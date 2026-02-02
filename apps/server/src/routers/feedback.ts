import { z } from "zod";
import { protectedProcedure, router } from "../lib/trpc";

const sendFeedbackInput = z.object({
	subject: z.string().min(1, "Subject is required"),
	message: z.string().min(1, "Message is required"),
});

export const feedbackRouter = router({
	send: protectedProcedure
		.input(sendFeedbackInput)
		.mutation(async ({ ctx, input }) => {
			const token = process.env.TELEGRAM_BOT_TOKEN;
			const chatId = process.env.TELEGRAM_CHAT_ID;

			if (!token || !chatId) {
				throw new Error(
					"Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment.",
				);
			}

			const userName = ctx.session.user.name ?? "Unknown";
			const userEmail = ctx.session.user.email ?? "";

			const text = [
				"📩 New Feedback",
				"",
				`Subject: ${input.subject}`,
				"",
				`Message:\n${input.message}`,
				"",
				`From: ${userName} (${userEmail})`,
			].join("\n");

			const url = `https://api.telegram.org/bot${token}/sendMessage`;
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`Telegram API error: ${res.status} ${err}`);
			}

			return { success: true };
		}),
});
