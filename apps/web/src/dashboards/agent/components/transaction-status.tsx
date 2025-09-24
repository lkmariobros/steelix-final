"use client";

import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

// Simple utility functions to avoid import issues
const formatPercentage = (value: number | string | null | undefined): string => {
	// Handle null, undefined, or invalid values
	if (value === null || value === undefined) {
		return "0.0%";
	}

	// Convert to number if it's a string
	const numValue = typeof value === "string" ? parseFloat(value) : value;

	// Check if the conversion resulted in a valid number
	if (Number.isNaN(numValue) || typeof numValue !== 'number') {
		return "0.0%";
	}

	return `${Number.isNaN(numValue) ? 0 : numValue.toFixed(1)}%`;
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

const getStatusColor = (status: string | null): string => {
	if (!status) return "bg-gray-100 text-gray-800";
	return (
		statusColors[status as keyof typeof statusColors] ||
		"bg-gray-100 text-gray-800"
	);
};

const getStatusLabel = (status: string | null): string => {
	if (!status) return "Unknown";
	return statusLabels[status as keyof typeof statusLabels] || status;
};

export function TransactionStatus() {
	// ✅ CORRECT tRPC query pattern
	const {
		data: statusData,
		isLoading,
		error,
	} = trpc.dashboard.getTransactionStatus.useQuery();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Transaction Status</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Skeleton className="h-6 w-20" />
								<Skeleton className="h-4 w-8" />
							</div>
							<div className="flex items-center gap-2">
								<Skeleton className="h-2 w-24 rounded-full" />
								<Skeleton className="h-4 w-12" />
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Transaction Status</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load status data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!statusData || statusData.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Transaction Status</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No transactions found.
					</p>
				</CardContent>
			</Card>
		);
	}

	const totalTransactions = statusData.reduce(
		(sum, status) => sum + status.count,
		0,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Transaction Status</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Status Breakdown */}
				<div className="space-y-3">
					{statusData.map((status) => (
						<div
							key={status.status}
							className="flex items-center justify-between"
						>
							<div className="flex items-center gap-3">
								<Badge
									variant="secondary"
									className={getStatusColor(status.status)}
								>
									{getStatusLabel(status.status)}
								</Badge>
								<span className="font-medium text-sm">{status.count}</span>
							</div>
							<div className="flex items-center gap-2">
								{/* Progress bar */}
								<div className="h-2 w-24 rounded-full bg-muted">
									<div
										className="h-2 rounded-full bg-primary transition-all duration-300"
										style={{ width: `${status.percentage}%` }}
									/>
								</div>
								<span className="w-12 text-right text-muted-foreground text-sm">
									{formatPercentage(status.percentage)}
								</span>
							</div>
						</div>
					))}
				</div>

				{/* Summary */}
				<div className="border-t pt-4">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Total Transactions</span>
						<span className="font-medium">{totalTransactions}</span>
					</div>
				</div>

				{/* Quick Insights */}
				<div className="space-y-2 pt-2">
					{(() => {
						const completedStatus = statusData.find(
							(s) => s.status === "completed",
						);
						const pendingStatuses = statusData.filter(
							(s) =>
								s.status &&
								["submitted", "under_review", "approved"].includes(s.status),
						);
						const pendingCount = pendingStatuses.reduce(
							(sum, s) => sum + s.count,
							0,
						);

						return (
							<>
								{completedStatus && (
									<div className="text-muted-foreground text-xs">
										<span className="font-medium text-emerald-600">
											{completedStatus.count} completed
										</span>{" "}
										({formatPercentage(completedStatus.percentage)} success
										rate)
									</div>
								)}
								{pendingCount > 0 && (
									<div className="text-muted-foreground text-xs">
										<span className="font-medium text-blue-600">
											{pendingCount} in progress
										</span>{" "}
										(
										{formatPercentage((pendingCount / totalTransactions) * 100)}{" "}
										of total)
									</div>
								)}
							</>
						);
					})()}
				</div>
			</CardContent>
		</Card>
	);
}
