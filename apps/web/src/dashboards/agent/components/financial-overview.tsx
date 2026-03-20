"use client";

import { StatsGrid } from "@/components/stats-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
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
				<h2 className="font-semibold text-lg">Financial Overview</h2>
				<div className="grid grid-cols-2 rounded-xl border border-border bg-gradient-to-br from-sidebar/60 to-sidebar min-[1200px]:grid-cols-4">
					{["fin-sk-1", "fin-sk-2", "fin-sk-3", "fin-sk-4"].map((id) => (
						<div key={id} className="p-4 lg:p-5">
							<div className="flex items-center gap-4">
								<Skeleton className="size-10 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-6 w-16" />
									<Skeleton className="h-3 w-24" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!financialOverview?.overview) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Financial Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="py-8 text-center text-muted-foreground text-sm">
						No transaction data found for the selected period.
					</p>
				</CardContent>
			</Card>
		);
	}

	const { overview } = financialOverview;

	const stats = [
		{
			title: "Total Commission",
			value: formatCurrency(overview.totalCommission),
			change: { value: "+12%", trend: "up" as const },
			icon: <RiMoneyDollarCircleLine size={20} />,
		},
		{
			title: "Completed Deals",
			value: overview.completedDeals.toString(),
			change: { value: "+8%", trend: "up" as const },
			icon: <RiTrophyLine size={20} />,
		},
		{
			title: "Pending Commission",
			value: formatCurrency(overview.pendingCommission),
			change: { value: "+15%", trend: "up" as const },
			icon: <RiTimeLine size={20} />,
		},
		{
			title: "Avg Deal Value",
			value: formatCurrency(overview.averageDealValue),
			change: { value: "+5%", trend: "up" as const },
			icon: <RiBarChartLine size={20} />,
		},
	];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-lg">Financial Overview</h2>
				<div className="text-muted-foreground text-sm">
					{dateRange.startDate && dateRange.endDate
						? `${dateRange.startDate.toLocaleDateString("en-US")} – ${dateRange.endDate.toLocaleDateString("en-US")}`
						: "All time"}
				</div>
			</div>
			<StatsGrid stats={stats} />
		</div>
	);
}
