import { askChoice } from "./typesafe";

export const ASSISTANT_INTENTS = [
	"today",
	"upcoming",
	"overdue",
	"urgent",
	"leads_by_stage",
	"cases_pending",
	"cases_by_status",
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
	"A real-estate agent typed this question into their work portal assistant. Which of their own portal records are they asking to see?";

const JEV_CRITERIA: Record<AssistantIntent, string> = {
	today: "Work due or happening today (tasks or calendar)",
	upcoming:
		"Tasks, follow-ups, appointments or events coming up over the next few days, this week, or tomorrow",
	overdue: "Tasks that are late, missed, or past their due date",
	urgent: "Tasks that are high priority, urgent, or important",
	leads_by_stage:
		"Leads, prospects, CRM pipeline, or asking how many / which leads are in each stage (new lead, follow-up, appointment, booking, etc.)",
	cases_pending:
		"Pending projects/cases/transactions that are not converted yet, drafts, waiting for approval, or stalled before conversion",
	cases_by_status:
		"Overview of projects/cases/transactions by status (draft, pending, verified, converted, cancelled, etc.)",
	unsupported:
		"Anything else: commissions/finance payouts, missing documents, writing messages, general chat, or topics outside the agent's tasks, calendar, leads pipeline, and cases",
};

const KEYWORD_RULES: Array<{ intent: AnsweredIntent; pattern: RegExp }> = [
	{
		intent: "leads_by_stage",
		pattern:
			/\b(leads?|prospects?|pipeline|crm|kanban|by stage|lead stages?|new lead|appointment made|booking made|potential lead)\b/i,
	},
	{
		intent: "cases_pending",
		pattern:
			/\b((pending|draft|not converted|haven'?t converted|unconverted).*(case|project|transaction)|((case|project|transaction).*(pending|draft|not converted|haven'?t converted|unconverted))|pending cases?|draft cases?)\b/i,
	},
	{
		intent: "cases_by_status",
		pattern:
			/\b(cases? by status|projects? by status|transactions? by status|my (cases?|projects?|transactions?)|case status|project status)\b/i,
	},
	{ intent: "overdue", pattern: /\b(overdue|late|missed|past due|behind|lewat|tertunggak)\b/i },
	{ intent: "urgent", pattern: /\b(urgent|priority|important|asap|critical|penting|segera)\b/i },
	{ intent: "today", pattern: /\b(today|tonight|this (morning|afternoon|evening)|hari ini)\b/i },
	{
		intent: "upcoming",
		pattern:
			/\b(tomorrow|upcoming|next|coming|this week|few days|schedule|esok|minggu ini)\b/i,
	},
	{
		intent: "upcoming",
		pattern: /\b(tasks?|to ?do|follow[- ]?ups?|appointments?|events?|meetings?|tugas)\b/i,
	},
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
