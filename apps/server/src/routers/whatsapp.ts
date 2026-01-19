import { and, desc, eq, ilike, or, sql, isNull } from "drizzle-orm";
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

				console.log("🔍 WhatsApp list query - agentId:", agentId);

				// Build where conditions
				const conditions = [
					// Only show conversations assigned to this agent or unassigned
					or(
						eq(whatsappConversations.assignedAgentId, agentId),
						isNull(whatsappConversations.assignedAgentId),
					)!,
				];

				console.log("🔍 WhatsApp list query - conditions:", conditions.length);

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

				console.log("🔍 WhatsApp list query - found conversations:", conversations.length);
				if (conversations.length > 0) {
					console.log("🔍 First conversation:", {
						id: conversations[0].id,
						contactName: conversations[0].contactName,
						contactPhone: conversations[0].contactPhone,
						assignedAgentId: conversations[0].assignedAgentId,
						lastMessage: conversations[0].lastMessage,
					});
				}

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
						isNull(whatsappConversations.assignedAgentId),
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
								isNull(whatsappConversations.assignedAgentId),
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
					console.error("❌ Kapso client not configured - cannot send message");
					throw new Error("Kapso client not configured. Please check KAPSO_API_KEY and KAPSO_PHONE_NUMBER_ID environment variables.");
				}

				// Normalize phone number to E.164 format (required by WhatsApp)
				let phoneNumber = conversation.contactPhone.trim();
				// Remove any double plus signs
				phoneNumber = phoneNumber.replace(/^\+\+/, "+");
				// Ensure it starts with +
				if (!phoneNumber.startsWith("+")) {
					phoneNumber = `+${phoneNumber}`;
				}

				console.log("📤 Attempting to send WhatsApp message:", {
					originalPhone: conversation.contactPhone,
					normalizedPhone: phoneNumber,
					messageLength: message.length,
					conversationId,
				});

				const sendResult = await kapsoClient.sendMessage({
					to: phoneNumber,
					message,
				});

				console.log("📤 Kapso sendMessage result:", {
					success: sendResult.success,
					messageId: sendResult.messageId,
					error: sendResult.error,
					raw: sendResult.raw ? JSON.stringify(sendResult.raw).substring(0, 300) : "none",
				});

				// CRITICAL: Only proceed if message was successfully sent
				if (!sendResult.success) {
					console.error("❌ Failed to send message via Kapso API:", {
						error: sendResult.error,
						raw: sendResult.raw,
						phoneNumber,
					});

					// Handle specific WhatsApp Business API errors with user-friendly messages
					const errorCode = sendResult.raw?.error?.code;
					const errorMessage = sendResult.error || "Failed to send message";

					if (errorCode === 131037 || errorMessage.includes("display name approval")) {
						throw new Error(
							"Your WhatsApp Business account display name needs to be approved by WhatsApp before you can send messages. " +
							"Please complete the display name approval process in your Meta Business Manager. " +
							"Once approved, you'll be able to send messages to customers."
						);
					}

					if (errorCode === 131047 || errorMessage.includes("message template")) {
						throw new Error(
							"This message requires a pre-approved template. " +
							"For messages outside the 24-hour window, please use approved message templates."
						);
					}

					if (errorCode === 131026 || errorMessage.includes("24 hour")) {
						throw new Error(
							"Cannot send message: More than 24 hours have passed since the customer's last message. " +
							"Please use an approved message template to initiate the conversation."
						);
					}

					// Generic error
					throw new Error(errorMessage || "Failed to send message via Kapso API. Message was NOT sent and will NOT be saved.");
				}

				// Warn if no messageId (but don't fail - some APIs might not return it immediately)
				if (!sendResult.messageId) {
					console.warn("⚠️ Message sent but no messageId returned from Kapso. This might indicate an issue:", {
						raw: sendResult.raw,
						phoneNumber,
					});
				}

				console.log("💾 Saving sent message to database:", {
					conversationId,
					messageLength: message.length,
					kapsoMessageId: sendResult.messageId,
				});

				// Save message to database
				const newMessage = {
					kapsoMessageId: sendResult.messageId || undefined,
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

				console.log("✅ Sent message saved successfully:", {
					messageId: savedMessage.id,
					conversationId: savedMessage.conversationId,
				});

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
