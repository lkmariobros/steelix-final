/**
 * Kapso Webhook Handler
 *
 * Handles incoming webhook events from Kapso (messages, status updates, etc.)
 */

import { and, eq, ilike, or, sql } from "drizzle-orm";
import { autoReplyLogs } from "../models/auto-reply";
import { prospects } from "../models/crm";
import {
	type InsertWhatsappConversation,
	type InsertWhatsappMessage,
	whatsappConversations,
	whatsappMessages,
} from "../models/whatsapp";
import { db } from "../utils/db";
import { processAutoReply } from "./auto-reply-engine";

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
		[key: string]: unknown;
	};
}

interface WebhookResult {
	success: boolean;
	error?: string;
	statusCode?: number;
}

/**
 * Handle Kapso batch format message
 * Format: { type: "whatsapp.message.received", batch: true, data: [{ message: {...}, conversation: {...} }] }
 */
// Loose types for Kapso webhook payloads (structure can vary)
interface KapsoMessageLike {
	direction?: string;
	id?: string;
	to?: string;
	from?: string;
	timestamp?: string | number;
	text?: { body?: string };
	content?: string;
	kapso?: {
		direction?: string;
		content?: string;
		status?: string;
		last_message_timestamp?: number | string;
	};
}
interface KapsoConversationLike {
	id?: string;
	phone_number?: string;
	contact_name?: string;
	kapso?: { last_message_timestamp?: number | string };
	unreadCount?: string;
	kapsoContactId?: string;
	contactName?: string;
	prospectId?: string;
}
interface KapsoBatchPayload {
	batch?: boolean;
	data?: Array<{
		message?: KapsoMessageLike;
		conversation?: KapsoConversationLike;
	}>;
}
async function handleKapsoBatchMessage(batchData: KapsoBatchPayload) {
	console.log(
		"📦 Processing Kapso batch message with",
		batchData.data?.length || 0,
		"items",
	);

	if (!Array.isArray(batchData.data)) {
		throw new Error("Batch data must be an array");
	}

	// Process each message in the batch
	const results = [];
	for (const item of batchData.data) {
		try {
			// Extract from nested structure
			const messageObj: KapsoMessageLike = item.message || {};
			const conversationObj: KapsoConversationLike = item.conversation || {};

			// Check message direction
			const messageDirection =
				messageObj.kapso?.direction || messageObj.direction || "inbound";
			const isOutbound = messageDirection === "outbound";

			const kapsoMessageId = messageObj.id;
			// For outbound messages, phone is in message.to or conversation.phone_number
			// For inbound messages, phone is in message.from or conversation.phone_number
			const contactPhone: string =
				(isOutbound
					? messageObj.to || conversationObj.phone_number
					: messageObj.from || conversationObj.phone_number) ?? "";
			const kapsoContactId = conversationObj.id as string | undefined;
			const contactName = conversationObj.contact_name as string | undefined;
			const content = (messageObj.text?.body ?? messageObj.kapso?.content) as
				| string
				| undefined;

			// Convert Unix timestamp to Date
			let timestamp: Date;
			if (messageObj.timestamp != null) {
				// Unix timestamp (seconds)
				const ts = messageObj.timestamp;
				timestamp =
					typeof ts === "number"
						? new Date(ts * 1000)
						: new Date(Number(ts) * 1000);
			} else if (conversationObj.kapso?.last_message_timestamp != null) {
				const ts = conversationObj.kapso.last_message_timestamp;
				timestamp = typeof ts === "number" ? new Date(ts) : new Date(ts);
			} else {
				timestamp = new Date();
			}

			console.log("🔍 Extracted from batch item:", {
				kapsoMessageId,
				kapsoContactId,
				contactName,
				contactPhone,
				content: content?.substring(0, 50),
				timestamp,
			});

			// Normalize phone number
			let normalizedPhone =
				(typeof contactPhone === "string" ? contactPhone : "").trim() || "";
			if (normalizedPhone && !normalizedPhone.startsWith("+")) {
				normalizedPhone = `+${normalizedPhone}`;
			}

			if (!content) {
				console.warn("⚠️ Skipping batch item - missing message content");
				continue;
			}

			if (!normalizedPhone && !kapsoContactId) {
				console.warn("⚠️ Skipping batch item - missing phone and contact ID");
				continue;
			}

			const finalContactId = kapsoContactId || normalizedPhone;

			// Find or create conversation
			const whereConditions = [];
			if (finalContactId) {
				whereConditions.push(
					eq(whatsappConversations.kapsoContactId, finalContactId),
				);
			}
			if (normalizedPhone) {
				whereConditions.push(
					eq(whatsappConversations.contactPhone, normalizedPhone),
				);
			}

			console.log("🔍 Looking for existing conversation with:", {
				kapsoContactId: finalContactId,
				phone: normalizedPhone,
				conditionsCount: whereConditions.length,
			});

			const orCondition =
				whereConditions.length > 0 ? or(...whereConditions) : null;
			let [conversation] =
				orCondition !== null
					? await db
							.select()
							.from(whatsappConversations)
							.where(orCondition ?? sql`false`)
							.limit(1)
					: [];

			// Debug: Check if there are any conversations with similar phone numbers (to detect duplicates)
			if (!conversation && normalizedPhone) {
				const allConversations = await db
					.select()
					.from(whatsappConversations)
					.where(
						ilike(
							whatsappConversations.contactPhone,
							`%${normalizedPhone.slice(-9)}%`,
						),
					)
					.limit(5);
				if (allConversations.length > 0) {
					console.warn(
						"⚠️ Found conversations with similar phone numbers but lookup failed:",
						{
							searchingFor: normalizedPhone,
							found: allConversations.map((c) => ({
								id: c.id,
								kapsoContactId: c.kapsoContactId,
								phone: c.contactPhone,
							})),
						},
					);
				}
			}

			if (conversation) {
				console.log("✅ Found existing conversation:", {
					id: conversation.id,
					kapsoContactId: conversation.kapsoContactId,
					phone: conversation.contactPhone,
					assignedAgentId: conversation.assignedAgentId,
				});

				// Update existing conversation
				const updateData: {
					lastMessage: string;
					lastMessageAt: Date;
					updatedAt: Date;
					unreadCount?: string;
					kapsoContactId?: string;
					contactName?: string;
					prospectId?: string;
				} = {
					lastMessage: content,
					lastMessageAt: timestamp,
					updatedAt: new Date(),
				};

				// Only increment unread count for inbound messages (not outbound)
				if (!isOutbound) {
					updateData.unreadCount = String(
						Number(conversation.unreadCount || "0") + 1,
					);
				}

				if (finalContactId && conversation.kapsoContactId !== finalContactId) {
					updateData.kapsoContactId = finalContactId;
				}
				if (contactName && !conversation.contactName) {
					updateData.contactName = contactName;
				}

				// If conversation is not linked to a prospect, try to link it now
				if (!conversation.prospectId && normalizedPhone) {
					const [matchingProspect] = await db
						.select()
						.from(prospects)
						.where(eq(prospects.phone, normalizedPhone))
						.limit(1);
					if (matchingProspect) {
						updateData.prospectId = matchingProspect.id;
					}
				}

				await db
					.update(whatsappConversations)
					.set(updateData)
					.where(eq(whatsappConversations.id, conversation.id));
			} else {
				// Try to find a prospect by phone number to link the conversation
				const [matchingProspect] = await db
					.select()
					.from(prospects)
					.where(eq(prospects.phone, normalizedPhone))
					.limit(1);

				console.log("📝 Creating new conversation from batch:", {
					finalContactId,
					normalizedPhone,
					contactName,
				});
				// Ensure timestamp is a Date object
				const lastMessageAtDate =
					timestamp instanceof Date ? timestamp : new Date(timestamp);
				[conversation] = await db
					.insert(whatsappConversations)
					.values({
						kapsoContactId: finalContactId,
						contactPhone: normalizedPhone || finalContactId,
						contactName:
							typeof contactName === "string" ? contactName : undefined,
						assignedAgentId: undefined,
						lastMessage: typeof content === "string" ? content : "",
						lastMessageAt: lastMessageAtDate,
						unreadCount: "1",
						isArchived: false,
						prospectId: matchingProspect?.id ?? undefined,
					})
					.returning();

				console.log("✅ Created new conversation:", {
					id: conversation.id,
					kapsoContactId: conversation.kapsoContactId,
					phone: conversation.contactPhone,
					assignedAgentId: conversation.assignedAgentId,
				});
			}

			// Save message
			console.log("💾 Saving message to database:", {
				conversationId: conversation.id,
				contentLength: content?.length,
				kapsoMessageId,
				timestamp,
			});

			// Ensure timestamp is a Date object
			const sentAtDate =
				timestamp instanceof Date ? timestamp : new Date(timestamp);
			// Determine message direction and status
			const msgDirection = isOutbound ? "outbound" : "inbound";
			const messageStatus = isOutbound
				? messageObj.kapso?.status === "sent"
					? "sent"
					: "delivered"
				: "delivered";

			const [savedMessage] = await db
				.insert(whatsappMessages)
				.values({
					kapsoMessageId: kapsoMessageId || undefined,
					conversationId: conversation.id,
					content,
					direction: msgDirection,
					status: messageStatus,
					isAutoReply: false,
					sentAt: sentAtDate,
				})
				.returning();

			console.log("✅ Message saved successfully:", {
				messageId: savedMessage.id,
				conversationId: savedMessage.conversationId,
			});

			// Process auto-reply
			const autoReplyResult = await processAutoReply({
				content,
				conversationId: conversation.id,
				contactPhone: normalizedPhone,
				agentId: conversation.assignedAgentId || undefined,
			});

			if (autoReplyResult.matched && autoReplyResult.ruleId) {
				await db.insert(autoReplyLogs).values({
					ruleId: autoReplyResult.ruleId,
					conversationId: conversation.id,
					messageId: savedMessage.id,
					matchedKeyword: content,
					originalMessage: content,
					triggeredAt: new Date(),
					executedAt: new Date(),
				});

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

			results.push({
				success: true,
				conversationId: conversation.id,
				messageId: savedMessage.id,
			});
		} catch (error: unknown) {
			console.error("❌ Error processing batch item:", error);
			results.push({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}

/** Data shape for handleIncomingMessage (Kapso payloads vary) */
type IncomingMessageData = Record<string, unknown> & {
	message?: KapsoMessageLike;
	conversation?: KapsoConversationLike;
	profile?: { name?: string };
	timestamp?: string | number;
};

/**
 * Handle incoming message from Kapso
 */
async function handleIncomingMessage(data: IncomingMessageData) {
	console.log(
		"🔍 Processing message, data structure:",
		JSON.stringify(data, null, 2),
	);

	// Handle nested structure (message and conversation objects)
	const messageObj: KapsoMessageLike = data.message || {};
	const conversationObj: KapsoConversationLike = data.conversation || {};

	// Check message direction
	const messageDirection =
		messageObj.kapso?.direction ||
		messageObj.direction ||
		data.direction ||
		"inbound";
	const isOutbound = messageDirection === "outbound";

	console.log(
		`📨 Message direction: ${messageDirection} (${isOutbound ? "outbound - agent sent" : "inbound - customer sent"})`,
	);

	// Handle different Kapso webhook payload formats
	// Try multiple possible field names for each value
	const kapsoMessageId =
		messageObj.id ||
		data.message_id ||
		data.id ||
		data.messageId ||
		data.msg_id;

	// For outbound messages, phone is in conversation.phone_number or message.to
	// For inbound messages, phone is in message.from or conversation.phone_number
	const contactPhone = isOutbound
		? messageObj.to ||
			conversationObj.phone_number ||
			data.contact_phone ||
			data.contactPhone ||
			data.phone
		: messageObj.from ||
			conversationObj.phone_number ||
			data.contact_phone ||
			data.contactPhone ||
			data.phone ||
			data.from ||
			data.sender ||
			data.wa_id;

	const kapsoContactId =
		conversationObj.id ||
		data.contact_id ||
		data.contactId ||
		data.from ||
		data.sender ||
		data.wa_id;
	const contactName: string | undefined =
		(conversationObj.contact_name as string | undefined) ||
		(data.contact_name as string | undefined) ||
		(data.contactName as string | undefined) ||
		(data.name as string | undefined) ||
		(data.from_name as string | undefined) ||
		data.profile?.name;

	// Extract message content
	const content =
		messageObj.text?.body ||
		messageObj.kapso?.content ||
		messageObj.content ||
		data.message ||
		data.text ||
		data.body ||
		data.content ||
		data.message_body ||
		data.message_text;

	// Extract timestamp
	const timestamp = messageObj.timestamp
		? typeof messageObj.timestamp === "string"
			? new Date(Number(messageObj.timestamp) * 1000)
			: new Date(messageObj.timestamp)
		: conversationObj.kapso?.last_message_timestamp
			? new Date(
					typeof conversationObj.kapso.last_message_timestamp === "number"
						? conversationObj.kapso.last_message_timestamp
						: Number(conversationObj.kapso.last_message_timestamp),
				)
			: data.timestamp != null
				? new Date(data.timestamp as string | number)
				: new Date();

	// Helper function to preview content
	const contentPreview =
		typeof content === "string"
			? content.substring(0, 50)
			: typeof content === "object" && content !== null
				? (() => {
						const c = content as {
							body?: string;
							text?: { body?: string } | string;
						};
						const body =
							typeof c?.text === "object" && c?.text && "body" in c.text
								? (c.text as { body?: string }).body
								: c?.text;
						return c?.body ?? body ?? JSON.stringify(content).substring(0, 50);
					})()
				: String(content).substring(0, 50);

	console.log("🔍 Extracted values:", {
		kapsoMessageId,
		kapsoContactId,
		contactName,
		contactPhone,
		contentPreview: `${contentPreview}...`,
		contentType: typeof content,
		timestamp,
	});

	// Normalize phone number (ensure it starts with +)
	const contactPhoneStr =
		typeof contactPhone === "string"
			? contactPhone
			: String(contactPhone ?? "").trim();
	let normalizedPhone = contactPhoneStr || "";
	if (normalizedPhone && !normalizedPhone.startsWith("+")) {
		// Try to add country code if missing (you may need to adjust this based on your region)
		normalizedPhone = `+${normalizedPhone}`;
	}

	// More lenient validation - try to work with what we have
	const contentStr = typeof content === "string" ? content : "";
	if (!contentStr) {
		console.error(
			"❌ Missing message content. Full data:",
			JSON.stringify(data, null, 2),
		);
		throw new Error("Missing required field: message content");
	}

	// If we don't have contact ID, use phone number as fallback
	const finalContactId: string =
		(typeof kapsoContactId === "string"
			? kapsoContactId
			: String(kapsoContactId ?? "")) ||
		normalizedPhone ||
		`phone_${normalizedPhone}`;

	if (!normalizedPhone && !kapsoContactId) {
		console.error(
			"❌ Missing both contact_id and phone. Full data:",
			JSON.stringify(data, null, 2),
		);
		throw new Error("Missing required fields: contact_id or contact_phone");
	}

	// For outbound messages, check if we already have this message in the database
	// (to avoid duplicates when agent sends via our API)
	const kapsoMessageIdStr =
		typeof kapsoMessageId === "string"
			? kapsoMessageId
			: kapsoMessageId != null
				? String(kapsoMessageId)
				: "";
	if (isOutbound && kapsoMessageIdStr) {
		const [existingMessage] = await db
			.select()
			.from(whatsappMessages)
			.where(eq(whatsappMessages.kapsoMessageId, kapsoMessageIdStr))
			.limit(1);

		if (existingMessage) {
			console.log(
				"✅ Outbound message already exists in database, updating status if needed",
			);
			// Update message status if provided
			if (messageObj.kapso?.status) {
				const statusMap: Record<
					string,
					"sent" | "delivered" | "read" | "failed"
				> = {
					sent: "sent",
					delivered: "delivered",
					read: "read",
					failed: "failed",
				};
				const newStatus =
					statusMap[messageObj.kapso.status.toLowerCase()] ||
					existingMessage.status;
				if (newStatus !== existingMessage.status) {
					await db
						.update(whatsappMessages)
						.set({
							status: newStatus,
							deliveredAt:
								newStatus === "delivered"
									? new Date()
									: existingMessage.deliveredAt,
							readAt:
								newStatus === "read" ? new Date() : existingMessage.readAt,
						})
						.where(eq(whatsappMessages.id, existingMessage.id));
				}
			}
			// Update conversation's last message
			if (existingMessage.conversationId) {
				await db
					.update(whatsappConversations)
					.set({
						lastMessage: contentStr,
						lastMessageAt:
							timestamp instanceof Date ? timestamp : new Date(timestamp),
						updatedAt: new Date(),
					})
					.where(eq(whatsappConversations.id, existingMessage.conversationId));
			}
			return {
				success: true,
				conversationId: existingMessage.conversationId,
				messageId: existingMessage.id,
			};
		}
	}

	// Find or create conversation by kapsoContactId OR phone number (in case contact ID changes)
	const whereConditions = [];
	if (finalContactId) {
		whereConditions.push(
			eq(whatsappConversations.kapsoContactId, finalContactId),
		);
	}
	if (normalizedPhone) {
		whereConditions.push(
			eq(whatsappConversations.contactPhone, normalizedPhone),
		);
	}

	const orCondition =
		whereConditions.length > 0 ? or(...whereConditions) : null;
	let [conversation] =
		orCondition !== null
			? await db
					.select()
					.from(whatsappConversations)
					.where(orCondition ?? sql`false`)
					.limit(1)
			: [];

	if (!conversation) {
		// Create new conversation
		console.log("📝 Creating new conversation for:", {
			finalContactId,
			normalizedPhone,
			contactName,
		});
		// Ensure timestamp is a Date object
		const lastMessageAtDate = timestamp
			? timestamp instanceof Date
				? timestamp
				: new Date(timestamp)
			: new Date();
		[conversation] = await db
			.insert(whatsappConversations)
			.values({
				kapsoContactId: finalContactId,
				contactPhone: normalizedPhone || finalContactId,
				contactName: (typeof contactName === "string"
					? contactName
					: undefined) as string | undefined,
				lastMessage: contentStr,
				lastMessageAt: lastMessageAtDate,
				unreadCount: "1",
				isArchived: false,
			})
			.returning();
	} else {
		// Update existing conversation
		// Also update kapsoContactId if it changed
		const updateData: {
			lastMessage: string;
			lastMessageAt: Date;
			updatedAt: Date;
			unreadCount?: string;
			kapsoContactId?: string;
			contactName?: string;
		} = {
			lastMessage: contentStr,
			lastMessageAt:
				timestamp instanceof Date
					? timestamp
					: timestamp
						? new Date(timestamp)
						: new Date(),
			updatedAt: new Date(),
		};

		// Only increment unread count for inbound messages (not outbound)
		if (!isOutbound) {
			updateData.unreadCount = String(
				Number(conversation.unreadCount || "0") + 1,
			);
		}

		// Update contact ID if it's different (Kapso might change it)
		if (finalContactId && conversation.kapsoContactId !== finalContactId) {
			updateData.kapsoContactId = finalContactId;
		}

		// Update contact name if we have new info
		if (contactName && !conversation.contactName) {
			updateData.contactName =
				typeof contactName === "string" ? contactName : undefined;
		}

		await db
			.update(whatsappConversations)
			.set(updateData)
			.where(eq(whatsappConversations.id, conversation.id));
	}

	// Save message (inbound or outbound)
	const sentAtDate =
		timestamp instanceof Date
			? timestamp
			: timestamp
				? new Date(timestamp)
				: new Date();
	const msgDirection = isOutbound ? "outbound" : "inbound";
	const messageStatus = isOutbound
		? messageObj.kapso?.status === "sent"
			? "sent"
			: "delivered"
		: "delivered";

	const [savedMessage] = await db
		.insert(whatsappMessages)
		.values({
			kapsoMessageId:
				typeof kapsoMessageId === "string" ? kapsoMessageId : undefined,
			conversationId: conversation.id,
			content: contentStr,
			direction: msgDirection,
			status: messageStatus,
			isAutoReply: false,
			sentAt: sentAtDate,
		})
		.returning();

	// Process auto-reply rules
	const autoReplyResult = await processAutoReply({
		content: contentStr,
		conversationId: conversation.id,
		contactPhone: normalizedPhone,
		agentId: conversation.assignedAgentId || undefined,
	});

	if (autoReplyResult.matched && autoReplyResult.ruleId) {
		// Log the auto-reply execution
		await db.insert(autoReplyLogs).values({
			ruleId: String(autoReplyResult.ruleId),
			conversationId: conversation.id,
			messageId: savedMessage.id,
			matchedKeyword: contentStr,
			originalMessage: contentStr,
			triggeredAt: new Date(),
			executedAt: new Date(),
		});

		// Save the auto-reply message as outbound
		if (autoReplyResult.response && autoReplyResult.ruleId) {
			await db.insert(whatsappMessages).values({
				conversationId: conversation.id,
				content: autoReplyResult.response,
				direction: "outbound",
				status: "sent",
				isAutoReply: true,
				autoReplyRuleId: String(autoReplyResult.ruleId),
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

	return {
		success: true,
		conversationId: conversation.id,
		messageId: savedMessage.id,
	};
}

/**
 * Handle message status update from Kapso
 */
async function handleMessageStatus(
	data:
		| KapsoWebhookPayload["data"]
		| (Record<string, unknown> & { message_id?: string; status?: string }),
) {
	const kapsoMessageId =
		data.message_id ??
		((data as Record<string, unknown>).message_id as string | undefined);
	const status =
		data.status ??
		((data as Record<string, unknown>).status as string | undefined);

	if (!kapsoMessageId || !status) {
		throw new Error("Missing required fields: message_id or status");
	}

	const kapsoIdStr =
		typeof kapsoMessageId === "string"
			? kapsoMessageId
			: String(kapsoMessageId);
	// Find message by Kapso message ID
	const [message] = await db
		.select()
		.from(whatsappMessages)
		.where(eq(whatsappMessages.kapsoMessageId, kapsoIdStr))
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
 * Handles different Kapso webhook payload formats
 */
export async function handleKapsoWebhook(
	payload: KapsoWebhookPayload | Record<string, unknown>,
): Promise<WebhookResult> {
	try {
		// Handle different webhook payload formats
		let event: string;
		let data: KapsoWebhookPayload["data"] | Record<string, unknown>;

		// Format 1: { event: "message", data: {...} }
		if (payload.event && payload.data) {
			event = String(payload.event);
			data = payload.data as KapsoWebhookPayload["data"];
		}
		// Format 2: Direct message object (Kapso sometimes sends this)
		else if (
			(payload as Record<string, unknown>).message ||
			(payload as Record<string, unknown>).text ||
			(payload as Record<string, unknown>).body ||
			(payload as Record<string, unknown>).content
		) {
			event = "message";
			data = payload as Record<string, unknown>;
		}
		// Format 3: Status update
		else if (
			(payload as Record<string, unknown>).status ||
			(payload as Record<string, unknown>).message_status
		) {
			event = "status";
			data = payload as Record<string, unknown>;
		}
		// Format 4: Try to infer from structure
		else {
			event = String(
				(payload as Record<string, unknown>).type ??
					(payload as Record<string, unknown>).event ??
					"message",
			);
			data = payload as Record<string, unknown>;
		}

		console.log(
			`📨 Processing Kapso webhook event: ${event}`,
			JSON.stringify(data, null, 2),
		);

		// Check if this is a batch format (Kapso sends batch messages)
		if (
			(payload as Record<string, unknown>).batch === true &&
			Array.isArray((payload as Record<string, unknown>).data)
		) {
			console.log("📦 Detected Kapso batch format");
			const results = await handleKapsoBatchMessage(
				payload as KapsoBatchPayload,
			);
			const successCount = results.filter((r) => r.success).length;
			const failCount = results.filter((r) => !r.success).length;
			console.log(
				`✅ Processed batch: ${successCount} succeeded, ${failCount} failed`,
			);
			return { success: true, statusCode: 200 };
		}

		switch (event.toLowerCase()) {
			case "whatsapp.message.received":
			case "message":
			case "incoming_message":
			case "incoming":
			case "text":
				await handleIncomingMessage(data as IncomingMessageData);
				return { success: true, statusCode: 200 };

			case "status":
			case "message_status":
			case "status_update":
				await handleMessageStatus(
					data as Record<string, unknown> & {
						message_id?: string;
						status?: string;
					},
				);
				return { success: true, statusCode: 200 };

			default: {
				// If we can't identify the event but have message data, treat as incoming message
				const d = data as Record<string, unknown>;
				if (d.message || d.text || d.body || d.content) {
					console.log(
						"⚠️ Unknown event type, but has message data. Treating as incoming message.",
					);
					await handleIncomingMessage(data as IncomingMessageData);
					return { success: true, statusCode: 200 };
				}
				console.warn(`⚠️ Unknown webhook event: ${event}`);
				return {
					success: false,
					error: `Unknown event type: ${event}`,
					statusCode: 400,
				};
			}
		}
	} catch (error: unknown) {
		console.error("❌ Webhook handler error:", error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Webhook processing failed",
			statusCode: 500,
		};
	}
}
