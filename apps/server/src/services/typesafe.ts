/**
 * TypeSafe (Jev) System One client.
 *
 * Docs: https://docs.typesafe.ai/api
 * POST https://api.typesafe.ai/v1/systemone
 */

const DEFAULT_API_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";
const DEFAULT_TIMEOUT_MS = 2_500;

export interface ChoiceDecision<T extends string> {
	choice: T;
	confidence: number;
	probabilities: Record<string, number>;
	model: string;
	latencyMs: number;
}

export function isTypeSafeConfigured(): boolean {
	return Boolean(process.env.TYPESAFE_API_KEY?.trim()) && process.env.TYPESAFE_DISABLED !== "true";
}

/**
 * Ask Jev a single Choice question. Returns null on any failure (no key,
 * timeout, HTTP error, unexpected shape) so callers can fall back.
 */
export async function askChoice<T extends string>(params: {
	state: string;
	instructions: string;
	criteria: Record<T, string | null>;
	timeoutMs?: number;
}): Promise<ChoiceDecision<T> | null> {
	if (!isTypeSafeConfigured()) return null;

	const apiUrl = (process.env.TYPESAFE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
	const model = process.env.TYPESAFE_MODEL ?? DEFAULT_MODEL;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const startedAt = Date.now();

	try {
		const res = await fetch(`${apiUrl}/v1/systemone`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				state: params.state,
				questions: {
					decision: {
						type: "choice",
						instructions: params.instructions,
						criteria: params.criteria,
					},
				},
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			console.warn(`⚠️ TypeSafe request failed: HTTP ${res.status}`);
			return null;
		}

		const body = (await res.json()) as {
			model?: string;
			answers?: {
				decision?: {
					type?: string;
					choice?: string;
					confidence?: number;
					probabilities?: Record<string, number>;
				};
			};
		};
		const answer = body.answers?.decision;
		if (
			answer?.type !== "choice" ||
			typeof answer.choice !== "string" ||
			!(answer.choice in params.criteria)
		) {
			console.warn("⚠️ TypeSafe returned an unexpected answer shape");
			return null;
		}

		return {
			choice: answer.choice as T,
			confidence: typeof answer.confidence === "number" ? answer.confidence : 0,
			probabilities: answer.probabilities ?? {},
			model: body.model ?? model,
			latencyMs: Date.now() - startedAt,
		};
	} catch (error) {
		const reason =
			error instanceof Error && error.name === "AbortError"
				? "timeout"
				: error instanceof Error
					? error.message
					: String(error);
		console.warn(`⚠️ TypeSafe request error: ${reason}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}
