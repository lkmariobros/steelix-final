import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { isAssignableLeadAgentRole } from "../utils/user-roles";
import type { SQL } from "drizzle-orm";
import {
	type ActivityEntry,
	type ActivityEventType,
	prospectActivityLog,
} from "../models/activity-timeline";
import { user } from "../models/auth";
import {
	type InsertProspect,
	type LeadType,
	type PipelineStage,
	type ProspectStatus,
	type ProspectType,
	crmProjects,
	crmTags,
	insertProspectSchema,
	leadTypeSchema,
	normalisePipelineStage,
	pipelineStageSchema,
	prospectNotes,
	prospectFollowers,
	prospectTags,
	prospects,
	prospectStatusSchema,
	prospectTypeSchema,
	selectProspectNoteSchema,
	selectProspectSchema,
} from "../models/crm";
import { db } from "../utils/db";
import { withPipelineStageSchemaRetry } from "../utils/pipeline-stage-schema";
import { withProspectNotesSchemaRetry } from "../utils/prospect-notes-schema";

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
	email: string | null;
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
	notes: string | null;
	lastContact: Date | null;
	nextContact: Date | null;
	agentId: string | null;
	agentName: string | null;
	agentEmail: string | null;
	tagIds: string[];
	tagNames: string[];
	followerIds: string[];
	followerNames: string[];
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

const LEAD_INACTIVITY_DAYS = 5;

async function autoMarkInactiveLeads() {
	// Default status is "active" on import/create.
	// If there is no update to Notes/Stage for 5 days, mark lead as inactive.
	// When Notes/Stage are updated again, mutations set status back to active.
	const cutoff = new Date(Date.now() - LEAD_INACTIVITY_DAYS * 86_400_000);
	try {
		await db
			.update(prospects)
			.set({ status: "inactive", updatedAt: new Date() })
			.where(
				and(
					eq(prospects.status, "active"),
					sql`${prospects.updatedAt} <= ${cutoff}`,
				),
			);
	} catch {
		// never block UX
	}
}

/**
 * Get all leads (admin — no agent restriction) with filters and pagination.
 */
