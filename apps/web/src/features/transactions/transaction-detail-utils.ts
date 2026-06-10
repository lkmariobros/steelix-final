export function formatRm(amount: string | number | null | undefined) {
	if (amount === null || amount === undefined || amount === "") return "—";
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (!Number.isFinite(num)) return "—";
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(num);
}

export function formatTransactionDate(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	try {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		if (Number.isNaN(dateObj.getTime())) return "—";
		return new Intl.DateTimeFormat("en-MY", {
			year: "numeric",
			month: "short",
			day: "numeric",
		}).format(dateObj);
	} catch {
		return "—";
	}
}

export function formatTransactionDateTime(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	try {
		const dateObj = typeof date === "string" ? new Date(date) : date;
		if (Number.isNaN(dateObj.getTime())) return "—";
		return new Intl.DateTimeFormat("en-MY", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(dateObj);
	} catch {
		return "—";
	}
}

export function formatStatusLabel(status: string | null | undefined): string {
	if (!status) return "Draft";
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
