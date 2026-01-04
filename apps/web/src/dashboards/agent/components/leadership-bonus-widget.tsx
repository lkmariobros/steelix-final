"use client";

import { TierBadge } from "@/components/agent-tier/tier-badge";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	TIER_COLORS,
	hasLeadershipBonus,
} from "@/lib/agent-tier-config";
import { trpc } from "@/utils/trpc";
import {
	RiArrowUpLine,
	RiMoneyDollarCircleLine,
	RiTeamLine,
	RiUserAddLine,
} from "@remixicon/react";

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

interface LeadershipBonusWidgetProps {
	className?: string;
}

export function LeadershipBonusWidget({
	className,
}: LeadershipBonusWidgetProps) {
	const { data: bonusSummary, isLoading } =
		trpc.agentTiers.getMyLeadershipBonusSummary.useQuery();
	const { data: uplineInfo } = trpc.agentTiers.getMyUpline.useQuery();
	const { data: downline } = trpc.agentTiers.getMyDownline.useQuery();

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-32 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (!bonusSummary) return null;

	const currentTier = (bonusSummary.currentTier || "advisor") as AgentTier;
	const tierColors = TIER_COLORS[currentTier];
	const hasBonus = hasLeadershipBonus(currentTier);

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<RiTeamLine className="h-5 w-5" />
							Leadership Bonus
						</CardTitle>
						<CardDescription>
							Bonus earnings from your recruited team
						</CardDescription>
					</div>
					<TierBadge tier={currentTier} />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Bonus Summary Stats */}
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<div className="rounded-lg border bg-green-50 p-3 text-center dark:bg-green-900/20">
						<RiMoneyDollarCircleLine className="mx-auto mb-1 h-5 w-5 text-green-600" />
						<p className="text-muted-foreground text-xs">Total Earned</p>
						<p className="font-bold text-green-600 text-lg">
							{formatCurrency(bonusSummary.totalEarnings)}
						</p>
					</div>
					<div className="rounded-lg border bg-yellow-50 p-3 text-center dark:bg-yellow-900/20">
						<p className="text-muted-foreground text-xs">Pending</p>
						<p className="font-bold text-lg text-yellow-600">
							{formatCurrency(bonusSummary.totalPendingBonus)}
						</p>
					</div>
					<div className="rounded-lg border p-3 text-center">
						<RiUserAddLine className="mx-auto mb-1 h-5 w-5 text-blue-600" />
						<p className="text-muted-foreground text-xs">Direct Recruits</p>
						<p className="font-bold text-lg">{bonusSummary.downlineCount}</p>
					</div>
					<div className="rounded-lg border p-3 text-center">
						<RiArrowUpLine className="mx-auto mb-1 h-5 w-5 text-purple-600" />
						<p className="text-muted-foreground text-xs">Bonus Rate</p>
						<p className="font-bold text-lg">
							{bonusSummary.leadershipBonusRate > 0
								? `${bonusSummary.leadershipBonusRate}%`
								: "—"}
						</p>
					</div>
				</div>

				{/* Upline Info */}
				{uplineInfo && (
					<div className="rounded-lg border bg-muted/30 p-3">
						<p className="mb-1 text-muted-foreground text-xs">
							Your Upline (Recruiter)
						</p>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="text-lg">
									{TIER_COLORS[uplineInfo.uplineTier as AgentTier]?.icon ||
										"👤"}
								</span>
								<span className="font-medium">{uplineInfo.uplineName}</span>
							</div>
							{uplineInfo.uplineTier && (
								<Badge variant="outline" className="text-xs">
									{
										AGENT_TIER_CONFIG[uplineInfo.uplineTier as AgentTier]
											?.displayName
									}
								</Badge>
							)}
						</div>
					</div>
				)}

				{/* Downline Preview */}
				{downline && downline.length > 0 && (
					<div>
						<p className="mb-2 font-medium text-sm">
							Your Recruited Agents ({downline.length})
						</p>
						<div className="max-h-32 space-y-2 overflow-y-auto">
							{downline.slice(0, 5).map((agent) => (
								<div
									key={agent.id}
									className="flex items-center justify-between border-b pb-1 text-sm last:border-0"
								>
									<span>{agent.name}</span>
									<Badge variant="outline" className="text-xs">
										{
											AGENT_TIER_CONFIG[
												(agent.agentTier || "advisor") as AgentTier
											]?.displayName
										}
									</Badge>
								</div>
							))}
							{downline.length > 5 && (
								<p className="text-center text-muted-foreground text-xs">
									+{downline.length - 5} more agents
								</p>
							)}
						</div>
					</div>
				)}

				{/* No Bonus Message */}
				{!hasBonus && (
					<div className="rounded-lg bg-muted/30 p-4 text-center text-muted-foreground text-sm">
						<p>
							Leadership bonus becomes available at{" "}
							<strong>Sales Leader</strong> tier and above.
						</p>
						<p className="mt-1">
							Keep building your sales record to unlock this benefit!
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
