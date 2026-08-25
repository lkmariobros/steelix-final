"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDateDMY } from "@/lib/date-format";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	RiAlarmWarningLine,
	RiCheckLine,
	RiEyeLine,
	RiTimeLine,
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

function formatTaskWhen(task: LeadTask, isUpcoming: boolean) {
	const d = new Date(task.dueDate);
	if (task.isOverdue || isUpcoming) {
		return formatDateDMY(d);
	}
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const priorityBadge: Record<TaskPriority, string> = {
	low: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
	normal: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
	high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	urgent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

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
		{ upcomingDays: 30 },
		{
			staleTime: 15_000,
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
			<section className="rounded-2xl bg-[#eef3f5] p-4 shadow-card dark:bg-teal-950/25 sm:p-5">
				<div className="mb-4 flex items-center justify-between">
					<div className="space-y-1.5">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-3 w-56" />
					</div>
					<Skeleton className="h-6 w-20 rounded-full" />
				</div>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="space-y-3 rounded-2xl border border-border/40 bg-card p-4"
						>
							<Skeleton className="h-4 w-4/5" />
							<Skeleton className="h-3 w-2/3" />
							<div className="flex justify-between pt-1">
								<Skeleton className="h-5 w-24 rounded-full" />
								<Skeleton className="h-5 w-16" />
							</div>
						</div>
					))}
				</div>
			</section>
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
		<section className="rounded-2xl bg-[#eef3f5] p-4 shadow-card dark:bg-teal-950/25 sm:p-5">
			{/* Header — matches “Upcoming Meetings” shell */}
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="font-semibold text-base text-foreground tracking-tight">
						{headerTitle}
					</h3>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{headerSubtitle}
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
					{overdue.length > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700 text-[11px] dark:bg-rose-900/30 dark:text-rose-300">
							<RiAlarmWarningLine className="size-3" />
							{overdue.length} overdue
						</span>
					)}
					{dueToday.length > 0 && (
						<span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 font-medium text-primary text-[11px]">
							{dueToday.length} today
						</span>
					)}
					{scope === "agent" && upcoming.length > 0 && (
						<span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700 text-[11px] dark:bg-sky-900/30 dark:text-sky-300">
							{upcoming.length} upcoming
						</span>
					)}
				</div>
			</div>

			{/* Nested meeting-style cards */}
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{visible.map((task) => {
					const isUpcoming = !task.isOverdue && !isDueToday(task.dueDate);
					const priority = task.priority as TaskPriority;
					const taskType = task.taskType as TaskType;

					return (
						<article
							key={task.id}
							className={cn(
								"group flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
								task.isOverdue && "ring-1 ring-rose-200/80 dark:ring-rose-900/50",
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 space-y-1.5">
									<p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">
										{task.title}
									</p>
									<div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
										<span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
											{TASK_TYPE_ICONS[taskType]}
										</span>
										<span className="truncate">
											<button
												type="button"
												className="font-medium text-foreground/80 hover:text-primary hover:underline"
												onClick={() => onViewLead(task.prospectId)}
											>
												{task.prospectName ?? "View lead"}
											</button>
											<span className="text-muted-foreground">
												{" "}
												· {TASK_TYPE_LABELS[taskType]}
											</span>
										</span>
									</div>
								</div>
							</div>

							<div className="mt-auto flex flex-wrap items-center gap-2">
								<span
									className={cn(
										"inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-[11px]",
										priorityBadge[priority] ?? priorityBadge.normal,
									)}
								>
									{TASK_PRIORITY_CONFIG[priority]?.label ?? "Normal"}
								</span>

								<span
									className={cn(
										"inline-flex items-center gap-1 text-xs tabular-nums",
										task.isOverdue
											? "font-medium text-rose-600 dark:text-rose-400"
											: "text-muted-foreground",
									)}
								>
									{task.isOverdue ? (
										<RiAlarmWarningLine className="size-3.5 shrink-0" />
									) : (
										<RiTimeLine className="size-3.5 shrink-0" />
									)}
									{formatTaskWhen(task, isUpcoming)}
								</span>

								<div className="ml-auto flex items-center gap-0.5">
									<Button
										variant="ghost"
										size="sm"
										className="h-8 gap-1 px-2 font-medium text-muted-foreground text-xs hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
										onClick={() =>
											completeMutation.mutate({
												id: task.id,
												completed: true,
											})
										}
										disabled={completeMutation.isPending}
									>
										<RiCheckLine className="size-3.5" />
										Done
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 gap-1 px-2 font-medium text-muted-foreground text-xs hover:bg-primary/10 hover:text-primary"
										onClick={() => onViewLead(task.prospectId)}
									>
										<RiEyeLine className="size-3.5" />
										View
									</Button>
								</div>
							</div>
						</article>
					);
				})}
			</div>

			{totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between border-border/50 border-t pt-3">
					<p className="text-muted-foreground text-xs">
						Showing {(safePage - 1) * PAGE_SIZE + 1}–
						{Math.min(safePage * PAGE_SIZE, tasks.length)} of {tasks.length}
					</p>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-7 rounded-lg bg-card px-2.5 text-xs"
							disabled={safePage === 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
						>
							Prev
						</Button>
						<span className="text-muted-foreground text-xs tabular-nums">
							{safePage} / {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							className="h-7 rounded-lg bg-card px-2.5 text-xs"
							disabled={safePage === totalPages}
							onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
