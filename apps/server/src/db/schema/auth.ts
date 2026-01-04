import {
	boolean,
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
	jsonb,
} from "drizzle-orm/pg-core";

// Agent tier enum for commission calculations
export const agentTierEnum = pgEnum("agent_tier", [
	"advisor",
	"sales_leader",
	"team_leader",
	"group_leader",
	"supreme_leader",
]);

// Agencies table - top level of hierarchy
export const agencies = pgTable("agencies", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	settings: text("settings"), // JSON string for agency settings
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Teams table - belongs to agencies
export const teams = pgTable("teams", {
	id: uuid("id").primaryKey().defaultRandom(),
	agencyId: uuid("agency_id")
		.notNull()
		.references(() => agencies.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	settings: text("settings"), // JSON string for team settings
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Extended user table with hierarchy relationships and agent tier system
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
	// Hierarchy relationships
	agencyId: uuid("agency_id").references(() => agencies.id),
	teamId: uuid("team_id").references(() => teams.id),
	role: text("role").default("agent"), // 'agent', 'team_lead', 'admin'
	permissions: text("permissions"), // JSON string for role permissions
	// Agent tier system for commission calculations
	agentTier: agentTierEnum("agent_tier").default("advisor"),
	companyCommissionSplit: integer("company_commission_split").default(70), // Percentage (70 = 70% for Advisor under New Leadership Plan)
	tierEffectiveDate: timestamp("tier_effective_date").defaultNow(),
	tierPromotedBy: text("tier_promoted_by"), // Self-reference for who promoted - will add FK constraint separately
	// Recruitment/upline tracking for Leadership Bonus (1-level direct upline only)
	recruitedBy: text("recruited_by"), // User ID of direct upline who recruited this agent
	recruitedAt: timestamp("recruited_at"), // Date when agent was recruited
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
}, (table) => ({
	recruitedByIdx: index("idx_user_recruited_by").on(table.recruitedBy),
	agentTierIdx: index("idx_user_agent_tier").on(table.agentTier),
}));

// Agent tier history for audit trail and compliance
export const agentTierHistory = pgTable("agent_tier_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	previousTier: agentTierEnum("previous_tier"),
	newTier: agentTierEnum("new_tier").notNull(),
	effectiveDate: timestamp("effective_date").defaultNow().notNull(),
	promotedBy: text("promoted_by").references(() => user.id),
	reason: text("reason"), // Reason for tier change
	performanceMetrics: text("performance_metrics"), // JSON string for metrics that triggered change
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Dashboard preferences for customization
export const dashboardPreferences = pgTable("dashboard_preferences", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	dashboardType: text("dashboard_type").notNull(), // 'agent' or 'admin'
	layoutConfig: text("layout_config"), // JSON string for layout configuration
	widgetVisibility: text("widget_visibility"), // JSON string for widget visibility
	notificationSettings: text("notification_settings"), // JSON string for notifications
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

// Commission audit log for compliance and tracking
export const commissionAuditLog = pgTable("commission_audit_log", {
	id: uuid("id").primaryKey().defaultRandom(),
	transactionId: uuid("transaction_id").notNull(), // References transactions table
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	oldValues: text("old_values"), // JSON string of previous commission values
	newValues: text("new_values"), // JSON string of new commission values
	changedBy: text("changed_by")
		.notNull()
		.references(() => user.id),
	changeReason: text("change_reason"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Tier commission configuration table - allows admin to modify tier settings
export const tierCommissionConfig = pgTable("tier_commission_config", {
	id: uuid("id").primaryKey().defaultRandom(),
	tier: agentTierEnum("tier").notNull().unique(),
	commissionSplit: integer("commission_split").notNull(), // Agent's percentage (e.g., 70 = 70%)
	leadershipBonusRate: integer("leadership_bonus_rate").notNull().default(0), // Percentage from company's share
	requirements: jsonb("requirements").$type<{
		monthlySales: number;
		teamMembers: number;
	}>().notNull(),
	displayName: text("display_name").notNull(),
	description: text("description"),
	isActive: boolean("is_active").default(true).notNull(),
	effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
	effectiveTo: timestamp("effective_to"), // Null means currently active
	createdBy: text("created_by").references(() => user.id),
	updatedBy: text("updated_by").references(() => user.id),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	tierIdx: index("idx_tier_commission_config_tier").on(table.tier),
	isActiveIdx: index("idx_tier_commission_config_is_active").on(table.isActive),
}));

// Leadership bonus payments table - tracks bonus payments to uplines
export const leadershipBonusPayments = pgTable("leadership_bonus_payments", {
	id: uuid("id").primaryKey().defaultRandom(),
	transactionId: uuid("transaction_id").notNull(), // References transactions table
	// The agent who made the sale (downline)
	downlineAgentId: text("downline_agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	// The agent receiving the leadership bonus (direct upline)
	uplineAgentId: text("upline_agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	// Upline's tier at time of payment
	uplineTier: agentTierEnum("upline_tier").notNull(),
	// Commission details
	originalCommissionAmount: decimal("original_commission_amount", { precision: 15, scale: 2 }).notNull(),
	companyShareAmount: decimal("company_share_amount", { precision: 15, scale: 2 }).notNull(),
	leadershipBonusRate: integer("leadership_bonus_rate").notNull(), // Percentage applied
	leadershipBonusAmount: decimal("leadership_bonus_amount", { precision: 15, scale: 2 }).notNull(),
	// Status
	status: text("status").default("pending").notNull(), // pending, paid, cancelled
	paidAt: timestamp("paid_at"),
	// Audit
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	transactionIdIdx: index("idx_leadership_bonus_transaction_id").on(table.transactionId),
	downlineAgentIdIdx: index("idx_leadership_bonus_downline_agent_id").on(table.downlineAgentId),
	uplineAgentIdIdx: index("idx_leadership_bonus_upline_agent_id").on(table.uplineAgentId),
	statusIdx: index("idx_leadership_bonus_status").on(table.status),
}));

// Tier configuration change audit log
export const tierConfigChangeLog = pgTable("tier_config_change_log", {
	id: uuid("id").primaryKey().defaultRandom(),
	configId: uuid("config_id").references(() => tierCommissionConfig.id),
	tier: agentTierEnum("tier").notNull(),
	changeType: text("change_type").notNull(), // 'create', 'update', 'deactivate'
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	changedBy: text("changed_by")
		.notNull()
		.references(() => user.id),
	changeReason: text("change_reason"),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
	configIdIdx: index("idx_tier_config_change_log_config_id").on(table.configId),
	tierIdx: index("idx_tier_config_change_log_tier").on(table.tier),
	timestampIdx: index("idx_tier_config_change_log_timestamp").on(table.timestamp),
}));

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});

// Zod schemas for validation
import { z } from "zod";

export const agentTierSchema = z.enum([
	"advisor",
	"sales_leader",
	"team_leader",
	"group_leader",
	"supreme_leader",
]);

export const agentTierHistorySchema = z.object({
	id: z.string(),
	agentId: z.string(),
	previousTier: agentTierSchema.nullable(),
	newTier: agentTierSchema,
	effectiveDate: z.date(),
	promotedBy: z.string().nullable(),
	reason: z.string().nullable(),
	performanceMetrics: z.string().nullable(),
	createdAt: z.date(),
});

export const commissionAuditLogSchema = z.object({
	id: z.string(),
	transactionId: z.string(),
	agentId: z.string(),
	oldValues: z.string().nullable(),
	newValues: z.string().nullable(),
	changedBy: z.string(),
	changeReason: z.string().nullable(),
	ipAddress: z.string().nullable(),
	userAgent: z.string().nullable(),
	timestamp: z.date(),
});

// Tier commission config schema
export const tierCommissionConfigSchema = z.object({
	id: z.string(),
	tier: agentTierSchema,
	commissionSplit: z.number(),
	leadershipBonusRate: z.number(),
	requirements: z.object({
		monthlySales: z.number(),
		teamMembers: z.number(),
	}),
	displayName: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	effectiveFrom: z.date(),
	effectiveTo: z.date().nullable(),
	createdBy: z.string().nullable(),
	updatedBy: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Leadership bonus payment schema
export const leadershipBonusPaymentSchema = z.object({
	id: z.string(),
	transactionId: z.string(),
	downlineAgentId: z.string(),
	uplineAgentId: z.string(),
	uplineTier: agentTierSchema,
	originalCommissionAmount: z.string(), // Decimal comes as string
	companyShareAmount: z.string(),
	leadershipBonusRate: z.number(),
	leadershipBonusAmount: z.string(),
	status: z.enum(["pending", "paid", "cancelled"]),
	paidAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Enhanced user schema with agent tier fields
export const userWithTierSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	agencyId: z.string().nullable(),
	teamId: z.string().nullable(),
	role: z.string().nullable(),
	permissions: z.string().nullable(),
	agentTier: agentTierSchema,
	companyCommissionSplit: z.number(),
	tierEffectiveDate: z.date().nullable(),
	tierPromotedBy: z.string().nullable(),
	recruitedBy: z.string().nullable(),
	recruitedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// TypeScript types
export type AgentTier = z.infer<typeof agentTierSchema>;
export type AgentTierHistory = z.infer<typeof agentTierHistorySchema>;
export type CommissionAuditLog = z.infer<typeof commissionAuditLogSchema>;
export type TierCommissionConfig = z.infer<typeof tierCommissionConfigSchema>;
export type LeadershipBonusPayment = z.infer<typeof leadershipBonusPaymentSchema>;
export type UserWithTier = z.infer<typeof userWithTierSchema>;

// Agent status enum for management
export const agentStatusEnum = pgEnum("agent_status", [
	"active",
	"inactive",
	"suspended",
	"pending_approval",
	"terminated",
]);

// Agent activity tracking
export const agentActivities = pgTable("agent_activities", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),

	// Activity details
	activityType: text("activity_type").notNull(), // 'login', 'transaction_created', 'client_contact', etc.
	description: text("description"),
	metadata: text("metadata"), // JSON string for additional data

	// Context
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	sessionId: text("session_id"),

	timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
	agentIdIdx: index("idx_agent_activities_agent_id").on(table.agentId),
	activityTypeIdx: index("idx_agent_activities_activity_type").on(table.activityType),
	timestampIdx: index("idx_agent_activities_timestamp").on(table.timestamp),
}));

// Agent performance goals
export const agentGoals = pgTable("agent_goals", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),

	// Goal details
	title: text("title").notNull(),
	description: text("description"),
	goalType: text("goal_type").notNull(), // 'sales', 'commission', 'clients', 'custom'

	// Target and progress - USING TEXT INSTEAD OF DECIMAL TO FIX IMPORT ISSUE
	targetValue: text("target_value").notNull(),
	currentValue: text("current_value").default("0").notNull(),
	unit: text("unit").notNull(), // 'transactions', 'dollars', 'percentage', etc.

	// Timeline
	startDate: timestamp("start_date").notNull(),
	endDate: timestamp("end_date").notNull(),

	// Status
	isActive: boolean("is_active").default(true).notNull(),
	isAchieved: boolean("is_achieved").default(false).notNull(),
	achievedAt: timestamp("achieved_at"),

	// Metadata
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	agentIdIdx: index("idx_agent_goals_agent_id").on(table.agentId),
	goalTypeIdx: index("idx_agent_goals_goal_type").on(table.goalType),
	isActiveIdx: index("idx_agent_goals_is_active").on(table.isActive),
	endDateIdx: index("idx_agent_goals_end_date").on(table.endDate),
}));

// Agent tier configuration with commission splits, leadership bonus, and requirements
// New Leadership Plan commission structure:
// - Advisor: 70% commission, no leadership bonus (entry level)
// - Sales Leader: 80% commission + 7% leadership bonus from downline
// - Team Leader: 83% commission + 5% leadership bonus from downline
// - Group Leader: 85% commission + 8% leadership bonus from downline
// - Supreme Leader: 85% commission + 6% leadership bonus from downline
export const AGENT_TIER_CONFIG = {
	advisor: {
		commissionSplit: 70,
		leadershipBonusRate: 0, // No leadership bonus for entry level
		requirements: {
			monthlySales: 0,
			teamMembers: 0,
		},
		displayName: "Advisor",
		description: "Entry level agent",
	},
	sales_leader: {
		commissionSplit: 80,
		leadershipBonusRate: 7, // 7% leadership bonus from company's share
		requirements: {
			monthlySales: 2,
			teamMembers: 0,
		},
		displayName: "Sales Leader",
		description: "2+ monthly sales",
	},
	team_leader: {
		commissionSplit: 83,
		leadershipBonusRate: 5, // 5% leadership bonus from company's share
		requirements: {
			monthlySales: 3,
			teamMembers: 3,
		},
		displayName: "Team Leader",
		description: "3+ sales, 3+ team members",
	},
	group_leader: {
		commissionSplit: 85,
		leadershipBonusRate: 8, // 8% leadership bonus from company's share
		requirements: {
			monthlySales: 5,
			teamMembers: 5,
		},
		displayName: "Group Leader",
		description: "5+ sales, 5+ team members",
	},
	supreme_leader: {
		commissionSplit: 85,
		leadershipBonusRate: 6, // 6% leadership bonus from company's share
		requirements: {
			monthlySales: 8,
			teamMembers: 10,
		},
		displayName: "Supreme Leader",
		description: "8+ sales, 10+ team members",
	},
} as const;
