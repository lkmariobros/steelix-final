"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RiAlarmWarningLine, RiAddLine, RiCalendar2Line, RiCheckboxMultipleLine, RiCheckLine, RiDeleteBinLine, RiEditLine, RiLoader4Line, RiTodoLine } from "@remixicon/react";
import type { LeadTask, TaskPriority, TaskType } from "./lead-models";
import { TASK_PRIORITY_CONFIG, TASK_TYPE_LABELS } from "./lead-constants";
import { DateTimePicker } from "./date-time-picker";
import { TaskPriorityBadge } from "./lead-ui";

function formatDue(d: Date | string) {
	const dt = new Date(d);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);
	const taskDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

	if (taskDay.getTime() === today.getTime())
		return `Today ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	if (taskDay.getTime() === tomorrow.getTime())
		return `Tomorrow ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	return dt.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: dt.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function LeadTasksCard({ leadId }: { leadId: string }) {
	const queryClient = useQueryClient();

	const { data: tasks, isLoading: tasksLoading } = trpc.leadTasks.list.useQuery(
		{ prospectId: leadId },
		{ staleTime: 0 },
	);

	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState<{
		title: string;
		taskType: TaskType;
		priority: TaskPriority;
		dueDate: string;
		notes: string;
	}>({
		title: "",
		taskType: "follow_up",
		priority: "normal",
		dueDate: "",
		notes: "",
	});

	// Inline edit state
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<{
		title: string;
		taskType: TaskType;
		priority: TaskPriority;
		dueDate: string;
		notes: string;
	}>({
		title: "",
		taskType: "follow_up",
		priority: "normal",
		dueDate: "",
		notes: "",
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: [["leadTasks", "list"]] });
		queryClient.invalidateQueries({ queryKey: [["leadTasks", "listToday"]] });
	};

	const createMutation = trpc.leadTasks.create.useMutation({
		onSuccess: () => {
			toast.success("Task created");
			setShowForm(false);
			setForm({
				title: "",
				taskType: "follow_up",
				priority: "normal",
				dueDate: "",
				notes: "",
			});
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const updateMutation = trpc.leadTasks.update.useMutation({
		onSuccess: () => {
			toast.success("Task updated");
			setEditingTaskId(null);
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const completeMutation = trpc.leadTasks.complete.useMutation({
		onSuccess: (task) => {
			toast.success(task.completedAt ? "Task completed ✓" : "Task reopened");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const deleteMutation = trpc.leadTasks.delete.useMutation({
		onSuccess: () => {
			toast.success("Task deleted");
			invalidate();
		},
		onError: (e) => toast.error(e.message),
	});

	const handleCreate = () => {
		if (!form.title.trim() || !form.dueDate) return;
		createMutation.mutate({
			prospectId: leadId,
			title: form.title.trim(),
			taskType: form.taskType,
			priority: form.priority,
			dueDate: new Date(form.dueDate),
			notes: form.notes.trim() || null,
		});
	};

	const handleStartEdit = (task: LeadTask) => {
		const dt = new Date(task.dueDate);
		const pad = (n: number) => String(n).padStart(2, "0");
		const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
		setEditForm({
			title: task.title,
			taskType: task.taskType,
			priority: task.priority,
			dueDate: local,
			notes: task.notes ?? "",
		});
		setEditingTaskId(task.id);
	};

	const handleSaveEdit = () => {
		if (!editingTaskId || !editForm.title.trim() || !editForm.dueDate) return;
		updateMutation.mutate({
			id: editingTaskId,
			title: editForm.title.trim(),
			taskType: editForm.taskType,
			priority: editForm.priority,
			dueDate: new Date(editForm.dueDate),
			notes: editForm.notes.trim() || null,
		});
	};

	const pendingTasks = (tasks ?? []).filter((t) => !t.completedAt);
	const completedTasks = (tasks ?? []).filter((t) => !!t.completedAt);
	const overduePending = pendingTasks.filter((t) => t.isOverdue);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-sm">
						<RiTodoLine className="size-4" />
						Tasks & Follow-ups
						{pendingTasks.length > 0 && (
							<span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs">
								{pendingTasks.length}
							</span>
						)}
						{overduePending.length > 0 && (
							<span className="ml-0.5 rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/20 dark:text-red-400">
								{overduePending.length} overdue
							</span>
						)}
					</CardTitle>
					<Button
						size="sm"
						variant="ghost"
						className="h-7 gap-1 px-2 text-xs"
						onClick={() => setShowForm((v) => !v)}
					>
						<RiAddLine className="size-3.5" />
						Add Task
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				{/* ── Add Task Form ── */}
				{showForm && (
					<div className="space-y-3 rounded-md border bg-muted/30 p-3">
						<p className="font-medium text-xs">New Task</p>
						<div className="space-y-2">
							<Input
								placeholder="Task title e.g. Call Ahmad on Thursday 10am"
								value={form.title}
								onChange={(e) =>
									setForm((p) => ({ ...p, title: e.target.value }))
								}
								className="h-8 text-sm"
								autoFocus
							/>
							<div className="grid grid-cols-2 gap-2">
								<Select
									value={form.taskType}
									onValueChange={(v) =>
										setForm((p) => ({ ...p, taskType: v as TaskType }))
									}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]
										).map(([val, label]) => (
											<SelectItem key={val} value={val} className="text-xs">
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={form.priority}
									onValueChange={(v) =>
										setForm((p) => ({ ...p, priority: v as TaskPriority }))
									}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											Object.entries(
												TASK_PRIORITY_CONFIG,
											) as [TaskPriority, { label: string; color: string }][]
										).map(([val, cfg]) => (
											<SelectItem key={val} value={val} className="text-xs">
												{cfg.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<DateTimePicker
								value={form.dueDate}
								onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))}
								placeholder="Due date & time"
							/>
							<Textarea
								placeholder="Notes (optional)"
								value={form.notes}
								onChange={(e) =>
									setForm((p) => ({ ...p, notes: e.target.value }))
								}
								rows={2}
								className="resize-none bg-background text-xs"
							/>
						</div>
						<div className="flex gap-2">
							<Button
								size="sm"
								className="h-7 text-xs"
								disabled={
									!form.title.trim() || !form.dueDate || createMutation.isPending
								}
								onClick={handleCreate}
							>
								{createMutation.isPending && (
									<RiLoader4Line className="mr-1 size-3.5 animate-spin" />
								)}
								Save Task
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 text-xs"
								onClick={() => setShowForm(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{/* ── Task List ── */}
				{tasksLoading ? (
					<div className="space-y-2">
						{[1, 2].map((i) => (
							<div key={i} className="rounded-md border p-2.5">
								<div className="flex items-start justify-between gap-2">
									<div className="flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
									<div className="flex gap-1">
										<Skeleton className="h-7 w-7 rounded-md" />
										<Skeleton className="h-7 w-7 rounded-md" />
										<Skeleton className="h-7 w-7 rounded-md" />
									</div>
								</div>
							</div>
						))}
					</div>
				) : (tasks ?? []).length === 0 ? (
					<div className="flex flex-col items-center gap-1.5 py-6 text-center">
						<RiTodoLine className="size-7 text-muted-foreground/40" />
						<p className="text-muted-foreground text-sm">No tasks yet</p>
						<p className="text-muted-foreground text-xs">
							Click &ldquo;Add Task&rdquo; to create a follow-up reminder
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{/* Pending tasks */}
						{pendingTasks.map((task) =>
							editingTaskId === task.id ? (
								/* ── Inline Edit Form ── */
								<div
									key={task.id}
									className="space-y-2.5 rounded-md border border-primary/30 bg-muted/30 p-3"
								>
									<p className="font-medium text-xs text-primary">Edit Task</p>
									<Input
										value={editForm.title}
										onChange={(e) =>
											setEditForm((p) => ({ ...p, title: e.target.value }))
										}
										className="h-8 text-sm"
										autoFocus
									/>
									<div className="grid grid-cols-2 gap-2">
										<Select
											value={editForm.taskType}
											onValueChange={(v) =>
												setEditForm((p) => ({ ...p, taskType: v as TaskType }))
											}
										>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(
													Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]
												).map(([val, label]) => (
													<SelectItem
														key={val}
														value={val}
														className="text-xs"
													>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Select
											value={editForm.priority}
											onValueChange={(v) =>
												setEditForm((p) => ({
													...p,
													priority: v as TaskPriority,
												}))
											}
										>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{(
													Object.entries(TASK_PRIORITY_CONFIG) as [
														TaskPriority,
														{ label: string; color: string },
													][]
												).map(([val, cfg]) => (
													<SelectItem
														key={val}
														value={val}
														className="text-xs"
													>
														{cfg.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<DateTimePicker
										value={editForm.dueDate}
										onChange={(v) =>
											setEditForm((p) => ({ ...p, dueDate: v }))
										}
										placeholder="Due date & time"
									/>
									<Textarea
										placeholder="Notes (optional)"
										value={editForm.notes}
										onChange={(e) =>
											setEditForm((p) => ({ ...p, notes: e.target.value }))
										}
										rows={2}
										className="resize-none bg-background text-xs"
									/>
									<div className="flex gap-2">
										<Button
											size="sm"
											className="h-7 text-xs"
											disabled={
												!editForm.title.trim() ||
												!editForm.dueDate ||
												updateMutation.isPending
											}
											onClick={handleSaveEdit}
										>
											{updateMutation.isPending && (
												<RiLoader4Line className="mr-1 size-3.5 animate-spin" />
											)}
											Save Changes
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="h-7 text-xs"
											onClick={() => setEditingTaskId(null)}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								/* ── Task Row ── */
								<div
									key={task.id}
									className={`rounded-md border p-2.5 transition-colors ${
										task.isOverdue
											? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
											: "bg-muted/20 hover:bg-muted/40"
									}`}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-1.5">
												{task.isOverdue && (
													<RiAlarmWarningLine className="size-3.5 shrink-0 text-red-500" />
												)}
												<p
													className={`font-medium text-sm ${
														task.isOverdue
															? "text-red-700 dark:text-red-400"
															: ""
													}`}
												>
													{task.title}
												</p>
											</div>
											<div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
												<span className="text-muted-foreground">
													{TASK_TYPE_LABELS[task.taskType as TaskType]}
												</span>
												<span className="text-muted-foreground">·</span>
												<TaskPriorityBadge priority={task.priority} />
												<span className="text-muted-foreground">·</span>
												<span
													className={`flex items-center gap-0.5 ${
														task.isOverdue
															? "font-medium text-red-600 dark:text-red-400"
															: "text-muted-foreground"
													}`}
												>
													<RiCalendar2Line className="size-3" />
													{formatDue(task.dueDate)}
												</span>
											</div>
											{task.notes && (
												<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
													{task.notes}
												</p>
											)}
										</div>
										<div className="flex shrink-0 gap-0.5">
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600"
												title="Mark complete"
												onClick={() =>
													completeMutation.mutate({
														id: task.id,
														completed: true,
													})
												}
												disabled={completeMutation.isPending}
											>
												<RiCheckLine className="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
												title="Edit task"
												onClick={() => handleStartEdit(task)}
											>
												<RiEditLine className="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
												title="Delete task"
												onClick={() => deleteMutation.mutate({ id: task.id })}
												disabled={deleteMutation.isPending}
											>
												<RiDeleteBinLine className="size-3.5" />
											</Button>
										</div>
									</div>
								</div>
							),
						)}

						{/* Completed tasks (collapsed indicator) */}
						{completedTasks.length > 0 && (
							<details className="group">
								<summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground">
									<RiCheckboxMultipleLine className="size-3.5" />
									{completedTasks.length} completed task
									{completedTasks.length !== 1 ? "s" : ""}
								</summary>
								<div className="mt-2 space-y-1.5">
									{completedTasks.map((task) => (
										<div
											key={task.id}
											className="flex items-center justify-between gap-2 rounded-md border bg-muted/10 px-2.5 py-2 opacity-60"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm line-through">
													{task.title}
												</p>
												<p className="text-muted-foreground text-xs">
													{TASK_TYPE_LABELS[task.taskType as TaskType]} ·{" "}
													{task.completedAt
														? `Done ${new Date(task.completedAt).toLocaleDateString()}`
														: ""}
												</p>
											</div>
											<div className="flex shrink-0 gap-0.5">
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
													title="Reopen task"
													onClick={() =>
														completeMutation.mutate({
															id: task.id,
															completed: false,
														})
													}
													disabled={completeMutation.isPending}
												>
													Reopen
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
													title="Delete task"
													onClick={() =>
														deleteMutation.mutate({ id: task.id })
													}
													disabled={deleteMutation.isPending}
												>
													<RiDeleteBinLine className="size-3.5" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</details>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

