"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	RiAlarmWarningLine,
	RiCalendar2Line,
	RiCheckLine,
	RiEyeLine,
	RiTodoLine,
} from "@remixicon/react";
import type { LeadTask, TaskPriority, TaskType } from "./lead-models";
import {
	TASK_PRIORITY_CONFIG,
	TASK_TYPE_ICONS,
	TASK_TYPE_LABELS,
} from "./lead-constants";

const PAGE_SIZE = 6;

function isDueToday(dueDate: Date | string): boolean {
	const dt = new Date(dueDate);
	const now = new Date();
	return (
		dt.getFullYear() === now.getFullYear() &&
		dt.getMonth() === now.getMonth() &&
		dt.getDate() === now.getDate()
	);
}

function categorizeTasks(tasks: LeadTask[]) {
	const overdue = tasks.filter((t) => t.isOverdue);
	const dueToday = tasks.filter((t) => !t.isOverdue && isDueToday(t.dueDate));
	const upcoming = tasks.filter((t) => !t.isOverdue && !isDueToday(t.dueDate));
	return { overdue, dueToday, upcoming };
}

export function TodayTasksWidget({
	onViewLead,
	scope = "admin",
	enabled = true,
}: {
	onViewLead: (leadId: string) => void;
	scope?: "admin" | "agent";
	enabled?: boolean;
}) {
	const adminQuery = trpc.leadTasks.listToday.useQuery(undefined, {
		staleTime: 3 * 60 * 1000,
		enabled: enabled && scope === "admin",
	});
	const agentQuery = trpc.leadTasks.listMyReminders.useQuery(
		{ upcomingDays: 7 },
		{
			staleTime: 3 * 60 * 1000,
			enabled: enabled && scope === "agent",
		},
	);

	const { data: tasks, isLoading } =
		scope === "agent" ? agentQuery : adminQuery;

	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);

	const completeMutation = trpc.leadTasks.complete.useMutation({
		onSuccess: (task) => {
			toast.success(task.completedAt ? "Task completed ✓" : "Task reopened");
			queryClient.invalidateQueries({ queryKey: [["leadTasks"]] });
		},
		onError: (e) => toast.error(e.message),
	});

	const { overdue, dueToday, upcoming } = useMemo(
		() => categorizeTasks(tasks ?? []),
		[tasks],
	);

	const totalPages = Math.max(1, Math.ceil((tasks?.length ?? 0) / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const visible = (tasks ?? []).slice(
		(safePage - 1) * PAGE_SIZE,
		safePage * PAGE_SIZE,
	);

	if (isLoading) {
		return (
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<div className="flex items-center gap-3 border-b px-4 py-3">
					<Skeleton className="size-8 shrink-0 rounded-lg" />
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-48" />
					</div>
				</div>
				<div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
					{[1, 2, 3, 4].map((i) => (
						<div
							key={i}
							className="flex flex-col gap-2.5 rounded-lg border p-3"
						>
							<div className="flex items-start gap-2">
								<Skeleton className="mt-0.5 size-6 shrink-0 rounded" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-3.5 w-4/5" />
									<Skeleton className="h-3 w-2/3" />
								</div>
							</div>
							<div className="flex items-center justify-between pt-1">
								<Skeleton className="h-5 w-20 rounded-full" />
								<div className="flex gap-1">
									<Skeleton className="size-6 rounded-md" />
									<Skeleton className="size-6 rounded-md" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!tasks || tasks.length === 0) return null;

	const headerTitle =
		scope === "agent" ? "Tasks & Reminders" : "Tasks Due Today";
	const headerSubtitle =
		scope === "agent"
			? "Overdue, due today, and upcoming follow-ups on your leads"
			: "Follow-ups & tasks that need your attention";

	return (
		<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
			{/* ── Header ── */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
						<RiTodoLine className="size-4 text-amber-600 dark:text-amber-400" />
					</div>
					<div>
						<h3 className="font-semibold text-sm">{headerTitle}</h3>
						<p className="text-muted-foreground text-xs">{headerSubtitle}</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-1.5">
					{overdue.length > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 text-xs dark:bg-red-900/20 dark:text-red-400">
							<RiAlarmWarningLine className="size-3" />
							{overdue.length} overdue
						</span>
					)}
					{dueToday.length > 0 && (
						<span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 text-xs dark:bg-amber-900/20 dark:text-amber-400">
							{dueToday.length} today
						</span>
					)}
					{scope === "agent" && upcoming.length > 0 && (
						<span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700 text-xs dark:bg-blue-900/20 dark:text-blue-400">
							{upcoming.length} upcoming
						</span>
					)}
				</div>
			</div>

			{/* ── Card Grid ── */}
			<div className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
				{visible.map((task) => {
					const isUpcoming = !task.isOverdue && !isDueToday(task.dueDate);
					return (
						<div
							key={task.id}
							className={cn(
								"group relative flex flex-col gap-2 overflow-hidden rounded-lg border transition-all hover:shadow-sm",
								task.isOverdue
									? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
									: isUpcoming
										? "border-blue-200/70 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-950/10"
										: "border-amber-200/70 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10",
							)}
						>
							<div
								className={cn(
									"absolute inset-y-0 left-0 w-0.5",
									task.isOverdue
										? "bg-red-500"
										: isUpcoming
											? "bg-blue-400"
											: "bg-amber-400",
								)}
							/>

							<div className="flex flex-col gap-2 pt-2.5 pr-3 pb-2.5 pl-3">
								<div className="flex items-start gap-2">
									<div
										className={cn(
											"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded",
											task.isOverdue
												? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
												: isUpcoming
													? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
													: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
										)}
									>
										{TASK_TYPE_ICONS[task.taskType as TaskType]}
									</div>
									<p
										className={cn(
											"line-clamp-2 font-semibold text-sm leading-snug",
											task.isOverdue && "text-red-700 dark:text-red-400",
										)}
									>
										{task.title}
									</p>
								</div>

								<div className="pl-8 text-xs">
									<span className="text-muted-foreground">Lead: </span>
									<button
										type="button"
										className="font-medium text-primary hover:underline"
										onClick={() => onViewLead(task.prospectId)}
									>
										{task.prospectName ?? "View lead"}
									</button>
									<span className="mx-1 opacity-40">·</span>
									<span className="text-muted-foreground">
										{TASK_TYPE_LABELS[task.taskType as TaskType]}
									</span>
								</div>

								<div className="flex items-center justify-between pl-8">
									<div className="flex items-center gap-1.5">
										{task.isOverdue ? (
											<span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 text-[0.65rem] dark:bg-red-900/20 dark:text-red-400">
												<RiAlarmWarningLine className="mr-1 size-2.5" />
												{new Date(task.dueDate).toLocaleDateString([], {
													month: "short",
													day: "numeric",
												})}
											</span>
										) : isUpcoming ? (
											<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 text-[0.65rem] dark:bg-blue-900/20 dark:text-blue-400">
												<RiCalendar2Line className="mr-1 size-2.5" />
												{new Date(task.dueDate).toLocaleDateString([], {
													month: "short",
													day: "numeric",
												})}
											</span>
										) : (
											<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 text-[0.65rem] dark:bg-amber-900/20 dark:text-amber-400">
												<RiCalendar2Line className="mr-1 size-2.5" />
												{new Date(task.dueDate).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										)}

										<span
											className={cn(
												"inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[0.65rem]",
												{
													"bg-muted text-muted-foreground":
														task.priority === "low",
													"bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400":
														task.priority === "normal",
													"bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400":
														task.priority === "high",
													"bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400":
														task.priority === "urgent",
												},
											)}
										>
											{
												TASK_PRIORITY_CONFIG[task.priority as TaskPriority]
													.label
											}
										</span>
									</div>

									<div className="flex items-center gap-0.5">
										<Button
											variant="ghost"
											size="sm"
											className="size-6 p-0 text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
											title="Mark complete"
											onClick={() =>
												completeMutation.mutate({
													id: task.id,
													completed: true,
												})
											}
											disabled={completeMutation.isPending}
										>
											<RiCheckLine className="size-3" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="size-6 p-0 text-muted-foreground hover:bg-accent"
											title="View lead"
											onClick={() => onViewLead(task.prospectId)}
										>
											<RiEyeLine className="size-3" />
										</Button>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
					<p className="text-muted-foreground text-xs">
						Showing {(safePage - 1) * PAGE_SIZE + 1}–
						{Math.min(safePage * PAGE_SIZE, tasks.length)} of {tasks.length}{" "}
						tasks
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={safePage === 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
						>
							Prev
						</Button>
						<span className="text-muted-foreground text-xs">
							{safePage} / {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							disabled={safePage === totalPages}
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
