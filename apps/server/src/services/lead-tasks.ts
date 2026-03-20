import type {
	InsertLeadTask,
	LeadTask,
	UpdateLeadTask,
} from "../models/lead-tasks";
import { pool } from "../utils/db";

/**
 * Lead Tasks Service
 *
 * All queries use raw SQL via the shared pg Pool so the lead_tasks table
 * does not need to be added to the Drizzle schema.
 * User name lookups join against public."user" (Better Auth user table).
 */

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): LeadTask {
	const now = new Date();
	const dueDate = new Date(row.due_date as string);
	const completedAt = row.completed_at
		? new Date(row.completed_at as string)
		: null;

	return {
		id: row.id as string,
		prospectId: row.prospect_id as string,
		prospectName: (row.prospect_name as string) ?? null,
		title: row.title as string,
		taskType: row.task_type as LeadTask["taskType"],
		priority: row.priority as LeadTask["priority"],
		dueDate,
		completedAt,
		assignedTo: (row.assigned_to as string) ?? null,
		assignedToName: (row.assigned_to_name as string) ?? null,
		createdBy: row.created_by as string,
		createdByName: (row.created_by_name as string) ?? null,
		notes: (row.notes as string) ?? null,
		createdAt: new Date(row.created_at as string),
		updatedAt: new Date(row.updated_at as string),
		isOverdue: !completedAt && dueDate < now,
	};
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get all tasks for a specific lead.
 * Pending tasks (ordered by due date) come first, completed tasks at the end.
 */
export async function getTasksForLead(prospectId: string): Promise<LeadTask[]> {
	const res = await pool.query(
		`SELECT
      t.id,
      t.prospect_id,
      NULL::text                           AS prospect_name,
      t.title,
      t.task_type,
      t.priority,
      t.due_date,
      t.completed_at,
      t.assigned_to,
      t.created_by,
      t.notes,
      t.created_at,
      t.updated_at,
      au.name                              AS assigned_to_name,
      cu.name                              AS created_by_name
    FROM  public.lead_tasks t
    LEFT JOIN public."user" au ON au.id = t.assigned_to
    LEFT JOIN public."user" cu ON cu.id = t.created_by
    WHERE t.prospect_id = $1
    ORDER BY
      (t.completed_at IS NOT NULL) ASC,   -- pending first
      t.due_date ASC`,
		[prospectId],
	);

	return res.rows.map(mapRow);
}

/**
 * Get all overdue + today's tasks across every lead (dashboard widget).
 * Returns at most 100 rows, ordered by due date ascending.
 */
export async function getTodaysTasks(): Promise<LeadTask[]> {
	const res = await pool.query(
		`SELECT
      t.id,
      t.prospect_id,
      p.name                               AS prospect_name,
      t.title,
      t.task_type,
      t.priority,
      t.due_date,
      t.completed_at,
      t.assigned_to,
      t.created_by,
      t.notes,
      t.created_at,
      t.updated_at,
      au.name                              AS assigned_to_name,
      cu.name                              AS created_by_name
    FROM  public.lead_tasks t
    LEFT JOIN public.prospects p  ON p.id  = t.prospect_id
    LEFT JOIN public."user"    au ON au.id = t.assigned_to
    LEFT JOIN public."user"    cu ON cu.id = t.created_by
    WHERE t.completed_at IS NULL
      AND t.due_date::date <= CURRENT_DATE
    ORDER BY t.due_date ASC
    LIMIT 100`,
	);

	return res.rows.map(mapRow);
}

/**
 * Get upcoming tasks for the next N days (optional dashboard extension).
 */
export async function getUpcomingTasks(days = 7): Promise<LeadTask[]> {
	const res = await pool.query(
		`SELECT
      t.id,
      t.prospect_id,
      p.name                               AS prospect_name,
      t.title,
      t.task_type,
      t.priority,
      t.due_date,
      t.completed_at,
      t.assigned_to,
      t.created_by,
      t.notes,
      t.created_at,
      t.updated_at,
      au.name                              AS assigned_to_name,
      cu.name                              AS created_by_name
    FROM  public.lead_tasks t
    LEFT JOIN public.prospects p  ON p.id  = t.prospect_id
    LEFT JOIN public."user"    au ON au.id = t.assigned_to
    LEFT JOIN public."user"    cu ON cu.id = t.created_by
    WHERE t.completed_at IS NULL
      AND t.due_date::date > CURRENT_DATE
      AND t.due_date::date <= (CURRENT_DATE + $1::int)
    ORDER BY t.due_date ASC
    LIMIT 100`,
		[days],
	);

	return res.rows.map(mapRow);
}

/**
 * Create a new task linked to a lead.
 */
export async function createLeadTask(
	input: InsertLeadTask,
	createdBy: string,
): Promise<LeadTask> {
	const res = await pool.query(
		`INSERT INTO public.lead_tasks
      (prospect_id, title, task_type, priority, due_date, assigned_to, created_by, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
		[
			input.prospectId,
			input.title,
			input.taskType ?? "follow_up",
			input.priority ?? "normal",
			input.dueDate,
			input.assignedTo ?? null,
			createdBy,
			input.notes ?? null,
		],
	);

	const row = res.rows[0];
	if (!row) throw new Error("Failed to create task");

	// Fetch with name joins so the returned object is complete
	return (await getTasksForLead(input.prospectId)).find(
		(t) => t.id === row.id,
	)!;
}

/**
 * Update a task's fields.
 */
export async function updateLeadTask(input: UpdateLeadTask): Promise<LeadTask> {
	// Build dynamic SET clause
	const sets: string[] = ["updated_at = NOW()"];
	const values: unknown[] = [];
	let idx = 1;

	if (input.title !== undefined) {
		sets.push(`title = $${idx++}`);
		values.push(input.title);
	}
	if (input.taskType !== undefined) {
		sets.push(`task_type = $${idx++}`);
		values.push(input.taskType);
	}
	if (input.priority !== undefined) {
		sets.push(`priority = $${idx++}`);
		values.push(input.priority);
	}
	if (input.dueDate !== undefined) {
		sets.push(`due_date = $${idx++}`);
		values.push(input.dueDate);
	}
	if ("assignedTo" in input) {
		sets.push(`assigned_to = $${idx++}`);
		values.push(input.assignedTo ?? null);
	}
	if ("notes" in input) {
		sets.push(`notes = $${idx++}`);
		values.push(input.notes ?? null);
	}

	values.push(input.id);

	const res = await pool.query(
		`UPDATE public.lead_tasks
    SET ${sets.join(", ")}
    WHERE id = $${idx}
    RETURNING prospect_id`,
		values,
	);

	if (res.rowCount === 0) throw new Error("Task not found");
	const prospectId = res.rows[0].prospect_id as string;

	const tasks = await getTasksForLead(prospectId);
	const updated = tasks.find((t) => t.id === input.id);
	if (!updated) throw new Error("Task not found after update");
	return updated;
}

/**
 * Mark a task as complete (or reopen it by passing completed = false).
 */
export async function completeLeadTask(
	id: string,
	completed: boolean,
): Promise<LeadTask> {
	const res = await pool.query(
		`UPDATE public.lead_tasks
    SET completed_at = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING prospect_id`,
		[completed ? new Date() : null, id],
	);

	if (res.rowCount === 0) throw new Error("Task not found");
	const prospectId = res.rows[0].prospect_id as string;

	const tasks = await getTasksForLead(prospectId);
	const updated = tasks.find((t) => t.id === id);
	if (!updated) throw new Error("Task not found after update");
	return updated;
}

/**
 * Delete a task permanently.
 */
export async function deleteLeadTask(id: string): Promise<{ success: true }> {
	const res = await pool.query(
		`DELETE FROM public.lead_tasks WHERE id = $1`,
		[id],
	);

	if (res.rowCount === 0) throw new Error("Task not found");
	return { success: true };
}
