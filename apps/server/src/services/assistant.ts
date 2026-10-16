import { and, asc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { calendarEvents } from "../models/calendar";
import type { LeadTask } from "../models/lead-tasks";
import { db } from "../utils/db";
import {
	formatMalaysiaShortDate,
	formatMalaysiaTime,
	malaysiaDayDiff,
	malaysiaDayKey,
	startOfMalaysiaDay,
} from "../utils/malaysia-time";
import type { AnsweredIntent, IntentResult } from "./assistant-intent";
import { getOpenTasksForAgentBefore } from "./lead-tasks";

/** "Next 3 days" = today plus the following two Malaysia calendar days. */
export const UPCOMING_DAYS = 3;
const MAX_EVENTS = 50;

export const SUPPORTED_HINT =
	"For this first version I can help with Today, Next 3 days, Overdue and Urgent work.";

export interface AssistantItem {
	kind: "task" | "event";
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

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function buildSummary(
	intent: AnsweredIntent,
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

/** Builds the answer from the agent's permitted tasks and calendar events. Dates are Malaysia time. */
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
		...base,
		summary: buildSummary(intent, overdueCount, windowCount),
		groups,
		totalCount: overdueCount + windowCount,
		overdueCount,
	};
}
