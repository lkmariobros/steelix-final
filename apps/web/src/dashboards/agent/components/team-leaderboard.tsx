"use client";

import { Avatar } from "@/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentDashboard } from "@/contexts/agent-dashboard-context";
import { cn } from "@/lib/utils";
import {
	RiAwardLine,
	RiFireLine,
	RiMedalLine,
	RiSparklingLine,
	RiTrophyLine,
} from "@remixicon/react";

const formatCurrency = (amount: number): string =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);

const PERIODS = [
	{ value: "month" as const, label: "Month" },
	{ value: "30d" as const, label: "30d" },
	{ value: "all" as const, label: "All" },
];

const RANK_ICONS = [
	<RiTrophyLine key="t" className="size-3.5 text-amber-500" />,
	<RiMedalLine key="m" className="size-3.5 text-slate-400" />,
	<RiAwardLine key="a" className="size-3.5 text-orange-600" />,
];

export function TeamLeaderboard() {
	const { teamLeaderboard, isLoading, leaderboardPeriod, setLeaderboardPeriod } =
		useAgentDashboard();

	const periodToggle = (
		<div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5">
			{PERIODS.map((p) => (
				<button
					key={p.value}
					type="button"
					onClick={() => setLeaderboardPeriod(p.value)}
					className={cn(
						"inline-flex h-7 items-center rounded-full px-2.5 font-medium text-[11px] transition-colors",
						leaderboardPeriod === p.value
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{p.label}
				</button>
			))}
		</div>
	);

	if (isLoading) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<div className="flex items-center justify-between gap-2">
						<CardTitle className="text-base">Team Leaderboard</CardTitle>
						{periodToggle}
					</div>
				</CardHeader>
				<CardContent className="space-y-3 p-5">
					{["sk-tl-1", "sk-tl-2", "sk-tl-3", "sk-tl-4"].map((id) => (
						<div key={id} className="flex items-center gap-3">
							<Skeleton className="size-8 rounded-full" />
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-2 w-full rounded-full" />
							</div>
							<Skeleton className="h-4 w-14" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	if (!teamLeaderboard || teamLeaderboard.length === 0) {
		return (
			<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
				<CardHeader className="border-border/50 border-b px-5 py-4">
					<div className="flex items-center justify-between gap-2">
						<CardTitle className="text-base">Team Leaderboard</CardTitle>
						{periodToggle}
					</div>
				</CardHeader>
				<CardContent className="p-5">
					<p className="py-6 text-center text-muted-foreground text-sm">
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
	const topScore = Math.max(...teamLeaderboard.map((a) => a.score || 0), 1);

	return (
		<Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card">
			<CardHeader className="border-border/50 border-b px-5 py-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle className="text-base">Team Leaderboard</CardTitle>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Ranked by performance score
						</p>
					</div>
					{periodToggle}
				</div>
			</CardHeader>
			<CardContent className="p-4 sm:p-5">
				{/* Top performer highlight */}
				{teamLeaderboard[0] && (
					<div className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
						<div className="mb-2 flex items-center gap-1.5 font-medium text-[11px] text-primary uppercase tracking-wide">
							<RiTrophyLine className="size-3.5" />
							Top performer
						</div>
						<div className="flex items-center gap-3">
							<Avatar className="size-11 shrink-0 ring-2 ring-primary/30">
								{teamLeaderboard[0].agentImage ? (
									<img
										src={teamLeaderboard[0].agentImage}
										alt={teamLeaderboard[0].agentName ?? undefined}
										className="size-full object-cover"
									/>
								) : (
									<div className="flex size-full items-center justify-center bg-primary/15 font-bold text-primary">
										{(teamLeaderboard[0].agentName ?? "?")
											.charAt(0)
											.toUpperCase()}
									</div>
								)}
							</Avatar>
							<div className="min-w-0 flex-1">
								<div className="truncate font-semibold text-sm">
									{teamLeaderboard[0].agentName}
								</div>
								<div className="text-muted-foreground text-xs">
									Level {teamLeaderboard[0].level} ·{" "}
									{teamLeaderboard[0].completedDeals} completed
								</div>
							</div>
							<div className="text-right">
								<div className="font-bold text-lg tabular-nums text-primary">
									{formatCurrency(teamLeaderboard[0].totalCommission)}
								</div>
								<div className="text-muted-foreground text-xs tabular-nums">
									{teamLeaderboard[0].score.toLocaleString()} pts
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="space-y-2">
					{teamLeaderboard.map((agent, i) => {
						const barPct = Math.round((agent.score / topScore) * 100);
						return (
							<div
								key={agent.agentId}
								className={cn(
									"rounded-2xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30",
									i === 0 && "border-primary/25 bg-primary/[0.03]",
								)}
							>
								<div className="flex items-center gap-2.5">
									<div
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
											i === 0 &&
												"border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
											i === 1 &&
												"border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-800/50",
											i === 2 &&
												"border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-900/30",
											i > 2 && "border-border bg-muted text-muted-foreground",
										)}
									>
										{RANK_ICONS[i] ?? i + 1}
									</div>

									<Avatar className="size-8 shrink-0">
										{agent.agentImage ? (
											<img
												src={agent.agentImage}
												alt={agent.agentName ?? undefined}
												className="size-full object-cover"
											/>
										) : (
											<div className="flex size-full items-center justify-center bg-primary/12 font-semibold text-primary text-sm">
												{(agent.agentName ?? "?").charAt(0).toUpperCase()}
											</div>
										)}
									</Avatar>

									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span className="truncate font-medium text-sm">
												{agent.agentName}
											</span>
											{agent.badges[0] && (
												<span className="hidden items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-0.5 font-medium text-[10px] text-primary sm:inline-flex">
													<RiSparklingLine className="size-2.5" />
													{agent.badges[0]}
												</span>
											)}
										</div>
										<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
											<div
												className={cn(
													"h-full rounded-full transition-all",
													i === 0 ? "bg-primary" : "bg-primary/50",
												)}
												style={{ width: `${Math.max(barPct, 4)}%` }}
											/>
										</div>
										<div className="mt-1 text-muted-foreground text-[11px]">
											{agent.completedDeals} completed · {agent.activeDeals}{" "}
											active
											{agent.streakDays > 0 && (
												<span className="ml-1.5 inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
													<RiFireLine className="size-3" />
													{agent.streakDays}d
												</span>
											)}
										</div>
									</div>

									<div className="shrink-0 text-right">
										<div className="font-semibold text-sm tabular-nums">
											{formatCurrency(agent.totalCommission)}
										</div>
										<div className="text-muted-foreground text-[11px] tabular-nums">
											{agent.score.toLocaleString()} pts
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				<div className="mt-4 grid grid-cols-3 gap-2 border-border/50 border-t pt-4">
					{[
						{ label: "Team Total", value: formatCurrency(totalCommission) },
						{ label: "Total Deals", value: `${totalCompleted}` },
						{ label: "Active", value: `${totalActive}` },
					].map(({ label, value }) => (
						<div
							key={label}
							className="rounded-xl border border-border/50 bg-muted/25 px-2.5 py-2 text-center"
						>
							<div className="text-muted-foreground text-[10px] uppercase tracking-wide">
								{label}
							</div>
							<div className="mt-0.5 font-bold text-sm tabular-nums">{value}</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
