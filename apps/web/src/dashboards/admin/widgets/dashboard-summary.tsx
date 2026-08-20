"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/contexts/admin-dashboard-context";
import { cn } from "@/lib/utils";
import { safeToFixed } from "@/utils/number-formatting";
import {
	RiCheckboxCircleLine,
	RiFileListLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
} from "@remixicon/react";
import React from "react";

import { formatCurrency } from "../admin-schema";
import { MetricCard } from "./metric-card";
import { StripedProgress } from "./striped-progress";

interface DashboardSummaryProps {
	className?: string;
}

export function DashboardSummary({ className }: DashboardSummaryProps) {
	const { dashboardSummary: raw, summaryLoading, hasError } = useAdminDashboard();

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

	if (summaryLoading) {
		return (
			<div className={cn("space-y-4", className)}>
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{["sk-ds-1", "sk-ds-2", "sk-ds-3", "sk-ds-4"].map((id) => (
						<Card key={id} className="gap-0 py-5">
							<CardContent className="space-y-3">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-8 w-20" />
								<Skeleton className="h-5 w-16 rounded-full" />
							</CardContent>
						</Card>
					))}
				</div>
				<Card className="gap-0 py-5">
					<CardContent className="grid gap-6 md:grid-cols-3">
						{["sk-r-1", "sk-r-2", "sk-r-3"].map((id) => (
							<div key={id} className="space-y-3">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-2.5 w-full rounded-full" />
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (hasError || !data) {
		return (
			<Card className={className}>
				<CardContent className="flex items-center justify-center py-10">
					<p className="text-muted-foreground text-sm">
						{hasError
							? "Failed to load dashboard summary. Please try again."
							: "No data available for the selected period."}
					</p>
				</CardContent>
			</Card>
		);
	}

	const approvalRate =
		data.totalTransactions > 0
			? (data.approvedTransactions / data.totalTransactions) * 100
			: 0;

	const pendingRate =
		data.totalTransactions > 0
			? (data.pendingApprovals / data.totalTransactions) * 100
			: 0;

	const rateTone = (
		rate: number,
		thresholds: [number, number],
		inverted: boolean,
	) => {
		const isGood = inverted ? rate <= thresholds[0] : rate >= thresholds[0];
		const isOk = inverted ? rate <= thresholds[1] : rate >= thresholds[1];
		if (isGood) return { text: "text-primary", tone: "primary" as const };
		if (isOk) return { text: "text-amber-600 dark:text-amber-400", tone: "warning" as const };
		return { text: "text-rose-600 dark:text-rose-400", tone: "danger" as const };
	};

	const approvalMeta = rateTone(approvalRate, [90, 70], false);
	const pendingMeta = rateTone(pendingRate, [10, 25], true);

	return (
		<div className={cn("space-y-4", className)}>
			<div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					title="Total Transactions"
					value={data.totalTransactions.toString()}
					changeLabel={`${data.totalTransactions} total`}
					trend={data.totalTransactions > 0 ? "up" : "neutral"}
					icon={<RiFileListLine size={20} />}
					sparkline={[22, 34, 28, 46, 40, 58, 52, 68, 60, 74, 70, 82]}
				/>
				<MetricCard
					title="Pending Approvals"
					value={data.pendingApprovals.toString()}
					changeLabel={`${safeToFixed(pendingRate, 1)}% of total`}
					trend={data.pendingApprovals > 5 ? "down" : "up"}
					icon={<RiTimeLine size={20} />}
					sparkline={[40, 48, 36, 55, 62, 50, 70, 58, 66, 72, 64, 78]}
				/>
				<MetricCard
					title="Approved Transactions"
					value={data.approvedTransactions.toString()}
					changeLabel={`${safeToFixed(approvalRate, 1)}% approval`}
					trend={approvalRate > 80 ? "up" : "neutral"}
					icon={<RiCheckboxCircleLine size={20} />}
					sparkline={[30, 38, 44, 42, 55, 60, 58, 72, 68, 80, 76, 88]}
				/>
				<MetricCard
					title="Total Commission"
					value={formatCurrency(data.totalCommissionValue)}
					changeLabel={`${formatCurrency(data.avgCommissionValue)} avg`}
					trend={data.totalCommissionValue > 0 ? "up" : "neutral"}
					icon={<RiMoneyDollarCircleLine size={20} />}
					variant="gradient"
				/>
			</div>

			{/* Rates overview — brand-green striped bars */}
			<Card className="gap-0 py-5">
				<CardContent className="grid gap-6 md:grid-cols-3 md:divide-x md:divide-border/60">
					<div className="space-y-3 md:pr-6">
						<div className="flex items-center justify-between gap-3">
							<span className="font-medium text-foreground text-sm">
								Approval Rate
							</span>
							<span
								className={cn(
									"font-semibold text-sm tabular-nums",
									approvalMeta.text,
								)}
							>
								{approvalRate.toFixed(1)}%
							</span>
						</div>
						<StripedProgress value={approvalRate} tone="primary" height="md" />
					</div>

					<div className="space-y-3 md:px-6">
						<div className="flex items-center justify-between gap-3">
							<span className="font-medium text-foreground text-sm">
								Pending Rate
							</span>
							<span
								className={cn(
									"font-semibold text-sm tabular-nums",
									pendingMeta.text,
								)}
							>
								{pendingRate.toFixed(1)}%
							</span>
						</div>
						<StripedProgress value={pendingRate} tone="primary" height="md" />
					</div>

					<div className="space-y-2 md:pl-6">
						<div className="flex items-center justify-between gap-3">
							<span className="font-medium text-foreground text-sm">
								Avg Commission
							</span>
							<span className="font-semibold text-sm tabular-nums text-primary">
								{formatCurrency(data.avgCommissionValue)}
							</span>
						</div>
						<p className="truncate whitespace-nowrap text-muted-foreground text-xs">
							{data.totalTransactions > 0
								? `Across ${data.totalTransactions} transactions`
								: "No transactions"}
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
