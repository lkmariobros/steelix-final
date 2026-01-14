import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	whatsappConversations,
	whatsappMessages,
	type InsertWhatsappMessage,
	insertWhatsappMessageSchema,
} from "../db/schema/whatsapp";
import { protectedProcedure, router } from "../lib/trpc";
import { getKapsoClient } from "../lib/kapso";

// List conversations input schema
const listConversationsInput = z.object({
	search: z.string().optional(),
	filter: z.enum(["all", "unread"]).default("all"),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
});

// Get conversation by ID input schema
const getConversationInput = z.object({
	id: z.string().uuid(),
});

// Get messages for a conversation input schema
const getMessagesInput = z.object({
	conversationId: z.string().uuid(),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(50),
});

// Send message input schema
const sendMessageInput = z.object({
	conversationId: z.string().uuid(),
	message: z.string().min(1, "Message cannot be empty"),
});

export const whatsappRouter = router({
	// List all conversations
	list: protectedProcedure
		.input(listConversationsInput)
		.query(async ({ input, ctx }) => {
			try {
				const { search, filter, page, limit } = input;
				const agentId = ctx.session.user.id;

				// Build where conditions
				const conditions = [
					// Only show conversations assigned to this agent or unassigned
					or(
						eq(whatsappConversations.assignedAgentId, agentId),
						eq(whatsappConversations.assignedAgentId, null as any),
					)!,
				];

				// Search filter
				if (search) {
					const searchConditions = or(
						ilike(whatsappConversations.contactName, `%${search}%`),
						ilike(whatsappConversations.contactPhone, `%${search}%`),
						ilike(whatsappConversations.lastMessage, `%${search}%`),
					);
					if (searchConditions) {
						conditions.push(searchConditions);
					}
				}

			// Unread filter
			if (filter === "unread") {
				conditions.push(sql`${whatsappConversations.unreadCount} != '0'`);
			}

				// Get paginated results
				const offset = (page - 1) * limit;
				const conversations = await db
					.select()
					.from(whatsappConversations)
					.where(and(...conditions))
					.orderBy(desc(whatsappConversations.lastMessageAt))
					.limit(limit)
					.offset(offset);

				// Get total count
				const total = conversations.length; // Simplified - in production, use COUNT query

				return {
					conversations: conversations.map((conv) => ({
						id: conv.id,
						name: conv.contactName || conv.contactPhone,
						phone: conv.contactPhone,
						lastMessage: conv.lastMessage || "",
						unreadCount: Number(conv.unreadCount) || 0,
						timestamp: conv.lastMessageAt?.toISOString() || conv.createdAt.toISOString(),
					})),
					pagination: {
						total,
						page,
						limit,
						totalPages: Math.ceil(total / limit),
					},
				};
			} catch (error) {
				console.error("❌ WhatsApp list error:", error);
				throw error;
			}
		}),

	// Get a single conversation with messages
	get: protectedProcedure.input(getConversationInput).query(async ({ input, ctx }) => {
		const { id } = input;
		const agentId = ctx.session.user.id;

		const [conversation] = await db
			.select()
			.from(whatsappConversations)
			.where(
				and(
					eq(whatsappConversations.id, id),
					or(
						eq(whatsappConversations.assignedAgentId, agentId),
						eq(whatsappConversations.assignedAgentId, null as any),
					)!,
				),
			)
			.limit(1);

		if (!conversation) {
			throw new Error("Conversation not found");
		}

		// Get messages for this conversation
		const messages = await db
			.select()
			.from(whatsappMessages)
			.where(eq(whatsappMessages.conversationId, id))
			.orderBy(desc(whatsappMessages.sentAt))
			.limit(100);

		// Mark conversation as read (reset unread count)
		if (Number(conversation.unreadCount) > 0) {
			await db
				.update(whatsappConversations)
				.set({ unreadCount: "0", updatedAt: new Date() })
				.where(eq(whatsappConversations.id, id));
		}

		return {
			id: conversation.id,
			name: conversation.contactName || conversation.contactPhone,
			phone: conversation.contactPhone,
			messages: messages
				.reverse()
				.map((msg) => ({
					id: msg.id,
					text: msg.content,
					timestamp: msg.sentAt.toISOString(),
					sender: msg.direction === "inbound" ? "user" : "agent",
					read: msg.status === "read" || msg.status === "delivered",
				})),
		};
	}),

	// Send a message
	send: protectedProcedure
		.input(sendMessageInput)
		.mutation(async ({ input, ctx }) => {
			try {
				const { conversationId, message } = input;
				const agentId = ctx.session.user.id;

				// Verify conversation exists and is accessible
				const [conversation] = await db
					.select()
					.from(whatsappConversations)
					.where(
						and(
							eq(whatsappConversations.id, conversationId),
							or(
								eq(whatsappConversations.assignedAgentId, agentId),
								eq(whatsappConversations.assignedAgentId, null as any),
							)!,
						),
					)
					.limit(1);

				if (!conversation) {
					throw new Error("Conversation not found");
				}

				// Assign conversation to agent if not already assigned
				if (!conversation.assignedAgentId) {
					await db
						.update(whatsappConversations)
						.set({ assignedAgentId: agentId, updatedAt: new Date() })
						.where(eq(whatsappConversations.id, conversationId));
				}

				// Send message via Kapso
				const kapsoClient = getKapsoClient();
				if (!kapsoClient) {
					throw new Error("Kapso client not configured");
				}

				const sendResult = await kapsoClient.sendMessage({
					to: conversation.contactPhone,
					message,
					contactId: conversation.kapsoContactId,
				});

				if (!sendResult.success) {
					throw new Error(sendResult.error || "Failed to send message");
				}

			// Save message to database
			const newMessage = {
				kapsoMessageId: sendResult.messageId,
				conversationId,
				content: message,
				direction: "outbound" as const,
				status: "sent" as const,
				agentId,
				isAutoReply: false,
				sentAt: new Date(),
			};

			const [savedMessage] = await db
				.insert(whatsappMessages)
				.values(newMessage)
				.returning();

				// Update conversation
				await db
					.update(whatsappConversations)
					.set({
						lastMessage: message,
						lastMessageAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(whatsappConversations.id, conversationId));

				return {
					success: true,
					message: {
						id: savedMessage.id,
						text: savedMessage.content,
						timestamp: savedMessage.sentAt.toISOString(),
						sender: "agent" as const,
						read: false,
					},
				};
			} catch (error: any) {
				console.error("❌ WhatsApp send error:", error);
				throw error;
			}
		}),
});
