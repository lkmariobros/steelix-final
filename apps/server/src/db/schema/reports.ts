import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

// Report type enum
export const reportTypeEnum = pgEnum("report_type", [
	"performance",
	"financial",
	"agent_activity",
	"transaction_summary",
	"commission_analysis",
	"custom",
]);

// Report frequency enum
export const reportFrequencyEnum = pgEnum("report_frequency", [
	"daily",
	"weekly",
	"monthly",
	"quarterly",
	"yearly",
	"custom",
]);

// Report status enum
export const reportStatusEnum = pgEnum("report_status", [
	"pending",
	"generating",
	"completed",
	"failed",
	"scheduled",
]);

// Reports table for generated reports
export const reports = pgTable("reports", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: text("description"),
	
	// Report configuration
	type: reportTypeEnum("type").notNull(),
	frequency: reportFrequencyEnum("frequency").default("monthly"),
	
	// Date range
	startDate: timestamp("start_date").notNull(),
	endDate: timestamp("end_date").notNull(),
	
	// Filters and parameters
	filters: jsonb("filters").$type<{
		agentIds?: string[];
		teamIds?: string[];
		agencyIds?: string[];
		transactionTypes?: string[];
		marketTypes?: string[];
		statusFilters?: string[];
		amountRange?: {
			min: number;
			max: number;
		};
		[key: string]: any;
	}>(),
	
	// Report data and results
	data: jsonb("data").$type<{
		summary: {
			totalTransactions: number;
			totalCommission: number;
			averageCommission: number;
			topPerformers: Array<{
				agentId: string;
				agentName: string;
				transactions: number;
				commission: number;
			}>;
		};
		details: any[];
		charts: Array<{
			type: string;
			title: string;
			data: any[];
		}>;
		[key: string]: any;
	}>(),
	
	// Status and metadata
	status: reportStatusEnum("status").default("pending").notNull(),
	generatedBy: text("generated_by")
		.notNull()
		.references(() => user.id),
	
	// File information
	fileUrl: text("file_url"),
	fileSize: integer("file_size"),
	fileFormat: text("file_format").default("pdf"),
	
	// Scheduling
	isScheduled: boolean("is_scheduled").default(false),
	nextRunAt: timestamp("next_run_at"),
	lastRunAt: timestamp("last_run_at"),
	
	// Timestamps
	generatedAt: timestamp("generated_at"),
	expiresAt: timestamp("expires_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	typeIdx: index("idx_reports_type").on(table.type),
	statusIdx: index("idx_reports_status").on(table.status),
	generatedByIdx: index("idx_reports_generated_by").on(table.generatedBy),
	createdAtIdx: index("idx_reports_created_at").on(table.createdAt),
	isScheduledIdx: index("idx_reports_is_scheduled").on(table.isScheduled),
}));

// Performance metrics table for caching calculated metrics
export const performanceMetrics = pgTable("performance_metrics", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Time period
	periodType: text("period_type").notNull(), // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
	periodStart: timestamp("period_start").notNull(),
	periodEnd: timestamp("period_end").notNull(),
	
	// Transaction metrics
	totalTransactions: integer("total_transactions").default(0).notNull(),
	completedTransactions: integer("completed_transactions").default(0).notNull(),
	pendingTransactions: integer("pending_transactions").default(0).notNull(),
	
	// Financial metrics
	totalCommission: decimal("total_commission", { precision: 12, scale: 2 }).default("0").notNull(),
	averageCommission: decimal("average_commission", { precision: 10, scale: 2 }).default("0").notNull(),
	totalSalesVolume: decimal("total_sales_volume", { precision: 15, scale: 2 }).default("0").notNull(),
	
	// Performance indicators
	conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0").notNull(),
	averageDaysToClose: decimal("average_days_to_close", { precision: 5, scale: 1 }).default("0").notNull(),
	clientSatisfactionScore: decimal("client_satisfaction_score", { precision: 3, scale: 2 }).default("0").notNull(),
	
	// Rankings and comparisons
	rankInTeam: integer("rank_in_team"),
	rankInAgency: integer("rank_in_agency"),
	percentileScore: decimal("percentile_score", { precision: 5, scale: 2 }),
	
	// Additional metrics
	metrics: jsonb("metrics").$type<{
		leadGeneration?: number;
		followUpRate?: number;
		referralRate?: number;
		repeatClientRate?: number;
		marketingROI?: number;
		[key: string]: any;
	}>(),
	
	// Timestamps
	calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	agentIdIdx: index("idx_performance_metrics_agent_id").on(table.agentId),
	periodIdx: index("idx_performance_metrics_period").on(table.periodType, table.periodStart, table.periodEnd),
	calculatedAtIdx: index("idx_performance_metrics_calculated_at").on(table.calculatedAt),
}));

