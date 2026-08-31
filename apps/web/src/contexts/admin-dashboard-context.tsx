"use client";

/**
 * AdminDashboardContext
 *
 * Fetches admin dashboard data in one place. Critical widgets (summary + queue)
 * load first; heavier insights/performance wait until after first paint.
 */

import { trpc } from "@/utils/trpc";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export interface AdminDateRange {
	startDate?: Date;
	endDate?: Date;
}

function defaultDashboardDateRange(): AdminDateRange {
	const end = new Date();
	end.setHours(23, 59, 59, 999);
	const start = new Date();
	start.setDate(start.getDate() - 90);
	start.setHours(0, 0, 0, 0);
	return { startDate: start, endDate: end };
}

export interface DashboardSummaryData {
	totalTransactions: number;
	pendingApprovals: number;
	approvedTransactions: number;
	totalCommissionValue: string | number | null;
	avgCommissionValue: string | number | null;
}

export interface CommissionApprovalItem {
	id: string;
	agentId: string | null;
	agentName: string | null;
	agentEmail: string | null;
	agentImage?: string | null;
	agentCode?: string | null;
	coAgentName?: string | null;
	coAgentCode?: string | null;
	isCoBroking?: boolean | null;
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
		purchasingMethod?: "cash" | "loan";
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
	agentImage?: string | null;
	teamId?: string | null;
	totalTransactions: number;
	totalCommission: string | number | null;
	avgCommission: string | number | null;
	approvedCount: number;
	pendingCount: number;
}

export interface AgingBucket {
	key: "fresh" | "attention" | "overdue";
	label: string;
	count: number;
	amount: number;
}

export interface DealMixSegment {
	key: "newProject" | "subsale" | "rental";
	label: string;
	count: number;
	amount: number;
}

export interface DashboardInsightsData {
	aging: {
		buckets: AgingBucket[];
		totalPending: number;
		totalPendingAmount: number;
		oldestDays: number | null;
	};
	dealMix: {
		segments: DealMixSegment[];
		totalCount: number;
		totalAmount: number;
	};
}

interface AdminDashboardContextValue {
	dateRange: AdminDateRange;
	setDateRange: (range: AdminDateRange) => void;

	dashboardSummary: DashboardSummaryData | undefined;
	commissionQueue: CommissionQueueData | undefined;
	dashboardInsights: DashboardInsightsData | undefined;
	agentPerformance: AgentPerformanceItem[] | undefined;

	summaryLoading: boolean;
	queueLoading: boolean;
	insightsLoading: boolean;
	performanceLoading: boolean;
	isLoading: boolean;
	isRefetching: boolean;
	hasError: boolean;

	refetch: () => void;
}

const AdminDashboardContext = createContext<AdminDashboardContextValue | null>(
	null,
);

export function AdminDashboardProvider({
	children,
}: { children: React.ReactNode }) {
	const [dateRange, setDateRange] = useState<AdminDateRange>(
		defaultDashboardDateRange,
	);
	const [loadSecondary, setLoadSecondary] = useState(false);

	useEffect(() => {
		const idle =
			typeof window !== "undefined" && "requestIdleCallback" in window
				? window.requestIdleCallback(() => setLoadSecondary(true), {
						timeout: 1200,
					})
				: null;
		const fallback = window.setTimeout(() => setLoadSecondary(true), 600);
		return () => {
			if (idle != null && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idle);
			}
			window.clearTimeout(fallback);
		};
	}, []);

	const queryRange = useMemo(
		() => ({
			startDate: dateRange.startDate,
			endDate: dateRange.endDate,
		}),
		[dateRange.endDate, dateRange.startDate],
	);

	const summaryQuery = trpc.admin.getDashboardSummary.useQuery(queryRange, {
		staleTime: 3 * 60_000,
	});

	const queueQuery = trpc.admin.getCommissionApprovalQueue.useQuery(
		{ limit: 20, offset: 0, status: "pending" },
		{ staleTime: 3 * 60_000 },
	);

	const insightsQuery = trpc.admin.getDashboardInsights.useQuery(queryRange, {
		staleTime: 3 * 60_000,
		enabled: loadSecondary,
	});

	const performanceQuery = trpc.admin.getAgentPerformance.useQuery(
		{ dateRange: queryRange, limit: 24 },
		{ staleTime: 3 * 60_000, enabled: loadSecondary },
	);

	const summaryLoading = summaryQuery.isPending;
	const queueLoading = queueQuery.isPending;
	const insightsLoading = loadSecondary && insightsQuery.isPending;
	const performanceLoading = loadSecondary && performanceQuery.isPending;

	// First paint only waits on summary + queue
	const isLoading = summaryLoading || queueLoading;

	const isRefetching =
		summaryQuery.isFetching ||
		queueQuery.isFetching ||
		insightsQuery.isFetching ||
		performanceQuery.isFetching;

	const hasError =
		!!summaryQuery.error ||
		!!queueQuery.error ||
		!!insightsQuery.error ||
		!!performanceQuery.error;

	const refetch = useCallback(() => {
		void summaryQuery.refetch();
		void queueQuery.refetch();
		void insightsQuery.refetch();
		void performanceQuery.refetch();
	}, [summaryQuery, queueQuery, insightsQuery, performanceQuery]);

	return (
		<AdminDashboardContext.Provider
			value={{
				dateRange,
				setDateRange,
				dashboardSummary: summaryQuery.data as DashboardSummaryData | undefined,
				commissionQueue: queueQuery.data as CommissionQueueData | undefined,
				dashboardInsights: insightsQuery.data as
					| DashboardInsightsData
					| undefined,
				agentPerformance: performanceQuery.data as
					| AgentPerformanceItem[]
					| undefined,
				summaryLoading,
				queueLoading,
				insightsLoading,
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

export function useAdminDashboard() {
	const ctx = useContext(AdminDashboardContext);
	if (!ctx) {
		throw new Error(
			"useAdminDashboard must be used inside <AdminDashboardProvider>",
		);
	}
	return ctx;
}
