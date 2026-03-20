import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
	type ActivityEntry,
	type ActivityEventType,
	prospectActivityLog,
} from "../models/activity-timeline";
import { user } from "../models/auth";
import {
	type InsertProspect,
	crmProjects,
	crmTags,
	pipelineStageSchema,
	prospectNotes,
	prospectTags,
	prospects,
	selectProspectNoteSchema,
	selectProspectSchema,
} from "../models/crm";
import { db } from "../utils/db";

/**
 * Admin Leads Management Service
 * All functions here bypass agent-scoped filters — admin can see/manage all leads.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminLeadsFilter {
	search?: string;
	type?: "tenant" | "buyer";
	status?: "active" | "inactive" | "pending";
	stage?: string;
	leadType?: "personal" | "company";
	agentId?: string; // filter by a specific agent
	page?: number;
	limit?: number;
	sortBy?: "createdAt" | "updatedAt" | "name" | "stage";
	sortOrder?: "asc" | "desc";
}

export interface LeadWithAgent {
	id: string;
	name: string;
	email: string;
	phone: string;
	source: string;
	type: "tenant" | "buyer";
	property: string;
	projectId: string | null;
	projectName: string | null;
	status: "active" | "inactive" | "pending";
	stage: string;
	leadType: "personal" | "company";
	tags: string | null;
	lastContact: Date | null;
	nextContact: Date | null;
	agentId: string | null;
	agentName: string | null;
	agentEmail: string | null;
	tagIds: string[];
	tagNames: string[];
	createdAt: Date;
	updatedAt: Date;
}

export interface LeadsStatsAdmin {
	total: number;
	byStage: Record<string, number>;
	byType: { tenant: number; buyer: number };
	byLeadType: { personal: number; company: number };
	byStatus: { active: number; inactive: number; pending: number };
	unclaimedCompanyLeads: number;
	totalAgentsWithLeads: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise legacy "owner" prospect_type → "buyer" */
function normaliseType(raw: string): "tenant" | "buyer" {
	return (raw as string) === "owner" ? "buyer" : (raw as "tenant" | "buyer");
}

/**
 * Internal helper — insert one activity log row.
 * Silently swallows errors so a logging failure never breaks the main action.
 */
