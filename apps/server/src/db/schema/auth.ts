import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
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
	companyCommissionSplit: integer("company_commission_split").default(60), // Percentage (60 = 60%)
	tierEffectiveDate: timestamp("tier_effective_date").defaultNow(),
	tierPromotedBy: text("tier_promoted_by"), // Self-reference for who promoted - will add FK constraint separately
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

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
	createdAt: z.date(),
	updatedAt: z.date(),
});

// TypeScript types
export type AgentTier = z.infer<typeof agentTierSchema>;
export type AgentTierHistory = z.infer<typeof agentTierHistorySchema>;
export type CommissionAuditLog = z.infer<typeof commissionAuditLogSchema>;
export type UserWithTier = z.infer<typeof userWithTierSchema>;

// Agent tier configuration with commission splits and requirements
export const AGENT_TIER_CONFIG = {
	advisor: {
		commissionSplit: 60,
		requirements: {
			monthlySales: 0,
			teamMembers: 0,
		},
		displayName: "Advisor",
		description: "Entry level agent",
	},
	sales_leader: {
		commissionSplit: 70,
		requirements: {
			monthlySales: 2,
			teamMembers: 0,
		},
		displayName: "Sales Leader",
		description: "2+ monthly sales",
	},
	team_leader: {
		commissionSplit: 75,
		requirements: {
			monthlySales: 3,
			teamMembers: 3,
		},
		displayName: "Team Leader",
		description: "3+ sales, 3+ team members",
	},
	group_leader: {
		commissionSplit: 80,
		requirements: {
			monthlySales: 5,
			teamMembers: 5,
		},
		displayName: "Group Leader",
		description: "5+ sales, 5+ team members",
	},
	supreme_leader: {
		commissionSplit: 85,
		requirements: {
			monthlySales: 8,
			teamMembers: 10,
		},
		displayName: "Supreme Leader",
		description: "8+ sales, 10+ team members",
	},
} as const;
