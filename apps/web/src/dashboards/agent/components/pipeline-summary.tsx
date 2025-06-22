"use client";

import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RiArrowRightLine, RiBarChartLine } from "@remixicon/react";
import Link from "next/link";

// Simple utility functions to avoid import issues
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

const statusColors = {
	draft: "bg-gray-100 text-gray-800",
	submitted: "bg-blue-100 text-blue-800",
	under_review: "bg-yellow-100 text-yellow-800",
	approved: "bg-green-100 text-green-800",
	rejected: "bg-red-100 text-red-800",
	completed: "bg-emerald-100 text-emerald-800",
} as const;

const statusLabels = {
	draft: "Draft",
	submitted: "Submitted",
	under_review: "Under Review",
	approved: "Approved",
	rejected: "Rejected",
	completed: "Completed",
} as const;

const getStatusColor = (status: string): string => {
	return (
		statusColors[status as keyof typeof statusColors] ||
		"bg-gray-100 text-gray-800"
	);
};

const getStatusLabel = (status: string): string => {
	return statusLabels[status as keyof typeof statusLabels] || status;
};

export function PipelineSummary() {
	// Mock data combining pipeline and status information
	const summaryData = {
		pipeline: [
			{ status: "submitted", count: 3, totalValue: 850000 },
			{ status: "under_review", count: 2, totalValue: 650000 },
			{ status: "approved", count: 1, totalValue: 420000 },
		],
		statusOverview: [
			{ status: "completed", count: 8, percentage: 40.0 },
			{ status: "under_review", count: 4, percentage: 20.0 },
			{ status: "submitted", count: 3, percentage: 15.0 },
			{ status: "approved", count: 3, percentage: 15.0 },
			{ status: "draft", count: 2, percentage: 10.0 },
		],
		monthlyTrend: {
			currentMonth: 32000,
			previousMonth: 28000,
			growth: 14.3,
		},
	};

	const isLoading = false;
	const error = null;

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Pipeline Overview</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-3 gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-6 w-12" />
								<Skeleton className="h-3 w-16" />
							</div>
						))}
					</div>
					<Skeleton className="h-20 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Pipeline Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load pipeline data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	const totalActivePipeline = summaryData.pipeline.reduce(
		(sum, item) => sum + item.totalValue,
		0,
	);
	const totalActiveDeals = summaryData.pipeline.reduce(
		(sum, item) => sum + item.count,
		0,
	);
	const totalTransactions = summaryData.statusOverview.reduce(
		(sum, item) => sum + item.count,
		0,
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
				<CardTitle className="flex items-center gap-2">
					<RiBarChartLine className="size-5" />
					Pipeline Overview
				</CardTitle>
				<Link href="/dashboard/pipeline">
					<Button variant="outline" size="sm" className="text-xs">
						View Details
						<RiArrowRightLine className="ml-1 size-3" />
					</Button>
				</Link>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Key Metrics Row */}
				<div className="grid grid-cols-3 gap-4">
					<div className="text-center">
						<div className="font-semibold text-lg">{totalActiveDeals}</div>
						<div className="text-muted-foreground text-xs">Active Deals</div>
					</div>
					<div className="text-center">
						<div className="font-semibold text-lg">
							{formatCurrency(totalActivePipeline)}
						</div>
						<div className="text-muted-foreground text-xs">Pipeline Value</div>
					</div>
					<div className="text-center">
						<div className="font-semibold text-green-600 text-lg">
							+{summaryData.monthlyTrend.growth}%
						</div>
						<div className="text-muted-foreground text-xs">Monthly Growth</div>
					</div>
				</div>

				{/* Active Pipeline Status */}
				<div>
					<h4 className="mb-3 font-medium text-sm">Active Pipeline</h4>
					<div className="flex flex-wrap gap-2">
						{summaryData.pipeline.map((item) => (
							<div key={item.status} className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className={getStatusColor(item.status)}
								>
									{getStatusLabel(item.status)}
								</Badge>
								<span className="font-medium text-sm">{item.count}</span>
								<span className="text-muted-foreground text-xs">
									({formatCurrency(item.totalValue)})
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Completion Rate */}
				<div>
					<div className="mb-2 flex items-center justify-between">
						<h4 className="font-medium text-sm">Overall Progress</h4>
						<span className="text-muted-foreground text-sm">
							{summaryData.statusOverview.find((s) => s.status === "completed")
								?.count || 0}{" "}
							of {totalTransactions} completed
						</span>
					</div>
					<div className="h-2 w-full rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
							style={{
								width: `${summaryData.statusOverview.find((s) => s.status === "completed")?.percentage || 0}%`,
							}}
						/>
					</div>
					<div className="mt-1 text-muted-foreground text-xs">
						{summaryData.statusOverview.find((s) => s.status === "completed")
							?.percentage || 0}
						% completion rate
					</div>
				</div>

				{/* Quick Actions */}
				<div className="flex items-center justify-between border-t pt-2">
					<div className="text-muted-foreground text-xs">
						{summaryData.pipeline
							.filter((p) => p.status === "under_review")
							.reduce((sum, p) => sum + p.count, 0)}{" "}
						deals need attention
					</div>
					<Link href="/dashboard/pipeline">
						<Button variant="ghost" size="sm" className="text-xs">
							Manage Pipeline →
						</Button>
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
