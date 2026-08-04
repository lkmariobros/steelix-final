"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	RiAlarmWarningLine,
	RiCalendar2Line,
	RiNotification3Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import type { LeadTask, TaskPriority, TaskType } from "@/app/admin/leads/_components/lead-models";
import {
	TASK_PRIORITY_CONFIG,
	TASK_TYPE_ICONS,
	TASK_TYPE_LABELS,
} from "@/app/admin/leads/_components/lead-constants";

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

export function TaskRemindersButton() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const utils = trpc.useUtils();

	const { data: tasks, isLoading, isFetching, refetch } =
		trpc.leadTasks.listMyReminders.useQuery(
			{ upcomingDays: 30 },
			{
				staleTime: 15_000,
				refetchOnWindowFocus: true,
			},
		);

	const completeMutation = trpc.leadTasks.complete.useMutation({
		onSuccess: async (task) => {
			toast.success(task.completedAt ? "Task completed ✓" : "Task reopened");
			await utils.leadTasks.listMyReminders.invalidate();
			await utils.leadTasks.listMyToday.invalidate();
			queryClient.invalidateQueries({ queryKey: [["leadTasks"]] });
		},
		onError: (e) => toast.error(e.message),
	});

	const { overdue, dueToday, upcoming } = useMemo(
		() => categorizeTasks((tasks ?? []) as LeadTask[]),
		[tasks],
	);

	const attentionCount = overdue.length + dueToday.length;
	const badgeCount = attentionCount > 0 ? attentionCount : upcoming.length;
	const badgeUrgent = attentionCount > 0;

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (next) {
			void refetch();
		}
	};

	const handleViewLead = (leadId: string) => {
		setOpen(false);
		const href = `/dashboard/crm?lead=${encodeURIComponent(leadId)}`;
		if (pathname.startsWith("/dashboard/crm")) {
			router.replace(href);
			return;
		}
		router.push(href);
	};

	const visible = (tasks ?? []).slice(0, 12) as LeadTask[];

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="relative gap-2 text-muted-foreground hover:text-foreground"
					aria-label="Task reminders"
				>
					<RiNotification3Line className="size-4" />
					<span className="hidden sm:inline">Tasks</span>
					{badgeCount > 0 ? (
						<span
							className={cn(
								"absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold text-[10px] leading-none tabular-nums text-white",
								badgeUrgent ? "bg-red-500" : "bg-blue-500",
							)}
						>
							{badgeCount > 99 ? "99+" : badgeCount}
						</span>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[22rem] p-0 sm:w-[24rem]">
				<div className="flex items-center justify-between border-b px-3 py-2.5">
					<div>
						<p className="font-semibold text-sm">Task reminders</p>
						<p className="text-muted-foreground text-xs">
							Overdue, due today, and next 30 days
						</p>
					</div>
					<div className="flex flex-wrap justify-end gap-1">
						{isFetching ? (
							<span className="text-muted-foreground text-[0.65rem]">
								Updating…
							</span>
						) : null}
						{overdue.length > 0 ? (
							<span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-[0.65rem] text-red-700 dark:bg-red-900/20 dark:text-red-400">
								{overdue.length} overdue
							</span>
						) : null}
						{dueToday.length > 0 ? (
							<span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[0.65rem] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
								{dueToday.length} today
							</span>
						) : null}
					</div>
				</div>

				<div className="max-h-[22rem] overflow-y-auto">
					{isLoading ? (
						<div className="space-y-2 p-3">
							{[1, 2, 3].map((i) => (
								<div key={i} className="space-y-2 rounded-lg border p-3">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
								</div>
							))}
						</div>
					) : visible.length === 0 ? (
						<div className="space-y-1 px-3 py-8 text-center">
							<p className="text-muted-foreground text-sm">
								No task reminders right now.
							</p>
							<p className="text-muted-foreground text-xs">
								Create a task with a due date within the next 30 days to see it
								here.
							</p>
						</div>
					) : (
						<ul className="divide-y">
							{visible.map((task) => {
								const isUpcoming =
									!task.isOverdue && !isDueToday(task.dueDate);
								return (
									<li key={task.id} className="p-3">
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
											<div className="min-w-0 flex-1">
												<p
													className={cn(
														"line-clamp-2 font-medium text-sm leading-snug",
														task.isOverdue && "text-red-700 dark:text-red-400",
													)}
												>
													{task.title}
												</p>
												<p className="mt-0.5 text-muted-foreground text-xs">
													Lead: {task.prospectName ?? "—"} ·{" "}
													{TASK_TYPE_LABELS[task.taskType as TaskType]}
												</p>
												<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
													{task.isOverdue ? (
														<span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 font-semibold text-[0.65rem] text-red-700 dark:bg-red-900/20 dark:text-red-400">
															<RiAlarmWarningLine className="mr-1 size-2.5" />
															{new Date(task.dueDate).toLocaleDateString([], {
																month: "short",
																day: "numeric",
															})}
														</span>
													) : isUpcoming ? (
														<span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[0.65rem] text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
															<RiCalendar2Line className="mr-1 size-2.5" />
															{new Date(task.dueDate).toLocaleDateString([], {
																month: "short",
																day: "numeric",
															})}
														</span>
													) : (
														<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-[0.65rem] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
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
												<div className="mt-2 flex justify-end gap-1">
													<Button
														variant="ghost"
														size="sm"
														className="h-7 px-2 text-xs"
														disabled={completeMutation.isPending}
														onClick={() =>
															completeMutation.mutate({
																id: task.id,
																completed: true,
															})
														}
													>
														Done
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 px-2 text-xs"
														onClick={() => handleViewLead(task.prospectId)}
													>
														View
													</Button>
												</div>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{(tasks?.length ?? 0) > 0 ? (
					<div className="border-t px-3 py-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-full text-xs"
							onClick={() => {
								setOpen(false);
								router.push("/dashboard/crm");
							}}
						>
							Open My Leads
						</Button>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
