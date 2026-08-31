/**
 * Targeted query invalidation for transaction data flow.
 * Prefer narrow keys so dashboards do not refetch everything on every edit.
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * After agent create / draft save / update / submit.
 */
export function invalidateTransactionQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		queryKey: [["transactions"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getRecentTransactions"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getTransactionStatus"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getSalesPipeline"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getCommissionApprovalQueue"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getRecordLog"]],
	});
}

/**
 * After admin approve / reject / status change.
 */
export function invalidateAdminQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		queryKey: [["admin", "getCommissionApprovalQueue"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getDashboardSummary"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getUrgentTasks"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getDashboardInsights"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["transactions"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getRecentTransactions"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getTransactionStatus"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["admin", "getRecordLog"]],
	});
}

/**
 * After agent-only actions that should refresh agent home widgets.
 */
export function invalidateAgentQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getFinancialOverview"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getSalesPipeline"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getTransactionStatus"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["dashboard", "getRecentTransactions"]],
	});
	queryClient.invalidateQueries({
		queryKey: [["transactions"]],
	});
}

/**
 * Force refresh all transaction-related data.
 * Use sparingly — for major data changes or user role changes.
 */
export function forceRefreshAllQueries(queryClient: QueryClient) {
	queryClient.invalidateQueries();
	queryClient.refetchQueries();
}

/**
 * Optimistic update helper for transaction status changes.
 * Updates local cache immediately before server response.
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
		[["admin", "getCommissionApprovalQueue"]],
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
		[["dashboard", "getRecentTransactions"]],
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
