"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { cn } from "@/lib/utils";
import {
	RiCheckboxCircleLine,
	RiFileList3Line,
	RiPercentLine,
	RiMoneyDollarCircleLine,
	RiTimeLine,
} from "@remixicon/react";
import {
	formatCurrency,
	formatPercentage,
	getStatusLabel,
} from "../agent-schema";
import { InsightMetricCard } from "./insight-metric-card";

const PIPELINE_ORDER = [
	"draft",
	"submitted",
	"under_review",
	"approved",
	"completed",
] as const;

const PIPELINE_BAR: Record<string, string> = {
	draft: "bg-slate-400",
	submitted: "bg-sky-500",
	under_review: "bg-amber-500",
	approved: "bg-primary",
	completed: "bg-emerald-500",
};

const STATUS_PILL: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
	submitted: "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300",
	under_review:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300",
	approved: "bg-primary/12 text-primary",
	completed:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300",
};

export function TransactionOverview() {
	const { salesPipeline, transactionStatus, isLoading } = useAgentDashboard();

	if (isLoading) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<Skeleton className="h-5 w-44" />
				</CardHeader>
				<CardContent className="space-y-6 p-5">
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						{["sk-to-1", "sk-to-2", "sk-to-3", "sk-to-4"].map((id) => (
							<div
								key={id}
								className="space-y-3 rounded-2xl border border-border/50 p-4 shadow-card"
							>
								<div className="flex justify-between">
									<Skeleton className="size-10 rounded-xl" />
									<Skeleton className="h-5 w-12 rounded-full" />
								</div>
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-7 w-16" />
							</div>
						))}
					</div>
					<Skeleton className="h-28 w-full rounded-2xl" />
				</CardContent>
			</Card>
		);
	}

	if (!salesPipeline && !transactionStatus) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<CardTitle className="text-base">Transaction Overview</CardTitle>
				</CardHeader>
				<CardContent className="p-5">
					<p className="text-muted-foreground text-sm">
						No transactions found. Create your first transaction to see your
						pipeline here.
					</p>
				</CardContent>
			</Card>
		);
	}

	const pipeline = salesPipeline?.pipeline ?? [];
	const allStatuses = transactionStatus ?? [];

	const activeDeals = pipeline.reduce((sum, s) => sum + s.count, 0);
	const pipelineValue = pipeline.reduce(
		(sum, s) => sum + (s.totalValue || 0),
		0,
	);
	const totalTransactions = allStatuses.reduce((sum, s) => sum + s.count, 0);
	const pendingReviewCount = allStatuses
		.filter((s) => s.status && ["submitted", "under_review"].includes(s.status))
		.reduce((sum, s) => sum + s.count, 0);
	const completionRate =
		allStatuses.find((s) => s.status === "completed")?.percentage ?? 0;

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

	const barTotal = Math.max(
		mergedPipeline.reduce((sum, item) => sum + item.count, 0),
		1,
	);

	return (
		<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
			<CardHeader className="border-border/50 border-b px-5 py-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle className="text-base">Transaction Overview</CardTitle>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Pipeline health and deal distribution
						</p>
					</div>
					<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-[11px] text-primary">
						{totalTransactions} total transactions
					</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-6 p-5">
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<InsightMetricCard
						label="Active Deals"
						value={activeDeals.toString()}
						icon={<RiFileList3Line className="size-5" />}
						iconTone="primary"
						changeLabel={`${activeDeals} open`}
						trend="neutral"
					/>
					<InsightMetricCard
						label="Pipeline Value"
						value={formatCurrency(pipelineValue)}
						icon={<RiMoneyDollarCircleLine className="size-5" />}
						iconTone="success"
						changeLabel="In pipeline"
						trend="up"
					/>
					<InsightMetricCard
						label="Pending Review"
						value={pendingReviewCount.toString()}
						icon={<RiTimeLine className="size-5" />}
						iconTone={pendingReviewCount > 0 ? "warning" : "info"}
						changeLabel={pendingReviewCount > 0 ? "Needs review" : "Clear"}
						trend={pendingReviewCount > 0 ? "down" : "neutral"}
					/>
					<InsightMetricCard
						label="Completion Rate"
						value={formatPercentage(completionRate)}
						icon={<RiPercentLine className="size-5" />}
						iconTone="success"
						changeLabel={
							completionRate > 0 ? `+${completionRate.toFixed(1)}%` : "0%"
						}
						trend={completionRate > 0 ? "up" : "neutral"}
					/>
				</div>

				<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
					{/* Sources-style breakdown */}
					<div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
						<div className="mb-4 flex items-center justify-between gap-2">
							<div>
								<h3 className="font-semibold text-sm">Sales Pipeline</h3>
								<p className="text-muted-foreground text-xs">
									Status wise breakdown
								</p>
							</div>
							{completionRate > 0 && (
								<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
									<RiCheckboxCircleLine className="size-3.5" />
									{formatPercentage(completionRate)}
								</span>
							)}
						</div>

						{mergedPipeline.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-sm">
								No active pipeline data.
							</p>
						) : (
							<>
								<div className="mb-5 flex h-3 overflow-hidden rounded-full bg-muted">
									{mergedPipeline.map((item) =>
										item.count > 0 ? (
											<div
												key={`bar-${item.status}`}
												className={cn(
													"h-full transition-all",
													PIPELINE_BAR[item.status] ?? "bg-primary/60",
												)}
												style={{
													width: `${Math.max((item.count / barTotal) * 100, 3)}%`,
												}}
												title={`${getStatusLabel(item.status)}: ${item.count}`}
											/>
										) : null,
									)}
								</div>

								<div className="space-y-3">
									{mergedPipeline.map((item) => {
										const pct =
											item.percentage ||
											Math.round((item.count / barTotal) * 100);
										return (
											<div key={item.status} className="space-y-1.5">
												<div className="flex items-center justify-between gap-2 text-sm">
													<div className="flex items-center gap-2">
														<span
															className={cn(
																"size-2.5 shrink-0 rounded-sm",
																PIPELINE_BAR[item.status] ?? "bg-primary",
															)}
														/>
														<span className="font-medium">
															{getStatusLabel(item.status)}
														</span>
														<span className="text-muted-foreground text-xs tabular-nums">
															{item.count}
														</span>
													</div>
													<div className="flex items-center gap-3">
														{item.totalValue > 0 && (
															<span className="text-muted-foreground text-xs tabular-nums">
																{formatCurrency(item.totalValue)}
															</span>
														)}
														<span className="w-10 text-right font-semibold text-xs tabular-nums">
															{formatPercentage(pct)}
														</span>
													</div>
												</div>
												<div className="h-2 overflow-hidden rounded-full bg-muted">
													<div
														className={cn(
															"h-full rounded-full transition-all duration-300",
															PIPELINE_BAR[item.status] ?? "bg-primary",
														)}
														style={{ width: `${Math.min(pct, 100)}%` }}
													/>
												</div>
											</div>
										);
									})}
								</div>
							</>
						)}
					</div>

					{/* Rating-distribution style summary */}
					<div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-card">
						<div>
							<h3 className="font-semibold text-sm">Pipeline Snapshot</h3>
							<p className="text-muted-foreground text-xs">
								Active book of business
							</p>
							<div className="mt-5 text-center">
								<p className="font-bold text-4xl tracking-tight tabular-nums text-primary">
									{activeDeals}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{activeDeals === 1 ? "active deal" : "active deals"}
								</p>
							</div>
						</div>

						<div className="mt-6 space-y-2">
							<div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
								<span className="text-muted-foreground">Total Value</span>
								<span className="font-semibold tabular-nums">
									{formatCurrency(pipelineValue)}
								</span>
							</div>
							<div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
								<span className="text-muted-foreground">Pending Review</span>
								<span
									className={cn(
										"font-semibold tabular-nums",
										pendingReviewCount > 0 && "text-amber-600",
									)}
								>
									{pendingReviewCount}
								</span>
							</div>
							<div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5 text-sm">
								<span className="text-primary/80">Completion</span>
								<span className="font-semibold text-primary tabular-nums">
									{formatPercentage(completionRate)}
								</span>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
