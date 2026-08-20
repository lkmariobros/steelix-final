"use client";

import { cn } from "@/lib/utils";

type ProgressTone = "primary" | "success" | "warning" | "danger";

interface StripedProgressProps {
	value: number;
	tone?: ProgressTone;
	className?: string;
	trackClassName?: string;
	height?: "sm" | "md" | "lg";
}

const toneClass: Record<ProgressTone, string> = {
	primary: "progress-striped",
	success: "progress-striped-success",
	warning: "progress-striped-warning",
	danger: "progress-striped-danger",
};

const heightClass = {
	sm: "h-2",
	md: "h-2.5",
	lg: "h-3.5",
};

export function StripedProgress({
	value,
	tone = "primary",
	className,
	trackClassName,
	height = "md",
}: StripedProgressProps) {
	const clamped = Math.max(0, Math.min(100, value));

	return (
		<div
			className={cn(
				"w-full overflow-hidden rounded-full bg-muted",
				heightClass[height],
				trackClassName,
				className,
			)}
			role="progressbar"
			aria-valuenow={Math.round(clamped)}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div
				className={cn(
					"h-full rounded-full transition-[width] duration-500 ease-out",
					toneClass[tone],
				)}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}