// Analytics dashboards configuration
export const analyticsDashboards = pgTable("analytics_dashboards", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: text("description"),
	
	// Dashboard configuration
	layout: jsonb("layout").$type<{
		widgets: Array<{
			id: string;
			type: string;
			title: string;
			position: { x: number; y: number; w: number; h: number };
			config: any;
		}>;
		theme?: string;
		refreshInterval?: number;
	}>(),
	
	// Access control
	isPublic: boolean("is_public").default(false),
	allowedRoles: jsonb("allowed_roles").$type<string[]>(),
	allowedUsers: jsonb("allowed_users").$type<string[]>(),
	
	// Metadata
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id),
	isDefault: boolean("is_default").default(false),
	
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	nameIdx: index("idx_analytics_dashboards_name").on(table.name),
	createdByIdx: index("idx_analytics_dashboards_created_by").on(table.createdBy),
	isPublicIdx: index("idx_analytics_dashboards_is_public").on(table.isPublic),
}));

// Zod schemas for validation
export const insertReportSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	type: z.enum(["performance", "financial", "agent_activity", "transaction_summary", "commission_analysis", "custom"]),
	frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]).default("monthly"),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	filters: z.object({
		agentIds: z.array(z.string()).optional(),
		teamIds: z.array(z.string()).optional(),
		agencyIds: z.array(z.string()).optional(),
		transactionTypes: z.array(z.string()).optional(),
		marketTypes: z.array(z.string()).optional(),
		statusFilters: z.array(z.string()).optional(),
		amountRange: z.object({
			min: z.number(),
			max: z.number(),
		}).optional(),
	}).optional(),
	fileFormat: z.enum(["pdf", "excel", "csv"]).default("pdf"),
	isScheduled: z.boolean().default(false),
	nextRunAt: z.coerce.date().optional(),
});

export const selectReportSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	type: z.enum(["performance", "financial", "agent_activity", "transaction_summary", "commission_analysis", "custom"]),
	frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]),
	startDate: z.date(),
	endDate: z.date(),
	filters: z.any().nullable(),
	data: z.any().nullable(),
	status: z.enum(["pending", "generating", "completed", "failed", "scheduled"]),
	generatedBy: z.string(),
	fileUrl: z.string().nullable(),
	fileSize: z.number().nullable(),
	fileFormat: z.string(),
	isScheduled: z.boolean(),
	nextRunAt: z.date().nullable(),
	lastRunAt: z.date().nullable(),
	generatedAt: z.date().nullable(),
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const performanceMetricsSchema = z.object({
	id: z.string(),
	agentId: z.string(),
	periodType: z.string(),
	periodStart: z.date(),
	periodEnd: z.date(),
	totalTransactions: z.number(),
	completedTransactions: z.number(),
	pendingTransactions: z.number(),
	totalCommission: z.string(), // Decimal as string
	averageCommission: z.string(),
	totalSalesVolume: z.string(),
	conversionRate: z.string(),
	averageDaysToClose: z.string(),
	clientSatisfactionScore: z.string(),
	rankInTeam: z.number().nullable(),
	rankInAgency: z.number().nullable(),
	percentileScore: z.string().nullable(),
	metrics: z.any().nullable(),
	calculatedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Type exports
export type Report = z.infer<typeof selectReportSchema>;
export type NewReport = z.infer<typeof insertReportSchema>;
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;
export type ReportType = Report["type"];
export type ReportStatus = Report["status"];
export type ReportFrequency = Report["frequency"];

// Constants for report generation
export const REPORT_EXPIRY_DAYS = {
	daily: 7,
	weekly: 30,
	monthly: 90,
	quarterly: 180,
	yearly: 365,
	custom: 30,
} as const;

export const PERFORMANCE_PERIODS = {
	DAILY: "daily",
	WEEKLY: "weekly",
	MONTHLY: "monthly",
	QUARTERLY: "quarterly",
	YEARLY: "yearly",
} as const;
