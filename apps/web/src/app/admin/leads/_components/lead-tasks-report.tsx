"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RiAlarmWarningLine, RiCheckboxCircleLine, RiTodoLine } from "@remixicon/react";
import { TASK_TYPE_LABELS } from "./lead-constants";
import type { TaskType } from "./lead-models";

export function LeadTasksReport({ enabled = true }: { enabled?: boolean }) {
	const [status, setStatus] = useState<"__all__" | "open" | "overdue" | "completed">(
		"__all__",
	);

	const { data, isLoading } = trpc.leadTasks.listReport.useQuery(
		{
			status: status === "__all__" ? undefined : status,
			limit: 50,
			offset: 0,
		},
		{ enabled, staleTime: 3 * 60 * 1000 },
	);

	const summary = data?.summary;

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<RiTodoLine className="size-4" />
					Agent Task Report
				</CardTitle>
				<Select
					value={status}
					onValueChange={(v) =>
						setStatus(v as "open" | "overdue" | "completed" | "__all__")
					}
				>
					<SelectTrigger className="h-8 w-[140px] text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">All tasks</SelectItem>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="overdue">Overdue</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<div className="grid gap-3 sm:grid-cols-4">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-16 rounded-lg" />
						))}
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-4">
						<div className="rounded-lg border bg-muted/30 p-3">
							<p className="text-muted-foreground text-xs">Open</p>
							<p className="font-semibold text-xl">{summary?.open ?? 0}</p>
						</div>
						<div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
							<p className="flex items-center gap-1 text-red-600 text-xs dark:text-red-400">
								<RiAlarmWarningLine className="size-3" />
								Overdue
							</p>
							<p className="font-semibold text-red-700 text-xl dark:text-red-400">
								{summary?.overdue ?? 0}
							</p>
						</div>
						<div className="rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/20">
							<p className="text-muted-foreground text-xs">Due today</p>
							<p className="font-semibold text-xl">{summary?.dueToday ?? 0}</p>
						</div>
						<div className="rounded-lg border bg-green-50/50 p-3 dark:bg-green-950/20">
							<p className="flex items-center gap-1 text-green-700 text-xs dark:text-green-400">
								<RiCheckboxCircleLine className="size-3" />
								Completed
							</p>
							<p className="font-semibold text-green-700 text-xl dark:text-green-400">
								{summary?.completed ?? 0}
							</p>
						</div>
					</div>
				)}

				<div className="overflow-x-auto rounded-lg border">
					<table className="w-full min-w-[640px] text-sm">
						<thead className="border-b bg-muted/40 text-left text-muted-foreground text-xs">
							<tr>
								<th className="px-3 py-2 font-medium">Task</th>
								<th className="px-3 py-2 font-medium">Lead</th>
								<th className="px-3 py-2 font-medium">Agent</th>
								<th className="px-3 py-2 font-medium">Due</th>
								<th className="px-3 py-2 font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{isLoading ? (
								<tr>
									<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
										Loading…
									</td>
								</tr>
							) : (data?.tasks ?? []).length === 0 ? (
								<tr>
									<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
										No tasks match this filter
									</td>
								</tr>
							) : (
								data?.tasks.map((task) => (
									<tr key={task.id} className="border-b last:border-0">
										<td className="px-3 py-2">
											<p className="font-medium">{task.title}</p>
											<p className="text-muted-foreground text-xs">
												{TASK_TYPE_LABELS[task.taskType as TaskType]}
											</p>
										</td>
										<td className="px-3 py-2">{task.prospectName ?? "—"}</td>
										<td className="px-3 py-2">{task.agentName ?? "Unassigned"}</td>
										<td className="px-3 py-2">
											{new Date(task.dueDate).toLocaleString([], {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</td>
										<td className="px-3 py-2">
											{task.completedAt ? (
												<span className="text-green-600 text-xs">Done</span>
											) : task.isOverdue ? (
												<span className="text-red-600 text-xs">Overdue</span>
											) : (
												<span className="text-muted-foreground text-xs">Open</span>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
