import { z } from "zod";
import {
	insertProspectSchema,
	pipelineStageSchema,
	updateProspectSchema,
} from "../models/crm";
import {
	addNoteToLeadAdmin,
	assignLeadAdmin,
	bulkAssignLeadsAdmin,
	bulkSetLeadFollowersAdmin,
	bulkUpdateLeadCategoriesAdmin,
	bulkUpdateLeadsStageAdmin,
	checkLeadDuplicateAdmin,
	createLeadAdmin,
	importLeadsBulkAdmin,
	deleteLeadAdmin,
	deleteNoteAdmin,
	getAgentsWithLeads,
	getAllLeadsAdmin,
	getLeadActivityAdmin,
	getLeadByIdAdmin,
	getLeadsStatsAdmin,
	logCallForLeadAdmin,
	logEmailForLeadAdmin,
	setProspectFollowers,
	updateLeadAdmin,
	updateNoteAdmin,
} from "../services/leads";
import { adminProcedure, router } from "../utils/trpc";

// ─── Input Schemas ─────────────────────────────────────────────────────────────

const adminListLeadsInput = z.object({
	search: z.string().optional(),
	type: z.enum(["tenant", "buyer"]).optional(),
	status: z.enum(["active", "inactive", "pending"]).optional(),
	stage: pipelineStageSchema.optional(),
	leadType: z.enum(["personal", "company"]).optional(),
	agentId: z.string().optional(), // can be agent UUID or "__unassigned__"
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(10000).default(20),
	sortBy: z
		.enum(["createdAt", "updatedAt", "name", "stage"])
		.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const adminGetLeadInput = z.object({
	id: z.string().uuid(),
});

const adminCreateLeadInput = insertProspectSchema.extend({
	agentId: z.string().min(1, "Assign to Agent is required"),
	tagIds: z.array(z.string().uuid()).optional(),
});

const adminUpdateLeadInput = updateProspectSchema.extend({
	agentId: z.string().optional(), // admin can reassign while updating
	tagIds: z.array(z.string().uuid()).optional(),
});

const adminAssignLeadInput = z.object({
	id: z.string().uuid(),
	agentId: z.string().nullable(), // null = unassign
});

const adminSetFollowersInput = z.object({
	id: z.string().uuid(),
	followerIds: z.array(z.string()).default([]),
});

const adminBulkUpdateStageInput = z.object({
	ids: z.array(z.string().uuid()).min(1),
	stage: pipelineStageSchema,
});

const adminBulkAssignInput = z.object({
	ids: z.array(z.string().uuid()).min(1),
	agentId: z.string().nullable(),
});

const adminBulkUpdateCategoriesInput = z.object({
	ids: z.array(z.string().uuid()).min(1),
	tagIds: z.array(z.string().uuid()).default([]),
	mode: z.enum(["replace", "add", "remove"]),
});

const adminBulkSetFollowersInput = z.object({
	ids: z.array(z.string().uuid()).min(1),
	followerIds: z.array(z.string()).default([]),
	mode: z.enum(["replace", "add", "remove"]),
});

const adminAddNoteInput = z.object({
	leadId: z.string().uuid(),
	content: z.string().min(1, "Note content is required"),
});

const adminUpdateNoteInput = z.object({
	id: z.string().uuid(),
	content: z.string().min(1, "Note content is required"),
});

const adminDeleteNoteInput = z.object({
	id: z.string().uuid(),
});

const adminLogCallInput = z.object({
	leadId: z.string().uuid(),
	content: z.string().min(1, "Call description is required"),
});

const adminLogEmailInput = z.object({
	leadId: z.string().uuid(),
	content: z.string().min(1, "Email description is required"),
});

const adminGetTimelineInput = z.object({
	leadId: z.string().uuid(),
});

const adminCheckDuplicateInput = z.object({
	email: z
		.string()
		.optional()
		.transform((v) => (typeof v === "string" ? v.trim() : "")),
	phone: z.string().min(1),
	excludeId: z.string().uuid().optional(), // pass when editing an existing lead
});

const adminImportLeadsInput = z.object({
	rows: z.array(z.record(z.string())).max(2000),
});

// ─── Admin Leads Router ────────────────────────────────────────────────────────

export const adminLeadsRouter = router({
	/**
	 * List all leads with filters and pagination (admin — no agent restriction)
	 */
	list: adminProcedure.input(adminListLeadsInput).query(async ({ input }) => {
		return await getAllLeadsAdmin(input);
	}),

	/**
	 * Get aggregated stats for the admin leads dashboard
	 */
	stats: adminProcedure.query(async () => {
		return await getLeadsStatsAdmin();
	}),

	/**
	 * Active agent-portal accounts available for assignment and filters.
	 */
	agentsWithLeads: adminProcedure.query(async () => {
		return await getAgentsWithLeads();
	}),

	/**
	 * Get a single lead by ID with full details and notes
	 */
	get: adminProcedure.input(adminGetLeadInput).query(async ({ input }) => {
		const result = await getLeadByIdAdmin(input.id);
		if (!result) throw new Error("Lead not found");
		return result;
	}),

	/**
	 * Check if an email or phone is already used by another lead.
	 * Used for real-time duplicate validation in create/edit forms.
	 */
	checkDuplicate: adminProcedure
		.input(adminCheckDuplicateInput)
		.query(async ({ input }) => {
			return await checkLeadDuplicateAdmin(
				input.email ?? "",
				input.phone,
				input.excludeId,
			);
		}),

	/**
	 * Get the full activity timeline for a lead (newest first)
	 */
	getTimeline: adminProcedure
		.input(adminGetTimelineInput)
		.query(async ({ input }) => {
			return await getLeadActivityAdmin(input.leadId);
		}),

	/**
	 * Create a new lead (admin can specify agentId directly)
	 */
	create: adminProcedure
		.input(adminCreateLeadInput)
		.mutation(async ({ input, ctx }) => {
			const { tagIds, ...rest } = input;
			return await createLeadAdmin({
				...rest,
				tagIds,
				_actorId: ctx.session.user.id,
			});
		}),

	/**
	 * Bulk import leads from parsed CSV rows (same columns as export).
	 */
	importCsv: adminProcedure
		.input(adminImportLeadsInput)
		.mutation(async ({ input, ctx }) => {
			return await importLeadsBulkAdmin(input.rows, ctx.session.user.id);
		}),

	/**
	 * Update any lead field
	 */
	update: adminProcedure
		.input(adminUpdateLeadInput)
		.mutation(async ({ input, ctx }) => {
			const { id, tagIds, ...fields } = input;
			return await updateLeadAdmin(id, {
				...fields,
				tagIds,
				_actorId: ctx.session.user.id,
			});
		}),

	/**
	 * Delete a lead
	 */
	delete: adminProcedure
		.input(adminGetLeadInput)
		.mutation(async ({ input }) => {
			return await deleteLeadAdmin(input.id);
		}),

	bulkDelete: adminProcedure
		.input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
		.mutation(async ({ input }) => {
			for (const id of input.ids) {
				await deleteLeadAdmin(id);
			}
			return { deleted: input.ids.length };
		}),

	/**
	 * Assign / reassign a lead to an agent (or unassign)
	 */
	assign: adminProcedure
		.input(adminAssignLeadInput)
		.mutation(async ({ input, ctx }) => {
			return await assignLeadAdmin(
				input.id,
				input.agentId,
				ctx.session.user.id,
			);
		}),

	setFollowers: adminProcedure
		.input(adminSetFollowersInput)
		.mutation(async ({ input, ctx }) => {
			return await setProspectFollowers(
				input.id,
				input.followerIds,
				ctx.session.user.id,
			);
		}),

	/**
	 * Bulk update pipeline stage for multiple leads
	 */
	bulkUpdateStage: adminProcedure
		.input(adminBulkUpdateStageInput)
		.mutation(async ({ input }) => {
			return await bulkUpdateLeadsStageAdmin(input.ids, input.stage);
		}),

	bulkAssign: adminProcedure
		.input(adminBulkAssignInput)
		.mutation(async ({ input, ctx }) => {
			return await bulkAssignLeadsAdmin(
				input.ids,
				input.agentId,
				ctx.session.user.id,
			);
		}),

	bulkUpdateCategories: adminProcedure
		.input(adminBulkUpdateCategoriesInput)
		.mutation(async ({ input, ctx }) => {
			return await bulkUpdateLeadCategoriesAdmin(
				input.ids,
				input.tagIds,
				input.mode,
				ctx.session.user.id,
			);
		}),

	bulkSetFollowers: adminProcedure
		.input(adminBulkSetFollowersInput)
		.mutation(async ({ input, ctx }) => {
			return await bulkSetLeadFollowersAdmin(
				input.ids,
				input.followerIds,
				input.mode,
				ctx.session.user.id,
			);
		}),

	/**
	 * Add a note to any lead (admin as author)
	 */
	addNote: adminProcedure
		.input(adminAddNoteInput)
		.mutation(async ({ input, ctx }) => {
			return await addNoteToLeadAdmin(
				input.leadId,
				input.content,
				ctx.session.user.id,
			);
		}),

	/**
	 * Edit any lead note (admin — not limited to own notes)
	 */
	updateNote: adminProcedure
		.input(adminUpdateNoteInput)
		.mutation(async ({ input }) => {
			return await updateNoteAdmin(input.id, input.content);
		}),

	/**
	 * Delete any lead note (admin — not limited to own notes)
	 */
	deleteNote: adminProcedure
		.input(adminDeleteNoteInput)
		.mutation(async ({ input }) => {
			return await deleteNoteAdmin(input.id);
		}),

	/**
	 * Log a call interaction for a lead
	 */
	logCall: adminProcedure
		.input(adminLogCallInput)
		.mutation(async ({ input, ctx }) => {
			await logCallForLeadAdmin(
				input.leadId,
				input.content,
				ctx.session.user.id,
			);
			return { success: true };
		}),

	/**
	 * Log an email interaction for a lead
	 */
	logEmail: adminProcedure
		.input(adminLogEmailInput)
		.mutation(async ({ input, ctx }) => {
			await logEmailForLeadAdmin(
				input.leadId,
				input.content,
				ctx.session.user.id,
			);
			return { success: true };
		}),
});
