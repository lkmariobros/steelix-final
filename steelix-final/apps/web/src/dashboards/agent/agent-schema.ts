import { z } from "zod";

// Financial overview data schema
export const financialOverviewSchema = z.object({
	overview: z.object({
		totalCommission: z.number(),
		completedDeals: z.number(),
		pendingCommission: z.number(),
		averageDealValue: z.number(),
	}),
	monthlyTrend: z.array(
		z.object({
			month: z.string(),
			commission: z.number(),
			deals: z.number(),
		}),
	),
});

// Sales pipeline data schema
export const salesPipelineSchema = z.object({
	pipeline: z.array(
		z.object({
			status: z.string(),
			count: z.number(),
			totalValue: z.number(),
		}),
	),
	activeTransactions: z.array(
		z.object({
			id: z.string(),
			propertyAddress: z.string().nullable(),
			propertyPrice: z.number().nullable(),
			clientName: z.string().nullable(),
			status: z.string(),
			transactionDate: z.date(),
			commissionAmount: z.string(),
		}),
	),
});

// Transaction status data schema
export const transactionStatusSchema = z.array(
	z.object({
		status: z.string(),
		count: z.number(),
		percentage: z.number(),
	}),
);

// Recent transactions schema
export const recentTransactionsSchema = z.array(
	z.object({
		id: z.string(),
		agentId: z.string(),
		agentName: z.string(),
		propertyAddress: z.string().nullable(),
		propertyPrice: z.number().nullable(),
		clientName: z.string().nullable(),
		status: z.string(),
		transactionDate: z.date(),
		updatedAt: z.date(),
	}),
);

// Team leaderboard schema
export const teamLeaderboardSchema = z.array(
	z.object({
		agentId: z.string(),
		agentName: z.string(),
		agentImage: z.string().nullable(),
		totalCommission: z.number(),
		completedDeals: z.number(),
		activeDeals: z.number(),
	}),
);

// Dashboard preferences schema
export const dashboardPreferencesSchema = z.object({
	id: z.string(),
	userId: z.string(),
	dashboardType: z.enum(["agent", "admin"]),
	layoutConfig: z.string().nullable(),
	widgetVisibility: z.string().nullable(),
	notificationSettings: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Input schemas for API calls
export const dateRangeInputSchema = z.object({
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export const preferencesInputSchema = z.object({
	dashboardType: z.enum(["agent", "admin"]),
	layoutConfig: z.record(z.any()).optional(),
	widgetVisibility: z.record(z.boolean()).optional(),
	notificationSettings: z.record(z.any()).optional(),
});

// TypeScript types
export type FinancialOverview = z.infer<typeof financialOverviewSchema>;
export type SalesPipeline = z.infer<typeof salesPipelineSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type RecentTransactions = z.infer<typeof recentTransactionsSchema>;
export type TeamLeaderboard = z.infer<typeof teamLeaderboardSchema>;
export type DashboardPreferences = z.infer<typeof dashboardPreferencesSchema>;
export type DateRangeInput = z.infer<typeof dateRangeInputSchema>;
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;

// Status color mapping for consistent UI
export const statusColors = {
	draft: "bg-gray-100 text-gray-800",
	submitted: "bg-blue-100 text-blue-800",
	under_review: "bg-yellow-100 text-yellow-800",
	approved: "bg-green-100 text-green-800",
	rejected: "bg-red-100 text-red-800",
	completed: "bg-emerald-100 text-emerald-800",
} as const;

// Status display names
export const statusLabels = {
	draft: "Draft",
	submitted: "Submitted",
	under_review: "Under Review",
	approved: "Approved",
	rejected: "Rejected",
	completed: "Completed",
} as const;

// Widget configuration types
export interface WidgetConfig {
	id: string;
	title: string;
	enabled: boolean;
	order: number;
	size: "small" | "medium" | "large" | "full";
}

export const defaultWidgetConfig: WidgetConfig[] = [
	{
		id: "financial-overview",
		title: "Financial Overview",
		enabled: true,
		order: 1,
		size: "full",
	},
	{
		id: "sales-pipeline",
		title: "Sales Pipeline",
		enabled: true,
		order: 2,
		size: "large",
	},
	{
		id: "transaction-status",
		title: "Transaction Status",
		enabled: true,
		order: 3,
		size: "medium",
	},
	{
		id: "recent-transactions",
		title: "Recent Transactions",
		enabled: true,
		order: 4,
		size: "large",
	},
	{
		id: "team-leaderboard",
		title: "Team Leaderboard",
		enabled: true,
		order: 5,
		size: "medium",
	},
];

// Helper functions
export function getStatusColor(status: string): string {
	return (
		statusColors[status as keyof typeof statusColors] ||
		"bg-gray-100 text-gray-800"
	);
}

export function getStatusLabel(status: string): string {
	return statusLabels[status as keyof typeof statusLabels] || status;
}

export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

export function formatPercentage(value: number | string | null | undefined): string {
	const n = typeof value === "string" ? parseFloat(value) : value ?? 0
	if (!Number.isFinite(n)) return "0.0%"
	return `${n.toFixed(1)}%`
}

export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

export function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffInHours = Math.floor(
		(now.getTime() - date.getTime()) / (1000 * 60 * 60),
	);

	if (diffInHours < 1) {
		return "Just now";
	}
	if (diffInHours < 24) {
		return `${diffInHours}h ago`;
	}
	if (diffInHours < 168) {
		// 7 days
		const days = Math.floor(diffInHours / 24);
		return `${days}d ago`;
	}
	return formatDate(date);
}
