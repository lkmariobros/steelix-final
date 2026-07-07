"use client";

import { trpc } from "@/utils/trpc";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TierProgress } from "./tier-progress";
import { TierHistoryTimeline } from "./tier-history-timeline";
import { AgentProfilePanel } from "./agent-profile-panel";
import type { AgentTier } from "@/lib/agent-tier-config";
import {
	RiUserLine,
	RiLineChartLine,
	RiHistoryLine,
	RiAwardLine,
} from "@remixicon/react";

interface AgentViewModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agentId: string;
	onManage?: () => void;
}

export function AgentViewModal({
	open,
	onOpenChange,
	agentId,
	onManage,
}: AgentViewModalProps) {
	const { data: agentData, isLoading } = trpc.agents.getById.useQuery(
		{ id: agentId },
		{ enabled: open && !!agentId },
	);

	const agent = agentData?.agent;
	const currentTier = (agent?.agentTier || "advisor") as AgentTier;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[96vh] w-[min(96vw,76rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
				<DialogHeader className="shrink-0 border-b bg-muted/20 px-8 py-5">
					<DialogTitle className="flex items-center gap-2 text-xl">
						<RiUserLine className="h-5 w-5 text-primary" />
						Agent Profile
					</DialogTitle>
					<DialogDescription>
						View and edit detailed agent information and tier progression
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{isLoading ? (
						<AgentViewSkeleton />
					) : agent ? (
						<Tabs defaultValue="details" className="w-full">
							<TabsList className="grid w-full grid-cols-4">
								<TabsTrigger value="details">Details</TabsTrigger>
								<TabsTrigger value="progress" className="flex items-center gap-1">
									<RiLineChartLine className="h-4 w-4" />
									Progress
								</TabsTrigger>
								<TabsTrigger value="history" className="flex items-center gap-1">
									<RiHistoryLine className="h-4 w-4" />
									History
								</TabsTrigger>
								<TabsTrigger value="stats" className="flex items-center gap-1">
									<RiAwardLine className="h-4 w-4" />
									Stats
								</TabsTrigger>
							</TabsList>

							<TabsContent value="details" className="mt-4">
								<AgentProfilePanel
									agent={agent}
									recruiterName={agentData?.recruiter?.name}
									onManage={onManage}
								/>
							</TabsContent>

							<TabsContent value="progress" className="mt-4">
								<TierProgress
									currentTier={currentTier}
									metrics={{ monthlySales: 0, teamMembers: 0 }}
								/>
							</TabsContent>

							<TabsContent value="history" className="mt-4">
								<TierHistoryTimeline agentId={agentId} />
							</TabsContent>

							<TabsContent value="stats" className="mt-4">
								<AgentStatsPanel
									performanceHistory={agentData?.performanceHistory || []}
									currentGoals={agentData?.currentGoals || []}
								/>
							</TabsContent>
						</Tabs>
					) : (
						<div className="py-8 text-center text-muted-foreground">
							Agent not found
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function AgentViewSkeleton() {
	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="pt-5">
					<div className="flex items-start gap-4">
						<Skeleton className="h-14 w-14 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-4 w-64" />
						</div>
					</div>
				</CardContent>
			</Card>
			<div className="grid gap-4 xl:grid-cols-2">
				<Skeleton className="h-40 w-full" />
				<Skeleton className="h-40 w-full" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		</div>
	);
}

interface AgentStatsPanelProps {
	performanceHistory: Array<{
		totalTransactions?: number | null;
		totalCommission?: string | number | null;
		averageCommission?: string | number | null;
		conversionRate?: string | number | null;
	}>;
	currentGoals: Array<{
		id: string;
		title: string;
		goalType: string;
		currentValue?: string | null;
		targetValue: string;
		unit: string;
	}>;
}

function AgentStatsPanel({ performanceHistory, currentGoals }: AgentStatsPanelProps) {
	const latestPerformance = performanceHistory[0];

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="font-bold text-2xl text-primary">
							{latestPerformance?.totalTransactions || 0}
						</p>
						<p className="text-muted-foreground text-xs">Total Transactions</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="font-bold text-2xl text-green-600">
							${Number(latestPerformance?.totalCommission || 0).toLocaleString()}
						</p>
						<p className="text-muted-foreground text-xs">Total Commission</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="font-bold text-2xl text-blue-600">
							${Number(latestPerformance?.averageCommission || 0).toLocaleString()}
						</p>
						<p className="text-muted-foreground text-xs">Avg Commission</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="font-bold text-2xl text-amber-600">
							{Number(latestPerformance?.conversionRate || 0).toFixed(1)}%
						</p>
						<p className="text-muted-foreground text-xs">Conversion Rate</p>
					</CardContent>
				</Card>
			</div>

			{currentGoals.length > 0 ? (
				<Card>
					<CardContent className="space-y-3 pt-4">
						{currentGoals.map((goal) => (
							<div
								key={goal.id}
								className="flex items-center justify-between rounded-lg bg-muted/50 p-2"
							>
								<div>
									<p className="font-medium text-sm">{goal.title}</p>
									<p className="text-muted-foreground text-xs">{goal.goalType}</p>
								</div>
								<div className="text-right">
									<p className="font-bold">
										{goal.currentValue || 0} / {goal.targetValue}
									</p>
									<p className="text-muted-foreground text-xs">{goal.unit}</p>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			) : performanceHistory.length === 0 ? (
				<div className="py-8 text-center text-muted-foreground">
					<RiLineChartLine className="mx-auto mb-2 h-12 w-12 opacity-50" />
					<p>No performance data available yet</p>
				</div>
			) : null}
		</div>
	);
}
