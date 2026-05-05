import type { CompleteTransactionData } from "./transaction-schema";

const STORAGE_KEY = "steelix.transaction.create.prefill.v1";

/**
 * Stored before opening “New Transaction”; consumed once when the modal mounts (create mode).
 */
export function stashTransactionPrefillOnce(
	data: Partial<CompleteTransactionData>,
) {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function takeTransactionPrefillOnce(): Partial<CompleteTransactionData> | null {
	if (typeof window === "undefined") return null;
	const raw = sessionStorage.getItem(STORAGE_KEY);
	sessionStorage.removeItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Partial<CompleteTransactionData>;
	} catch {
		return null;
	}
}
