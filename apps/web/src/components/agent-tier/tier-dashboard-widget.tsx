"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type AgentTier,
	AGENT_TIER_CONFIG,
	TIER_ORDER,
} from "@/lib/agent-tier-config";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { RiBarChartBoxLine } from "@remixicon/react";

interface TierDashboardWidgetProps {
	className?: string;
}

const TIER_BAR_STYLE: Record<
	AgentTier,
	{ track: string; fill: string; value: string }
> = {
	advisor: {
		track: "bg-primary/10",
		fill: "bg-gradient-to-r from-primary to-[#3d8f8a]",
		value: "text-primary",
	},
	sales_leader: {
		track: "bg-sky-500/12",
		fill: "bg-gradient-to-r from-sky-500 to-sky-400",
		value: "text-sky-700 dark:text-sky-300",
	},
	team_leader: {
		track: "bg-amber-500/12",
		fill: "bg-gradient-to-r from-amber-500 to-amber-400",
		value: "text-amber-700 dark:text-amber-300",
	},
	group_leader: {
		track: "bg-orange-500/12",
		fill: "bg-gradient-to-r from-orange-500 to-orange-400",
		value: "text-orange-700 dark:text-orange-300",
	},
	supreme_leader: {
		track: "bg-emerald-500/12",
		fill: "bg-gradient-to-r from-emerald-600 to-emerald-400",
		value: "text-emerald-700 dark:text-emerald-300",
	},
};

export function TierDashboardWidget({ className }: TierDashboardWidgetProps) {
	const { data: agentStats, isLoading: statsLoading } =
		trpc.agents.getStats.useQuery();
	const { data: agentsWithTiers, isLoading: tiersLoading } =
		trpc.agentTiers.getAllAgentsWithTiers.useQuery({
			limit: 100,
			offset: 0,
		});

	const isLoading = statsLoading || tiersLoading;

	if (isLoading) {
		return <TierDashboardSkeleton className={className} />;
	}

	const salesAgents =
		agentsWithTiers?.filter(
			(a) => a.role === "agent" || a.role === "team_lead",
		) ?? [];

	const tierCounts = TIER_ORDER.reduce(
		(acc, tier) => {
			acc[tier] = 0;
			return acc;
		},
		{} as Record<AgentTier, number>,
	);

	for (const agent of salesAgents) {
		const tier = (agent.agentTier || "advisor") as AgentTier;
		tierCounts[tier]++;
	}

	const totalAgents = salesAgents.length;
	const monthlyAgents = agentStats?.monthlyAgents ?? 0;
	const yearlyAgents = agentStats?.yearlyAgents ?? 0;

	return (
		<Card
			className={cn(
				"self-start gap-0 overflow-hidden rounded-3xl border-border/50 bg-card py-0 shadow-card",
				className,
			)}
		>
			<CardHeader className="space-y-3 px-5 pt-5 pb-1">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
						<span className="flex size-8 items-center justify-center rounded-2xl bg-primary/12 text-primary">
							<RiBarChartBoxLine size={16} />
						</span>
						Agent Tier
					</CardTitle>
					{monthlyAgents > 0 ? (
						<span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-[10px] text-emerald-700 dark:text-emerald-300">
							+{monthlyAgents} mo
						</span>
					) : null}
				</div>

				<div className="flex items-end gap-2">
					<p className="font-bold text-3xl tracking-tight tabular-nums leading-none">
						{totalAgents.toLocaleString()}
					</p>
					<p className="mb-0.5 text-muted-foreground text-xs">
						agents · {yearlyAgents} this year
					</p>
				</div>
			</CardHeader>

			<CardContent className="space-y-2.5 px-5 pt-3 pb-5">
				{TIER_ORDER.map((tier) => {
					const count = tierCounts[tier];
					const percentage =
						totalAgents > 0 ? (count / totalAgents) * 100 : 0;
					const style = TIER_BAR_STYLE[tier];
					const config = AGENT_TIER_CONFIG[tier];

					return (
						<div key={tier} className="space-y-1">
							<div className="flex items-center justify-between gap-2">
								<span className="truncate font-medium text-muted-foreground text-xs">
									{config.displayName}
								</span>
								<span
									className={cn(
										"shrink-0 font-semibold text-xs tabular-nums",
										style.value,
									)}
								>
									{count}
								</span>
							</div>
							<div
								className={cn(
									"h-2.5 w-full overflow-hidden rounded-full",
									style.track,
								)}
								role="progressbar"
								aria-valuenow={Math.round(percentage)}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={`${config.displayName}: ${count}`}
							>
								<div
									className={cn(
										"h-full rounded-full transition-[width] duration-500 ease-out",
										style.fill,
									)}
									style={{
										width: `${Math.max(percentage > 0 ? 8 : 0, percentage)}%`,
									}}
								/>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

function TierDashboardSkeleton({ className }: { className?: string }) {
	return (
		<Card
			className={cn(
				"self-start gap-0 overflow-hidden rounded-3xl border-border/50 py-0 shadow-card",
				className,
			)}
		>
			<CardHeader className="space-y-3 px-5 pt-5 pb-1">
				<Skeleton className="h-8 w-36 rounded-2xl" />
				<Skeleton className="h-8 w-20" />
			</CardHeader>
			<CardContent className="space-y-2.5 px-5 pt-3 pb-5">
				{["a", "b", "c", "d", "e"].map((id) => (
					<div key={id} className="space-y-1">
						<div className="flex justify-between">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-6" />
						</div>
						<Skeleton className="h-2.5 w-full rounded-full" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}
