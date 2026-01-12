import {
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

// Auto-reply trigger type enum
export const triggerTypeEnum = pgEnum("trigger_type", [
	"contains",
	"equals",
	"starts_with",
	"regex",
]);

// User status enum (for message owner)
export const userStatusEnum = pgEnum("user_status", ["tenant", "owner"]);

// Auto-reply rules table
export const autoReplyRules = pgTable(
	"auto_reply_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Trigger configuration stored as JSONB
		trigger: jsonb("trigger").$type<{
			type: "contains" | "equals" | "starts_with" | "regex";
			keywords: string[];
		}>().notNull(),
		response: text("response").notNull(),
		messageOwner: text("message_owner").notNull(), // Agent/user name who created this rule
		status: userStatusEnum("status").notNull(), // User status: tenant or owner
		logCount: integer("log_count").default(0).notNull(), // Number of times this rule was executed
		// Track which agent created this rule
		agentId: text("agent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		agentIdIdx: index("idx_auto_reply_rules_agent_id").on(table.agentId),
		statusIdx: index("idx_auto_reply_rules_status").on(table.status),
		messageOwnerIdx: index("idx_auto_reply_rules_message_owner").on(
			table.messageOwner,
		),
	}),
);

// Auto-reply execution logs table (for tracking when rules are triggered)
export const autoReplyLogs = pgTable(
	"auto_reply_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ruleId: uuid("rule_id")
			.notNull()
			.references(() => autoReplyRules.id, { onDelete: "cascade" }),
		conversationId: text("conversation_id"), // WhatsApp conversation ID (when implemented)
		messageId: text("message_id"), // WhatsApp message ID (when implemented)
		triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
		executedAt: timestamp("executed_at"),
		// Store the matched keyword and original message for debugging
		matchedKeyword: text("matched_keyword"),
		originalMessage: text("original_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		ruleIdIdx: index("idx_auto_reply_logs_rule_id").on(table.ruleId),
		triggeredAtIdx: index("idx_auto_reply_logs_triggered_at").on(
			table.triggeredAt,
		),
	}),
);

// Zod schemas for validation
export const triggerTypeSchema = z.enum([
	"contains",
	"equals",
	"starts_with",
	"regex",
]);
export const userStatusSchema = z.enum(["tenant", "owner"]);

export const triggerSchema = z.object({
	type: triggerTypeSchema,
	keywords: z.array(z.string().min(1)).min(1, "At least one keyword is required"),
});

export const insertAutoReplyRuleSchema = z.object({
	trigger: triggerSchema,
	response: z.string().min(1, "Response is required"),
	messageOwner: z.string().min(1, "Message owner is required"),
	status: userStatusSchema,
});

export const selectAutoReplyRuleSchema = z.object({
	id: z.string(),
	trigger: triggerSchema,
	response: z.string(),
	messageOwner: z.string(),
	status: userStatusSchema,
	logCount: z.number(),
	agentId: z.string(),
	createdAt: z.string().datetime().or(z.date()),
	updatedAt: z.string().datetime().or(z.date()),
});

export const updateAutoReplyRuleSchema = insertAutoReplyRuleSchema.partial().extend({
	id: z.string(),
});

// TypeScript types
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type InsertAutoReplyRule = z.infer<typeof insertAutoReplyRuleSchema>;
export type SelectAutoReplyRule = z.infer<typeof selectAutoReplyRuleSchema>;
export type UpdateAutoReplyRule = z.infer<typeof updateAutoReplyRuleSchema>;
