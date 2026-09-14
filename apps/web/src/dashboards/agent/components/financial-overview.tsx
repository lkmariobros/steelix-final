"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateDMY } from "@/lib/date-format";
import {
	RiBarChartLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
	RiTrophyLine,
} from "@remixicon/react";

function sparkFromTrend(
	monthlyTrend: { commission: number; deals: number }[],
	key: "commission" | "deals",
): number[] | undefined {
	if (!monthlyTrend.length) return undefined;
	const values = monthlyTrend.map((m) => m[key]);
	const max = Math.max(...values, 1);
	return values.map((v) => Math.max(12, Math.round((v / max) * 100)));
}

export function FinancialOverview() {
	const { financialOverview, isLoading, dateRange } = useAgentDashboard();

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-20" />
				</div>
				<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{["fin-sk-1", "fin-sk-2", "fin-sk-3", "fin-sk-4"].map((id) => (
						<div
							key={id}
							className="overflow-hidden rounded-3xl border border-border/40 bg-card p-5 shadow-card"
						>
							<div className="mb-3 flex items-start justify-between">
								<Skeleton className="h-3.5 w-24" />
								<Skeleton className="size-11 rounded-2xl" />
							</div>
							<Skeleton className="mb-2 h-8 w-24" />
							<Skeleton className="h-5 w-28 rounded-full" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!financialOverview?.overview) {
		return (
			<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
				<CardHeader className="border-border/60 border-b px-5 py-4">
					<CardTitle className="text-base">Financial Overview</CardTitle>
				</CardHeader>
				<CardContent className="p-5">
					<p className="py-8 text-center text-muted-foreground text-sm">
						No transaction data found for the selected period.
					</p>
				</CardContent>
			</Card>
		);
	}

	const { overview, monthlyTrend = [], comparisons, scopeLabel } =
		financialOverview;

	const scopeBadge =
		dateRange.startDate && dateRange.endDate
			? `${formatDateDMY(dateRange.startDate)} – ${formatDateDMY(dateRange.endDate)}`
			: scopeLabel || "All time";

	const commissionSpark = sparkFromTrend(monthlyTrend, "commission");
	const dealsSpark = sparkFromTrend(monthlyTrend, "deals");

	const metric = (
		key: keyof NonNullable<typeof comparisons>,
		fallbackLabel: string,
	) => {
		const c = comparisons?.[key];
		if (!c) {
			return { changeLabel: fallbackLabel, trend: "neutral" as const };
		}
		return { changeLabel: c.label, trend: c.trend };
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="font-semibold text-lg tracking-tight">
						Financial Overview
					</h2>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Totals for scope · badges compare recent activity
					</p>
				</div>
				<span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 font-medium text-[11px] text-muted-foreground">
					{scopeBadge}
				</span>
			</div>

			<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					title="Total Commission"
					value={formatCurrency(overview.totalCommission)}
					{...metric("totalCommission", scopeBadge)}
					icon={<RiMoneyDollarCircleLine size={20} />}
					sparkline={commissionSpark}
					variant="gradient"
				/>
				<MetricCard
					title="Completed Deals"
					value={overview.completedDeals.toString()}
					{...metric("completedDeals", scopeBadge)}
					icon={<RiTrophyLine size={20} />}
					sparkline={dealsSpark}
				/>
				<MetricCard
					title="Pending Commission"
					value={formatCurrency(overview.pendingCommission)}
					{...metric("pendingCommission", "Open pipeline")}
					icon={<RiTimeLine size={20} />}
					sparkline={commissionSpark}
				/>
				<MetricCard
					title="Avg Deal Value"
					value={formatCurrency(overview.averageDealValue)}
					{...metric("averageDealValue", scopeBadge)}
					icon={<RiBarChartLine size={20} />}
					sparkline={commissionSpark}
				/>
			</div>
		</div>
	);
}
