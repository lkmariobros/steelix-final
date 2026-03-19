import type { Context } from "hono";
import { Hono } from "hono";
import { db } from "../utils/db";

const app = new Hono();

// ─── Kapso WhatsApp webhook handler ─────────────────────────────────────────

const handleKapsoWebhook = async (c: Context) => {
	try {
		const body = await c.req.json();
		const { handleKapsoWebhook } = await import("../services/kapso-webhook");
		const result = await handleKapsoWebhook(body);

		if (result.success) {
			return c.json({ success: true, message: "Webhook processed" }, 200);
		}
		return c.json(
			{ success: false, error: result.error },
			(result.statusCode || 400) as 200 | 400 | 500,
		);
	} catch (error: unknown) {
		const msg =
			error instanceof Error ? error.message : "Webhook processing failed";
		console.error("❌ Kapso webhook error:", error);
		return c.json({ success: false, error: msg }, 500);
	}
};

// Kapso calls different paths, register all variants
app.post("/webhook/kapso", handleKapsoWebhook);
app.post("/webhooks/kapso", handleKapsoWebhook);
app.post("/webhooks/kapso/whatsapp", handleKapsoWebhook);
app.post("/webhook/kapso/whatsapp", handleKapsoWebhook);

// ─── Test: send first WhatsApp message ──────────────────────────────────────

app.post("/test/send-first-message", async (c) => {
	try {
		const { phoneNumber, message } = await c.req.json();

		if (!phoneNumber) {
			return c.json({ error: "phoneNumber is required" }, 400);
		}

		const { getKapsoClient } = await import("../services/kapso");
		const kapsoClient = getKapsoClient();

		if (!kapsoClient) {
			return c.json({ error: "Kapso client not configured" }, 500);
		}

		let formattedPhone = phoneNumber.trim().replace(/^\+\+/, "+");
		if (!formattedPhone.startsWith("+")) {
			formattedPhone = `+${formattedPhone}`;
		}

		const messageText =
			message ||
			"Hello! This is a test message from your WhatsApp Business account.";

		const result = await kapsoClient.sendMessage({
			to: formattedPhone,
			message: messageText,
		});

		if (result.success) {
			return c.json({
				success: true,
				message: "First message sent successfully!",
				messageId: result.messageId,
			});
		}
		return c.json(
			{ success: false, error: result.error || "Failed to send message" },
			500,
		);
	} catch (error: unknown) {
		console.error("❌ Test send message error:", error);
		return c.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to send test message",
			},
			500,
		);
	}
});

// ─── Debug: view WhatsApp conversations ─────────────────────────────────────

app.get("/debug/whatsapp-conversations", async (c) => {
	try {
		const { whatsappConversations, whatsappMessages } = await import(
			"../models/whatsapp"
		);

		const conversations = await db
			.select()
			.from(whatsappConversations)
			.limit(20);
		const messages = await db.select().from(whatsappMessages).limit(20);

		return c.json({
			conversationsCount: conversations.length,
			conversations: conversations.map((conv) => ({
				id: conv.id,
				kapsoContactId: conv.kapsoContactId,
				contactName: conv.contactName,
				contactPhone: conv.contactPhone,
				assignedAgentId: conv.assignedAgentId,
				lastMessage: conv.lastMessage,
				unreadCount: conv.unreadCount,
				lastMessageAt: conv.lastMessageAt,
				createdAt: conv.createdAt,
			})),
			messagesCount: messages.length,
			messages: messages.map((msg) => ({
				id: msg.id,
				conversationId: msg.conversationId,
				content: msg.content,
				direction: msg.direction,
				status: msg.status,
				sentAt: msg.sentAt,
			})),
		});
	} catch (error: unknown) {
		return c.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch conversations",
			},
			500,
		);
	}
});

// ─── Debug: test Kapso API connection ───────────────────────────────────────

app.get("/test/kapso-connection", async (c) => {
	try {
		const { getKapsoClient } = await import("../services/kapso");
		const kapsoClient = getKapsoClient();

		if (!kapsoClient) {
			return c.json(
				{
					error: "Kapso client not configured",
					hint: "Check KAPSO_API_KEY in .env",
				},
				500,
			);
		}

		const apiUrl = process.env.KAPSO_API_URL || "https://api.kapso.ai";
		const testEndpoints = [
			`${apiUrl}/meta/whatsapp/v24.0/messages`,
			`${apiUrl}/v1/messages`,
			`${apiUrl}/health`,
		];

		const results = await Promise.all(
			testEndpoints.map(async (endpoint) => {
				try {
					const response = await fetch(endpoint, {
						method: "GET",
						headers: { Authorization: `Bearer ${process.env.KAPSO_API_KEY}` },
					});
					return { endpoint, status: response.status, reachable: true };
				} catch (error: unknown) {
					const e = error as { message?: string; code?: string };
					return {
						endpoint,
						reachable: false,
						error: e?.message,
						code: e?.code,
					};
				}
			}),
		);

		return c.json({
			apiUrl,
			apiKeySet: !!process.env.KAPSO_API_KEY,
			testResults: results,
		});
	} catch (error: unknown) {
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to test connection",
			},
			500,
		);
	}
});

export { app as webhookRoutes };
