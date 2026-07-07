const PENDING_APPROVAL_MESSAGE =
	"Your account is pending admin approval. You will be able to sign in after an administrator approves your registration.";

function parseJsonObject(text: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(text);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// ignore invalid JSON
	}
	return null;
}

function collectErrorPayloads(error: unknown): Record<string, unknown>[] {
	const payloads: Record<string, unknown>[] = [];

	if (typeof error === "string" && error.trim()) {
		payloads.push({ message: error });
		const parsed = parseJsonObject(error);
		if (parsed) payloads.push(parsed);
		return payloads;
	}

	if (!error || typeof error !== "object") {
		return payloads;
	}

	const record = error as Record<string, unknown>;
	payloads.push(record);

	// better-fetch / better-auth ErrorContext: { response, responseText, error }
	if (record.error && typeof record.error === "object") {
		payloads.push(record.error as Record<string, unknown>);
	} else if (typeof record.error === "string" && record.error.trim()) {
		payloads.push({ error: record.error });
	}

	if (typeof record.responseText === "string" && record.responseText.trim()) {
		const parsed = parseJsonObject(record.responseText);
		if (parsed) payloads.push(parsed);
	}

	return payloads;
}

function readMessage(payload: Record<string, unknown>): string | null {
	if (typeof payload.error === "string" && payload.error.trim()) {
		return payload.error;
	}
	if (typeof payload.message === "string" && payload.message.trim()) {
		return payload.message;
	}
	return null;
}

function readStatus(payloads: Record<string, unknown>[]): number | undefined {
	for (const payload of payloads) {
		if (typeof payload.status === "number") return payload.status;
		if (typeof payload.statusCode === "number") return payload.statusCode;
	}
	return undefined;
}

export function getSignInErrorMessage(error: unknown): string {
	const payloads = collectErrorPayloads(error);

	for (const payload of payloads) {
		const message = readMessage(payload);
		if (message) return message;
	}

	const status = readStatus(payloads);
	const combinedText = payloads
		.map((payload) => readMessage(payload))
		.filter((message): message is string => Boolean(message))
		.join(" ")
		.toLowerCase();

	if (
		combinedText.includes("pending") ||
		combinedText.includes("approval") ||
		combinedText.includes("deactivated") ||
		combinedText.includes("suspended") ||
		combinedText.includes("terminated")
	) {
		return (
			payloads.map((payload) => readMessage(payload)).find(Boolean) ??
			PENDING_APPROVAL_MESSAGE
		);
	}

	if (status === 401) {
		return "Invalid email or password.";
	}
	if (status === 403) {
		return PENDING_APPROVAL_MESSAGE;
	}
	if (status === 500) {
		return "Authentication server error. Please try again or contact support.";
	}
	if (status === 502) {
		return "Could not reach the authentication server. Please try again later.";
	}

	return "Sign in failed. Please try again.";
}