export async function getAllLeadsAdmin(filter: AdminLeadsFilter = {}) {
	try {
		await autoMarkInactiveLeads();
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
			sql`coalesce(${prospects.email}, '') ilike ${`%${search}%`}`,
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
			agentName: agentLeadDisplayNameSql,
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

	const followersByProspect = await fetchFollowersByProspectIds(prospectIds);

	const leads: LeadWithAgent[] = rows.map((r) => {
		const parsed = selectProspectSchema.parse({
			...r.prospect,
			type: normaliseType(r.prospect.type),
			stage: normalisePipelineStage(r.prospect.stage),
			leadType: r.prospect.leadType ?? "personal",
		});
		return {
			...parsed,
			notes: parsed.notes ?? null,
			projectName: r.projectName ?? null,
			agentName: r.agentName ?? null,
			agentEmail: r.agentEmail ?? null,
			tagIds: tagsByProspect[r.prospect.id]?.ids ?? [],
			tagNames: tagsByProspect[r.prospect.id]?.names ?? [],
			followerIds: followersByProspect[r.prospect.id]?.ids ?? [],
			followerNames: followersByProspect[r.prospect.id]?.names ?? [],
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
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		// Common when code schema is ahead of the DB schema.
		if (
			/column .*notes.* does not exist/i.test(msg) ||
			/column .*email.* does not exist/i.test(msg) ||
			/invalid input value for enum pipeline_stage/i.test(msg)
		) {
			throw new Error(
				`Leads query failed because the DB schema is out of date. Please apply the latest leads schema patch (prospects.notes, nullable email, pipeline_stage values). Original error: ${msg}`,
			);
		}
		throw e;
	}
}

type FollowersByProspect = Record<
	string,
	{ ids: string[]; names: string[] }
>;

export async function fetchFollowersByProspectIds(
	prospectIds: string[],
): Promise<FollowersByProspect> {
	const result: FollowersByProspect = {};
	if (prospectIds.length === 0) return result;

	try {
		const rows = await db
			.select({
				prospectId: prospectFollowers.prospectId,
				userId: user.id,
				userName: agentLeadDisplayNameSql,
				userEmail: user.email,
			})
			.from(prospectFollowers)
			.innerJoin(user, eq(prospectFollowers.userId, user.id))
			.where(
				prospectIds.length === 1
					? eq(prospectFollowers.prospectId, prospectIds[0])
					: sql`${prospectFollowers.prospectId} = ANY(ARRAY[${sql.join(
							prospectIds.map((id) => sql`${id}::uuid`),
							sql`, `,
						)}])`,
			);

		for (const row of rows) {
			if (!result[row.prospectId]) {
				result[row.prospectId] = { ids: [], names: [] };
			}
			result[row.prospectId].ids.push(row.userId);
			result[row.prospectId].names.push(
				row.userName ?? row.userEmail ?? row.userId,
			);
		}
	} catch {
		// Table may not be migrated yet
	}

	return result;
}

export async function getProspectFollowers(prospectId: string) {
	const byProspect = await fetchFollowersByProspectIds([prospectId]);
	return byProspect[prospectId] ?? { ids: [], names: [] };
}

export async function isAgentProspectFollower(
	prospectId: string,
	agentId: string,
): Promise<boolean> {
	try {
		const [row] = await db
			.select({ id: prospectFollowers.id })
			.from(prospectFollowers)
			.where(
				and(
					eq(prospectFollowers.prospectId, prospectId),
					eq(prospectFollowers.userId, agentId),
				),
			)
			.limit(1);
		return !!row;
	} catch {
		return false;
	}
}

/** Agent can access if they own the lead, follow it, or (optionally) it's unclaimed company pool. */
export async function canAgentAccessProspect(
	prospectId: string,
	agentId: string,
	opts?: { allowUnclaimedCompany?: boolean },
): Promise<boolean> {
	const [row] = await db
		.select({
			agentId: prospects.agentId,
			leadType: prospects.leadType,
		})
		.from(prospects)
		.where(eq(prospects.id, prospectId))
		.limit(1);

	if (!row) return false;
	if (row.agentId === agentId) return true;
	if (
		opts?.allowUnclaimedCompany &&
		row.leadType === "company" &&
		row.agentId === null
	) {
		return true;
	}
	return isAgentProspectFollower(prospectId, agentId);
}

/** SQL condition for agent "My Leads" tab: assigned or followed. */
export function buildAgentPersonalLeadsCondition(agentId: string): SQL {
	return (
		or(
			eq(prospects.agentId, agentId),
			inArray(
				prospects.id,
				db
					.select({ id: prospectFollowers.prospectId })
					.from(prospectFollowers)
					.where(eq(prospectFollowers.userId, agentId)),
			),
		) ?? sql`false`
	);
}

export async function setProspectFollowers(
	prospectId: string,
	followerIds: string[],
	actorId?: string,
) {
	const [prospect] = await db
		.select({ agentId: prospects.agentId })
		.from(prospects)
		.where(eq(prospects.id, prospectId))
		.limit(1);

	if (!prospect) throw new Error("Lead not found");

	const uniqueIds = [...new Set(followerIds)];
	for (const followerId of uniqueIds) {
		await assertAssignableLeadAgent(followerId);
	}

	const before = await getProspectFollowers(prospectId);

	try {
		await db
			.delete(prospectFollowers)
			.where(eq(prospectFollowers.prospectId, prospectId));
		if (uniqueIds.length > 0) {
			await db.insert(prospectFollowers).values(
				uniqueIds.map((userId) => ({ prospectId, userId })),
			);
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/prospect_followers/i.test(msg) && /does not exist/i.test(msg)) {
			throw new Error(
				"Lead followers table is missing. Run apps/server/sql/prospect-followers-setup.sql on your database.",
			);
		}
		throw e;
	}

	if (actorId) {
		const beforeLabel =
			before.names.length > 0 ? before.names.join(", ") : "None";
		const after = await getProspectFollowers(prospectId);
		const afterLabel =
			after.names.length > 0 ? after.names.join(", ") : "None";

		if (beforeLabel !== afterLabel) {
			await logActivity({
				prospectId,
				eventType: "lead_updated",
				actorId,
				content: `Followers updated from "${beforeLabel}" to "${afterLabel}"`,
				metadata: {
					field: "followers",
					from: beforeLabel,
					to: afterLabel,
				},
			});
		}
	}

	return getProspectFollowers(prospectId);
}

/**
 * Set lead categories from admin-managed tags only (junction table).
 */
export async function setProspectTagIds(
	prospectId: string,
	tagIds: string[],
	actorId?: string,
) {
	const uniqueTagIds = [...new Set(tagIds)];

	if (uniqueTagIds.length > 0) {
		const existing = await db
			.select({ id: crmTags.id, name: crmTags.name })
			.from(crmTags)
			.where(inArray(crmTags.id, uniqueTagIds));
		if (existing.length !== uniqueTagIds.length) {
			throw new Error(
				"One or more categories are invalid. Choose from admin-defined categories only.",
			);
		}
	}

	let beforeNames: string[] = [];
	try {
		const beforeRows = await db
			.select({ tagName: crmTags.name })
			.from(prospectTags)
			.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
			.where(eq(prospectTags.prospectId, prospectId));
		beforeNames = beforeRows.map((r) => r.tagName);
	} catch {
		// tags table may be missing
	}

	await db.delete(prospectTags).where(eq(prospectTags.prospectId, prospectId));
	if (uniqueTagIds.length > 0) {
		await db
			.insert(prospectTags)
			.values(uniqueTagIds.map((tagId) => ({ prospectId, tagId })));
	}
	await db
		.update(prospects)
		.set({ tags: null, updatedAt: new Date() })
		.where(eq(prospects.id, prospectId));

	const afterRows =
		uniqueTagIds.length > 0
			? await db
					.select({ id: crmTags.id, name: crmTags.name })
					.from(crmTags)
					.where(inArray(crmTags.id, uniqueTagIds))
			: [];

	const afterNames = afterRows.map((r) => r.name);
	const beforeLabel = beforeNames.length > 0 ? beforeNames.join(", ") : "None";
	const afterLabel = afterNames.length > 0 ? afterNames.join(", ") : "None";

	if (actorId && beforeLabel !== afterLabel) {
		await logActivity({
			prospectId,
			eventType: "lead_updated",
			actorId,
			content: `Categories updated from "${beforeLabel}" to "${afterLabel}"`,
			metadata: {
				field: "categories",
				from: beforeLabel,
				to: afterLabel,
			},
		});
	}

	return {
		tagIds: afterRows.map((r) => r.id),
		tagNames: afterNames,
	};
}

/**
 * Get a single lead by ID — admin can access any lead.
 */
export async function getLeadByIdAdmin(leadId: string) {
	const [row] = await db
		.select({
			prospect: prospects,
			agentName: agentLeadDisplayNameSql,
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
	const noteRows = await withProspectNotesSchemaRetry(() =>
		db
			.select({
				note: prospectNotes,
				agentName: agentLeadDisplayNameSql,
			})
			.from(prospectNotes)
			.leftJoin(user, eq(prospectNotes.agentId, user.id))
			.where(eq(prospectNotes.prospectId, leadId))
			.orderBy(desc(prospectNotes.createdAt)),
	);

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

	const followers = await getProspectFollowers(leadId);

	const parsed = selectProspectSchema.parse({
		...row.prospect,
		type: normaliseType(row.prospect.type),
		stage: normalisePipelineStage(row.prospect.stage),
		leadType: row.prospect.leadType ?? "personal",
	});

	return {
		lead: {
			...parsed,
			notes: parsed.notes ?? null,
			projectName: row.projectName ?? null,
			agentName: row.agentName ?? null,
			agentEmail: row.agentEmail ?? null,
			tagIds: tagRows.map((t) => t.tagId),
			tagNames: tagRows.map((t) => t.tagName),
			followerIds: followers.ids,
			followerNames: followers.names,
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
	data: Partial<InsertProspect> & {
		tagIds?: string[];
		_actorId?: string;
		agentId?: string | null;
	},
) {
	const { tagIds, _actorId, ...updateFields } = data;

	if (updateFields.agentId) {
		await assertAssignableLeadAgent(updateFields.agentId);
	}

	// Reactivate on Notes/Stage updates (unless admin explicitly sets status).
	const touchedByAgent =
		updateFields.stage !== undefined ||
		updateFields.notes !== undefined ||
		updateFields.lastContact !== undefined ||
		updateFields.nextContact !== undefined;
	if (updateFields.status === undefined && touchedByAgent) {
		updateFields.status = "active";
	}

	// Fetch old record for diff-logging
	const [before] = await db
		.select()
		.from(prospects)
		.where(eq(prospects.id, leadId))
		.limit(1);

	const [updated] = await withPipelineStageSchemaRetry(() =>
		db
			.update(prospects)
			.set({ ...updateFields, updatedAt: new Date() })
			.where(eq(prospects.id, leadId))
			.returning(),
	);

	if (!updated) throw new Error("Lead not found");

	// Update lead categories if provided (junction table is the source of truth)
	if (tagIds !== undefined) {
		await db.delete(prospectTags).where(eq(prospectTags.prospectId, leadId));
		if (tagIds.length > 0) {
			await db
				.insert(prospectTags)
				.values(tagIds.map((tagId) => ({ prospectId: leadId, tagId })));
		}
		await db
			.update(prospects)
			.set({ tags: null, updatedAt: new Date() })
			.where(eq(prospects.id, leadId));
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

async function assertAssignableLeadAgent(agentId: string) {
	const [agentRow] = await db
		.select({ role: user.role, isActive: user.isActive })
		.from(user)
		.where(eq(user.id, agentId))
		.limit(1);

	if (!agentRow) throw new Error("Selected agent not found");
	if (agentRow.isActive === false) {
		throw new Error("Cannot assign to an inactive agent account");
	}
	if (!isAssignableLeadAgentRole(agentRow.role)) {
		throw new Error("Leads can only be assigned to agent accounts");
	}
}

/**
 * Assign / reassign a lead to an agent (or unassign by passing null).
 */
export async function assignLeadAdmin(
	leadId: string,
	agentId: string | null,
	actorId?: string,
) {
	if (agentId) await assertAssignableLeadAgent(agentId);

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
				.select({
					name: user.name,
					nickName: user.nickName,
					email: user.email,
				})
				.from(user)
				.where(eq(user.id, agentId))
				.limit(1);
			newAgentName = agentRow
				? pickAgentLeadDisplayName(agentRow)
				: agentId;
		}

		let oldAgentName = "Unassigned";
		if (before?.agentId) {
			const [oldAgentRow] = await db
				.select({
					name: user.name,
					nickName: user.nickName,
					email: user.email,
				})
				.from(user)
				.where(eq(user.id, before.agentId))
				.limit(1);
			oldAgentName = oldAgentRow
				? pickAgentLeadDisplayName(oldAgentRow)
				: before.agentId;
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
 * Bulk re-assign many leads (each assignment is activity-logged).
 */
export async function bulkAssignLeadsAdmin(
	leadIds: string[],
	agentId: string | null,
	actorId: string,
) {
	for (const id of leadIds) {
		await assignLeadAdmin(id, agentId, actorId);
	}
	return { success: true as const, updated: leadIds.length };
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

	if (insertData.agentId) {
		await assertAssignableLeadAgent(insertData.agentId);
	}

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

	await withPipelineStageSchemaRetry(() =>
		db
			.update(prospects)
			.set({ stage: parsed.data, status: "active", updatedAt: new Date() })
			.where(
				sql`${prospects.id} = ANY(ARRAY[${sql.join(
					leadIds.map((id) => sql`${id}::uuid`),
					sql`, `,
				)}])`,
			),
	);

	return { success: true, updated: leadIds.length };
}

export type BulkLeadCategoryMode = "replace" | "add" | "remove";

/**
 * Bulk update lead categories (replace all, add, or remove) for multiple leads.
 */
export async function bulkUpdateLeadCategoriesAdmin(
	leadIds: string[],
	tagIds: string[],
	mode: BulkLeadCategoryMode,
	actorId?: string,
) {
	if (leadIds.length === 0) return { success: true as const, updated: 0 };

	if (tagIds.length === 0) {
		if (mode === "replace") {
			// Allow clearing all categories
		} else {
			throw new Error("Select at least one category");
		}
	}

	const tagNameById = new Map<string, string>();
	if (tagIds.length > 0) {
		const tagRows = await db
			.select({ id: crmTags.id, name: crmTags.name })
			.from(crmTags)
			.where(inArray(crmTags.id, tagIds));
		for (const row of tagRows) {
			tagNameById.set(row.id, row.name);
		}
	}

	const formatTagNames = (ids: string[]) =>
		ids.map((id) => tagNameById.get(id) ?? id).join(", ") || "None";

	for (const leadId of leadIds) {
		let beforeIds: string[] = [];
		try {
			const existing = await db
				.select({ tagId: prospectTags.tagId })
				.from(prospectTags)
				.where(eq(prospectTags.prospectId, leadId));
			beforeIds = existing.map((r) => r.tagId);
		} catch {
			// tags table may be missing
		}

		if (mode === "replace") {
			await db.delete(prospectTags).where(eq(prospectTags.prospectId, leadId));
			if (tagIds.length > 0) {
				await db
					.insert(prospectTags)
					.values(tagIds.map((tagId) => ({ prospectId: leadId, tagId })));
			}
			await db
				.update(prospects)
				.set({ tags: null, updatedAt: new Date() })
				.where(eq(prospects.id, leadId));
		} else if (mode === "add") {
			const existingSet = new Set(beforeIds);
			const toAdd = tagIds.filter((id) => !existingSet.has(id));
			if (toAdd.length > 0) {
				await db
					.insert(prospectTags)
					.values(toAdd.map((tagId) => ({ prospectId: leadId, tagId })));
			}
		} else {
			if (tagIds.length > 0) {
				await db
					.delete(prospectTags)
					.where(
						and(
							eq(prospectTags.prospectId, leadId),
							inArray(prospectTags.tagId, tagIds),
						),
					);
			}
		}

		if (actorId) {
			const beforeRows =
				beforeIds.length > 0
					? await db
							.select({ name: crmTags.name })
							.from(crmTags)
							.where(inArray(crmTags.id, beforeIds))
					: [];
			const beforeLabel =
				beforeRows.map((r) => r.name).join(", ") || "None";

			const modeLabel =
				mode === "replace"
					? "replaced with"
					: mode === "add"
						? "added"
						: "removed";

			await logActivity({
				prospectId: leadId,
				eventType: "lead_updated",
				actorId,
				content:
					mode === "replace"
						? `Categories ${modeLabel} "${formatTagNames(tagIds)}" (was: ${beforeLabel})`
						: `Categories ${modeLabel}: ${formatTagNames(tagIds)}`,
				metadata: {
					field: "categories",
					mode,
					tagIds: tagIds.join(","),
				},
			});
		}
	}

	return { success: true as const, updated: leadIds.length };
}

/**
 * Add a note to any lead (admin author).
 */
export async function addNoteToLeadAdmin(
	leadId: string,
	content: string,
	adminId: string,
) {
	const [note] = await withProspectNotesSchemaRetry(() =>
		db
			.insert(prospectNotes)
			.values({ prospectId: leadId, content, agentId: adminId })
			.returning(),
	);

	// Note is activity -> reactivate
	await db
		.update(prospects)
		.set({ status: "active", updatedAt: new Date() })
		.where(eq(prospects.id, leadId));

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
		.set({ lastContact: new Date(), status: "active", updatedAt: new Date() })
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

	// Email counts as activity touchpoint -> reactivate
	await db
		.update(prospects)
		.set({ lastContact: new Date(), status: "active", updatedAt: new Date() })
		.where(eq(prospects.id, leadId));
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

	try {
		const rows = await db
			.select({
				activity: prospectActivityLog,
				actorName: agentLeadDisplayNameSql,
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

	} catch {
		// prospect_activity_log table not created yet — continue with legacy notes only
	}

	// ── 2. Fetch notes from prospect_notes ────────────────────────────────────
	// addNoteToLeadAdmin writes to both tables; skip prospect_notes rows that
	// already appear as note_added in the activity log (same content).
	const activityNoteContents = new Set(
		activityEntries
			.filter((e) => e.eventType === "note_added" && e.content)
			.map((e) => e.content as string),
	);

	try {
		const noteRows = await db
			.select({
				note: prospectNotes,
				agentName: agentLeadDisplayNameSql,
				agentEmail: user.email,
			})
			.from(prospectNotes)
			.leftJoin(user, eq(prospectNotes.agentId, user.id))
			.where(eq(prospectNotes.prospectId, leadId))
			.orderBy(desc(prospectNotes.createdAt));

		const legacyNoteEntries: ActivityEntry[] = noteRows
			.filter((r) => !activityNoteContents.has(r.note.content))
			.map((r) => ({
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

	let emailRow: { id: string; name: string } | undefined;
	if (normEmail) {
		const [row] = await db
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
		emailRow = row;
	} else {
		emailRow = undefined;
	}

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

/** Find lead id + owner by normalized phone (spaces stripped). */
export async function findProspectByNormalizedPhone(normPhone: string) {
	const [row] = await db
		.select({ id: prospects.id, agentId: prospects.agentId })
		.from(prospects)
		.where(sql`replace(${prospects.phone}, ' ', '') = ${normPhone}`)
		.limit(1);
	return row ?? null;
}

/**
 * Get aggregated stats for the admin leads dashboard.
 */
export async function getLeadsStatsAdmin(): Promise<LeadsStatsAdmin> {
	await autoMarkInactiveLeads();
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

/** Active agent-portal accounts eligible for lead assignment (agents and team leads). */
const assignableLeadAgentWhere = and(
	or(eq(user.isActive, true), isNull(user.isActive)),
	sql`lower(trim(coalesce(${user.role}, 'agent'))) in ('agent', 'team_lead')`,
);

/** Lead section only — prefer agent nickname over legal name in UI and exports. */
export const agentLeadDisplayNameSql = sql<string>`coalesce(nullif(trim(${user.nickName}), ''), ${user.name})`;

function pickAgentLeadDisplayName(row: {
	name?: string | null;
	nickName?: string | null;
	email?: string | null;
}): string {
	const nick = row.nickName?.trim();
	if (nick) return nick;
	const name = row.name?.trim();
	if (name) return name;
	return row.email?.trim() ?? "Unknown";
}

function normalizePersonKey(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve assignable agent from CSV token — nickname first (lead section convention). */
async function resolveAssignableAgentIdFromCsv(
	raw: string,
): Promise<string | null> {
	const t = raw.trim();
	if (!t) return null;

	if (t.includes("@")) {
		const [row] = await db
			.select({ id: user.id })
			.from(user)
			.where(
				and(
					sql`lower(${user.email}) = ${t.toLowerCase()}`,
					assignableLeadAgentWhere,
				),
			)
			.limit(1);
		return row?.id ?? null;
	}

	const want = normalizePersonKey(t);

	const [byNick] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				sql`lower(regexp_replace(trim(coalesce(${user.nickName}, '')), '\\s+', ' ', 'g')) = ${want}`,
				assignableLeadAgentWhere,
			),
		)
		.limit(1);
	if (byNick) return byNick.id;

	const [byName] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				sql`lower(regexp_replace(trim(${user.name}), '\\s+', ' ', 'g')) = ${want}`,
				assignableLeadAgentWhere,
			),
		)
		.limit(1);
	if (byName) return byName.id;

	const [byCode] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				sql`lower(trim(coalesce(${user.agentCode}, ''))) = ${want}`,
				assignableLeadAgentWhere,
			),
		)
		.limit(1);
	return byCode?.id ?? null;
}

/** Match CSV follower tokens to active agent accounts (name, nickname, code, or email). */
async function resolveFollowerIdsFromCsv(raw: string): Promise<{
	followerIds: string[];
	unknownNames: string[];
}> {
	const tokens = parseCsvTagNames(raw);
	if (tokens.length === 0) return { followerIds: [], unknownNames: [] };

	const followerIds: string[] = [];
	const unknownNames: string[] = [];

	for (const token of tokens) {
		const t = token.trim();
		if (!t) continue;

		const agentId = await resolveAssignableAgentIdFromCsv(t);
		if (agentId) {
			if (!followerIds.includes(agentId)) followerIds.push(agentId);
		} else {
			unknownNames.push(t);
		}
	}

	return { followerIds, unknownNames };
}

/**
 * Active sales agents available for lead assignment (not limited to leads already held).
 */
export async function getAgentsWithLeads() {
	const rows = await db
		.select({
			agentId: user.id,
			agentName: agentLeadDisplayNameSql,
			agentEmail: user.email,
		})
		.from(user)
		.where(assignableLeadAgentWhere)
		.orderBy(asc(agentLeadDisplayNameSql));

	return rows;
}

// ─── CSV bulk import (admin) ─────────────────────────────────────────────────

const IMPORT_MAX_ROWS = 2000;

function pickCsvField(row: Record<string, string>, ...aliases: string[]): string {
	const lowerMap = new Map<string, string>();
	for (const [k, v] of Object.entries(row)) {
		lowerMap.set(k.toLowerCase().trim(), v === undefined ? "" : String(v).trim());
	}
	for (const alias of aliases) {
		const val = lowerMap.get(alias.toLowerCase().trim());
		if (val !== undefined && val !== "") return val;
	}
	return "";
}

function normalizePhoneForImport(raw: string): string {
	return raw.replace(/[^\d\s+\-()]/g, "").trim();
}

/**
 * Normalise a phone number for storage/matching. Defaults bare local numbers
 * (no country code) to Malaysian +60, but leaves any number that already
 * carries a country code (a leading +) untouched aside from stripping
 * formatting characters — it must NOT be reinterpreted as a Malaysian number.
 */
function normalizeMalaysianPhoneKey(raw: string): string {
	const d = normalizePhoneForImport(raw).replace(/\s+/g, "");
	if (d.startsWith("+60")) return `+${d.slice(1).replace(/\D/g, "")}`;
	if (d.startsWith("60") && d.length >= 10) return `+${d.replace(/\D/g, "")}`;
	if (d.startsWith("0")) return `+60${d.slice(1).replace(/\D/g, "")}`;
	if (d.startsWith("+")) return `+${d.slice(1).replace(/\D/g, "")}`;
	const digitsOnly = d.replace(/\D/g, "");
	if (/^\d{8,11}$/.test(digitsOnly)) return `+60${digitsOnly}`;
	return digitsOnly ? `+${digitsOnly}` : d;
}

function parseOptionalDate(raw: string): Date | undefined {
	const t = raw.trim();
	if (!t) return undefined;
	const d = new Date(t);
	if (Number.isNaN(d.getTime())) return undefined;
	return d;
}

function parseStageFromCsv(raw: string): PipelineStage {
	const t = raw.trim();
	if (!t) return "new_lead";
	const direct = pipelineStageSchema.safeParse(t);
	if (direct.success) return direct.data;
	const n = t.toLowerCase().replace(/[^a-z0-9]+/g, "");
	const map: Record<string, PipelineStage> = {
		newlead: "new_lead",
		firstfollowup: "first_follow_up",
		"1firstfollowup": "first_follow_up",
		secondfollowup: "second_follow_up",
		"2secondfollowup": "second_follow_up",
		thirdfollowup: "third_follow_up",
		"3thirdfollowup": "third_follow_up",
		fourthfollowup: "fourth_follow_up",
		"4fourthfollowup": "fourth_follow_up",
		potentiallead: "potential_lead",
		appointmentmade: "appointment_made",
		needconsider: "need_consider",
		rejectproject: "reject_project",
		bookingmade: "booking_made",
		spamfakelead: "spam_fake_lead",
		// Retired labels → active stage
		followupinprogress: "first_follow_up",
		nopickreply: "second_follow_up",
		nopickupnoreply: "second_follow_up",
		nopupreattempt: "second_follow_up",
		nopickupreattempt: "second_follow_up",
		nopicknoreply: "second_follow_up",
		canrecycle: "fourth_follow_up",
		recycle: "fourth_follow_up",
		followupforappt: "third_follow_up",
		followupforappointment: "third_follow_up",
		considerseen: "need_consider",
		contacted: "first_follow_up",
		appointmentset: "appointment_made",
		converted: "booking_made",
	};
	return map[n] ?? "new_lead";
}

function parseStatusFromCsv(raw: string): ProspectStatus {
	const s = raw.trim().toLowerCase();
	if (!s) return "active";
	const parsed = prospectStatusSchema.safeParse(s);
	if (parsed.success) return parsed.data;
	return "active";
}

function parseTypeFromCsv(raw: string): ProspectType {
	const s = raw.trim().toLowerCase();
	if (!s) return "buyer";
	if (s === "owner") return "buyer";
	const parsed = prospectTypeSchema.safeParse(s);
	if (parsed.success) return parsed.data;
	return "buyer";
}

function parseLeadTypeFromCsv(raw: string): LeadType {
	const s = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
	if (!s) return "personal";
	if (s.includes("company")) return "company";
	if (s.includes("personal")) return "personal";
	const parsed = leadTypeSchema.safeParse(s.replace(/\s+/g, ""));
	if (parsed.success) return parsed.data;
	const compact = leadTypeSchema.safeParse(s.replace(/\s+/g, "_"));
	if (compact.success) return compact.data;
	return "personal";
}

function parseCsvTagNames(raw: string): string[] {
	if (!raw.trim()) return [];
	return raw
		.split(/[;,]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Match CSV category names to admin-managed lead categories only (no auto-create). */
async function resolveTagIdsFromCsv(raw: string): Promise<{
	tagIds: string[];
	unknownNames: string[];
}> {
	const names = parseCsvTagNames(raw);
	if (names.length === 0) return { tagIds: [], unknownNames: [] };

	const tagIds: string[] = [];
	const unknownNames: string[] = [];
	for (const name of names) {
		const [existing] = await db
			.select({ id: crmTags.id })
			.from(crmTags)
			.where(sql`lower(trim(${crmTags.name})) = ${name.toLowerCase()}`)
			.limit(1);

		if (existing) {
			tagIds.push(existing.id);
		} else {
			unknownNames.push(name);
		}
	}
	return { tagIds, unknownNames };
}

function formatZodImportErrors(
	errors: { path: (string | number)[]; message: string }[],
): string {
	return errors
		.map((e) => {
			const path = e.path.length > 0 ? String(e.path[0]) : "field";
			if (path === "email") return "Invalid email address";
			return `${path}: ${e.message}`;
		})
		.join("; ");
}

export type LeadImportLineResult = {
	lineNo: number;
	identifier: string;
	object: string;
	kind: "created" | "updated" | "error" | "warning";
	message?: string;
};

export type LeadImportSummary = {
	total: number;
	success: number;
	created: number;
	updated: number;
	error: number;
	warning: number;
	skippedInvalid: number;
	lines: LeadImportLineResult[];
};

/**
 * Import many leads from parsed CSV rows.
 * Required: name + phone. Email optional.
 * If phone already exists → update the lead (upsert) and count as "updated".
 */
export async function importLeadsBulkAdmin(
	rows: Record<string, string>[],
	actorId: string,
): Promise<LeadImportSummary> {
	if (rows.length > IMPORT_MAX_ROWS) {
		throw new Error(`Import is limited to ${IMPORT_MAX_ROWS} rows per batch.`);
	}

	const lines: LeadImportLineResult[] = [];
	let created = 0;
	let updated = 0;
	let error = 0;
	let warning = 0;
	let skippedInvalid = 0;

	const seenPhoneNormInFile = new Map<string, number>();

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const rowNum = i + 1;

		const name = pickCsvField(row, "name", "Name");
		const email = pickCsvField(
			row,
			"email",
			"Email",
			"contact email",
			"contactemail",
			"Contact Email",
		);
		const phoneRaw = pickCsvField(
			row,
			"phone",
			"Phone",
			"contact phone",
			"contactphone",
			"Contact Phone",
		);
		const notesRaw = pickCsvField(row, "notes", "Notes", "remarks", "Remarks");
		const property = pickCsvField(row, "property", "Property");
		const projectName = pickCsvField(
			row,
			"project",
			"Project",
			"projectname",
			"project name",
		);
		const stageRaw = pickCsvField(row, "stage", "Stage", "status", "Status");
		const statusRaw = pickCsvField(row, "status", "Status", "lifecycle", "Lifecycle");
		const typeRaw = pickCsvField(row, "type", "Type");
		const leadTypeRaw = pickCsvField(
			row,
			"leadtype",
			"lead type",
			"Lead Type",
			"lead_type",
		);
		const source = pickCsvField(row, "source", "Source");
		const tags = pickCsvField(
			row,
			"tags",
			"Tags",
			"categories",
			"Categories",
		);
		const agentEmail = pickCsvField(
			row,
			"agentemail",
			"agent email",
			"Agent Email",
			"assigned agent email",
		);
		const agentNameRaw = pickCsvField(
			row,
			"assigned agent",
			"Assigned Agent",
			"agent name",
			"Agent Name",
			"agent",
			"Agent",
		);
		const followersRaw = pickCsvField(
			row,
			"follower",
			"Follower",
			"followers",
			"Followers",
			"contact owner",
			"Contact Owner",
			"contactowner",
		);
		const lastContactRaw = pickCsvField(
			row,
			"lastcontact",
			"last contact",
			"Last Contact",
		);
		const nextContactRaw = pickCsvField(
			row,
			"nextcontact",
			"next contact",
			"Next Contact",
		);

		if (!name?.trim() || !phoneRaw?.trim()) {
			skippedInvalid++;
			error++;
			lines.push({
				lineNo: rowNum,
				identifier: name?.trim() || "(no name)",
				object: "Lead",
				kind: "error",
				message: "Missing required field (name or phone).",
			});
			continue;
		}

		const phone = normalizeMalaysianPhoneKey(phoneRaw);
		const phoneNorm = phone.replace(/\s+/g, "");

		const firstLine = seenPhoneNormInFile.get(phoneNorm);
		if (firstLine !== undefined) {
			warning++;
			lines.push({
				lineNo: rowNum,
				identifier: name.trim(),
				object: "Lead",
				kind: "warning",
				message: `Duplicate phone also on row ${firstLine}; updating same record.`,
			});
		} else {
			seenPhoneNormInFile.set(phoneNorm, rowNum);
		}

		const emailNorm = email.trim().toLowerCase();

		const dup = emailNorm
			? await checkLeadDuplicateAdmin(email, phone)
			: { emailTaken: false, phoneTaken: false, emailConflictName: null, phoneConflictName: null };

		let projectId: string | undefined;
		if (projectName) {
			const [pRow] = await db
				.select({ id: crmProjects.id })
				.from(crmProjects)
				.where(
					sql`lower(${crmProjects.name}) = ${projectName.toLowerCase().trim()}`,
				)
				.limit(1);
			projectId = pRow?.id;
		}

		let agentId: string | null = null;
		if (agentEmail) {
			const [uRow] = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(
						sql`lower(${user.email}) = ${agentEmail.toLowerCase().trim()}`,
						assignableLeadAgentWhere,
					),
				)
				.limit(1);
			agentId = uRow?.id ?? null;
		} else if (agentNameRaw.trim()) {
			agentId = await resolveAssignableAgentIdFromCsv(agentNameRaw);
		}

		const parsedStage = parseStageFromCsv(stageRaw);
		const parsedStatus = parseStatusFromCsv(statusRaw);
		const parsedType = parseTypeFromCsv(typeRaw);
		const parsedLeadType = parseLeadTypeFromCsv(leadTypeRaw);
		const finalSource = source?.trim() || "CSV import";
		const finalProperty = property?.trim() || "—";

		const lastContact = parseOptionalDate(lastContactRaw);
		const nextContact = parseOptionalDate(nextContactRaw);

		const notesVal = notesRaw.trim() ? notesRaw.trim() : null;
		const tagNames = parseCsvTagNames(tags);

		const existing = await findProspectByNormalizedPhone(phoneNorm);

		const baseUpsert = {
			name: name.trim(),
			...(emailNorm ? { email: emailNorm } : {}),
			phone,
			source: finalSource,
			type: parsedType,
			property: finalProperty,
			...(projectId ? { projectId } : {}),
			status: parsedStatus,
			stage: parsedStage,
			leadType: parsedLeadType,
			...(notesVal ? { notes: notesVal } : {}),
			...(lastContact ? { lastContact } : {}),
			...(nextContact ? { nextContact } : {}),
		};

		const validated = insertProspectSchema.safeParse(baseUpsert);
		if (!validated.success) {
			skippedInvalid++;
			error++;
			lines.push({
				lineNo: rowNum,
				identifier: name.trim(),
				object: "Lead",
				kind: "error",
				message: formatZodImportErrors(validated.error.errors),
			});
			continue;
		}

		const resolvedTags =
			tagNames.length > 0 ? await resolveTagIdsFromCsv(tags) : null;
		const resolvedFollowers = followersRaw.trim()
			? await resolveFollowerIdsFromCsv(followersRaw)
			: null;

		try {
			let leadId: string;
			if (existing) {
				await updateLeadAdmin(existing.id, {
					...validated.data,
					...(resolvedTags ? { tagIds: resolvedTags.tagIds } : {}),
					_actorId: actorId,
				});
				if (agentId !== null) {
					await assignLeadAdmin(existing.id, agentId, actorId);
				}
				leadId = existing.id;
				updated++;
				lines.push({
					lineNo: rowNum,
					identifier: name.trim(),
					object: "Lead",
					kind: "updated",
				});
			} else {
				if (emailNorm && dup.emailTaken) {
					warning++;
					lines.push({
						lineNo: rowNum,
						identifier: name.trim(),
						object: "Lead",
						kind: "warning",
						message: `Email already used by “${dup.emailConflictName ?? "another lead"}”; creating/updating by phone only.`,
					});
				}
				const newLead = await createLeadAdmin({
					...validated.data,
					...(resolvedTags ? { tagIds: resolvedTags.tagIds } : {}),
					agentId: agentId ?? undefined,
					_actorId: actorId,
				});
				leadId = newLead.id;
				created++;
				lines.push({
					lineNo: rowNum,
					identifier: name.trim(),
					object: "Lead",
					kind: "created",
				});
			}
			if (resolvedTags && resolvedTags.unknownNames.length > 0) {
				warning++;
				lines.push({
					lineNo: rowNum,
					identifier: name.trim(),
					object: "Lead",
					kind: "warning",
					message: `Unknown categories skipped (create them in Lead Categories first): ${resolvedTags.unknownNames.join(", ")}`,
				});
			}
			if (resolvedFollowers) {
				await setProspectFollowers(
					leadId,
					resolvedFollowers.followerIds,
					actorId,
				);
			}
			if (resolvedFollowers && resolvedFollowers.unknownNames.length > 0) {
				warning++;
				lines.push({
					lineNo: rowNum,
					identifier: name.trim(),
					object: "Lead",
					kind: "warning",
					message: `Unknown followers skipped: ${resolvedFollowers.unknownNames.join(", ")}`,
				});
			}
			if (notesVal) {
				await addNoteToLeadAdmin(leadId, notesVal, actorId);
			}
		} catch (e) {
			skippedInvalid++;
			error++;
			lines.push({
				lineNo: rowNum,
				identifier: name.trim(),
				object: "Lead",
				kind: "error",
				message: e instanceof Error ? e.message : "Save failed",
			});
		}
	}

	const success = created + updated;
	return {
		total: rows.length,
		success,
		created,
		updated,
		error,
		warning,
		skippedInvalid,
		lines,
	};
}

export type AgentProspectCsvImportMode =
	| "personal_assigned"
	| "company_unclaimed";

/**
 * Agent CRM bulk import: rows are validated like admin import, but assignment
 * is always the current agent (personal) or the company pool (unclaimed company).
 * CSV "Agent Email" / agent columns are ignored for security.
 */
export async function importProspectsBulkForAgent(
	rows: Record<string, string>[],
	agentId: string,
	mode: AgentProspectCsvImportMode,
) {
	if (rows.length > IMPORT_MAX_ROWS) {
		throw new Error(`Import is limited to ${IMPORT_MAX_ROWS} rows per batch.`);
	}

	const result = {
		created: 0,
		updated: 0,
		skippedDuplicate: 0,
		skippedInvalid: 0,
		errors: [] as { rowIndex: number; message: string }[],
		warnings: [] as { rowIndex: number; message: string }[],
	};

	const forcedLeadType: LeadType =
		mode === "company_unclaimed" ? "company" : "personal";
	const assignAgentId: string | null =
		mode === "company_unclaimed" ? null : agentId;

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const rowNum = i + 1;

		const name = pickCsvField(row, "name", "Name");
		const email = pickCsvField(
			row,
			"email",
			"Email",
			"contact email",
			"contactemail",
			"Contact Email",
		);
		const phoneRaw = pickCsvField(
			row,
			"phone",
			"Phone",
			"contact phone",
			"contactphone",
			"Contact Phone",
		);
		const notesRaw = pickCsvField(row, "notes", "Notes", "remarks", "Remarks");
		const property = pickCsvField(row, "property", "Property");
		const projectName = pickCsvField(
			row,
			"project",
			"Project",
			"projectname",
			"project name",
		);
		const stageRaw = pickCsvField(row, "stage", "Stage");
		const statusRaw = pickCsvField(row, "status", "Status");
		const typeRaw = pickCsvField(row, "type", "Type");
		const source = pickCsvField(row, "source", "Source");
		const tagsRaw = pickCsvField(
			row,
			"categories",
			"Categories",
			"tags",
			"Tags",
		);
		const lastContactRaw = pickCsvField(
			row,
			"lastcontact",
			"last contact",
			"Last Contact",
		);
		const nextContactRaw = pickCsvField(
			row,
			"nextcontact",
			"next contact",
			"Next Contact",
		);
		const followersRaw = pickCsvField(
			row,
			"follower",
			"Follower",
			"followers",
			"Followers",
			"contact owner",
			"Contact Owner",
			"contactowner",
		);

		if (!name?.trim() || !phoneRaw?.trim()) {
			result.skippedInvalid++;
			result.errors.push({
				rowIndex: rowNum,
				message: "Missing required field (name or phone).",
			});
			continue;
		}

		const phone = normalizeMalaysianPhoneKey(phoneRaw);
		const phoneNorm = phone.replace(/\s+/g, "");
		const emailNorm = email.trim().toLowerCase();
		const notesVal = notesRaw.trim() ? notesRaw.trim() : null;

		const existing = await findProspectByNormalizedPhone(phoneNorm);

		const parsedStage = parseStageFromCsv(stageRaw);
		const parsedStatus = parseStatusFromCsv(statusRaw);
		const parsedType = parseTypeFromCsv(typeRaw);
		const finalSource = source?.trim() || "CSV import";
		const finalProperty = property?.trim() || "—";

		let projectId: string | undefined;
		if (projectName) {
			const [pRow] = await db
				.select({ id: crmProjects.id })
				.from(crmProjects)
				.where(
					sql`lower(${crmProjects.name}) = ${projectName.toLowerCase().trim()}`,
				)
				.limit(1);
			projectId = pRow?.id;
		}

		const lastContact = parseOptionalDate(lastContactRaw);
		const nextContact = parseOptionalDate(nextContactRaw);

		const tagNames = parseCsvTagNames(tagsRaw);
		const resolvedTags =
			tagNames.length > 0 ? await resolveTagIdsFromCsv(tagsRaw) : null;
		const resolvedFollowers = followersRaw.trim()
			? await resolveFollowerIdsFromCsv(followersRaw)
			: null;

		const baseUpsert = {
			name: name.trim(),
			...(emailNorm ? { email: emailNorm } : {}),
			phone,
			source: finalSource,
			type: parsedType,
			property: finalProperty,
			...(projectId ? { projectId } : {}),
			status: parsedStatus,
			stage: parsedStage,
			leadType: forcedLeadType,
			...(notesVal ? { notes: notesVal } : {}),
			...(lastContact ? { lastContact } : {}),
			...(nextContact ? { nextContact } : {}),
		};

		const validated = insertProspectSchema.safeParse(baseUpsert);
		if (!validated.success) {
			result.skippedInvalid++;
			result.errors.push({
				rowIndex: rowNum,
				message: formatZodImportErrors(validated.error.errors),
			});
			continue;
		}

		try {
			let leadId: string;
			if (existing) {
				if (mode === "personal_assigned") {
					if (
						existing.agentId !== null &&
						existing.agentId !== undefined &&
						existing.agentId !== agentId
					) {
						result.skippedInvalid++;
						result.errors.push({
							rowIndex: rowNum,
							message:
								"Phone belongs to another agent’s lead — cannot overwrite via import.",
						});
						continue;
					}
					await updateLeadAdmin(existing.id, {
						...validated.data,
						...(resolvedTags ? { tagIds: resolvedTags.tagIds } : {}),
						_actorId: agentId,
					});
					await assignLeadAdmin(existing.id, agentId, agentId);
					leadId = existing.id;
					result.updated++;
				} else {
					if (existing.agentId !== null && existing.agentId !== undefined) {
						result.skippedInvalid++;
						result.errors.push({
							rowIndex: rowNum,
							message:
								"Phone already tied to an assigned lead — cannot upsert into company pool.",
						});
						continue;
					}
					await updateLeadAdmin(existing.id, {
						...validated.data,
						leadType: "company",
						...(resolvedTags ? { tagIds: resolvedTags.tagIds } : {}),
						_actorId: agentId,
					});
					leadId = existing.id;
					result.updated++;
				}
			} else {
				const newLead = await createLeadAdmin({
					...validated.data,
					leadType: forcedLeadType,
					agentId: assignAgentId ?? undefined,
					...(resolvedTags ? { tagIds: resolvedTags.tagIds } : {}),
					_actorId: agentId,
				});
				leadId = newLead.id;
				result.created++;
			}
			if (notesVal) {
				await addNoteToLeadAdmin(leadId, notesVal, agentId);
			}
			if (resolvedTags && resolvedTags.unknownNames.length > 0) {
				result.warnings.push({
					rowIndex: rowNum,
					message: `Unknown categories skipped (create them in Lead Categories first): ${resolvedTags.unknownNames.join(", ")}`,
				});
			}
			if (resolvedFollowers) {
				await setProspectFollowers(
					leadId,
					resolvedFollowers.followerIds,
					agentId,
				);
			}
			if (resolvedFollowers && resolvedFollowers.unknownNames.length > 0) {
				result.warnings.push({
					rowIndex: rowNum,
					message: `Unknown followers skipped: ${resolvedFollowers.unknownNames.join(", ")}`,
				});
			}
		} catch (e) {
			result.skippedInvalid++;
			result.errors.push({
				rowIndex: rowNum,
				message: e instanceof Error ? e.message : "Save failed",
			});
		}
	}

	return result;
}
