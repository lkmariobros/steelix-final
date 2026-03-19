"use client";

import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { useEffect, useState } from "react";

const formatCurrency = (amount: number): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);

const useRelativeTime = (date: Date): string => {
	const [rel, setRel] = useState<string>("");

	useEffect(() => {
		const calc = () => {
			const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000);
			if (diffH < 1) return "Just now";
			if (diffH < 24) return `${diffH}h ago`;
			if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		};
		setRel(calc());
		const id = setInterval(() => setRel(calc()), 3_600_000);
		return () => clearInterval(id);
	}, [date]);

	return rel || "Loading...";
};

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-gray-100 text-gray-800",
	submitted: "bg-blue-100 text-blue-800",
	under_review: "bg-yellow-100 text-yellow-800",
	approved: "bg-green-100 text-green-800",
	rejected: "bg-red-100 text-red-800",
	completed: "bg-emerald-100 text-emerald-800",
};
const STATUS_LABELS: Record<string, string> = {
	draft: "Draft",
	submitted: "Submitted",
	under_review: "Under Review",
	approved: "Approved",
	rejected: "Rejected",
	completed: "Completed",
};

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
	const rel = useRelativeTime(
		typeof transaction.updatedAt === "string"
			? new Date(transaction.updatedAt)
			: transaction.updatedAt,
	);

	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-10">
				<div className="flex size-full items-center justify-center bg-primary/10 font-medium text-primary text-sm">
					{transaction.agentName.charAt(0).toUpperCase()}
				</div>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<span className="truncate font-medium text-sm">
						{transaction.agentName}
					</span>
					<Badge
						variant="secondary"
						className={`${STATUS_COLORS[transaction.status ?? ""] ?? "bg-gray-100 text-gray-800"} text-xs`}
					>
						{STATUS_LABELS[transaction.status ?? ""] ?? "Unknown"}
					</Badge>
				</div>
				<div className="truncate text-muted-foreground text-xs">
					{transaction.propertyAddress || "Property address not set"}
				</div>
				<div className="text-muted-foreground text-xs">
					Client: {transaction.clientName || "Not specified"}
				</div>
			</div>
			<div className="space-y-1 text-right">
				<div className="font-medium text-sm">
					{transaction.propertyPrice
						? formatCurrency(transaction.propertyPrice)
						: "Price TBD"}
				</div>
				<div className="text-muted-foreground text-xs">{rel}</div>
			</div>
		</div>
	);
}

interface RecentTransactionsProps {
	limit?: number;
}

export function RecentTransactions({ limit = 10 }: RecentTransactionsProps) {
	const { recentTransactions, isLoading } = useAgentDashboard();

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

	const transactions = Array.isArray(recentTransactions)
		? recentTransactions
		: [];

	if (transactions.length === 0) {
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

	const displayed = transactions.slice(0, limit);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Team Activity</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{displayed.map((t) => (
						<TransactionItem key={t.id} transaction={t} />
					))}
				</div>
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
