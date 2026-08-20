"use client";

import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/contexts/admin-dashboard-context";
import { cn } from "@/lib/utils";
import { RiPieChartLine } from "@remixicon/react";

import { formatCurrency } from "../admin-schema";
import { StripedProgress } from "./striped-progress";

interface DealMixPanelProps {
	className?: string;
}

const SEGMENT_STYLE = {
	newProject: {
		swatch: "bg-primary",
		bar: "primary" as const,
		value: "text-primary",
	},
	subsale: {
		swatch: "bg-[#3d8f8a]",
		bar: "success" as const,
		value: "text-[#2a6b73] dark:text-[#6fb5b0]",
	},
	rental: {
		swatch: "bg-sky-500",
		bar: "primary" as const,
		value: "text-sky-600 dark:text-sky-400",
	},
};

export function DealMixPanel({ className }: DealMixPanelProps) {
	const { dashboardInsights, insightsLoading, hasError } = useAdminDashboard();
	const dealMix = dashboardInsights?.dealMix;

	if (insightsLoading) {
		return (
			<Card className={cn("flex h-full flex-col", className)}>
				<CardHeader className="pb-3">
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
					<Skeleton className="h-3 w-full rounded-full" />
					{["a", "b", "c"].map((id) => (
						<Skeleton key={id} className="h-16 w-full rounded-xl" />
					))}
				</CardContent>
			</Card>
		);
	}

	if (hasError || !dealMix) {
		return (
			<Card className={cn("flex h-full flex-col", className)}>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2.5 text-base">
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<RiPieChartLine size={18} />
						</span>
						Deal Mix
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-1 items-center justify-center">
					<p className="text-center text-muted-foreground text-sm">
						Failed to load deal mix.
					</p>
				</CardContent>
			</Card>
		);
	}

	const { segments, totalCount, totalAmount } = dealMix;

	return (
		<Card className={cn("flex h-full flex-col", className)}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="flex items-center gap-2.5 text-base">
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<RiPieChartLine size={18} />
						</span>
						Deal Mix
					</CardTitle>
					<Badge className="rounded-full border-0 bg-primary/12 font-medium text-primary">
						{totalCount} deals
					</Badge>
				</div>
				{totalCount > 0 && (
					<p className="mt-1 text-muted-foreground text-xs">
						{formatCurrency(totalAmount)} commission in period
					</p>
				)}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col pt-0">
				{totalCount === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
						<p className="font-medium text-sm">No deals in range</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Try another date filter to see mix.
						</p>
					</div>
				) : (
					<div className="flex flex-1 flex-col gap-4">
						<div className="flex h-3.5 overflow-hidden rounded-full bg-muted">
							{segments.map((seg) => {
								const width =
									totalCount > 0 ? (seg.count / totalCount) * 100 : 0;
								if (width <= 0) return null;
								const style = SEGMENT_STYLE[seg.key];
								return (
									<div
										key={seg.key}
										className={cn("h-full transition-all", style.swatch)}
										style={{ width: `${width}%` }}
										title={`${seg.label}: ${seg.count}`}
									/>
								);
							})}
						</div>

						<div className="flex flex-1 flex-col justify-evenly gap-3">
							{segments.map((seg) => {
								const style = SEGMENT_STYLE[seg.key];
								const pct =
									totalCount > 0 ? (seg.count / totalCount) * 100 : 0;
								return (
									<div
										key={seg.key}
										className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3"
									>
										<div className="mb-2 flex items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<span
													className={cn("size-2.5 rounded-sm", style.swatch)}
												/>
												<span className="font-medium text-sm">{seg.label}</span>
											</div>
											<span
												className={cn(
													"font-semibold text-sm tabular-nums",
													style.value,
												)}
											>
												{pct.toFixed(0)}%
											</span>
										</div>
										<div className="mb-2.5 flex items-center justify-between text-muted-foreground text-xs">
											<span>
												{seg.count} deal{seg.count === 1 ? "" : "s"}
											</span>
											<span className="tabular-nums">
												{formatCurrency(seg.amount)}
											</span>
										</div>
										{seg.key === "rental" ? (
											<div className="h-2.5 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full rounded-full bg-sky-500 transition-all"
													style={{ width: `${pct}%` }}
												/>
											</div>
										) : (
											<StripedProgress
												value={pct}
												tone={style.bar}
												height="md"
											/>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
