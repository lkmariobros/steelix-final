"use client";

/**
 * AdminDashboardContext
 *
 * Fetches ALL admin dashboard data in one place so every widget reads from
 * context instead of making its own independent network requests.
 *
 * Benefits:
 *  - tRPC batches all queries into a single HTTP request on page load
 *  - One shared loading/error state — no cascading skeleton flash
 *  - Shared date-range filter without prop drilling
 *  - Single refetch() refreshes the whole dashboard
 *  - No more refreshKey anti-pattern
 */

import { trpc } from "@/utils/trpc";
import { createContext, useCallback, useContext, useState } from "react";

// ─── Explicit data interfaces (avoids broken tRPC inference with Drizzle ORM) ──

export interface AdminDateRange {
	startDate?: Date;
	endDate?: Date;
}

/** Matches what the server's getDashboardSummary procedure actually returns */
export interface DashboardSummaryData {
	totalTransactions: number;
	pendingApprovals: number;
	approvedTransactions: number;
	/** Drizzle sum() returns string | null */
	totalCommissionValue: string | number | null;
	/** Drizzle avg() returns string | null */
	avgCommissionValue: string | number | null;
}

export interface CommissionApprovalItem {
	id: string;
	agentId: string | null;
	agentName: string | null;
	agentEmail: string | null;
	clientData: {
		name?: string;
		email?: string;
		phone?: string;
		type?: string;
		source?: string;
		notes?: string;
		icNo?: string;
		address?: string;
	} | null;
	propertyData: {
		address?: string;
		propertyType?: string;
		price?: number;
		listingTitle?: string;
		spaPrice?: number;
		nettPrice?: number;
	} | null;
	transactionType: string;
	marketType?: string | null;
	transactionDate?: Date | string | null;
	commissionAmount: string | null;
	commissionValue?: string | null;
	commissionBreakdown?: unknown;
	status: string | null;
	submittedAt: Date | string | null;
	createdAt: Date | string;
	reviewNotes?: string | null;
	caseNo?: string | null;
	bookingDate?: Date | string | null;
	projectName?: string | null;
	unitNo?: string | null;
	blockListingId?: string | null;
	notes?: string | null;
}

export interface CommissionQueueData {
	transactions: CommissionApprovalItem[];
	totalCount: number;
	hasMore: boolean;
}

export interface AgentPerformanceItem {
	agentId: string;
	agentName: string | null;
	agentEmail: string | null;
	teamId?: string | null;
	totalTransactions: number;
	/** Drizzle sum() returns string | null */
	totalCommission: string | number | null;
	/** Drizzle avg() returns string | null */
	avgCommission: string | number | null;
	approvedCount: number;
	pendingCount: number;
}

export interface UrgentTaskItem {
	id: string;
	type: unknown;
	title: unknown;
	description: unknown;
	priority: unknown;
	agentName: string | null;
	createdAt: Date | string | null;
	clientData?: {
		name?: string;
		email?: string;
		phone?: string;
	} | null;
}

// ─── Context value interface ───────────────────────────────────────────────────

interface AdminDashboardContextValue {
	// Date filter (shared across all widgets)
	dateRange: AdminDateRange;
	setDateRange: (range: AdminDateRange) => void;

	// Data — explicitly typed to avoid broken Drizzle/tRPC inference
	dashboardSummary: DashboardSummaryData | undefined;
	commissionQueue: CommissionQueueData | undefined;
	urgentTasks: UrgentTaskItem[] | undefined;
	agentPerformance: AgentPerformanceItem[] | undefined;

	// State — per-widget so one slow query does not block the whole dashboard
	summaryLoading: boolean;
	queueLoading: boolean;
	urgentLoading: boolean;
	performanceLoading: boolean;
	isLoading: boolean;
	isRefetching: boolean;
	hasError: boolean;

	// Actions
	refetch: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AdminDashboardContext = createContext<AdminDashboardContextValue | null>(
	null,
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminDashboardProvider({
	children,
}: { children: React.ReactNode }) {
	const [dateRange, setDateRange] = useState<AdminDateRange>({});

	// ── All queries in ONE component → tRPC batches them into ONE HTTP request ──

	const summaryQuery = trpc.admin.getDashboardSummary.useQuery(dateRange, {
		staleTime: 3 * 60_000,
	});

	const queueQuery = trpc.admin.getCommissionApprovalQueue.useQuery(
		{ limit: 10, offset: 0, status: "pending" },
		{ staleTime: 3 * 60_000 },
	);

	const urgentQuery = trpc.admin.getUrgentTasks.useQuery(undefined, {
		staleTime: 3 * 60_000,
	});

	const performanceQuery = trpc.admin.getAgentPerformance.useQuery(
		{ dateRange },
		{ staleTime: 3 * 60_000 },
	);

	// ── Derived state ──────────────────────────────────────────────────────────

	const summaryLoading = summaryQuery.isPending;
	const queueLoading = queueQuery.isPending;
	const urgentLoading = urgentQuery.isPending;
	const performanceLoading = performanceQuery.isPending;

	const isLoading =
		summaryLoading ||
		queueLoading ||
		urgentLoading ||
		performanceLoading;

	const isRefetching =
		summaryQuery.isFetching ||
		queueQuery.isFetching ||
		urgentQuery.isFetching ||
		performanceQuery.isFetching;

	const hasError =
		!!summaryQuery.error ||
		!!queueQuery.error ||
		!!urgentQuery.error ||
		!!performanceQuery.error;

	// ── Refetch all ───────────────────────────────────────────────────────────

	const refetch = useCallback(() => {
		summaryQuery.refetch();
		queueQuery.refetch();
		urgentQuery.refetch();
		performanceQuery.refetch();
	}, [summaryQuery, queueQuery, urgentQuery, performanceQuery]);

	return (
		<AdminDashboardContext.Provider
			value={{
				dateRange,
				setDateRange,
				// Cast to explicit types — the inferred Drizzle/tRPC types lose
				// specificity through complex SQL expressions (count/sum/avg).
				dashboardSummary: summaryQuery.data as DashboardSummaryData | undefined,
				commissionQueue: queueQuery.data as CommissionQueueData | undefined,
				urgentTasks: urgentQuery.data as UrgentTaskItem[] | undefined,
				agentPerformance: performanceQuery.data as
					| AgentPerformanceItem[]
					| undefined,
				summaryLoading,
				queueLoading,
				urgentLoading,
				performanceLoading,
				isLoading,
				isRefetching,
				hasError,
				refetch,
			}}
		>
			{children}
		</AdminDashboardContext.Provider>
	);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
	const ctx = useContext(AdminDashboardContext);
	if (!ctx) {
		throw new Error(
			"useAdminDashboard must be used inside <AdminDashboardProvider>",
		);
	}
	return ctx;
}
