"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { formatDateDMY } from "@/lib/date-format";
import {
	RiBarChartLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
	RiTrophyLine,
} from "@remixicon/react";

const formatCurrency = (amount: number): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);

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

	const { overview } = financialOverview;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="font-semibold text-lg tracking-tight">
					Financial Overview
				</h2>
				<span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 font-medium text-[11px] text-muted-foreground">
					{dateRange.startDate && dateRange.endDate
						? `${formatDateDMY(dateRange.startDate)} – ${formatDateDMY(dateRange.endDate)}`
						: "All time"}
				</span>
			</div>

			<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					title="Total Commission"
					value={formatCurrency(overview.totalCommission)}
					changeLabel="+12% vs last week"
					trend="up"
					icon={<RiMoneyDollarCircleLine size={20} />}
					sparkline={[40, 48, 42, 55, 50, 62, 58, 70, 64, 72, 68, 80]}
					variant="gradient"
				/>
				<MetricCard
					title="Completed Deals"
					value={overview.completedDeals.toString()}
					changeLabel="+8% vs last week"
					trend="up"
					icon={<RiTrophyLine size={20} />}
					sparkline={[28, 35, 32, 40, 38, 48, 45, 52, 50, 58, 55, 62]}
				/>
				<MetricCard
					title="Pending Commission"
					value={formatCurrency(overview.pendingCommission)}
					changeLabel="+15% vs last week"
					trend="up"
					icon={<RiTimeLine size={20} />}
					sparkline={[35, 42, 38, 50, 45, 55, 52, 60, 58, 65, 62, 70]}
				/>
				<MetricCard
					title="Avg Deal Value"
					value={formatCurrency(overview.averageDealValue)}
					changeLabel="+5% vs last week"
					trend="up"
					icon={<RiBarChartLine size={20} />}
					sparkline={[30, 32, 36, 40, 38, 44, 48, 46, 52, 55, 58, 60]}
				/>
			</div>
		</div>
	);
}
