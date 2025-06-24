"use client";

import { StatsGrid } from "@/components/stats-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
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
	// Real tRPC query - replaces mock data
	const {
		data: financialData,
		isLoading,
		error,
	} = useQuery(
		trpc.dashboard.getFinancialOverview.queryOptions({
			startDate: dateRange?.startDate,
			endDate: dateRange?.endDate,
		}),
	);

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
