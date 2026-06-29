import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	completeLeadTaskSchema,
	insertLeadTaskSchema,
	updateLeadTaskSchema,
} from "../models/lead-tasks";
import {
	completeLeadTask,
	createLeadTask,
	deleteLeadTask,
	getLeadTasksReport,
	getTaskProspectAgentId,
	getTasksForAgentToday,
	getTasksForLead,
	getTodaysTasks,
	getUpcomingTasks,
	updateLeadTask,
} from "../services/lead-tasks";
import { canAgentAccessProspect } from "../services/leads";
import { hasAdminAccess } from "../utils/user-roles";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";

async function assertAgentCanManageProspect(agentId: string, prospectId: string) {
	const allowed = await canAgentAccessProspect(prospectId, agentId);
	if (!allowed) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only manage tasks on leads you own or follow",
		});
	}
}

async function assertAgentCanManageTask(agentId: string, taskId: string) {
	const meta = await getTaskProspectAgentId(taskId);
	if (!meta) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
	}
	const allowed = await canAgentAccessProspect(meta.prospectId, agentId);
	if (!allowed) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only manage tasks on leads you own or follow",
		});
	}
}

function sessionUser(ctx: {
	session: { user: { id: string; role?: string | null; roles?: string[] | null } };
}) {
	return ctx.session.user;
}

function assertAdminOrAgentProspect(
	ctx: { session: { user: { id: string; role?: string | null; roles?: string[] | null } } },
	prospectId: string,
) {
	if (hasAdminAccess(sessionUser(ctx))) return Promise.resolve();
	return assertAgentCanManageProspect(ctx.session.user.id, prospectId);
}

function assertAdminOrAgentTask(
	ctx: { session: { user: { id: string; role?: string | null; roles?: string[] | null } } },
	taskId: string,
) {
	if (hasAdminAccess(sessionUser(ctx))) return Promise.resolve();
	return assertAgentCanManageTask(ctx.session.user.id, taskId);
}

export const leadTasksRouter = router({
	/**
	 * Get all tasks for a specific lead (agent: own leads only; admin: any)
	 */
	list: protectedProcedure
		.input(z.object({ prospectId: z.string().uuid() }))
		.query(async ({ input, ctx }) => {
			await assertAdminOrAgentProspect(ctx, input.prospectId);
			return await getTasksForLead(input.prospectId);
		}),

	/**
	 * Agent: overdue + today's tasks on assigned leads
	 */
	listMyToday: protectedProcedure.query(async ({ ctx }) => {
		return await getTasksForAgentToday(ctx.session.user.id);
	}),

	/**
	 * Admin: overdue + today's tasks across all leads
	 */
	listToday: adminProcedure.query(async () => {
		return await getTodaysTasks();
	}),

	/**
	 * Admin: task report with filters
	 */
	listReport: adminProcedure
		.input(
			z.object({
				agentId: z.string().optional(),
				status: z.enum(["open", "completed", "overdue"]).optional(),
				limit: z.number().min(1).max(200).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ input }) => {
			return await getLeadTasksReport(input);
		}),

	/**
	 * Get upcoming tasks for the next N days (admin)
	 */
	listUpcoming: adminProcedure
		.input(z.object({ days: z.number().min(1).max(30).default(7) }))
		.query(async ({ input }) => {
			return await getUpcomingTasks(input.days);
		}),

	/**
	 * Create a new task linked to a lead
	 */
	create: protectedProcedure
		.input(insertLeadTaskSchema)
		.mutation(async ({ input, ctx }) => {
			await assertAdminOrAgentProspect(ctx, input.prospectId);
			const assignedTo =
				input.assignedTo ??
				(hasAdminAccess(sessionUser(ctx)) ? null : ctx.session.user.id);
			return await createLeadTask(
				{ ...input, assignedTo },
				ctx.session.user.id,
			);
		}),

	/**
	 * Update task fields
	 */
	update: protectedProcedure
		.input(updateLeadTaskSchema)
		.mutation(async ({ input, ctx }) => {
			await assertAdminOrAgentTask(ctx, input.id);
			return await updateLeadTask(input);
		}),

	/**
	 * Mark a task as complete or reopen it
	 */
	complete: protectedProcedure
		.input(completeLeadTaskSchema)
		.mutation(async ({ input, ctx }) => {
			await assertAdminOrAgentTask(ctx, input.id);
			return await completeLeadTask(input.id, input.completed);
		}),

	/**
	 * Delete a task permanently
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			await assertAdminOrAgentTask(ctx, input.id);
			return await deleteLeadTask(input.id);
		}),
});
