"use client";

import { StatsGrid } from "@/components/stats-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import {
	RiBarChartLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
	RiTrophyLine,
} from "@remixicon/react";
// Simple utility function to avoid import issues
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

interface FinancialOverviewProps {
	dateRange?: {
		startDate?: Date;
		endDate?: Date;
	};
}

export function FinancialOverview({ dateRange }: FinancialOverviewProps) {
	// Mock data for demonstration (replace with tRPC call when database is ready)
	const financialData = {
		overview: {
			totalCommission: 125000,
			completedDeals: 8,
			pendingCommission: 45000,
			averageDealValue: 350000,
		},
		monthlyTrend: [
			{ month: "2024-01", commission: 15000, deals: 2 },
			{ month: "2024-02", commission: 22000, deals: 3 },
			{ month: "2024-03", commission: 18000, deals: 2 },
			{ month: "2024-04", commission: 28000, deals: 4 },
			{ month: "2024-05", commission: 32000, deals: 3 },
			{ month: "2024-06", commission: 25000, deals: 3 },
		],
	};
	const isLoading = false;
	const error = null;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold text-lg">Financial Overview</h2>
				</div>
				<div className="grid grid-cols-2 rounded-xl border border-border bg-gradient-to-br from-sidebar/60 to-sidebar min-[1200px]:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={`financial-skeleton-${i}`} className="p-4 lg:p-5">
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

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Financial Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load financial data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!financialData) {
		return null;
	}

	const { overview } = financialData;

	// Calculate percentage changes (mock data for now - would need historical data)
	const stats = [
		{
			title: "Total Commission",
			value: formatCurrency(overview.totalCommission),
			change: {
				value: "+12%",
				trend: "up" as const,
			},
			icon: <RiMoneyDollarCircleLine size={20} />,
		},
		{
			title: "Completed Deals",
			value: overview.completedDeals.toString(),
			change: {
				value: "+8%",
				trend: "up" as const,
			},
			icon: <RiTrophyLine size={20} />,
		},
		{
			title: "Pending Commission",
			value: formatCurrency(overview.pendingCommission),
			change: {
				value: "+15%",
				trend: "up" as const,
			},
			icon: <RiTimeLine size={20} />,
		},
		{
			title: "Avg Deal Value",
			value: formatCurrency(overview.averageDealValue),
			change: {
				value: "+5%",
				trend: "up" as const,
			},
			icon: <RiBarChartLine size={20} />,
		},
	];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-lg">Financial Overview</h2>
				<div className="text-muted-foreground text-sm">
					{dateRange?.startDate && dateRange?.endDate
						? `${dateRange.startDate.toLocaleDateString("en-US")} - ${dateRange.endDate.toLocaleDateString("en-US")}`
						: "All time"}
				</div>
			</div>
			<StatsGrid stats={stats} />
		</div>
	);
}
