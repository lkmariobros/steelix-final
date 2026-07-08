/** Date as DD/MM/YYYY with leading zeros (e.g. 08/07/2026). */
export function formatDateDMY(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	const dateObj = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(dateObj.getTime())) return "—";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(dateObj);
}

/** Value for `<input type="date" />` (YYYY-MM-DD). */
export function toDateInputValue(
	date: Date | string | null | undefined,
): string {
	if (!date) return "";
	const dateObj = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(dateObj.getTime())) return "";
	const y = dateObj.getFullYear();
	const m = String(dateObj.getMonth() + 1).padStart(2, "0");
	const d = String(dateObj.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function parseDateInputValue(value: string): Date | undefined {
	if (!value.trim()) return undefined;
	const d = new Date(`${value}T12:00:00`);
	return Number.isNaN(d.getTime()) ? undefined : d;
}
