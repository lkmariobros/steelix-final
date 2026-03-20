"use client";

import { Avatar } from "@/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { RiAwardLine, RiMedalLine, RiTrophyLine } from "@remixicon/react";

const formatCurrency = (amount: number): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);

const RANK_ICONS = [
	<RiTrophyLine key="t" className="size-4 text-yellow-500" />,
	<RiMedalLine key="m" className="size-4 text-gray-400" />,
	<RiAwardLine key="a" className="size-4 text-amber-600" />,
];

const RANK_COLORS = [
	"bg-yellow-100 text-yellow-800 border-yellow-200",
	"bg-gray-100 text-gray-800 border-gray-200",
	"bg-amber-100 text-amber-800 border-amber-200",
];

export function TeamLeaderboard() {
	const { teamLeaderboard, isLoading } = useAgentDashboard();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Team Leaderboard</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{["sk-tl-1", "sk-tl-2", "sk-tl-3", "sk-tl-4", "sk-tl-5"].map(
							(id) => (
								<div key={id} className="flex items-center gap-3">
									<Skeleton className="size-8 rounded-full" />
									<div className="flex-1 space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
									<div className="space-y-1 text-right">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-3 w-16" />
									</div>
								</div>
							),
						)}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!teamLeaderboard || teamLeaderboard.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Team Leaderboard</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						No team members found.
					</p>
				</CardContent>
			</Card>
		);
	}

	const totalCommission = teamLeaderboard.reduce(
		(sum, a) => sum + a.totalCommission,
		0,
	);
	const totalCompleted = teamLeaderboard.reduce(
		(sum, a) => sum + a.completedDeals,
		0,
	);
	const totalActive = teamLeaderboard.reduce(
		(sum, a) => sum + a.activeDeals,
		0,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Team Leaderboard</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{teamLeaderboard.map((agent, i) => (
						<div
							key={agent.agentId}
							className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${i < 3 ? "bg-muted/50" : ""}`}
						>
							<div
								className={`flex size-8 items-center justify-center rounded-full border ${RANK_COLORS[i] ?? "border-border bg-muted text-muted-foreground"}`}
							>
								{RANK_ICONS[i] ?? (
									<div className="flex size-4 items-center justify-center rounded-full bg-muted font-medium text-xs">
										{i + 1}
									</div>
								)}
							</div>

							<div className="flex min-w-0 flex-1 items-center gap-3">
								<Avatar className="size-8">
									{agent.agentImage ? (
										<img
											src={agent.agentImage}
											alt={agent.agentName ?? undefined}
											className="size-full object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center bg-primary/10 font-medium text-primary text-sm">
											{(agent.agentName ?? "?").charAt(0).toUpperCase()}
										</div>
									)}
								</Avatar>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium text-sm">
										{agent.agentName}
									</div>
									<div className="text-muted-foreground text-xs">
										{agent.completedDeals} completed · {agent.activeDeals}{" "}
										active
									</div>
								</div>
							</div>

							<div className="text-right">
								<div className="font-semibold text-sm">
									{formatCurrency(agent.totalCommission)}
								</div>
								<div className="text-muted-foreground text-xs">commission</div>
							</div>
						</div>
					))}
				</div>

				<div className="mt-4 space-y-2 border-t pt-4">
					{[
						{ label: "Team Total", value: formatCurrency(totalCommission) },
						{ label: "Total Deals", value: `${totalCompleted} completed` },
						{ label: "Active Pipeline", value: `${totalActive} deals` },
					].map(({ label, value }) => (
						<div
							key={label}
							className="flex items-center justify-between text-sm"
						>
							<span className="text-muted-foreground">{label}</span>
							<span className="font-medium">{value}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
