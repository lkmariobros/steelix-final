"use client";

import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

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

export function SalesPipeline() {
	// ✅ CORRECT tRPC query pattern
	const {
		data: pipelineData,
		isLoading,
		error,
	} = trpc.dashboard.getSalesPipeline.useQuery();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Sales Pipeline</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Pipeline Status Skeleton */}
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-6 w-12" />
								<Skeleton className="h-3 w-16" />
							</div>
						))}
					</div>

					{/* Active Transactions Skeleton */}
					<div className="space-y-3">
						<Skeleton className="h-5 w-32" />
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<div className="space-y-1">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-24" />
								</div>
								<div className="space-y-1 text-right">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-6 w-16" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Sales Pipeline</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load pipeline data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!pipelineData) {
		return null;
	}

	const { pipeline, activeTransactions } = pipelineData;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Sales Pipeline</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Pipeline Status Overview */}
				<div>
					<h3 className="mb-3 font-medium text-sm">Pipeline Status</h3>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
						{pipeline.map((status) => (
							<div key={status.status} className="space-y-1">
								<div className="flex items-center gap-2">
									<Badge
										variant="secondary"
										className={getStatusColor(status.status)}
									>
										{getStatusLabel(status.status)}
									</Badge>
								</div>
								<div className="font-semibold text-lg">{status.count}</div>
								<div className="text-muted-foreground text-xs">
									{formatCurrency(status.totalValue)} total
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Active Transactions */}
				<div>
					<h3 className="mb-3 font-medium text-sm">Active Transactions</h3>
					{activeTransactions.length === 0 ? (
						<p className="py-4 text-muted-foreground text-sm">
							No active transactions found.
						</p>
					) : (
						<div className="space-y-3">
							{activeTransactions.map((transaction) => (
								<div
									key={transaction.id}
									className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
								>
									<div className="space-y-1">
										<div className="font-medium text-sm">
											{transaction.propertyAddress ||
												"Property Address Not Set"}
										</div>
										<div className="text-muted-foreground text-xs">
											Client: {transaction.clientName || "Not specified"}
										</div>
										<div className="flex items-center gap-2">
											<Badge
												variant="secondary"
												className={getStatusColor(transaction.status)}
											>
												{getStatusLabel(transaction.status)}
											</Badge>
											<span className="text-muted-foreground text-xs">
												{new Date(
													transaction.transactionDate,
												).toLocaleDateString()}
											</span>
										</div>
									</div>
									<div className="space-y-1 text-right">
										<div className="font-semibold">
											{transaction.propertyPrice
												? formatCurrency(transaction.propertyPrice)
												: "Price TBD"}
										</div>
										<div className="text-muted-foreground text-xs">
											Commission:{" "}
											{formatCurrency(Number(transaction.commissionAmount))}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Pipeline Summary */}
				{pipeline.length > 0 && (
					<div className="border-t pt-4">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Total Active Deals</span>
							<span className="font-medium">
								{pipeline.reduce((sum, status) => sum + status.count, 0)}
							</span>
						</div>
						<div className="mt-1 flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Total Pipeline Value
							</span>
							<span className="font-medium">
								{formatCurrency(
									pipeline.reduce((sum, status) => sum + status.totalValue, 0),
								)}
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
