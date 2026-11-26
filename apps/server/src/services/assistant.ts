import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { calendarEvents } from "../models/calendar";
import {
	normalisePipelineStage,
	pipelineStageSchema,
	prospects,
	type PipelineStage,
} from "../models/crm";
import type { LeadTask } from "../models/lead-tasks";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import {
	formatMalaysiaShortDate,
	formatMalaysiaTime,
	malaysiaDayDiff,
	malaysiaDayKey,
	startOfMalaysiaDay,
} from "../utils/malaysia-time";
import {
	formatTransactionStatusLabel,
	normalizeTransactionStatus,
	type CanonicalTransactionStatus,
} from "../utils/transaction-status";
import {
	agentVisibleTransactionsSql,
	resolveViewerCommission,
} from "../utils/transaction-visibility";
import type { AnsweredIntent, IntentResult } from "./assistant-intent";
import { summarizeAgentPayoutDashboard } from "./commission-payouts";
import { buildAgentPersonalLeadsCondition } from "./leads";
import { getOpenTasksForAgentBefore } from "./lead-tasks";

/** "Next 3 days" = today plus the following two Malaysia calendar days. */
export const UPCOMING_DAYS = 3;
const MAX_EVENTS = 50;
const MAX_LEADS = 60;
const MAX_CASES = 60;
const MAX_ITEMS_PER_GROUP = 8;

/** Pipeline column order (active stages only). */
const PIPELINE_STAGE_ORDER: PipelineStage[] = [
	"new_lead",
	"first_follow_up",
	"second_follow_up",
	"third_follow_up",
	"fourth_follow_up",
	"potential_lead",
	"appointment_made",
	"need_consider",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
];

const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
	new_lead: "New Lead",
	first_follow_up: "1 First Follow Up",
	second_follow_up: "2 Second Follow Up",
	third_follow_up: "3 Third Follow Up",
	fourth_follow_up: "Last Follow Up (Can Recycle)",
	potential_lead: "Potential Lead",
	appointment_made: "Appointment Made",
	need_consider: "Need Consider",
	reject_project: "Reject Project",
	booking_made: "Booking Made",
	spam_fake_lead: "Spam/Fake Lead",
};

const CASE_STATUS_ORDER: CanonicalTransactionStatus[] = [
	"draft",
	"pending",
	"verified",
	"converted",
	"cancelled",
	"revoke",
	"void",
];

/** Cases that have not converted yet (still in the active case path). */
const PENDING_CASE_STATUSES: CanonicalTransactionStatus[] = [
	"draft",
	"pending",
	"verified",
];

/** Completed / converted cases (canonical + legacy completed). */
const COMPLETED_CASE_STATUSES: CanonicalTransactionStatus[] = ["converted"];

/** Dashboard-style “pending commission” statuses (owner share still open). */
const PENDING_COMMISSION_STATUSES = new Set([
	"approved",
	"under_review",
	"verified",
	"pending",
	"submitted",
]);

export const SUPPORTED_HINT =
	"I can help with Today, Next 3 days, Overdue, Urgent work, leads by stage, pending/all cases, completed cases, and commission summary.";

export interface AssistantItem {
	kind: "task" | "event" | "lead" | "case" | "stat";
	id: string;
	title: string;
	subtitle: string | null;
	priority: LeadTask["priority"] | null;
	at: string;
	timeLabel: string;
	href: string;
}

export interface AssistantGroup {
	key: string;
	label: string;
	items: AssistantItem[];
}

export interface AssistantAnswer extends IntentResult {
	summary: string;
	groups: AssistantGroup[];
	totalCount: number;
	overdueCount: number;
	generatedAt: string;
}

const TASK_TYPE_LABELS: Record<LeadTask["taskType"], string> = {
	call: "Call",
	email: "Email",
	follow_up: "Follow-up",
	meeting: "Meeting",
	other: "Task",
};

function dayLabel(now: Date, at: Date): string {
	const diff = malaysiaDayDiff(now, at);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	return formatMalaysiaShortDate(at);
}

