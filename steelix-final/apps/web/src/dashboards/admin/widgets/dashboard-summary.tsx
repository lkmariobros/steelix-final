"use client";

import { StatsCard } from "@/components/stats-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import {
	RiCheckboxCircleLine,
	RiFileListLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import React from "react";

// Import types and utilities
import type { DateRangeFilter } from "../admin-schema";
import { formatCurrency } from "../admin-schema";

interface DashboardSummaryProps {
	dateRange?: DateRangeFilter;
	refreshKey?: number;
	className?: string;
}

export function DashboardSummary({
	dateRange,
	refreshKey,
	className,
}: DashboardSummaryProps) {
	// Real tRPC query - replaces mock data
	const {
		data: rawSummaryData,
		isLoading,
		error,
		refetch,
	} = useQuery(
		trpc.admin.getDashboardSummary.queryOptions(dateRange || {}, {
			refetchOnWindowFocus: false,
			staleTime: 30000, // 30 seconds
		}),
	);

	// Type-safe data processing - handle string commission values from database
	const summaryData = React.useMemo(() => {
		if (!rawSummaryData) return null;

		return {
			...rawSummaryData,
			totalCommissionValue: rawSummaryData.totalCommissionValue
				? Number(rawSummaryData.totalCommissionValue)
				: 0,
			avgCommissionValue: rawSummaryData.avgCommissionValue
				? Number(rawSummaryData.avgCommissionValue)
				: 0,
		};
	}, [rawSummaryData]);

	// Refetch when refreshKey changes
	React.useEffect(() => {
		if (refreshKey !== undefined) {
			refetch();
		}
	}, [refreshKey, refetch]);

	// Loading state
	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Dashboard Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-8 w-16" />
								<Skeleton className="h-3 w-20" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	// Error state
	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Dashboard Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							Failed to load dashboard summary. Please try again.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// No data state
	if (!summaryData) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Dashboard Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							No data available for the selected period.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Calculate derived metrics
	const approvalRate =
		summaryData.totalTransactions > 0
			? (summaryData.approvedTransactions / summaryData.totalTransactions) * 100
			: 0;

	const pendingRate =
		summaryData.totalTransactions > 0
			? (summaryData.pendingApprovals / summaryData.totalTransactions) * 100
			: 0;

	// Determine trends (simplified - in real app you'd compare with previous period)
	const totalTransactionsTrend =
		summaryData.totalTransactions > 0 ? "up" : "down";
	const pendingApprovalsTrend =
		summaryData.pendingApprovals > 5 ? "up" : "down";
	const approvedTransactionsTrend = approvalRate > 80 ? "up" : "down";
	const commissionTrend =
		(summaryData.totalCommissionValue || 0) > 0 ? "up" : "down";

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Dashboard Summary</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{/* Total Transactions */}
					<StatsCard
						title="Total Transactions"
						value={summaryData.totalTransactions.toString()}
						change={{
							value: `${summaryData.totalTransactions} total`,
							trend: totalTransactionsTrend as "up" | "down",
						}}
						icon={
							<RiFileListLine
								size={20}
								className="text-blue-600 dark:text-blue-400"
							/>
						}
					/>

					{/* Pending Approvals */}
					<StatsCard
						title="Pending Approvals"
						value={summaryData.pendingApprovals.toString()}
						change={{
							value: `${pendingRate.toFixed(1)}% of total`,
							trend: pendingApprovalsTrend as "up" | "down",
						}}
						icon={
							<RiTimeLine
								size={20}
								className="text-orange-600 dark:text-orange-400"
							/>
						}
					/>

					{/* Approved Transactions */}
					<StatsCard
						title="Approved Transactions"
						value={summaryData.approvedTransactions.toString()}
						change={{
							value: `${approvalRate.toFixed(1)}% approval rate`,
							trend: approvedTransactionsTrend as "up" | "down",
						}}
						icon={
							<RiCheckboxCircleLine
								size={20}
								className="text-green-600 dark:text-green-400"
							/>
						}
					/>

					{/* Total Commission Value */}
					<StatsCard
						title="Total Commission"
						value={formatCurrency(summaryData.totalCommissionValue || 0)}
						change={{
							value: `${formatCurrency(summaryData.avgCommissionValue || 0)} avg`,
							trend: commissionTrend as "up" | "down",
						}}
						icon={
							<RiMoneyDollarCircleLine
								size={20}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						}
					/>
				</div>

				{/* Additional Summary Info */}
				<div className="mt-6 grid gap-4 md:grid-cols-3">
					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-sm">
								Approval Rate
							</span>
							<span
								className={`font-medium text-sm ${
									approvalRate >= 90
										? "text-green-600 dark:text-green-400"
										: approvalRate >= 70
											? "text-yellow-600 dark:text-yellow-400"
											: "text-red-600 dark:text-red-400"
								}`}
							>
								{approvalRate.toFixed(1)}%
							</span>
						</div>
						<div className="mt-2 h-2 rounded-full bg-muted">
							<div
								className={`h-2 rounded-full ${
									approvalRate >= 90
										? "bg-green-500"
										: approvalRate >= 70
											? "bg-yellow-500"
											: "bg-red-500"
								}`}
								style={{ width: `${Math.min(approvalRate, 100)}%` }}
							/>
						</div>
					</div>

					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-sm">
								Pending Rate
							</span>
							<span
								className={`font-medium text-sm ${
									pendingRate <= 10
										? "text-green-600 dark:text-green-400"
										: pendingRate <= 25
											? "text-yellow-600 dark:text-yellow-400"
											: "text-red-600 dark:text-red-400"
								}`}
							>
								{pendingRate.toFixed(1)}%
							</span>
						</div>
						<div className="mt-2 h-2 rounded-full bg-muted">
							<div
								className={`h-2 rounded-full ${
									pendingRate <= 10
										? "bg-green-500"
										: pendingRate <= 25
											? "bg-yellow-500"
											: "bg-red-500"
								}`}
								style={{ width: `${Math.min(pendingRate, 100)}%` }}
							/>
						</div>
					</div>

					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-sm">
								Avg Commission
							</span>
							<span className="font-medium text-sm">
								{formatCurrency(summaryData.avgCommissionValue || 0)}
							</span>
						</div>
						<div className="mt-2 text-muted-foreground text-xs">
							{summaryData.totalTransactions > 0
								? `Across ${summaryData.totalTransactions} transactions`
								: "No transactions"}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
