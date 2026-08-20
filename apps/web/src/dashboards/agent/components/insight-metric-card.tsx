"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface InsightMetricCardProps {
	label: string;
	value: string;
	icon: ReactNode;
	/** Soft tint for the icon chip */
	iconTone?: "primary" | "success" | "warning" | "danger" | "info";
	changeLabel?: string;
	trend?: "up" | "down" | "neutral";
	className?: string;
}

const ICON_TONE: Record<
	NonNullable<InsightMetricCardProps["iconTone"]>,
	string
> = {
	primary: "bg-primary/12 text-primary",
	success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
	danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
	info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

/**
 * Design-style metric tile: icon top-left, trend pill top-right,
 * label, then large value (matches Review dashboard cards).
 */
export function InsightMetricCard({
	label,
	value,
	icon,
	iconTone = "primary",
	changeLabel,
	trend = "neutral",
	className,
}: InsightMetricCardProps) {
	const trendClass =
		trend === "up"
			? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
			: trend === "down"
				? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
				: "bg-muted text-muted-foreground";

	return (
		<div
			className={cn(
				"flex h-full flex-col rounded-2xl border border-border/50 bg-card p-4 shadow-card transition-shadow hover:shadow-md",
				className,
			)}
		>
			<div className="mb-3 flex items-start justify-between gap-2">
				<div
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-xl",
						ICON_TONE[iconTone],
					)}
				>
					{icon}
				</div>
				{changeLabel ? (
					<span
						className={cn(
							"inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[11px] tabular-nums",
							trendClass,
						)}
					>
						{changeLabel}
					</span>
				) : null}
			</div>
			<p className="font-medium text-muted-foreground text-xs tracking-wide">
				{label}
			</p>
			<p className="mt-1.5 font-bold text-2xl tracking-tight tabular-nums leading-none text-foreground">
				{value}
			</p>
		</div>
	);
}
