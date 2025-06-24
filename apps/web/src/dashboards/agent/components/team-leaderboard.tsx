"use client";

import { Avatar } from "@/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { RiAwardLine, RiMedalLine, RiTrophyLine } from "@remixicon/react";
// Simple utility function to avoid import issues
const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
};

export function TeamLeaderboard() {
	// Real tRPC query - replaces mock data
	const {
		data: leaderboard,
		isLoading,
		error,
	} = useQuery(trpc.dashboard.getTeamLeaderboard.queryOptions());

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Team Leaderboard</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="flex items-center gap-3">
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
					<CardTitle>Team Leaderboard</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Failed to load leaderboard data. Please try again.
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!leaderboard || leaderboard.length === 0) {
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

	const getRankIcon = (index: number) => {
		switch (index) {
			case 0:
				return <RiTrophyLine className="size-4 text-yellow-500" />;
			case 1:
				return <RiMedalLine className="size-4 text-gray-400" />;
			case 2:
				return <RiAwardLine className="size-4 text-amber-600" />;
			default:
				return (
					<div className="flex size-4 items-center justify-center rounded-full bg-muted font-medium text-xs">
						{index + 1}
					</div>
				);
		}
	};

	const getRankBadgeColor = (index: number) => {
		switch (index) {
			case 0:
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			case 1:
				return "bg-gray-100 text-gray-800 border-gray-200";
			case 2:
				return "bg-amber-100 text-amber-800 border-amber-200";
			default:
				return "bg-muted text-muted-foreground border-border";
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Team Leaderboard</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{leaderboard.map((agent, index) => (
						<div
							key={agent.agentId}
							className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
								index < 3 ? "bg-muted/50" : ""
							}`}
						>
							{/* Rank */}
							<div
								className={`flex size-8 items-center justify-center rounded-full border ${getRankBadgeColor(index)}`}
							>
								{getRankIcon(index)}
							</div>

							{/* Agent Info */}
							<div className="flex min-w-0 flex-1 items-center gap-3">
								<Avatar className="size-8">
									{agent.agentImage ? (
										<img
											src={agent.agentImage}
											alt={agent.agentName}
											className="size-full object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center bg-primary/10 font-medium text-primary text-sm">
											{agent.agentName.charAt(0).toUpperCase()}
										</div>
									)}
								</Avatar>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium text-sm">
										{agent.agentName}
									</div>
									<div className="text-muted-foreground text-xs">
										{agent.completedDeals} completed • {agent.activeDeals}{" "}
										active
									</div>
								</div>
							</div>

							{/* Performance */}
							<div className="text-right">
								<div className="font-semibold text-sm">
									{formatCurrency(agent.totalCommission)}
								</div>
								<div className="text-muted-foreground text-xs">commission</div>
							</div>
						</div>
					))}
				</div>

				{/* Team Summary */}
				{leaderboard.length > 0 && (
					<div className="mt-4 space-y-2 border-t pt-4">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Team Total</span>
							<span className="font-medium">
								{formatCurrency(
									leaderboard.reduce(
										(sum, agent) => sum + agent.totalCommission,
										0,
									),
								)}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Total Deals</span>
							<span className="font-medium">
								{leaderboard.reduce(
									(sum, agent) => sum + agent.completedDeals,
									0,
								)}{" "}
								completed
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Active Pipeline</span>
							<span className="font-medium">
								{leaderboard.reduce((sum, agent) => sum + agent.activeDeals, 0)}{" "}
								deals
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
