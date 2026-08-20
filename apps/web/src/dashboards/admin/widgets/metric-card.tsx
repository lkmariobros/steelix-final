"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MetricCardProps {
	title: string;
	value: string;
	changeLabel: string;
	trend?: "up" | "down" | "neutral";
	icon?: ReactNode;
	/** Decorative sparkline heights (0–100). UI-only. */
	sparkline?: number[];
	variant?: "default" | "gradient";
	className?: string;
}

const DEFAULT_SPARK = [28, 42, 35, 58, 48, 72, 64, 80, 55, 70, 88, 76];

function MiniSparkline({
	values,
	className,
}: {
	values: number[];
	className?: string;
}) {
	return (
		<div
			className={cn("flex h-9 items-end gap-0.5", className)}
			aria-hidden="true"
		>
			{values.map((h, i) => (
				<span
					key={`${h}-${i}`}
					className="w-1 flex-1 rounded-full bg-primary/25 last:bg-primary/80 dark:bg-primary/35 dark:last:bg-primary"
					style={{ height: `${Math.max(12, Math.min(100, h))}%` }}
				/>
			))}
		</div>
	);
}

export function MetricCard({
	title,
	value,
	changeLabel,
	trend = "neutral",
	icon,
	sparkline = DEFAULT_SPARK,
	variant = "default",
	className,
}: MetricCardProps) {
	const isGradient = variant === "gradient";
	const trendBadge =
		trend === "up"
			? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
			: trend === "down"
				? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
				: "bg-muted text-muted-foreground";

	return (
		<div
			className={cn(
				"relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-card transition-shadow hover:shadow-md",
				isGradient
					? "border-transparent bg-gradient-to-br from-[#1a4d54] via-primary to-[#3d8f8a] text-primary-foreground"
					: "border-border/70 bg-card text-card-foreground",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p
						className={cn(
							"font-medium text-xs uppercase tracking-wide",
							isGradient ? "text-white/75" : "text-muted-foreground",
						)}
					>
						{title}
					</p>
					<p
						className={cn(
							"font-semibold text-2xl tracking-tight tabular-nums sm:text-[1.75rem]",
							isGradient ? "text-white" : "text-foreground",
						)}
					>
						{value}
					</p>
				</div>
				{icon && (
					<div
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-xl",
							isGradient
								? "bg-white/15 text-white"
								: "bg-primary/10 text-primary",
						)}
					>
						{icon}
					</div>
				)}
			</div>

			{/* Shared footer height so all cards align on one baseline */}
			<div className="mt-auto flex h-9 items-center justify-between gap-3 pt-4">
				<span
					className={cn(
						"inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 font-medium text-[11px]",
						isGradient ? "bg-white/20 text-white" : trendBadge,
					)}
				>
					{changeLabel}
				</span>
				{!isGradient && (
					<MiniSparkline values={sparkline} className="w-20 shrink-0" />
				)}
			</div>
		</div>
	);
}
