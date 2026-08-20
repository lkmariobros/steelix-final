"use client";

import { Avatar } from "@/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { cn } from "@/lib/utils";
import Link from "next/link";
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

const STATUS_PILL: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
	submitted: "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300",
	under_review:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300",
	approved: "bg-primary/12 text-primary",
	rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-300",
	completed:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300",
};

const STATUS_LABELS: Record<string, string> = {
	draft: "Draft",
	submitted: "Submitted",
	under_review: "Under Review",
	approved: "Approved",
	rejected: "Rejected",
	completed: "Completed",
};

const thClass =
	"h-10 bg-muted/40 px-3 font-semibold text-foreground/70 text-[11px] tracking-wide uppercase";

function StatusPill({ status }: { status: string | null }) {
	return (
		<span
			className={cn(
				"inline-flex rounded-full px-2.5 py-0.5 font-medium text-[11px]",
				STATUS_PILL[status ?? ""] ?? "bg-muted text-muted-foreground",
			)}
		>
			{STATUS_LABELS[status ?? ""] ?? "Unknown"}
		</span>
	);
}

function RelativeCell({
	updatedAt,
}: {
	updatedAt: string | Date | null;
}) {
	const rel = useRelativeTime(
		updatedAt == null
			? new Date()
			: typeof updatedAt === "string"
				? new Date(updatedAt)
				: updatedAt,
	);
	return <span className="text-muted-foreground text-xs">{rel}</span>;
}

interface RecentTransactionsProps {
	limit?: number;
}

export function RecentTransactions({ limit = 10 }: RecentTransactionsProps) {
	const { recentTransactions, isLoading } = useAgentDashboard();

	if (isLoading) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<CardTitle className="text-base">Team Activity</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 p-5">
					{["sk-rt-1", "sk-rt-2", "sk-rt-3", "sk-rt-4"].map((id) => (
						<div key={id} className="flex items-center gap-3">
							<Skeleton className="size-9 rounded-full" />
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-28" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	const transactions = Array.isArray(recentTransactions)
		? recentTransactions
		: [];

	if (transactions.length === 0) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<CardTitle className="text-base">Team Activity</CardTitle>
				</CardHeader>
				<CardContent className="p-5">
					<p className="py-6 text-center text-muted-foreground text-sm">
						No recent transactions found.
					</p>
				</CardContent>
			</Card>
		);
	}

	const displayed = transactions.slice(0, limit);

	return (
		<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
			<CardHeader className="border-border/50 border-b px-5 py-4">
				<div className="flex items-center justify-between gap-2">
					<div>
						<CardTitle className="text-base">Team Activity</CardTitle>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Latest team transactions
						</p>
					</div>
					<span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-[11px] text-primary">
						{displayed.length} recent
					</span>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className={thClass}>Agent</TableHead>
								<TableHead className={thClass}>Property / Client</TableHead>
								<TableHead className={thClass}>Status</TableHead>
								<TableHead className={cn(thClass, "text-right")}>
									Value
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{displayed.map((t) => (
								<TableRow
									key={t.id}
									className="border-border/40 transition-colors hover:bg-muted/35"
								>
									<TableCell className="px-3 py-3">
										<Link
											href={`/dashboard/transactions/${t.id}`}
											className="flex items-center gap-2.5"
										>
											<Avatar className="size-9 shrink-0">
												<div className="flex size-full items-center justify-center bg-primary/12 font-semibold text-primary text-sm">
													{(t.agentName ?? "?").charAt(0).toUpperCase()}
												</div>
											</Avatar>
											<span className="truncate font-medium text-sm">
												{t.agentName}
											</span>
										</Link>
									</TableCell>
									<TableCell className="px-3 py-3">
										<div className="max-w-[200px]">
											<div className="truncate text-sm">
												{t.propertyAddress || "Property address not set"}
											</div>
											<div className="truncate text-muted-foreground text-xs">
												Client: {t.clientName || "Not specified"}
											</div>
										</div>
									</TableCell>
									<TableCell className="px-3 py-3">
										<StatusPill status={t.status} />
									</TableCell>
									<TableCell className="px-3 py-3 text-right">
										<div className="font-semibold text-sm tabular-nums">
											{t.propertyPrice
												? formatCurrency(t.propertyPrice)
												: "TBD"}
										</div>
										<RelativeCell updatedAt={t.updatedAt} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				{transactions.length >= limit && (
					<div className="border-border/50 border-t px-5 py-3">
						<Link
							href="/dashboard/transactions"
							className="inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
						>
							View all transactions →
						</Link>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
