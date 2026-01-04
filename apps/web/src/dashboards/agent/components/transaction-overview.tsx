"use client";

import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import {
	formatCurrency,
	formatPercentage,
	getStatusColor,
	getStatusLabel,
} from "../agent-schema";

// Pipeline stage order for the funnel visualization
const PIPELINE_ORDER = [
	"draft",
	"submitted",
	"under_review",
	"approved",
	"completed",
] as const;

export function TransactionOverview() {
	// Fetch both pipeline and status data using existing tRPC endpoints
	const {
		data: pipelineData,
		isLoading: pipelineLoading,
		error: pipelineError,
	} = trpc.dashboard.getSalesPipeline.useQuery();

	const {
		data: statusData,
		isLoading: statusLoading,
		error: statusError,
	} = trpc.dashboard.getTransactionStatus.useQuery();

	const isLoading = pipelineLoading || statusLoading;
	const error = pipelineError || statusError;

	// Loading state
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Transaction Overview</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Key Metrics Skeleton */}
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="space-y-2 rounded-lg border p-3">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-6 w-16" />
							</div>
						))}
					</div>
					{/* Pipeline Skeleton */}
					<div className="space-y-3">
						<Skeleton className="h-5 w-32" />
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Skeleton className="h-6 w-24" />
									<Skeleton className="h-4 w-8" />
								</div>
								<Skeleton className="h-4 w-20" />
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
			<Card>
				<CardHeader>
					<CardTitle>Transaction Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load transaction data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Empty state
	if (!pipelineData && !statusData) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Transaction Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No transactions found. Create your first transaction to see your
						pipeline here.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Calculate key metrics from combined data
	const pipeline = pipelineData?.pipeline || [];
	const allStatuses = statusData || [];

	const activeDeals = pipeline.reduce((sum, s) => sum + s.count, 0);
	const pipelineValue = pipeline.reduce(
		(sum, s) => sum + (s.totalValue || 0),
		0,
	);
	const totalTransactions = allStatuses.reduce((sum, s) => sum + s.count, 0);

	// Find specific statuses for metrics
	const pendingReviewCount = allStatuses
		.filter((s) => s.status && ["submitted", "under_review"].includes(s.status))
		.reduce((sum, s) => sum + s.count, 0);

	const completedStatus = allStatuses.find((s) => s.status === "completed");
	const completionRate = completedStatus?.percentage || 0;

	// Merge pipeline and status data for unified view
	const mergedPipeline = PIPELINE_ORDER.map((status) => {
		const pipelineItem = pipeline.find((p) => p.status === status);
		const statusItem = allStatuses.find((s) => s.status === status);
		return {
			status,
			count: pipelineItem?.count || statusItem?.count || 0,
			totalValue: pipelineItem?.totalValue || 0,
			percentage: statusItem?.percentage || 0,
		};
	}).filter((item) => item.count > 0 || item.status === "completed");

	return (
		<Card>
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center justify-between">
					<span>Transaction Overview</span>
					<span className="font-normal text-muted-foreground text-sm">
						{totalTransactions} total transactions
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Key Metrics Row */}
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<MetricCard label="Active Deals" value={activeDeals.toString()} />
					<MetricCard
						label="Pipeline Value"
						value={formatCurrency(pipelineValue)}
					/>
					<MetricCard
						label="Pending Review"
						value={pendingReviewCount.toString()}
						highlight={pendingReviewCount > 0}
					/>
					<MetricCard
						label="Completion Rate"
						value={formatPercentage(completionRate)}
					/>
				</div>

				{/* Pipeline Funnel */}
				<div>
					<h3 className="mb-3 font-medium text-sm">Pipeline Status</h3>
					{mergedPipeline.length === 0 ? (
						<p className="py-2 text-muted-foreground text-sm">
							No active pipeline data.
						</p>
					) : (
						<div className="space-y-2">
							{mergedPipeline.map((item) => (
								<PipelineRow key={item.status} item={item} />
							))}
						</div>
					)}
				</div>

				{/* Pipeline Summary */}
				{(activeDeals > 0 || totalTransactions > 0) && (
					<div className="border-t pt-4">
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Active Pipeline</span>
								<span className="font-medium">{activeDeals} deals</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Total Value</span>
								<span className="font-medium">
									{formatCurrency(pipelineValue)}
								</span>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// Sub-components for cleaner code organization

interface MetricCardProps {
	label: string;
	value: string;
	highlight?: boolean;
}

function MetricCard({ label, value, highlight }: MetricCardProps) {
	return (
		<div
			className={`rounded-lg border p-3 ${highlight ? "border-yellow-500/50 bg-yellow-500/5" : "bg-muted/30"}`}
		>
			<div className="text-muted-foreground text-xs">{label}</div>
			<div
				className={`font-semibold text-lg ${highlight ? "text-yellow-600" : ""}`}
			>
				{value}
			</div>
		</div>
	);
}

interface PipelineItem {
	status: string;
	count: number;
	totalValue: number;
	percentage: number;
}

interface PipelineRowProps {
	item: PipelineItem;
}

function PipelineRow({ item }: PipelineRowProps) {
	return (
		<div className="flex items-center justify-between rounded-lg border p-2 transition-colors hover:bg-muted/50">
			<div className="flex items-center gap-3">
				<Badge variant="secondary" className={getStatusColor(item.status)}>
					{getStatusLabel(item.status)}
				</Badge>
				<span className="font-medium text-sm">{item.count}</span>
			</div>
			<div className="flex items-center gap-4">
				{item.totalValue > 0 && (
					<span className="text-muted-foreground text-sm">
						{formatCurrency(item.totalValue)}
					</span>
				)}
				{item.percentage > 0 && (
					<div className="flex items-center gap-2">
						<div className="h-2 w-16 rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-primary transition-all duration-300"
								style={{ width: `${Math.min(item.percentage, 100)}%` }}
							/>
						</div>
						<span className="w-12 text-right text-muted-foreground text-xs">
							{formatPercentage(item.percentage)}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
