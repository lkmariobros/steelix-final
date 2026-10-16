import { askChoice } from "./typesafe";

export const ASSISTANT_INTENTS = [
	"today",
	"upcoming",
	"overdue",
	"urgent",
	"unsupported",
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];
export type AnsweredIntent = Exclude<AssistantIntent, "unsupported">;

export type IntentSource = "button" | "jev" | "keyword";

export interface IntentResult {
	intent: AssistantIntent;
	source: IntentSource;
	jev?: {
		model: string;
		confidence: number;
		latencyMs: number;
	};
}

/** Below this, a Jev answer is treated as "not sure" rather than acted on. */
const MIN_JEV_CONFIDENCE = 0.4;

const JEV_INSTRUCTIONS =
	"A real-estate agent typed this question into their work portal assistant. Which of their own work items are they asking to see?";

const JEV_CRITERIA: Record<AssistantIntent, string> = {
	today: "Work due or happening today",
	upcoming:
		"Tasks, follow-ups, appointments or events coming up over the next few days, this week, or tomorrow",
	overdue: "Tasks that are late, missed, or past their due date",
	urgent: "Tasks that are high priority, urgent, or important",
	unsupported:
		"Anything else: not about the agent's own tasks or schedule (e.g. prices, commissions, writing messages, general chat)",
};

const KEYWORD_RULES: Array<{ intent: AnsweredIntent; pattern: RegExp }> = [
	{ intent: "overdue", pattern: /\b(overdue|late|missed|past due|behind|lewat|tertunggak)\b/i },
	{ intent: "urgent", pattern: /\b(urgent|priority|important|asap|critical|penting|segera)\b/i },
	{ intent: "today", pattern: /\b(today|tonight|this (morning|afternoon|evening)|hari ini)\b/i },
	{
		intent: "upcoming",
		pattern:
			/\b(tomorrow|upcoming|next|coming|this week|few days|schedule|esok|minggu ini)\b/i,
	},
	{ intent: "upcoming", pattern: /\b(tasks?|to ?do|follow[- ]?ups?|appointments?|events?|meetings?|tugas)\b/i },
];

export function classifyByKeyword(text: string): AnsweredIntent | "unsupported" {
	for (const rule of KEYWORD_RULES) {
		if (rule.pattern.test(text)) return rule.intent;
	}
	return "unsupported";
}

/** Jev first; keyword rules when Jev is unavailable or fails. */
export async function classifyQuestion(text: string): Promise<IntentResult> {
	const decision = await askChoice<AssistantIntent>({
		state: text,
		instructions: JEV_INSTRUCTIONS,
		criteria: JEV_CRITERIA,
	});

	if (decision) {
		return {
			intent:
				decision.confidence >= MIN_JEV_CONFIDENCE
					? decision.choice
					: "unsupported",
			source: "jev",
			jev: {
				model: decision.model,
				confidence: decision.confidence,
				latencyMs: decision.latencyMs,
			},
		};
	}

	return { intent: classifyByKeyword(text), source: "keyword" };
}
