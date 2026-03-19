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

type FinancialOverviewData = ReturnType<
	typeof trpc.dashboard.getFinancialOverview.useQuery
>["data"];
type RecentTransactionsData = ReturnType<
	typeof trpc.dashboard.getRecentTransactions.useQuery
>["data"];
type SalesPipelineData = ReturnType<
	typeof trpc.dashboard.getSalesPipeline.useQuery
>["data"];
type TransactionStatusData = ReturnType<
	typeof trpc.dashboard.getTransactionStatus.useQuery
>["data"];
type TeamLeaderboardData = ReturnType<
	typeof trpc.dashboard.getTeamLeaderboard.useQuery
>["data"];
type BonusSummaryData = ReturnType<
	typeof trpc.agentTiers.getMyLeadershipBonusSummary.useQuery
>["data"];
type UplineData = ReturnType<
	typeof trpc.agentTiers.getMyUpline.useQuery
>["data"];
type DownlineData = ReturnType<
	typeof trpc.agentTiers.getMyDownline.useQuery
>["data"];

interface AgentDashboardContextValue {
	// Date filter
	dateRange: DateRange;
	setDateRange: (range: DateRange) => void;

	// Data
	financialOverview: FinancialOverviewData;
	recentTransactions: RecentTransactionsData;
	salesPipeline: SalesPipelineData;
	transactionStatus: TransactionStatusData;
	teamLeaderboard: TeamLeaderboardData;
	bonusSummary: BonusSummaryData;
	uplineInfo: UplineData;
	downline: DownlineData;

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
				financialOverview: financialQuery.data,
				recentTransactions: recentTransactionsQuery.data,
				salesPipeline: salesPipelineQuery.data,
				transactionStatus: transactionStatusQuery.data,
				teamLeaderboard: teamLeaderboardQuery.data,
				bonusSummary: bonusSummaryQuery.data,
				uplineInfo: uplineQuery.data,
				downline: downlineQuery.data,
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
