"use client";

/**
 * AgentDashboardContext
 *
 * Fetches ALL dashboard data in one place so every widget gets its data from
 * context instead of making its own independent network requests.
 *
 * Benefits:
 *  - tRPC batches all queries into a single HTTP request
 *  - One shared loading state → no cascading skeleton flash
 *  - Shared date-range filter without prop drilling
 *  - Single refetch() refreshes the whole dashboard
 */

import { trpc } from "@/utils/trpc";
import { createContext, useCallback, useContext, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
	startDate?: Date;
	endDate?: Date;
}

// Explicit interfaces — avoids broken Drizzle/tRPC inference (resolves to {})
// Shapes are derived directly from the server controller return values.

export interface FinancialOverviewData {
	overview: {
		totalCommission: number;
		completedDeals: number;
		pendingCommission: number;
		averageDealValue: number;
	};
	monthlyTrend: { month: string; commission: number; deals: number }[];
}

export interface RecentTransactionItem {
	id: string;
	agentId: string | null;
	agentName: string | null;
	propertyAddress: string;
	propertyPrice: number;
	clientName: string;
	status: string | null;
	transactionDate: Date | null;
	updatedAt: Date | null;
}

export type RecentTransactionsData = RecentTransactionItem[];

export interface SalesPipelineItem {
	status: string | null;
	count: number;
	totalValue: number;
}

export interface SalesPipelineData {
	pipeline: SalesPipelineItem[];
	activeTransactions: {
		id: string;
		agentId: string | null;
		propertyAddress: string;
		propertyPrice: number;
		clientName: string;
		status: string | null;
		transactionDate: Date | null;
		commissionAmount: string | null;
	}[];
}

export interface TransactionStatusItem {
	status: string | null;
	count: number;
	percentage: number;
}

export type TransactionStatusData = TransactionStatusItem[];

export interface TeamLeaderboardItem {
	agentId: string;
	agentName: string | null;
	agentImage: string | null;
	totalCommission: number;
	completedDeals: number;
	activeDeals: number;
}

export type TeamLeaderboardData = TeamLeaderboardItem[];

export interface BonusSummaryData {
	currentTier: string | null | undefined;
	leadershipBonusRate: number;
	downlineCount: number;
	totalPendingBonus: number;
	totalPaidBonus: number;
	totalEarnings: number;
	recentPayments: unknown[];
}

export interface UplineData {
	uplineId: string | null;
	uplineName: string | null;
	uplineTier: string | null;
	leadershipBonusRate: number;
}

export interface DownlineAgent {
	id: string;
	name: string | null;
	email: string | null;
	agentTier: string | null;
	recruitedAt: Date | null;
}

export type DownlineData = DownlineAgent[];

interface AgentDashboardContextValue {
	// Date filter
	dateRange: DateRange;
	setDateRange: (range: DateRange) => void;

	// Data — explicitly typed to avoid broken Drizzle/tRPC inference
	financialOverview: FinancialOverviewData | undefined;
	recentTransactions: RecentTransactionsData | undefined;
	salesPipeline: SalesPipelineData | undefined;
	transactionStatus: TransactionStatusData | undefined;
	teamLeaderboard: TeamLeaderboardData | undefined;
	bonusSummary: BonusSummaryData | undefined;
	uplineInfo: UplineData | null | undefined;
	downline: DownlineData | undefined;

	// State
	isLoading: boolean;
	isRefetching: boolean;
	hasError: boolean;

