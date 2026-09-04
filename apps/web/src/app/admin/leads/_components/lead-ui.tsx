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

export function StageBadge({
	stage,
	className,
	title,
}: {
	stage: string;
	className?: string;
	title?: string;
}) {
	const info = stageMap[stage] ?? {
		label: formatPipelineStageLabel(stage),
		color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
	};
	const isLong = info.label.length > 12;

	return (
		<span
			title={title ?? info.label}
			className={cn(
				// 1–2 line badge: fixed max width, smaller type when label is long
				"inline-block max-w-[8.75rem] rounded-md px-2 py-1 text-center font-medium leading-snug",
				"line-clamp-2 break-words align-middle",
				isLong ? "text-[10px]" : "text-[11px]",
				info.color,
				className,
			)}
		>
			{info.label}
		</span>
	);
}

export function StatusBadge({
	status,
	className,
}: {
	status: string;
	className?: string;
}) {
	const normalizedStatus = status === "pending" ? "inactive" : status;
	const colors: Record<string, string> = {
		active:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
		inactive:
			"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
	};
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-medium text-[11px]",
				colors[normalizedStatus] ?? colors.inactive,
				className,
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

