"use client";

import { cn } from "@/lib/utils";
import {
	ACTIVITY_CONFIG,
	formatPipelineStageLabel,
	stageMap,
	TASK_PRIORITY_CONFIG,
} from "./lead-constants";
import type { ActivityEventType, TaskPriority } from "./lead-models";

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
	const cfg = TASK_PRIORITY_CONFIG[priority];
	return <span className={`font-medium text-xs ${cfg.color}`}>{cfg.label}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
	const info = stageMap[stage] ?? {
		label: formatPipelineStageLabel(stage),
		color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
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
	const normalizedStatus = status === "pending" ? "inactive" : status;
	const colors: Record<string, string> = {
		active:
			"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
		inactive:
			"bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
	};
	return (
		<span
			className={cn(
				`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs`,
				colors[normalizedStatus] ?? colors.inactive,
			)}
		>
			{normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)}
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

