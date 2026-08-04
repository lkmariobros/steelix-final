const LAST_DRAFT_ID_KEY = "transaction-last-draft-id";

export function rememberTransactionDraftId(id: string) {
	if (typeof window === "undefined" || !id) return;
	try {
		localStorage.setItem(LAST_DRAFT_ID_KEY, id);
	} catch {
		// ignore quota / private mode
	}
}

export function getRememberedTransactionDraftId(): string | null {
	if (typeof window === "undefined") return null;
	try {
		return localStorage.getItem(LAST_DRAFT_ID_KEY);
	} catch {
		return null;
	}
}

export function clearRememberedTransactionDraftId(id?: string) {
	if (typeof window === "undefined") return;
	try {
		const current = localStorage.getItem(LAST_DRAFT_ID_KEY);
		if (!id || current === id) {
			localStorage.removeItem(LAST_DRAFT_ID_KEY);
		}
	} catch {
		// ignore
	}
}