	// Actions
	refetch: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AgentDashboardContext = createContext<AgentDashboardContextValue | null>(
	null,
);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AgentDashboardProviderProps {
	children: React.ReactNode;
	transactionLimit?: number;
}

export function AgentDashboardProvider({
	children,
	transactionLimit = 8,
}: AgentDashboardProviderProps) {
	const [dateRange, setDateRange] = useState<DateRange>({});

	// ── All queries in ONE component → tRPC batches them into ONE HTTP request ──

	const financialQuery = trpc.dashboard.getFinancialOverview.useQuery(
		{ startDate: dateRange.startDate, endDate: dateRange.endDate },
		{ staleTime: 60_000 },
	);

	const recentTransactionsQuery = trpc.dashboard.getRecentTransactions.useQuery(
		{ limit: transactionLimit },
		{ staleTime: 60_000 },
	);

	const salesPipelineQuery = trpc.dashboard.getSalesPipeline.useQuery(
		undefined,
		{ staleTime: 60_000 },
	);

	const transactionStatusQuery = trpc.dashboard.getTransactionStatus.useQuery(
		undefined,
		{ staleTime: 60_000 },
	);

	const teamLeaderboardQuery = trpc.dashboard.getTeamLeaderboard.useQuery(
		undefined,
		{ staleTime: 60_000 },
	);

	const bonusSummaryQuery =
		trpc.agentTiers.getMyLeadershipBonusSummary.useQuery(undefined, {
			staleTime: 60_000,
		});

	const uplineQuery = trpc.agentTiers.getMyUpline.useQuery(undefined, {
		staleTime: 60_000,
	});

	const downlineQuery = trpc.agentTiers.getMyDownline.useQuery(undefined, {
		staleTime: 60_000,
	});

	// ── Derived state ──────────────────────────────────────────────────────────

	const isLoading =
		financialQuery.isLoading ||
		recentTransactionsQuery.isLoading ||
		salesPipelineQuery.isLoading ||
		transactionStatusQuery.isLoading ||
		teamLeaderboardQuery.isLoading ||
		bonusSummaryQuery.isLoading;

	const isRefetching =
		financialQuery.isFetching ||
		recentTransactionsQuery.isFetching ||
		salesPipelineQuery.isFetching ||
		transactionStatusQuery.isFetching ||
		teamLeaderboardQuery.isFetching ||
		bonusSummaryQuery.isFetching;

	const hasError =
		!!financialQuery.error ||
		!!recentTransactionsQuery.error ||
		!!salesPipelineQuery.error ||
		!!transactionStatusQuery.error ||
		!!teamLeaderboardQuery.error;

	// ── Refetch all ───────────────────────────────────────────────────────────

	const refetch = useCallback(() => {
		financialQuery.refetch();
		recentTransactionsQuery.refetch();
		salesPipelineQuery.refetch();
		transactionStatusQuery.refetch();
		teamLeaderboardQuery.refetch();
		bonusSummaryQuery.refetch();
		uplineQuery.refetch();
		downlineQuery.refetch();
	}, [
		financialQuery,
		recentTransactionsQuery,
		salesPipelineQuery,
		transactionStatusQuery,
		teamLeaderboardQuery,
		bonusSummaryQuery,
		uplineQuery,
		downlineQuery,
	]);

	return (
		<AgentDashboardContext.Provider
			value={{
				dateRange,
				setDateRange,
				// Cast to explicit types — Drizzle SQL expressions (count/sum/avg)
				// lose specificity through tRPC's type inference chain.
				financialOverview: financialQuery.data as
					| FinancialOverviewData
					| undefined,
				recentTransactions: recentTransactionsQuery.data as
					| RecentTransactionsData
					| undefined,
				salesPipeline: salesPipelineQuery.data as SalesPipelineData | undefined,
				transactionStatus: transactionStatusQuery.data as
					| TransactionStatusData
					| undefined,
				teamLeaderboard: teamLeaderboardQuery.data as
					| TeamLeaderboardData
					| undefined,
				bonusSummary: bonusSummaryQuery.data as BonusSummaryData | undefined,
				uplineInfo: uplineQuery.data as UplineData | null | undefined,
				downline: downlineQuery.data as DownlineData | undefined,
				isLoading,
				isRefetching,
				hasError,
				refetch,
			}}
		>
			{children}
		</AgentDashboardContext.Provider>
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentDashboard() {
	const ctx = useContext(AgentDashboardContext);
	if (!ctx) {
		throw new Error(
			"useAgentDashboard must be used inside <AgentDashboardProvider>",
		);
	}
	return ctx;
}
