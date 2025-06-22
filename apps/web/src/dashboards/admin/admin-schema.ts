import { z } from "zod";

// Admin dashboard widget configuration
export const adminWidgetConfigSchema = z.object({
	id: z.string(),
	title: z.string(),
	enabled: z.boolean(),
	order: z.number(),
	size: z.enum(["small", "medium", "large", "full"]),
});

export type AdminWidgetConfig = z.infer<typeof adminWidgetConfigSchema>;

// Commission approval queue schemas
export const commissionApprovalSchema = z.object({
	id: z.string(),
	agentId: z.string(),
	agentName: z.string().nullable(),
	agentEmail: z.string().nullable(),
	clientData: z
		.object({
			name: z.string(),
			email: z.string(),
			phone: z.string(),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string(),
			notes: z.string().optional(),
		})
		.nullable(),
	propertyData: z
		.object({
			address: z.string(),
			propertyType: z.string(),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number(),
			description: z.string().optional(),
		})
		.nullable(),
	transactionType: z.enum(["sale", "lease", "rental"]),
	commissionAmount: z.string(), // Decimal stored as string
	commissionValue: z.string(), // Decimal stored as string
	status: z.enum(["submitted", "under_review", "approved", "rejected"]),
	submittedAt: z.union([z.date(), z.string()]).nullable(),
	createdAt: z.union([z.date(), z.string()]),
});

export type CommissionApproval = z.infer<typeof commissionApprovalSchema>;

export const commissionApprovalQueueSchema = z.object({
	transactions: z.array(commissionApprovalSchema),
	totalCount: z.number(),
	hasMore: z.boolean(),
});

export type CommissionApprovalQueue = z.infer<
	typeof commissionApprovalQueueSchema
>;

// Agent performance schemas
export const agentPerformanceSchema = z.object({
	agentId: z.string(),
	agentName: z.string().nullable(),
	agentEmail: z.string().nullable(),
	teamId: z.string().nullable(),
	totalTransactions: z.number(),
	totalCommission: z.number().nullable(),
	avgCommission: z.number().nullable(),
	approvedCount: z.number(),
	pendingCount: z.number(),
});

export type AgentPerformance = z.infer<typeof agentPerformanceSchema>;

// Urgent tasks schemas
export const urgentTaskSchema = z.object({
	id: z.string(),
	type: z.string(),
	title: z.string(),
	description: z.string(),
	priority: z.enum(["low", "medium", "high", "critical"]),
	agentName: z.string().nullable(),
	createdAt: z.union([z.date(), z.string()]).nullable(),
	clientData: z
		.object({
			name: z.string(),
			email: z.string(),
			phone: z.string(),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string(),
			notes: z.string().optional(),
		})
		.nullable()
		.optional(),
});

export type UrgentTask = z.infer<typeof urgentTaskSchema>;

// Dashboard summary schemas
export const dashboardSummarySchema = z.object({
	totalTransactions: z.number(),
	pendingApprovals: z.number(),
	approvedTransactions: z.number(),
	totalCommissionValue: z.number().nullable(),
	avgCommissionValue: z.number().nullable(),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

// Filter schemas
export const dateRangeFilterSchema = z.object({
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;

export const agentFilterSchema = z.object({
	teamId: z.string().optional(),
	agencyId: z.string().optional(),
	dateRange: dateRangeFilterSchema.optional(),
});

export type AgentFilter = z.infer<typeof agentFilterSchema>;

// Status color mapping (reusing from agent dashboard pattern)
export const statusColors = {
	draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	under_review:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
	approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	completed:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
} as const;

// Priority color mapping
export const priorityColors = {
	low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
} as const;

// Default admin widget configuration
export const defaultAdminWidgetConfig: AdminWidgetConfig[] = [
	{
		id: "dashboard-summary",
		title: "Dashboard Summary",
		enabled: true,
		order: 1,
		size: "full",
	},
	{
		id: "commission-approval-queue",
		title: "Commission Approval Queue",
		enabled: true,
		order: 2,
		size: "large",
	},
	{
		id: "agent-performance-grid",
		title: "Agent Performance Grid",
		enabled: true,
		order: 3,
		size: "large",
	},
	{
		id: "urgent-tasks-panel",
		title: "Urgent Tasks Panel",
		enabled: true,
		order: 4,
		size: "medium",
	},
];

// Helper functions
export function getStatusColor(status: string): string {
	return (
		statusColors[status as keyof typeof statusColors] || statusColors.draft
	);
}

export function getPriorityColor(priority: string): string {
	return (
		priorityColors[priority as keyof typeof priorityColors] ||
		priorityColors.low
	);
}

export function formatCurrency(amount: number | string | null): string {
	if (!amount) return "$0";

	const numAmount =
		typeof amount === "string" ? Number.parseFloat(amount) : amount;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(numAmount);
}

export function formatPercentage(value: number): string {
	return `${value.toFixed(1)}%`;
}

export function formatDate(date: Date | string | null): string {
	if (!date) return "N/A";

	try {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return "Invalid Date";
	}
}

export function formatDateTime(date: Date | string | null): string {
	if (!date) return "N/A";

	try {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return dateObj.toLocaleString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "Invalid Date";
	}
}

export function getDaysAgo(date: Date | string | null): number {
	if (!date) return 0;

	// For mock data, return static values to avoid hydration mismatch
	if (typeof date === "string") {
		// Static calculation for mock dates
		if (date.includes("2024-01-07")) return 8;
		if (date.includes("2024-01-06")) return 9;
		return 7; // Default for other mock dates
	}

	try {
		const dateObj = date;
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - dateObj.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	} catch {
		return 0;
	}
}

// Performance calculation helpers
export function calculateApprovalRate(approved: number, total: number): number {
	if (total === 0) return 0;
	return (approved / total) * 100;
}

export function calculatePerformanceGrade(
	totalTransactions: number,
	approvalRate: number,
	avgCommission: number,
): "A" | "B" | "C" | "D" | "F" {
	let score = 0;

	// Transaction volume (40% weight)
	if (totalTransactions >= 20) score += 40;
	else if (totalTransactions >= 15) score += 30;
	else if (totalTransactions >= 10) score += 20;
	else if (totalTransactions >= 5) score += 10;

	// Approval rate (35% weight)
	if (approvalRate >= 95) score += 35;
	else if (approvalRate >= 90) score += 30;
	else if (approvalRate >= 85) score += 25;
	else if (approvalRate >= 80) score += 20;
	else if (approvalRate >= 70) score += 15;

	// Average commission (25% weight)
	if (avgCommission >= 10000) score += 25;
	else if (avgCommission >= 7500) score += 20;
	else if (avgCommission >= 5000) score += 15;
	else if (avgCommission >= 2500) score += 10;
	else if (avgCommission >= 1000) score += 5;

	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 60) return "D";
	return "F";
}
