import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

// Message direction enum
export const messageDirectionEnum = pgEnum("message_direction", [
	"inbound", // From user to agent
	"outbound", // From agent to user
]);

// Message status enum
export const messageStatusEnum = pgEnum("message_status", [
	"sent",
	"delivered",
	"read",
	"failed",
	"pending",
]);

// WhatsApp conversations table
export const whatsappConversations = pgTable(
	"whatsapp_conversations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Kapso conversation/contact ID
		kapsoContactId: text("kapso_contact_id").notNull().unique(),
		// Contact information
		contactName: text("contact_name"),
		contactPhone: text("contact_phone").notNull(),
		// Track which agent is handling this conversation
		assignedAgentId: text("assigned_agent_id").references(() => user.id, {
			onDelete: "set null",
		}),
		// Conversation metadata
		lastMessage: text("last_message"),
		lastMessageAt: timestamp("last_message_at"),
		unreadCount: text("unread_count").default("0").notNull(),
		// Status
		isArchived: boolean("is_archived").default(false).notNull(),
		// Timestamps
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		kapsoContactIdIdx: index("idx_whatsapp_conv_kapso_contact_id").on(
			table.kapsoContactId,
		),
		contactPhoneIdx: index("idx_whatsapp_conv_contact_phone").on(
			table.contactPhone,
		),
		assignedAgentIdIdx: index("idx_whatsapp_conv_assigned_agent_id").on(
			table.assignedAgentId,
		),
	}),
);

// WhatsApp messages table
export const whatsappMessages = pgTable(
	"whatsapp_messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Kapso message ID
		kapsoMessageId: text("kapso_message_id").unique(),
		// Link to conversation
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => whatsappConversations.id, { onDelete: "cascade" }),
		// Message content
		content: text("content").notNull(),
		// Message metadata
		direction: messageDirectionEnum("direction").notNull(),
		status: messageStatusEnum("status").default("pending").notNull(),
		// Track which agent sent/received (for outbound, it's the agent; for inbound, it's null)
		agentId: text("agent_id").references(() => user.id, { onDelete: "set null" }),
		// Auto-reply tracking
		isAutoReply: boolean("is_auto_reply").default(false).notNull(),
		autoReplyRuleId: uuid("auto_reply_rule_id"), // References auto_reply_rules.id
		// Timestamps
		sentAt: timestamp("sent_at").defaultNow().notNull(),
		deliveredAt: timestamp("delivered_at"),
		readAt: timestamp("read_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		conversationIdIdx: index("idx_whatsapp_messages_conversation_id").on(
			table.conversationId,
		),
		kapsoMessageIdIdx: index("idx_whatsapp_messages_kapso_message_id").on(
			table.kapsoMessageId,
		),
		sentAtIdx: index("idx_whatsapp_messages_sent_at").on(table.sentAt),
	}),
);

// Zod schemas for validation
export const messageDirectionSchema = z.enum(["inbound", "outbound"]);
export const messageStatusSchema = z.enum([
	"sent",
	"delivered",
	"read",
	"failed",
	"pending",
]);

export const insertWhatsappConversationSchema = z.object({
	kapsoContactId: z.string().min(1),
	contactName: z.string().optional(),
	contactPhone: z.string().min(1),
	assignedAgentId: z.string().optional(),
	lastMessage: z.string().optional(),
	lastMessageAt: z.string().datetime().or(z.date()).optional(),
	unreadCount: z.string().default("0"),
	isArchived: z.boolean().default(false),
});

export const insertWhatsappMessageSchema = z.object({
	kapsoMessageId: z.string().optional(),
	conversationId: z.string().uuid(),
	content: z.string().min(1),
	direction: messageDirectionSchema,
	status: messageStatusSchema.default("pending"),
	agentId: z.string().optional(),
	isAutoReply: z.boolean().default(false),
	autoReplyRuleId: z.string().uuid().optional(),
	sentAt: z.string().datetime().or(z.date()).optional(),
	deliveredAt: z.string().datetime().or(z.date()).optional(),
	readAt: z.string().datetime().or(z.date()).optional(),
});

// TypeScript types
export type MessageDirection = z.infer<typeof messageDirectionSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type InsertWhatsappConversation = z.infer<
	typeof insertWhatsappConversationSchema
>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
