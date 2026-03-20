import { z } from "zod";
import {
	insertProspectSchema,
	pipelineStageSchema,
	updateProspectSchema,
} from "../models/crm";
import {
	addNoteToLeadAdmin,
	assignLeadAdmin,
	bulkUpdateLeadsStageAdmin,
	checkLeadDuplicateAdmin,
	createLeadAdmin,
	deleteLeadAdmin,
	getAgentsWithLeads,
	getAllLeadsAdmin,
	getLeadActivityAdmin,
	getLeadByIdAdmin,
	getLeadsStatsAdmin,
	logCallForLeadAdmin,
	logEmailForLeadAdmin,
	updateLeadAdmin,
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
	agentId: z.string().optional(), // admin can assign to any agent
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

const adminBulkUpdateStageInput = z.object({
	ids: z.array(z.string().uuid()).min(1),
	stage: pipelineStageSchema,
});

const adminAddNoteInput = z.object({
	leadId: z.string().uuid(),
	content: z.string().min(1, "Note content is required"),
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
	email: z.string().email(),
	phone: z.string().min(1),
	excludeId: z.string().uuid().optional(), // pass when editing an existing lead
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
	 * Get the list of agents that have at least one lead (for filter dropdown)
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
				input.email,
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

	/**
	 * Bulk update pipeline stage for multiple leads
	 */
	bulkUpdateStage: adminProcedure
		.input(adminBulkUpdateStageInput)
		.mutation(async ({ input }) => {
			return await bulkUpdateLeadsStageAdmin(input.ids, input.stage);
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