function isMalaysiaMidnight(at: Date): boolean {
	return startOfMalaysiaDay(at).getTime() === at.getTime();
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatRm(amount: number): string {
	return `RM ${amount.toLocaleString("en-MY", {
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
}

function statItem(opts: {
	id: string;
	title: string;
	subtitle: string;
	timeLabel: string;
	href: string;
	at?: string;
}): AssistantItem {
	return {
		kind: "stat",
		id: opts.id,
		title: opts.title,
		subtitle: opts.subtitle,
		priority: null,
		at: opts.at ?? new Date(0).toISOString(),
		timeLabel: opts.timeLabel,
		href: opts.href,
	};
}

function taskToItem(now: Date, task: LeadTask, overdue: boolean): AssistantItem {
	const day = dayLabel(now, task.dueDate);
	const when = isMalaysiaMidnight(task.dueDate)
		? day
		: `${day}, ${formatMalaysiaTime(task.dueDate)}`;
	const subtitleParts = [
		task.prospectName ? `Lead: ${task.prospectName}` : null,
		TASK_TYPE_LABELS[task.taskType] ?? "Task",
	].filter(Boolean);

	return {
		kind: "task",
		id: task.id,
		title: task.title,
		subtitle: subtitleParts.join(" · "),
		priority: task.priority,
		at: task.dueDate.toISOString(),
		timeLabel: overdue ? `Due ${when.replace(/^Yesterday/, "yesterday")}` : when,
		href: `/dashboard/crm?lead=${encodeURIComponent(task.prospectId)}`,
	};
}

type CalendarEventRow = typeof calendarEvents.$inferSelect;

function eventToItem(now: Date, event: CalendarEventRow): AssistantItem {
	const day = dayLabel(now, event.startDate);
	const subtitle = event.location || event.description?.slice(0, 80) || null;
	return {
		kind: "event",
		id: event.id,
		title: event.title,
		subtitle,
		priority: null,
		at: event.startDate.toISOString(),
		timeLabel: event.isAllDay
			? `${day}, all day`
			: `${day}, ${formatMalaysiaTime(event.startDate)}`,
		href: "/dashboard/calendar",
	};
}

async function getEventsForAgentBetween(
	agentId: string,
	start: Date,
	end: Date,
): Promise<CalendarEventRow[]> {
	return db
		.select()
		.from(calendarEvents)
		.where(
			and(
				eq(calendarEvents.isActive, true),
				gte(calendarEvents.startDate, start),
				lt(calendarEvents.startDate, end),
				or(
					eq(calendarEvents.assignedToAgentId, agentId),
					isNull(calendarEvents.assignedToAgentId),
				) ?? sql`false`,
			),
		)
		.orderBy(asc(calendarEvents.startDate))
		.limit(MAX_EVENTS);
}

type LeadRow = {
	id: string;
	name: string;
	stage: string;
	property: string;
	status: string;
	updatedAt: Date;
};

async function getLeadsForAgent(agentId: string): Promise<LeadRow[]> {
	return db
		.select({
			id: prospects.id,
			name: prospects.name,
			stage: prospects.stage,
			property: prospects.property,
			status: prospects.status,
			updatedAt: prospects.updatedAt,
		})
		.from(prospects)
		.where(
			and(
				eq(prospects.leadType, "personal"),
				buildAgentPersonalLeadsCondition(agentId),
			),
		)
		.orderBy(desc(prospects.updatedAt))
		.limit(MAX_LEADS);
}

function leadToItem(lead: LeadRow): AssistantItem {
	const stage = normalisePipelineStage(lead.stage);
	return {
		kind: "lead",
		id: lead.id,
		title: lead.name,
		subtitle: lead.property || null,
		priority: null,
		at: lead.updatedAt.toISOString(),
		timeLabel: PIPELINE_STAGE_LABELS[stage] ?? stage,
		href: `/dashboard/crm?lead=${encodeURIComponent(lead.id)}`,
	};
}

type CaseRow = {
	id: string;
	caseNo: string | null;
	projectName: string | null;
	unitNo: string | null;
	status: string | null;
	propertyData: { address?: string | null } | null;
	updatedAt: Date;
	createdAt: Date;
};

async function getCasesForAgent(
	agentId: string,
	statusFilter?: CanonicalTransactionStatus[],
): Promise<CaseRow[]> {
	const visibility = agentVisibleTransactionsSql(agentId);
	const conditions = [visibility];

	if (statusFilter && statusFilter.length > 0) {
		const dbStatuses = [
			...new Set(
				statusFilter.flatMap((s) => {
					switch (s) {
						case "pending":
							return ["pending", "submitted", "under_review"] as const;
						case "verified":
							return ["verified", "approved", "commission_released"] as const;
						case "converted":
							return ["converted", "completed"] as const;
						case "cancelled":
							return ["cancelled", "rejected"] as const;
						default:
							return [s] as const;
					}
				}),
			),
		];
		conditions.push(inArray(transactions.status, dbStatuses as typeof transactions.status.enumValues));
	}

	return db
		.select({
			id: transactions.id,
			caseNo: transactions.caseNo,
			projectName: transactions.projectName,
			unitNo: transactions.unitNo,
			status: transactions.status,
			propertyData: transactions.propertyData,
			updatedAt: transactions.updatedAt,
			createdAt: transactions.createdAt,
		})
		.from(transactions)
		.where(and(...conditions))
		.orderBy(desc(transactions.updatedAt))
		.limit(MAX_CASES);
}

function caseToItem(row: CaseRow): AssistantItem {
	const status = normalizeTransactionStatus(row.status);
	const statusLabel = formatTransactionStatusLabel(row.status);
	const title =
		row.projectName?.trim() ||
		row.propertyData?.address?.trim() ||
		(row.caseNo ? `Case ${row.caseNo}` : "Untitled case");
	const subtitleParts = [
		row.caseNo ? `Case ${row.caseNo}` : null,
		row.unitNo ? `Unit ${row.unitNo}` : null,
		statusLabel,
	].filter(Boolean);

	return {
		kind: "case",
		id: row.id,
		title,
		subtitle: subtitleParts.join(" · "),
		priority: null,
		at: row.updatedAt.toISOString(),
		timeLabel: statusLabel,
		href: `/dashboard/transactions/${encodeURIComponent(row.id)}`,
	};
}

function buildScheduleSummary(
	intent: Extract<AnsweredIntent, "today" | "upcoming" | "overdue" | "urgent">,
	overdueCount: number,
	windowCount: number,
): string {
	const total = overdueCount + windowCount;
	switch (intent) {
		case "overdue":
			return total === 0
				? "You have no overdue tasks."
				: `You have ${plural(total, "overdue task")}.`;
		case "urgent":
			return total === 0
				? "You have no open tasks marked high or urgent."
				: `You have ${plural(total, "open task")} marked high or urgent.`;
		case "today":
		case "upcoming": {
			const period = intent === "today" ? "today" : `in the next ${UPCOMING_DAYS} days`;
			if (total === 0) return `Nothing due ${period}, and no overdue tasks.`;
			if (overdueCount === 0) return `You have ${plural(windowCount, "item")} ${period}.`;
			return `You have ${plural(total, "item")}: ${overdueCount} overdue and ${windowCount} ${period}.`;
		}
	}
}

async function buildScheduleAnswer(
	agentId: string,
	intent: Extract<AnsweredIntent, "today" | "upcoming" | "overdue" | "urgent">,
	intentResult: IntentResult,
	now: Date,
): Promise<AssistantAnswer> {
	const todayStart = startOfMalaysiaDay(now);
	const windowEnd =
		intent === "today"
			? startOfMalaysiaDay(now, 1)
			: intent === "upcoming"
				? startOfMalaysiaDay(now, UPCOMING_DAYS)
				: null;

	const [tasks, events] = await Promise.all([
		getOpenTasksForAgentBefore(
			agentId,
			intent === "overdue" ? todayStart : windowEnd,
			{ highPriorityOnly: intent === "urgent" },
		),
		windowEnd ? getEventsForAgentBetween(agentId, todayStart, windowEnd) : Promise.resolve([]),
	]);

	const overdueItems: AssistantItem[] = [];
	const byDay = new Map<string, AssistantItem[]>();
	const addToDay = (at: Date, item: AssistantItem) => {
		const key = malaysiaDayKey(at);
		const list = byDay.get(key) ?? [];
		list.push(item);
		byDay.set(key, list);
	};

	for (const task of tasks) {
		if (task.dueDate < todayStart) {
			overdueItems.push(taskToItem(now, task, true));
		} else {
			addToDay(task.dueDate, taskToItem(now, task, false));
		}
	}
	for (const event of events) {
		addToDay(event.startDate, eventToItem(now, event));
	}

	const groups: AssistantGroup[] = [];
	if (overdueItems.length > 0) {
		groups.push({ key: "overdue", label: "Overdue", items: overdueItems });
	}
	for (const key of [...byDay.keys()].sort()) {
		const items = (byDay.get(key) ?? []).sort((a, b) => a.at.localeCompare(b.at));
		const first = items[0];
		if (!first) continue;
		groups.push({ key, label: dayLabel(now, new Date(first.at)), items });
	}

	const overdueCount = overdueItems.length;
	const windowCount = groups.reduce((sum, g) => sum + g.items.length, 0) - overdueCount;

	return {
		...intentResult,
		generatedAt: now.toISOString(),
		summary: buildScheduleSummary(intent, overdueCount, windowCount),
		groups,
		totalCount: overdueCount + windowCount,
		overdueCount,
	};
}

async function buildLeadsByStageAnswer(
	agentId: string,
	intentResult: IntentResult,
	now: Date,
): Promise<AssistantAnswer> {
	const leads = await getLeadsForAgent(agentId);
	const byStage = new Map<PipelineStage, LeadRow[]>();

	for (const lead of leads) {
		const stage = normalisePipelineStage(lead.stage);
		const list = byStage.get(stage) ?? [];
		list.push(lead);
		byStage.set(stage, list);
	}

	const groups: AssistantGroup[] = [];
	for (const stage of PIPELINE_STAGE_ORDER) {
		const list = byStage.get(stage);
		if (!list || list.length === 0) continue;
		groups.push({
			key: stage,
			label: `${PIPELINE_STAGE_LABELS[stage]} (${list.length})`,
			items: list.slice(0, MAX_ITEMS_PER_GROUP).map(leadToItem),
		});
	}

	// Any unexpected stage values still get a group
	for (const [stage, list] of byStage) {
		if (PIPELINE_STAGE_ORDER.includes(stage)) continue;
		if (list.length === 0) continue;
		const parsed = pipelineStageSchema.safeParse(stage);
		const label = parsed.success
			? PIPELINE_STAGE_LABELS[parsed.data]
			: String(stage).replace(/_/g, " ");
		groups.push({
			key: stage,
			label: `${label} (${list.length})`,
			items: list.slice(0, MAX_ITEMS_PER_GROUP).map(leadToItem),
		});
	}

	const totalCount = leads.length;
	const stageCount = groups.length;
	const summary =
		totalCount === 0
			? "You have no personal leads in your CRM right now."
			: `You have ${plural(totalCount, "lead")} across ${plural(stageCount, "stage")}.`;

	return {
		...intentResult,
		generatedAt: now.toISOString(),
		summary,
		groups,
		totalCount,
		overdueCount: 0,
	};
}

function groupCasesByStatus(rows: CaseRow[]): AssistantGroup[] {
	const byStatus = new Map<CanonicalTransactionStatus | string, CaseRow[]>();
	for (const row of rows) {
		const status = normalizeTransactionStatus(row.status);
		const list = byStatus.get(status) ?? [];
		list.push(row);
		byStatus.set(status, list);
	}

	const groups: AssistantGroup[] = [];
	for (const status of CASE_STATUS_ORDER) {
		const list = byStatus.get(status);
		if (!list || list.length === 0) continue;
		groups.push({
			key: status,
			label: `${formatTransactionStatusLabel(status)} (${list.length})`,
			items: list.slice(0, MAX_ITEMS_PER_GROUP).map(caseToItem),
		});
	}
	for (const [status, list] of byStatus) {
		if (CASE_STATUS_ORDER.includes(status as CanonicalTransactionStatus)) continue;
		if (list.length === 0) continue;
		groups.push({
			key: String(status),
			label: `${formatTransactionStatusLabel(status)} (${list.length})`,
			items: list.slice(0, MAX_ITEMS_PER_GROUP).map(caseToItem),
		});
	}
	return groups;
}

async function buildCasesAnswer(
	agentId: string,
	intent: Extract<AnsweredIntent, "cases_pending" | "cases_by_status">,
	intentResult: IntentResult,
	now: Date,
): Promise<AssistantAnswer> {
	const rows =
		intent === "cases_pending"
			? await getCasesForAgent(agentId, PENDING_CASE_STATUSES)
			: await getCasesForAgent(agentId);

	const groups = groupCasesByStatus(rows);
	const totalCount = rows.length;

	let summary: string;
	if (intent === "cases_pending") {
		summary =
			totalCount === 0
				? "You have no pending cases that still need to convert."
				: `You have ${plural(totalCount, "case")} not converted yet (draft, pending, or verified).`;
	} else {
		summary =
			totalCount === 0
				? "You have no cases/projects visible in the portal."
				: `You have ${plural(totalCount, "case")} across ${plural(groups.length, "status")}.`;
	}

	return {
		...intentResult,
		generatedAt: now.toISOString(),
		summary,
		groups,
		totalCount,
		overdueCount: 0,
	};
}

async function buildCompletedCasesAnswer(
	agentId: string,
	intentResult: IntentResult,
	now: Date,
): Promise<AssistantAnswer> {
	const rows = await getCasesForAgent(agentId, COMPLETED_CASE_STATUSES);
	const groups =
		rows.length === 0
			? []
			: [
					{
						key: "converted",
						label: `Converted (${rows.length})`,
						items: rows.slice(0, MAX_ITEMS_PER_GROUP).map(caseToItem),
					},
				];

	return {
		...intentResult,
		generatedAt: now.toISOString(),
		summary:
			rows.length === 0
				? "You have no completed (converted) cases yet."
				: `You have ${plural(rows.length, "completed case")}.`,
		groups,
		totalCount: rows.length,
		overdueCount: 0,
	};
}

async function getCommissionOverview(agentId: string) {
	const visibility = agentVisibleTransactionsSql(agentId);
	const visibleRows = await db
		.select({
			agentId: transactions.agentId,
			status: transactions.status,
			commissionAmount: transactions.commissionAmount,
			coBrokingData: transactions.coBrokingData,
			commissionBreakdown: transactions.commissionBreakdown,
		})
		.from(transactions)
		.where(visibility);

	let totalCommission = 0;
	let pendingCommission = 0;
	let completedDeals = 0;
	for (const row of visibleRows) {
		const mine = resolveViewerCommission({
			viewerId: agentId,
			agentId: row.agentId,
			commissionAmount: row.commissionAmount,
			coBrokingData: row.coBrokingData,
			commissionBreakdown: row.commissionBreakdown,
		}).myCommissionAmount;
		totalCommission += mine;
		if (row.status && PENDING_COMMISSION_STATUSES.has(row.status)) {
			pendingCommission += mine;
		}
		const canonical = normalizeTransactionStatus(row.status);
		if (canonical === "converted") completedDeals += 1;
	}

	const payout = await summarizeAgentPayoutDashboard(agentId);

	return {
		totalCommission: Math.round(totalCommission * 100) / 100,
		pendingCommission: Math.round(pendingCommission * 100) / 100,
		completedDeals,
		visibleCaseCount: visibleRows.length,
		totalEarnedRm: Math.round(payout.totalEarnedRm * 100) / 100,
		totalReceivedRm: Math.round(payout.totalReceivedRm * 100) / 100,
		outstandingRm: Math.round(payout.outstandingRm * 100) / 100,
	};
}

async function buildCommissionSummaryAnswer(
	agentId: string,
	intentResult: IntentResult,
	now: Date,
): Promise<AssistantAnswer> {
	const [overview, completedRows] = await Promise.all([
		getCommissionOverview(agentId),
		getCasesForAgent(agentId, COMPLETED_CASE_STATUSES),
	]);

	const generatedAt = now.toISOString();
	const summaryItems: AssistantItem[] = [
		statItem({
			id: "total-commission",
			title: formatRm(overview.totalCommission),
			subtitle: "Your share across visible cases",
			timeLabel: "Total commission",
			href: "/dashboard/commissions",
			at: generatedAt,
		}),
		statItem({
			id: "pending-commission",
			title: formatRm(overview.pendingCommission),
			subtitle: "Still in pending / verified path",
			timeLabel: "Pending commission",
			href: "/dashboard/transactions",
			at: generatedAt,
		}),
		statItem({
			id: "completed-deals",
			title: String(overview.completedDeals),
			subtitle: "Converted / completed cases",
			timeLabel: "Completed cases",
			href: "/dashboard/transactions",
			at: generatedAt,
		}),
		statItem({
			id: "payout-earned",
			title: formatRm(overview.totalEarnedRm),
			subtitle: "From your commission payouts",
			timeLabel: "Payout earned",
			href: "/dashboard/commissions",
			at: generatedAt,
		}),
		statItem({
			id: "payout-received",
			title: formatRm(overview.totalReceivedRm),
			subtitle: "Marked paid",
			timeLabel: "Payout received",
			href: "/dashboard/commissions",
			at: generatedAt,
		}),
		statItem({
			id: "payout-outstanding",
			title: formatRm(overview.outstandingRm),
			subtitle: "Not paid yet",
			timeLabel: "Outstanding",
			href: "/dashboard/commissions",
			at: generatedAt,
		}),
	];

	const groups: AssistantGroup[] = [
		{ key: "summary", label: "Commission overview", items: summaryItems },
	];

	if (completedRows.length > 0) {
		groups.push({
			key: "converted",
			label: `Completed cases (${completedRows.length})`,
			items: completedRows.slice(0, MAX_ITEMS_PER_GROUP).map(caseToItem),
		});
	}

	const summary =
		overview.visibleCaseCount === 0 && overview.totalEarnedRm === 0
			? "No commission data yet for your visible cases and payouts."
			: `Commission: ${formatRm(overview.totalCommission)} total · ${formatRm(overview.pendingCommission)} pending · ${plural(overview.completedDeals, "completed case")}.`;

	return {
		...intentResult,
		generatedAt,
		summary,
		groups,
		totalCount: overview.completedDeals + summaryItems.length,
		overdueCount: 0,
	};
}

/** Builds the answer from the agent's permitted portal records. Dates are Malaysia time. */
export async function buildAssistantAnswer(
	agentId: string,
	intentResult: IntentResult,
	now = new Date(),
): Promise<AssistantAnswer> {
	const base = {
		...intentResult,
		generatedAt: now.toISOString(),
	};

	if (intentResult.intent === "unsupported") {
		return {
			...base,
			summary: SUPPORTED_HINT,
			groups: [],
			totalCount: 0,
			overdueCount: 0,
		};
	}

	const intent = intentResult.intent;

	if (
		intent === "today" ||
		intent === "upcoming" ||
		intent === "overdue" ||
		intent === "urgent"
	) {
		return buildScheduleAnswer(agentId, intent, intentResult, now);
	}

	if (intent === "leads_by_stage") {
		return buildLeadsByStageAnswer(agentId, intentResult, now);
	}

	if (intent === "cases_pending" || intent === "cases_by_status") {
		return buildCasesAnswer(agentId, intent, intentResult, now);
	}

	if (intent === "completed_cases") {
		return buildCompletedCasesAnswer(agentId, intentResult, now);
	}

	if (intent === "commission_summary") {
		return buildCommissionSummaryAnswer(agentId, intentResult, now);
	}

	return {
		...base,
		summary: SUPPORTED_HINT,
		groups: [],
		totalCount: 0,
		overdueCount: 0,
	};
}
