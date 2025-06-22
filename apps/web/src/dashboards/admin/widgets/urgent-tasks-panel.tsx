"use client";

import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import {
	RiAlertLine,
	RiArrowRightLine,
	RiFireLine,
	RiTimeLine,
} from "@remixicon/react";
import React from "react";

// Import types and utilities
import type { UrgentTask } from "../admin-schema";
import { formatDateTime, getDaysAgo, getPriorityColor } from "../admin-schema";

interface UrgentTasksPanelProps {
	refreshKey?: number;
	className?: string;
}

export function UrgentTasksPanel({
	refreshKey,
	className,
}: UrgentTasksPanelProps) {
	// TEMPORARILY DISABLED - Mock data for testing
	// const {
	// 	data: urgentTasks,
	// 	isLoading,
	// 	error,
	// 	refetch
	// } = trpc.admin.getUrgentTasks.useQuery(
	// 	undefined,
	// 	{
	// 		refetchOnWindowFocus: false,
	// 		staleTime: 30000, // 30 seconds
	// 	}
	// );

	// Mock data for testing
	const urgentTasks = [
		{
			id: "1",
			type: "overdue_approval",
			title: "Overdue Commission Approval",
			description: "Transaction for Alice Johnson pending approval for 8 days",
			priority: "high" as const,
			agentName: "John Smith",
			createdAt: "2024-01-07T09:00:00Z",
		},
		{
			id: "2",
			type: "overdue_approval",
			title: "Overdue Commission Approval",
			description: "Transaction for Bob Martinez pending approval for 9 days",
			priority: "high" as const,
			agentName: "Sarah Wilson",
			createdAt: "2024-01-06T11:30:00Z",
		},
	];
	const isLoading = false;
	const error = null;
	const refetch = () => {};

	// Refetch when refreshKey changes
	React.useEffect(() => {
		if (refreshKey !== undefined) {
			refetch();
		}
	}, [refreshKey, refetch]);

	// Get priority icon
	const getPriorityIcon = (priority: string) => {
		switch (priority) {
			case "critical":
				return <RiFireLine size={16} className="text-red-500" />;
			case "high":
				return <RiAlertLine size={16} className="text-orange-500" />;
			case "medium":
				return <RiTimeLine size={16} className="text-blue-500" />;
			default:
				return <RiTimeLine size={16} className="text-gray-500" />;
		}
	};

	// Handle task action (placeholder - would navigate to relevant page)
	const handleTaskAction = (task: UrgentTask) => {
		// In a real app, this would navigate to the relevant page
		// For now, we'll just show a placeholder
		console.log("Navigate to task:", task);
	};

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiAlertLine size={20} />
						Urgent Tasks
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={i}
								className="flex items-start gap-3 rounded-lg border p-3"
							>
								<Skeleton className="mt-1 h-4 w-4" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-3 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiAlertLine size={20} />
						Urgent Tasks
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							Failed to load urgent tasks. Please try again.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const tasks = urgentTasks || [];

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<RiAlertLine size={20} />
						Urgent Tasks
					</CardTitle>
					<Badge
						variant={tasks.length > 0 ? "destructive" : "secondary"}
						className="text-xs"
					>
						{tasks.length} urgent
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{tasks.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
							<RiAlertLine
								size={24}
								className="text-green-600 dark:text-green-400"
							/>
						</div>
						<p className="mt-4 font-medium text-sm">All caught up!</p>
						<p className="text-muted-foreground text-sm">
							No urgent tasks require your attention.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{tasks.map((task) => (
							<div
								key={task.id}
								className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
							>
								<div className="mt-1">{getPriorityIcon(task.priority)}</div>

								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<h4 className="font-medium text-sm leading-tight">
												{task.title}
											</h4>
											<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
												{task.description}
											</p>
										</div>

										<Badge
											className={`${getPriorityColor(task.priority)} shrink-0 text-xs`}
										>
											{task.priority}
										</Badge>
									</div>

									<div className="mt-3 flex items-center justify-between">
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											{task.agentName && (
												<>
													<span>{task.agentName}</span>
													<span>•</span>
												</>
											)}
											<span>{getDaysAgo(task.createdAt)} days ago</span>
										</div>

										<Button
											size="sm"
											variant="ghost"
											onClick={() => handleTaskAction(task)}
											className="h-6 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
										>
											View
											<RiArrowRightLine size={12} className="ml-1" />
										</Button>
									</div>
								</div>
							</div>
						))}

						{/* Show More Button (if there are many tasks) */}
						{tasks.length >= 5 && (
							<div className="border-t pt-2">
								<Button
									variant="ghost"
									size="sm"
									className="h-8 w-full text-xs"
									onClick={() => {
										// Navigate to full urgent tasks page
										console.log("Navigate to full urgent tasks page");
									}}
								>
									View All Urgent Tasks
									<RiArrowRightLine size={12} className="ml-1" />
								</Button>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
