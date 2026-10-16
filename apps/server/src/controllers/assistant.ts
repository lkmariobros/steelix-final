import { z } from "zod";
import { buildAssistantAnswer } from "../services/assistant";
import { classifyQuestion } from "../services/assistant-intent";
import { isTypeSafeConfigured } from "../services/typesafe";
import { protectedProcedure, router } from "../utils/trpc";

const askInput = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("button"),
		intent: z.enum(["today", "upcoming", "overdue", "urgent"]),
	}),
	z.object({
		mode: z.literal("text"),
		text: z.string().trim().min(1).max(300),
	}),
]);

export const assistantRouter = router({
	/** Read-only: answers only from the signed-in user's permitted tasks and calendar events. */
	ask: protectedProcedure.input(askInput).mutation(async ({ input, ctx }) => {
		const startedAt = Date.now();
		const intentResult =
			input.mode === "button"
				? { intent: input.intent, source: "button" as const }
				: await classifyQuestion(input.text);

		const answer = await buildAssistantAnswer(ctx.session.user.id, intentResult);

		console.log("🤖 assistant.ask", {
			userId: ctx.session.user.id,
			intent: answer.intent,
			source: answer.source,
			jevLatencyMs: answer.jev?.latencyMs,
			totalCount: answer.totalCount,
			ms: Date.now() - startedAt,
		});

		return answer;
	}),

	status: protectedProcedure.query(() => ({
		jevAvailable: isTypeSafeConfigured(),
	})),
});
