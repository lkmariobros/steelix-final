"use client";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

import { useEffect, useState } from "react";
// Simple utility functions to avoid import issues
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

// Client-side safe relative time formatting
const useRelativeTime = (date: Date): string => {
	const [relativeTime, setRelativeTime] = useState<string>("");

	useEffect(() => {
		const calculateRelativeTime = () => {
			const now = new Date();
			const diffInHours = Math.floor(
				(now.getTime() - date.getTime()) / (1000 * 60 * 60),
			);

			if (diffInHours < 1) {
				return "Just now";
			} else if (diffInHours < 24) {
				return `${diffInHours}h ago`;
			} else if (diffInHours < 168) {
				// 7 days
				const days = Math.floor(diffInHours / 24);
				return `${days}d ago`;
			} else {
				return date.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			}
		};

		setRelativeTime(calculateRelativeTime());

		// Only update every hour to prevent excessive re-renders
		const interval = setInterval(() => {
			setRelativeTime(calculateRelativeTime());
		}, 60 * 60 * 1000); // Update every hour

		return () => clearInterval(interval);
	}, [date]);

	return relativeTime || "Loading...";
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

// Component for individual transaction item to handle relative time
function TransactionItem({
	transaction,
}: {
	transaction: {
		id: string;
		agentId: string;
		agentName: string;
		propertyAddress: string;
		propertyPrice: number;
		clientName: string;
		status: string | null;
		transactionDate: string | Date;
		updatedAt: string | Date;
	};
}) {
	const relativeTime = useRelativeTime(
		typeof transaction.updatedAt === "string"
			? new Date(transaction.updatedAt)
			: transaction.updatedAt,
	);

	return (
		<div className="flex items-center gap-3">
			{/* Agent Avatar */}
			<Avatar className="size-10">
				<div className="flex size-full items-center justify-center bg-primary/10 font-medium text-primary text-sm">
					{transaction.agentName.charAt(0).toUpperCase()}
				</div>
			</Avatar>

			{/* Transaction Details */}
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<span className="truncate font-medium text-sm">
						{transaction.agentName}
					</span>
					<Badge
						variant="secondary"
						className={`${getStatusColor(transaction.status)} text-xs`}
					>
						{getStatusLabel(transaction.status)}
					</Badge>
				</div>
				<div className="truncate text-muted-foreground text-xs">
					{transaction.propertyAddress || "Property address not set"}
				</div>
				<div className="text-muted-foreground text-xs">
					Client: {transaction.clientName || "Not specified"}
				</div>
			</div>

			{/* Transaction Value & Time */}
			<div className="space-y-1 text-right">
				<div className="font-medium text-sm">
					{transaction.propertyPrice
						? formatCurrency(transaction.propertyPrice)
						: "Price TBD"}
				</div>
				<div className="text-muted-foreground text-xs">{relativeTime}</div>
			</div>
		</div>
	);
}

interface RecentTransactionsProps {
	limit?: number;
}

export function RecentTransactions({ limit = 10 }: RecentTransactionsProps) {
	// ✅ CORRECT tRPC query pattern
	const {
		data: transactions,
		isLoading,
		error,
	} = trpc.dashboard.getRecentTransactions.useQuery({
		limit,
	});

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Team Activity</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="flex items-center gap-3">
								<Skeleton className="size-10 rounded-full" />
								<div className="flex-1 space-y-1">
									<Skeleton className="h-4 w-48" />
									<Skeleton className="h-3 w-32" />
								</div>
								<div className="space-y-1 text-right">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-3 w-16" />
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
					<CardTitle>Team Activity</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load recent transactions. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!transactions || transactions.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Team Activity</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No recent transactions found.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Team Activity</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{transactions.map((transaction) => (
						<TransactionItem key={transaction.id} transaction={transaction} />
					))}
				</div>

				{/* View More Link */}
				{transactions.length >= limit && (
					<div className="mt-4 border-t pt-4">
						<button
							type="button"
							className="text-primary text-sm hover:underline"
						>
							View all transactions →
						</button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
