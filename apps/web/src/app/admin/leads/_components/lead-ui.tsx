"use client";

import { cn } from "@/lib/utils";
import { ACTIVITY_CONFIG, stageMap, TASK_PRIORITY_CONFIG } from "./lead-constants";
import type { ActivityEventType, TaskPriority } from "./lead-models";

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
	const cfg = TASK_PRIORITY_CONFIG[priority];
	return <span className={`font-medium text-xs ${cfg.color}`}>{cfg.label}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
	const info = stageMap[stage] ?? {
		label: stage,
		color: "bg-gray-100 text-gray-700",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${info.color}`}
		>
			{info.label}
		</span>
	);
}

export function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		active:
			"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
		inactive:
			"bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
		pending:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
	};
	return (
		<span
			className={cn(
				`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs`,
				colors[status] ?? colors.pending,
			)}
		>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</span>
	);
}

export function ActivityEventIcon({ type }: { type: ActivityEventType }) {
	const cfg = ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.lead_updated;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${cfg.color}`}
		>
			{cfg.icon}
			{cfg.label}
		</span>
	);
}

