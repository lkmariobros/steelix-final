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
	getTasksForLead,
	getTodaysTasks,
	getUpcomingTasks,
	updateLeadTask,
} from "../services/lead-tasks";
import { adminProcedure, router } from "../utils/trpc";

export const leadTasksRouter = router({
	/**
	 * Get all tasks for a specific lead (ordered: pending first, then completed)
	 */
	list: adminProcedure
		.input(z.object({ prospectId: z.string().uuid() }))
		.query(async ({ input }) => {
			return await getTasksForLead(input.prospectId);
		}),

	/**
	 * Get overdue + today's tasks across all leads (dashboard widget)
	 */
	listToday: adminProcedure.query(async () => {
		return await getTodaysTasks();
	}),

	/**
	 * Get upcoming tasks for the next N days (default: 7)
	 */
	listUpcoming: adminProcedure
		.input(z.object({ days: z.number().min(1).max(30).default(7) }))
		.query(async ({ input }) => {
			return await getUpcomingTasks(input.days);
		}),

	/**
	 * Create a new task linked to a lead
	 */
	create: adminProcedure
		.input(insertLeadTaskSchema)
		.mutation(async ({ input, ctx }) => {
			return await createLeadTask(input, ctx.session.user.id);
		}),

	/**
	 * Update task fields (title, type, priority, due date, notes, assignee)
	 */
	update: adminProcedure
		.input(updateLeadTaskSchema)
		.mutation(async ({ input }) => {
			return await updateLeadTask(input);
		}),

	/**
	 * Mark a task as complete or reopen it
	 */
	complete: adminProcedure
		.input(completeLeadTaskSchema)
		.mutation(async ({ input }) => {
			return await completeLeadTask(input.id, input.completed);
		}),

	/**
	 * Delete a task permanently
	 */
	delete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			return await deleteLeadTask(input.id);
		}),
});
