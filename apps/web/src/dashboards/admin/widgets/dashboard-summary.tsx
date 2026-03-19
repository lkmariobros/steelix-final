"use client";

import { StatsCard } from "@/components/stats-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/contexts/admin-dashboard-context";
import { safeToFixed } from "@/utils/number-formatting";
import {
	RiCheckboxCircleLine,
	RiFileListLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
} from "@remixicon/react";
import React from "react";

import { formatCurrency } from "../admin-schema";

interface DashboardSummaryProps {
	className?: string;
}

export function DashboardSummary({ className }: DashboardSummaryProps) {
	const { dashboardSummary: raw, isLoading, hasError } = useAdminDashboard();

	// Normalise commission values (Drizzle sum/avg return string | null)
	const data = React.useMemo(() => {
		if (!raw) return null;
		return {
			totalTransactions: raw.totalTransactions,
			pendingApprovals: raw.pendingApprovals,
			approvedTransactions: raw.approvedTransactions,
			totalCommissionValue:
				raw.totalCommissionValue != null ? Number(raw.totalCommissionValue) : 0,
			avgCommissionValue:
				raw.avgCommissionValue != null ? Number(raw.avgCommissionValue) : 0,
		};
	}, [raw]);

	// ── Loading ───────────────────────────────────────────────────────────────

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Dashboard Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }, (_, i) => (
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

	// ── Error / empty ─────────────────────────────────────────────────────────

	if (hasError || !data) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>Dashboard Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							{hasError
								? "Failed to load dashboard summary. Please try again."
								: "No data available for the selected period."}
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// ── Derived metrics ───────────────────────────────────────────────────────

	const approvalRate =
		data.totalTransactions > 0
			? (data.approvedTransactions / data.totalTransactions) * 100
			: 0;

	const pendingRate =
		data.totalTransactions > 0
			? (data.pendingApprovals / data.totalTransactions) * 100
			: 0;

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>Dashboard Summary</CardTitle>
			</CardHeader>
			<CardContent>
				{/* Stat cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<StatsCard
						title="Total Transactions"
						value={data.totalTransactions.toString()}
						change={{
							value: `${data.totalTransactions} total`,
							trend: data.totalTransactions > 0 ? "up" : "down",
						}}
						icon={
							<RiFileListLine
								size={20}
								className="text-blue-600 dark:text-blue-400"
							/>
						}
					/>
					<StatsCard
						title="Pending Approvals"
						value={data.pendingApprovals.toString()}
						change={{
							value: `${safeToFixed(pendingRate, 1)}% of total`,
							trend: data.pendingApprovals > 5 ? "up" : "down",
						}}
						icon={
							<RiTimeLine
								size={20}
								className="text-orange-600 dark:text-orange-400"
							/>
						}
					/>
					<StatsCard
						title="Approved Transactions"
						value={data.approvedTransactions.toString()}
						change={{
							value: `${safeToFixed(approvalRate, 1)}% approval rate`,
							trend: approvalRate > 80 ? "up" : "down",
						}}
						icon={
							<RiCheckboxCircleLine
								size={20}
								className="text-green-600 dark:text-green-400"
							/>
						}
					/>
					<StatsCard
						title="Total Commission"
						value={formatCurrency(data.totalCommissionValue)}
						change={{
							value: `${formatCurrency(data.avgCommissionValue)} avg`,
							trend: data.totalCommissionValue > 0 ? "up" : "down",
						}}
						icon={
							<RiMoneyDollarCircleLine
								size={20}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						}
					/>
				</div>

				{/* Rate indicators */}
				<div className="mt-6 grid gap-4 md:grid-cols-3">
					{[
						{
							label: "Approval Rate",
							value: `${approvalRate.toFixed(1)}%`,
							rate: approvalRate,
							thresholds: [90, 70] as [number, number],
							inverted: false,
						},
						{
							label: "Pending Rate",
							value: `${pendingRate.toFixed(1)}%`,
							rate: pendingRate,
							thresholds: [10, 25] as [number, number],
							inverted: true,
						},
					].map(({ label, value, rate, thresholds, inverted }) => {
						const isGood = inverted
							? rate <= thresholds[0]
							: rate >= thresholds[0];
						const isOk = inverted
							? rate <= thresholds[1]
							: rate >= thresholds[1];
						const textCls = isGood
							? "text-green-600 dark:text-green-400"
							: isOk
								? "text-yellow-600 dark:text-yellow-400"
								: "text-red-600 dark:text-red-400";
						const barCls = isGood
							? "bg-green-500"
							: isOk
								? "bg-yellow-500"
								: "bg-red-500";
						return (
							<div key={label} className="rounded-lg border p-4">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground text-sm">{label}</span>
									<span className={`font-medium text-sm ${textCls}`}>
										{value}
									</span>
								</div>
								<div className="mt-2 h-2 rounded-full bg-muted">
									<div
										className={`h-2 rounded-full ${barCls}`}
										style={{ width: `${Math.min(rate, 100)}%` }}
									/>
								</div>
							</div>
						);
					})}

					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-sm">
								Avg Commission
							</span>
							<span className="font-medium text-sm">
								{formatCurrency(data.avgCommissionValue)}
							</span>
						</div>
						<div className="mt-2 text-muted-foreground text-xs">
							{data.totalTransactions > 0
								? `Across ${data.totalTransactions} transactions`
								: "No transactions"}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
