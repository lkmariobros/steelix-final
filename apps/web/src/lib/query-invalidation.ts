/**
 * Comprehensive query invalidation utilities for transaction data flow
 * Ensures real-time updates across admin and agent dashboards
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate all dashboard-related queries after transaction operations
 * This ensures both admin and agent dashboards show updated data
 */
export function invalidateTransactionQueries(queryClient: QueryClient) {
	// Agent dashboard queries
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getFinancialOverview"],
	});
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getSalesPipeline"],
	});
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getTransactionStatus"],
	});
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getRecentTransactions"],
	});

	// Admin dashboard queries
	queryClient.invalidateQueries({
		queryKey: ["admin", "getDashboardSummary"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getCommissionApprovalQueue"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getAgentPerformance"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getUrgentTasks"],
	});

	// Transaction-specific queries
	queryClient.invalidateQueries({
		queryKey: ["transactions"],
	});
}

/**
 * Invalidate queries after transaction status changes (approve/reject)
 * More targeted invalidation for admin actions
 */
export function invalidateAdminQueries(queryClient: QueryClient) {
	// Admin-specific queries that change with approvals
	queryClient.invalidateQueries({
		queryKey: ["admin", "getCommissionApprovalQueue"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getDashboardSummary"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getAgentPerformance"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getUrgentTasks"],
	});

	// Also update agent dashboards as their transaction status changed
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getFinancialOverview"],
	});
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getSalesPipeline"],
	});
	queryClient.invalidateQueries({
		queryKey: ["dashboard", "getTransactionStatus"],
	});
}

/**
 * Invalidate queries after agent-specific actions
 * More targeted invalidation for agent operations
 */
export function invalidateAgentQueries(queryClient: QueryClient) {
	// Agent dashboard queries
	queryClient.invalidateQueries({
		queryKey: ["dashboard"],
	});

	// Also update admin views as they aggregate agent data
	queryClient.invalidateQueries({
		queryKey: ["admin", "getDashboardSummary"],
	});
	queryClient.invalidateQueries({
		queryKey: ["admin", "getAgentPerformance"],
	});
}

/**
 * Force refresh all transaction-related data
 * Use sparingly - for major data changes or user role changes
 */
export function forceRefreshAllQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries();
	queryClient.refetchQueries();
}

/**
 * Optimistic update helper for transaction status changes
 * Updates local cache immediately before server response
 */
export function optimisticUpdateTransaction(
	queryClient: QueryClient,
	transactionId: string,
	updates: Record<string, unknown>,
) {
	type OldQueue = {
		transactions?: Array<{ id: string; [k: string]: unknown }>;
	};
	queryClient.setQueryData(
		["admin", "getCommissionApprovalQueue"],
		(oldData: OldQueue | undefined) => {
			if (!oldData?.transactions) return oldData;

			return {
				...oldData,
				transactions: oldData.transactions.map((transaction) =>
					transaction.id === transactionId
						? { ...transaction, ...updates }
						: transaction,
				),
			};
		},
	);

	type TransactionItem = { id: string; [k: string]: unknown };
	queryClient.setQueryData(
		["dashboard", "getRecentTransactions"],
		(oldData: TransactionItem[] | undefined) => {
			if (!Array.isArray(oldData)) return oldData;

			return oldData.map((transaction) =>
				transaction.id === transactionId
					? { ...transaction, ...updates }
					: transaction,
			);
		},
	);
}