async function logActivity(opts: {
	prospectId: string;
	eventType: ActivityEventType;
	actorId: string;
	content?: string;
	metadata?: Record<string, string>;
}) {
	try {
		await db.insert(prospectActivityLog).values({
			prospectId: opts.prospectId,
			eventType: opts.eventType,
			actorId: opts.actorId,
			content: opts.content ?? null,
			metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
		});
	} catch {
		// Logging must never break the main operation
	}
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get all leads (admin — no agent restriction) with filters and pagination.
 */
export async function getAllLeadsAdmin(filter: AdminLeadsFilter = {}) {
	const {
		search,
		type,
		status,
		stage,
		leadType,
		agentId,
		page = 1,
		limit = 20,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = filter;

	const conditions: SQL[] = [];

	if (search) {
		const cond = or(
			ilike(prospects.name, `%${search}%`),
			ilike(prospects.email, `%${search}%`),
			ilike(prospects.phone, `%${search}%`),
		);
		if (cond) conditions.push(cond);
	}

	if (type) conditions.push(eq(prospects.type, type));
	if (status) conditions.push(eq(prospects.status, status));
	if (stage) {
		const parsed = pipelineStageSchema.safeParse(stage);
		if (parsed.success) conditions.push(eq(prospects.stage, parsed.data));
	}
	if (leadType) conditions.push(eq(prospects.leadType, leadType));
	if (agentId) {
		if (agentId === "__unassigned__") {
			conditions.push(isNull(prospects.agentId));
		} else {
			conditions.push(eq(prospects.agentId, agentId));
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Count
	const [countRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(prospects)
		.where(whereClause);

	const total = Number(countRow?.count ?? 0);
	const offset = (page - 1) * limit;

	// Sort column mapping
	const sortColumn =
		{
			createdAt: prospects.createdAt,
			updatedAt: prospects.updatedAt,
			name: prospects.name,
			stage: prospects.stage,
		}[sortBy] ?? prospects.createdAt;

	const orderFn = sortOrder === "asc" ? asc : desc;

	// Main query
	const rows = await db
		.select({
			prospect: prospects,
			agentName: user.name,
			agentEmail: user.email,
			projectName: crmProjects.name,
		})
		.from(prospects)
		.leftJoin(user, eq(prospects.agentId, user.id))
		.leftJoin(crmProjects, eq(prospects.projectId, crmProjects.id))
		.where(whereClause)
		.orderBy(orderFn(sortColumn))
		.limit(limit)
		.offset(offset);

	// Tags
	const prospectIds = rows.map((r) => r.prospect.id);
	let tagsData: Array<{ prospectId: string; tagId: string; tagName: string }> =
		[];
	if (prospectIds.length > 0) {
		try {
			const rawTags = await db
				.select({
					prospectId: prospectTags.prospectId,
					tagId: crmTags.id,
					tagName: crmTags.name,
				})
				.from(prospectTags)
				.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
				.where(
					prospectIds.length === 1
						? eq(prospectTags.prospectId, prospectIds[0])
						: sql`${prospectTags.prospectId} = ANY(ARRAY[${sql.join(
								prospectIds.map((id) => sql`${id}::uuid`),
								sql`, `,
							)}])`,
				);
			tagsData = rawTags;
		} catch {
			// Tags tables might not be migrated yet — skip gracefully
		}
	}

	const tagsByProspect: Record<string, { ids: string[]; names: string[] }> = {};
	for (const t of tagsData) {
		if (!tagsByProspect[t.prospectId]) {
			tagsByProspect[t.prospectId] = { ids: [], names: [] };
		}
		tagsByProspect[t.prospectId].ids.push(t.tagId);
		tagsByProspect[t.prospectId].names.push(t.tagName);
	}

	const leads: LeadWithAgent[] = rows.map((r) => {
		const parsed = selectProspectSchema.parse({
			...r.prospect,
			type: normaliseType(r.prospect.type),
			stage: r.prospect.stage ?? "new_lead",
			leadType: r.prospect.leadType ?? "personal",
		});
		return {
			...parsed,
			projectName: r.projectName ?? null,
			agentName: r.agentName ?? null,
			agentEmail: r.agentEmail ?? null,
			tagIds: tagsByProspect[r.prospect.id]?.ids ?? [],
			tagNames: tagsByProspect[r.prospect.id]?.names ?? [],
		};
	});

	return {
		leads,
		pagination: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
	};
}

/**
 * Get a single lead by ID — admin can access any lead.
 */
export async function getLeadByIdAdmin(leadId: string) {
	const [row] = await db
		.select({
			prospect: prospects,
			agentName: user.name,
			agentEmail: user.email,
			projectName: crmProjects.name,
		})
		.from(prospects)
		.leftJoin(user, eq(prospects.agentId, user.id))
		.leftJoin(crmProjects, eq(prospects.projectId, crmProjects.id))
		.where(eq(prospects.id, leadId))
		.limit(1);

	if (!row) return null;

	// Notes
	const noteRows = await db
		.select({
			note: prospectNotes,
			agentName: user.name,
		})
		.from(prospectNotes)
		.leftJoin(user, eq(prospectNotes.agentId, user.id))
		.where(eq(prospectNotes.prospectId, leadId))
		.orderBy(desc(prospectNotes.createdAt));

	// Tags
	let tagRows: Array<{ tagId: string; tagName: string }> = [];
	try {
		tagRows = await db
			.select({ tagId: crmTags.id, tagName: crmTags.name })
			.from(prospectTags)
			.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
			.where(eq(prospectTags.prospectId, leadId));
	} catch {
		// skip if tables not ready
	}

	const parsed = selectProspectSchema.parse({
		...row.prospect,
		type: normaliseType(row.prospect.type),
		stage: row.prospect.stage ?? "new_lead",
		leadType: row.prospect.leadType ?? "personal",
	});

	return {
		lead: {
			...parsed,
			projectName: row.projectName ?? null,
			agentName: row.agentName ?? null,
			agentEmail: row.agentEmail ?? null,
			tagIds: tagRows.map((t) => t.tagId),
			tagNames: tagRows.map((t) => t.tagName),
		},
		notes: noteRows.map((n) => ({
			...selectProspectNoteSchema.parse(n.note),
			agentName: n.agentName ?? "Unknown",
		})),
	};
}

/**
 * Admin update a lead (any field, any agent's lead).
 */
export async function updateLeadAdmin(
	leadId: string,
	data: Partial<InsertProspect> & { tagIds?: string[]; _actorId?: string },
) {
	const { tagIds, _actorId, ...updateFields } = data;

	// Fetch old record for diff-logging
	const [before] = await db
		.select()
		.from(prospects)
		.where(eq(prospects.id, leadId))
		.limit(1);

	const [updated] = await db
		.update(prospects)
		.set({ ...updateFields, updatedAt: new Date() })
		.where(eq(prospects.id, leadId))
		.returning();

	if (!updated) throw new Error("Lead not found");

	// Update tags if provided
	if (tagIds !== undefined) {
		await db.delete(prospectTags).where(eq(prospectTags.prospectId, leadId));
		if (tagIds.length > 0) {
			await db
				.insert(prospectTags)
				.values(tagIds.map((tagId) => ({ prospectId: leadId, tagId })));
		}
	}

	// Log stage change separately for clarity
	if (_actorId && before) {
		if (updateFields.stage && updateFields.stage !== before.stage) {
			await logActivity({
				prospectId: leadId,
				eventType: "stage_changed",
				actorId: _actorId,
				content: `Stage changed from "${before.stage}" to "${updateFields.stage}"`,
				metadata: { from: before.stage, to: updateFields.stage },
			});
		} else {
			// Generic update log (only if something actually changed)
			const changed = Object.keys(updateFields).filter(
				(k) =>
					k !== "updatedAt" &&
					(before as Record<string, unknown>)[k] !==
						(updateFields as Record<string, unknown>)[k],
			);
			if (changed.length > 0) {
				await logActivity({
					prospectId: leadId,
					eventType: "lead_updated",
					actorId: _actorId,
					content: `Updated: ${changed.join(", ")}`,
				});
			}
		}
	}

	return updated;
}

/**
 * Admin delete a lead.
 */
export async function deleteLeadAdmin(leadId: string) {
	const [deleted] = await db
		.delete(prospects)
		.where(eq(prospects.id, leadId))
		.returning({ id: prospects.id });

	if (!deleted) throw new Error("Lead not found");
	return { success: true, id: deleted.id };
}

/**
 * Assign / reassign a lead to an agent (or unassign by passing null).
 */
export async function assignLeadAdmin(
	leadId: string,
	agentId: string | null,
	actorId?: string,
) {
	// Fetch current agent for diff
	const [before] = await db
		.select({ agentId: prospects.agentId })
		.from(prospects)
		.where(eq(prospects.id, leadId))
		.limit(1);

	const [updated] = await db
		.update(prospects)
		.set({ agentId, updatedAt: new Date() })
		.where(eq(prospects.id, leadId))
		.returning();

	if (!updated) throw new Error("Lead not found");

	if (actorId) {
		// Resolve new agent name for a readable log entry
		let newAgentName = "Unassigned";
		if (agentId) {
			const [agentRow] = await db
				.select({ name: user.name, email: user.email })
				.from(user)
				.where(eq(user.id, agentId))
				.limit(1);
			newAgentName = agentRow?.name ?? agentRow?.email ?? agentId;
		}

		let oldAgentName = "Unassigned";
		if (before?.agentId) {
			const [oldAgentRow] = await db
				.select({ name: user.name, email: user.email })
				.from(user)
				.where(eq(user.id, before.agentId))
				.limit(1);
			oldAgentName = oldAgentRow?.name ?? oldAgentRow?.email ?? before.agentId;
		}

		await logActivity({
			prospectId: leadId,
			eventType: "lead_assigned",
			actorId,
			content: `Lead reassigned from "${oldAgentName}" to "${newAgentName}"`,
			metadata: {
				from: before?.agentId ?? "unassigned",
				to: agentId ?? "unassigned",
				fromName: oldAgentName,
				toName: newAgentName,
			},
		});
	}

	return updated;
}

/**
 * Admin create a new lead (can specify agentId directly).
 */
export async function createLeadAdmin(
	data: InsertProspect & {
		agentId?: string | null;
		tagIds?: string[];
		_actorId?: string;
	},
) {
	const { tagIds, _actorId, ...insertData } = data;

	const [created] = await db.insert(prospects).values(insertData).returning();

	if (tagIds && tagIds.length > 0) {
		try {
			await db
				.insert(prospectTags)
				.values(tagIds.map((tagId) => ({ prospectId: created.id, tagId })));
		} catch {
			// skip tag errors
		}
	}

	if (_actorId) {
		await logActivity({
			prospectId: created.id,
			eventType: "lead_updated",
			actorId: _actorId,
			content: `Lead created: ${created.name}`,
		});
	}

	return created;
}

/**
 * Bulk update the pipeline stage for multiple leads.
 */
export async function bulkUpdateLeadsStageAdmin(
	leadIds: string[],
	stage: string,
) {
	const parsed = pipelineStageSchema.safeParse(stage);
	if (!parsed.success) throw new Error("Invalid stage value");

	await db
		.update(prospects)
		.set({ stage: parsed.data, updatedAt: new Date() })
		.where(
			sql`${prospects.id} = ANY(ARRAY[${sql.join(
				leadIds.map((id) => sql`${id}::uuid`),
				sql`, `,
			)}])`,
		);

	return { success: true, updated: leadIds.length };
}

/**
 * Add a note to any lead (admin author).
 */
export async function addNoteToLeadAdmin(
	leadId: string,
	content: string,
	adminId: string,
) {
	const [note] = await db
		.insert(prospectNotes)
		.values({ prospectId: leadId, content, agentId: adminId })
		.returning();

	await logActivity({
		prospectId: leadId,
		eventType: "note_added",
		actorId: adminId,
		content,
	});

	return note;
}

/**
 * Log a call interaction for a lead.
 */
export async function logCallForLeadAdmin(
	leadId: string,
	content: string,
	actorId: string,
) {
	await logActivity({
		prospectId: leadId,
		eventType: "call_logged",
		actorId,
		content,
	});
	// Also update lastContact timestamp
	await db
		.update(prospects)
		.set({ lastContact: new Date(), updatedAt: new Date() })
		.where(eq(prospects.id, leadId));
}

/**
 * Log an email interaction for a lead.
 */
export async function logEmailForLeadAdmin(
	leadId: string,
	content: string,
	actorId: string,
) {
	await logActivity({
		prospectId: leadId,
		eventType: "email_sent",
		actorId,
		content,
	});
}

/**
 * Get the full unified activity timeline for a lead, newest first.
 *
 * Merges two sources:
 *  1. prospect_activity_log  — new structured events (stage changes, assignments, calls, emails, notes)
 *  2. prospect_notes         — legacy notes created before activity logging existed
 *
 * Legacy notes are deduplicated: if a note was already logged to prospect_activity_log
 * (i.e. added via addNoteToLeadAdmin after the new system was deployed), it won't
 * appear twice because the note_added log entry carries the same content.
 * To keep it simple we show all legacy notes whose created_at is BEFORE the earliest
 * activity_log entry for that lead, so there is no visual duplication.
 */
export async function getLeadActivityAdmin(
	leadId: string,
): Promise<ActivityEntry[]> {
	// ── 1. Fetch new activity log entries ────────────────────────────────────
	let activityEntries: ActivityEntry[] = [];
	let earliestActivityLogDate: Date | null = null;

	try {
		const rows = await db
			.select({
				activity: prospectActivityLog,
				actorName: user.name,
				actorEmail: user.email,
			})
			.from(prospectActivityLog)
			.leftJoin(user, eq(prospectActivityLog.actorId, user.id))
			.where(eq(prospectActivityLog.prospectId, leadId))
			.orderBy(desc(prospectActivityLog.createdAt));

		activityEntries = rows.map((r) => ({
			id: r.activity.id,
			prospectId: r.activity.prospectId,
			eventType: r.activity.eventType,
			actorId: r.activity.actorId,
			actorName: r.actorName ?? r.actorEmail ?? "Unknown",
			content: r.activity.content ?? null,
			metadata: r.activity.metadata
				? (() => {
						try {
							return JSON.parse(r.activity.metadata) as Record<string, string>;
						} catch {
							return null;
						}
					})()
				: null,
			createdAt: r.activity.createdAt,
		}));

		// Track the earliest log entry so we know which legacy notes to include
		if (rows.length > 0) {
			const dates = rows.map((r) => r.activity.createdAt.getTime());
			earliestActivityLogDate = new Date(Math.min(...dates));
		}
	} catch {
		// prospect_activity_log table not created yet — continue with legacy notes only
	}

	// ── 2. Fetch legacy notes from prospect_notes ─────────────────────────────
	// Include ALL notes if there are no activity log entries yet, otherwise only
	// include notes created before the activity log started (to avoid duplicates
	// since addNoteToLeadAdmin now writes to BOTH tables).
	try {
		const noteRows = await db
			.select({
				note: prospectNotes,
				agentName: user.name,
				agentEmail: user.email,
			})
			.from(prospectNotes)
			.leftJoin(user, eq(prospectNotes.agentId, user.id))
			.where(
				earliestActivityLogDate
					? and(
							eq(prospectNotes.prospectId, leadId),
							sql`${prospectNotes.createdAt} < ${earliestActivityLogDate.toISOString()}`,
						)
					: eq(prospectNotes.prospectId, leadId),
			)
			.orderBy(desc(prospectNotes.createdAt));

		const legacyNoteEntries: ActivityEntry[] = noteRows.map((r) => ({
			id: `note-${r.note.id}`, // prefix to avoid UUID collision with activity_log ids
			prospectId: r.note.prospectId,
			eventType: "note_added" as const,
			actorId: r.note.agentId,
			actorName: r.agentName ?? r.agentEmail ?? "Unknown",
			content: r.note.content,
			metadata: null,
			createdAt: r.note.createdAt,
		}));

		activityEntries = [...activityEntries, ...legacyNoteEntries];
	} catch {
		// prospect_notes table issue — skip
	}

	// ── 3. Sort all entries newest-first and return ───────────────────────────
	activityEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

	return activityEntries;
}

/**
 * Check if an email or phone number is already in use by another lead.
 * Pass excludeId when editing an existing lead so the lead doesn't conflict with itself.
 */
export async function checkLeadDuplicateAdmin(
	email: string,
	phone: string,
	excludeId?: string,
) {
	// Normalise: trim and lowercase email, strip spaces from phone
	const normEmail = email.trim().toLowerCase();
	const normPhone = phone.trim().replace(/\s+/g, "");

	const [emailRow] = await db
		.select({ id: prospects.id, name: prospects.name })
		.from(prospects)
		.where(
			excludeId
				? and(
						sql`lower(${prospects.email}) = ${normEmail}`,
						sql`${prospects.id} != ${excludeId}::uuid`,
					)
				: sql`lower(${prospects.email}) = ${normEmail}`,
		)
		.limit(1);

	const [phoneRow] = await db
		.select({ id: prospects.id, name: prospects.name })
		.from(prospects)
		.where(
			excludeId
				? and(
						sql`replace(${prospects.phone}, ' ', '') = ${normPhone}`,
						sql`${prospects.id} != ${excludeId}::uuid`,
					)
				: sql`replace(${prospects.phone}, ' ', '') = ${normPhone}`,
		)
		.limit(1);

	return {
		emailTaken: !!emailRow,
		emailConflictName: emailRow?.name ?? null,
		phoneTaken: !!phoneRow,
		phoneConflictName: phoneRow?.name ?? null,
	};
}

/**
 * Get aggregated stats for the admin leads dashboard.
 */
export async function getLeadsStatsAdmin(): Promise<LeadsStatsAdmin> {
	// Total count
	const [totalRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(prospects);

	// By stage
	const stageRows = await db
		.select({
			stage: prospects.stage,
			count: sql<number>`count(*)`,
		})
		.from(prospects)
		.groupBy(prospects.stage);

	// By type
	const typeRows = await db
		.select({
			type: prospects.type,
			count: sql<number>`count(*)`,
		})
		.from(prospects)
		.groupBy(prospects.type);

	// By lead type
	const leadTypeRows = await db
		.select({
			leadType: prospects.leadType,
			count: sql<number>`count(*)`,
		})
		.from(prospects)
		.groupBy(prospects.leadType);

	// By status
	const statusRows = await db
		.select({
			status: prospects.status,
			count: sql<number>`count(*)`,
		})
		.from(prospects)
		.groupBy(prospects.status);

	// Unclaimed company leads
	const [unclaimedRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(prospects)
		.where(and(eq(prospects.leadType, "company"), isNull(prospects.agentId)));

	// Total agents that have leads
	const [agentsRow] = await db
		.select({ count: sql<number>`count(distinct ${prospects.agentId})` })
		.from(prospects)
		.where(sql`${prospects.agentId} is not null`);

	const byStage: Record<string, number> = {};
	for (const row of stageRows) {
		byStage[row.stage] = Number(row.count);
	}

	const byType = { tenant: 0, buyer: 0 };
	for (const row of typeRows) {
		const t = normaliseType(row.type);
		byType[t] = (byType[t] ?? 0) + Number(row.count);
	}

	const byLeadType = { personal: 0, company: 0 };
	for (const row of leadTypeRows) {
		const lt = row.leadType as "personal" | "company";
		byLeadType[lt] = (byLeadType[lt] ?? 0) + Number(row.count);
	}

	const byStatus = { active: 0, inactive: 0, pending: 0 };
	for (const row of statusRows) {
		const s = row.status as "active" | "inactive" | "pending";
		byStatus[s] = (byStatus[s] ?? 0) + Number(row.count);
	}

	return {
		total: Number(totalRow?.count ?? 0),
		byStage,
		byType,
		byLeadType,
		byStatus,
		unclaimedCompanyLeads: Number(unclaimedRow?.count ?? 0),
		totalAgentsWithLeads: Number(agentsRow?.count ?? 0),
	};
}

/**
 * Get list of agents who have at least one lead (for filter dropdown).
 */
export async function getAgentsWithLeads() {
	const rows = await db
		.selectDistinct({
			agentId: user.id,
			agentName: user.name,
			agentEmail: user.email,
		})
		.from(prospects)
		.innerJoin(user, eq(prospects.agentId, user.id))
		.orderBy(asc(user.name));

	return rows;
}
