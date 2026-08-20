"use client";

import { TierBadge } from "@/components/agent-tier/tier-badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	TIER_COLORS,
	hasLeadershipBonus,
} from "@/lib/agent-tier-config";
import { cn } from "@/lib/utils";
import {
	RiArrowUpLine,
	RiMoneyDollarCircleLine,
	RiTeamLine,
	RiTimeLine,
	RiUserAddLine,
} from "@remixicon/react";
import { InsightMetricCard } from "./insight-metric-card";

const formatCurrency = (v: number): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(v);

interface LeadershipBonusWidgetProps {
	className?: string;
}

export function LeadershipBonusWidget({
	className,
}: LeadershipBonusWidgetProps) {
	const { bonusSummary, uplineInfo, downline, isLoading } = useAgentDashboard();

	if (isLoading) {
		return (
			<Card
				className={cn(
					"gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card",
					className,
				)}
			>
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<Skeleton className="h-5 w-48" />
				</CardHeader>
				<CardContent className="p-5">
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						{["lb1", "lb2", "lb3", "lb4"].map((id) => (
							<div
								key={id}
								className="space-y-3 rounded-2xl border border-border/50 p-4"
							>
								<Skeleton className="size-10 rounded-xl" />
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-7 w-14" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!bonusSummary) return null;

	const currentTier = (bonusSummary.currentTier || "advisor") as AgentTier;
	const hasBonus = hasLeadershipBonus(currentTier);

	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card",
				className,
			)}
		>
			<CardHeader className="border-border/50 border-b px-5 py-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2 text-base">
							<span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
								<RiTeamLine className="size-4" />
							</span>
							Leadership Bonus
						</CardTitle>
						<CardDescription className="mt-1">
							Bonus earnings from your recruited team
						</CardDescription>
					</div>
					<TierBadge tier={currentTier} />
				</div>
			</CardHeader>
			<CardContent className="space-y-5 p-5">
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<InsightMetricCard
						label="Total Earned"
						value={formatCurrency(bonusSummary.totalEarnings)}
						icon={<RiMoneyDollarCircleLine className="size-5" />}
						iconTone="success"
						changeLabel={
							bonusSummary.totalEarnings > 0 ? "Lifetime" : "No earnings yet"
						}
						trend={bonusSummary.totalEarnings > 0 ? "up" : "neutral"}
					/>
					<InsightMetricCard
						label="Pending"
						value={formatCurrency(bonusSummary.totalPendingBonus)}
						icon={<RiTimeLine className="size-5" />}
						iconTone="warning"
						changeLabel={
							bonusSummary.totalPendingBonus > 0 ? "Awaiting" : "Clear"
						}
						trend="neutral"
					/>
					<InsightMetricCard
						label="Direct Recruits"
						value={bonusSummary.downlineCount.toString()}
						icon={<RiUserAddLine className="size-5" />}
						iconTone="primary"
						changeLabel="Your team"
						trend="neutral"
					/>
					<InsightMetricCard
						label="Bonus Rate"
						value={
							bonusSummary.leadershipBonusRate > 0
								? `${bonusSummary.leadershipBonusRate}%`
								: "—"
						}
						icon={<RiArrowUpLine className="size-5" />}
						iconTone="info"
						changeLabel={hasBonus ? "Active" : "Locked"}
						trend={hasBonus ? "up" : "neutral"}
					/>
				</div>

				{uplineInfo && (
					<div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
						<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Your Upline (Recruiter)
						</p>
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2.5">
								<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-lg">
									{TIER_COLORS[uplineInfo.uplineTier as AgentTier]?.icon ??
										"👤"}
								</span>
								<span className="font-semibold text-sm">
									{uplineInfo.uplineName}
								</span>
							</div>
							{uplineInfo.uplineTier && (
								<span className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5 font-medium text-[11px] text-primary">
									{
										AGENT_TIER_CONFIG[uplineInfo.uplineTier as AgentTier]
											?.displayName
									}
								</span>
							)}
						</div>
					</div>
				)}

				{downline && downline.length > 0 && (
					<div className="rounded-2xl border border-border/50 p-4">
						<p className="mb-3 font-semibold text-sm">
							Your Recruited Agents{" "}
							<span className="font-normal text-muted-foreground">
								({downline.length})
							</span>
						</p>
						<div className="max-h-40 space-y-1.5 overflow-y-auto">
							{downline.slice(0, 5).map((agent, idx) => (
								<div
									key={agent.id}
									className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/40"
								>
									<div className="flex items-center gap-2.5">
										<span className="flex size-7 items-center justify-center rounded-full bg-primary/12 font-semibold text-[11px] text-primary">
											{idx + 1}
										</span>
										<span className="font-medium text-sm">{agent.name}</span>
									</div>
									<span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 font-medium text-[11px] text-muted-foreground">
										{
											AGENT_TIER_CONFIG[
												(agent.agentTier || "advisor") as AgentTier
											]?.displayName
										}
									</span>
								</div>
							))}
							{downline.length > 5 && (
								<p className="pt-1 text-center text-muted-foreground text-xs">
									+{downline.length - 5} more agents
								</p>
							)}
						</div>
					</div>
				)}

				{!hasBonus && (
					<div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4 text-center">
						<p className="text-sm text-foreground/80">
							Leadership bonus becomes available at{" "}
							<strong className="text-primary">Sales Leader</strong> tier and
							above.
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Keep building your sales record to unlock this benefit!
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
