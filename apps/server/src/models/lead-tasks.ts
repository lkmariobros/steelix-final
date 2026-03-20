import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const taskTypeSchema = z.enum([
	"call",
	"email",
	"follow_up",
	"meeting",
	"other",
]);

export const taskPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const insertLeadTaskSchema = z.object({
	prospectId: z.string().uuid(),
	title: z.string().min(1, "Title is required"),
	taskType: taskTypeSchema.default("follow_up"),
	priority: taskPrioritySchema.default("normal"),
	dueDate: z.coerce.date(),
	assignedTo: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

export const updateLeadTaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).optional(),
	taskType: taskTypeSchema.optional(),
	priority: taskPrioritySchema.optional(),
	dueDate: z.coerce.date().optional(),
	assignedTo: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

export const completeLeadTaskSchema = z.object({
	id: z.string().uuid(),
	/** Pass false to reopen a completed task */
	completed: z.boolean().default(true),
});

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type InsertLeadTask = z.infer<typeof insertLeadTaskSchema>;
export type UpdateLeadTask = z.infer<typeof updateLeadTaskSchema>;

export interface LeadTask {
	id: string;
	prospectId: string;
	/** Name of the lead — populated when querying across all tasks */
	prospectName: string | null;
	title: string;
	taskType: TaskType;
	priority: TaskPriority;
	dueDate: Date;
	completedAt: Date | null;
	assignedTo: string | null;
	assignedToName: string | null;
	createdBy: string;
	createdByName: string | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	/** Computed — true when past due and not completed */
	isOverdue: boolean;
}
