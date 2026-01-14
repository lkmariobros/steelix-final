/**
 * Kapso Webhook Handler
 * 
 * Handles incoming webhook events from Kapso (messages, status updates, etc.)
 */

import { db } from "../db";
import {
	whatsappConversations,
	whatsappMessages,
	type InsertWhatsappConversation,
	type InsertWhatsappMessage,
} from "../db/schema/whatsapp";
import { eq, and } from "drizzle-orm";
import { processAutoReply } from "./auto-reply-engine";
import { autoReplyLogs } from "../db/schema/auto-reply";

interface KapsoWebhookPayload {
	event: string; // "message", "status", etc.
	data: {
		message_id?: string;
		contact_id?: string;
		contact_name?: string;
		contact_phone?: string;
		message?: string;
		status?: string;
		timestamp?: string;
		[key: string]: any;
	};
}

interface WebhookResult {
	success: boolean;
	error?: string;
	statusCode?: number;
}

/**
 * Handle incoming message from Kapso
 */
async function handleIncomingMessage(data: KapsoWebhookPayload["data"]) {
	const {
		message_id: kapsoMessageId,
		contact_id: kapsoContactId,
		contact_name: contactName,
		contact_phone: contactPhone,
		message: content,
		timestamp,
	} = data;

	if (!kapsoContactId || !contactPhone || !content) {
		throw new Error("Missing required fields: contact_id, contact_phone, or message");
	}

	// Find or create conversation
	let [conversation] = await db
		.select()
		.from(whatsappConversations)
		.where(eq(whatsappConversations.kapsoContactId, kapsoContactId))
		.limit(1);

	if (!conversation) {
		// Create new conversation
		const newConversation: InsertWhatsappConversation = {
			kapsoContactId,
			contactName: contactName || null,
			contactPhone,
			lastMessage: content,
			lastMessageAt: timestamp ? new Date(timestamp) : new Date(),
			unreadCount: "1",
		};

		[conversation] = await db
			.insert(whatsappConversations)
			.values(newConversation)
			.returning();
	} else {
		// Update existing conversation
		await db
			.update(whatsappConversations)
			.set({
				lastMessage: content,
				lastMessageAt: timestamp ? new Date(timestamp) : new Date(),
				unreadCount: String(Number(conversation.unreadCount) + 1),
				updatedAt: new Date(),
			})
			.where(eq(whatsappConversations.id, conversation.id));
	}

	// Save incoming message
	const newMessage: InsertWhatsappMessage = {
		kapsoMessageId: kapsoMessageId || undefined,
		conversationId: conversation.id,
		content,
		direction: "inbound",
		status: "delivered",
		sentAt: timestamp ? new Date(timestamp) : new Date(),
	};

	const [savedMessage] = await db
		.insert(whatsappMessages)
		.values(newMessage)
		.returning();

	// Process auto-reply rules
	const autoReplyResult = await processAutoReply({
		content,
		conversationId: conversation.id,
		contactPhone,
		agentId: conversation.assignedAgentId || undefined,
	});

	if (autoReplyResult.matched && autoReplyResult.ruleId) {
		// Log the auto-reply execution
		await db.insert(autoReplyLogs).values({
			ruleId: autoReplyResult.ruleId,
			conversationId: conversation.id,
			messageId: savedMessage.id,
			matchedKeyword: content, // Store the matched content
			originalMessage: content,
			triggeredAt: new Date(),
			executedAt: new Date(),
		});

		// Save the auto-reply message as outbound
		if (autoReplyResult.response) {
			await db.insert(whatsappMessages).values({
				conversationId: conversation.id,
				content: autoReplyResult.response,
				direction: "outbound",
				status: "sent",
				isAutoReply: true,
				autoReplyRuleId: autoReplyResult.ruleId,
				sentAt: new Date(),
			});

			// Update conversation with auto-reply
			await db
				.update(whatsappConversations)
				.set({
					lastMessage: autoReplyResult.response,
					lastMessageAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(whatsappConversations.id, conversation.id));
		}
	}

	return { success: true, conversationId: conversation.id, messageId: savedMessage.id };
}

/**
 * Handle message status update from Kapso
 */
async function handleMessageStatus(data: KapsoWebhookPayload["data"]) {
	const { message_id: kapsoMessageId, status } = data;

	if (!kapsoMessageId || !status) {
		throw new Error("Missing required fields: message_id or status");
	}

	// Find message by Kapso message ID
	const [message] = await db
		.select()
		.from(whatsappMessages)
		.where(eq(whatsappMessages.kapsoMessageId, kapsoMessageId))
		.limit(1);

	if (!message) {
		console.warn(`⚠️ Message not found for Kapso ID: ${kapsoMessageId}`);
		return { success: false, error: "Message not found" };
	}

	// Update message status
	const statusMap: Record<string, "sent" | "delivered" | "read" | "failed"> = {
		sent: "sent",
		delivered: "delivered",
		read: "read",
		failed: "failed",
	};

	const newStatus = statusMap[status.toLowerCase()] || "sent";

	await db
		.update(whatsappMessages)
		.set({
			status: newStatus,
			deliveredAt: newStatus === "delivered" ? new Date() : message.deliveredAt,
			readAt: newStatus === "read" ? new Date() : message.readAt,
		})
		.where(eq(whatsappMessages.id, message.id));

	return { success: true };
}

/**
 * Main webhook handler
 */
export async function handleKapsoWebhook(
	payload: KapsoWebhookPayload,
): Promise<WebhookResult> {
	try {
		const { event, data } = payload;

		console.log(`📨 Processing Kapso webhook event: ${event}`);

		switch (event) {
			case "message":
			case "incoming_message":
				await handleIncomingMessage(data);
				return { success: true, statusCode: 200 };

			case "status":
			case "message_status":
				await handleMessageStatus(data);
				return { success: true, statusCode: 200 };

			default:
				console.warn(`⚠️ Unknown webhook event: ${event}`);
				return {
					success: false,
					error: `Unknown event type: ${event}`,
					statusCode: 400,
				};
		}
	} catch (error: any) {
		console.error("❌ Webhook handler error:", error);
		return {
			success: false,
			error: error.message || "Webhook processing failed",
			statusCode: 500,
		};
	}
}
