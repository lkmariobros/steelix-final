/** Parse calendar dates without UTC shift (YYYY-MM-DD stays that day). */
function toDate(date: Date | string): Date | null {
	if (date instanceof Date) {
		return Number.isNaN(date.getTime()) ? null : date;
	}
	const trimmed = date.trim();
	if (!trimmed) return null;
	const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (isoDay) {
		const y = Number(isoDay[1]);
		const m = Number(isoDay[2]);
		const d = Number(isoDay[3]);
		const local = new Date(y, m - 1, d);
		return Number.isNaN(local.getTime()) ? null : local;
	}
	const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed);
	if (dmy) {
		const local = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
		return Number.isNaN(local.getTime()) ? null : local;
	}
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Date as DD/MM/YYYY with leading zeros (e.g. 26/10/2026). */
export function formatDateDMY(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	const dateObj = toDate(date);
	if (!dateObj) return "—";
	const d = String(dateObj.getDate()).padStart(2, "0");
	const m = String(dateObj.getMonth() + 1).padStart(2, "0");
	return `${d}/${m}/${dateObj.getFullYear()}`;
}

/** Date + time as DD/MM/YYYY, HH:mm (e.g. 08/07/2026, 14:30). */
export function formatDateTimeDMY(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	const dateObj = toDate(date);
	if (!dateObj) return "—";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(dateObj);
}

/** Date + time with seconds as DD/MM/YYYY HH:mm:ss in Malaysia time (e.g. 08/07/2026 14:30:05). */
export function formatDateTimeSecondsDMY(
	date: Date | string | null | undefined,
): string {
	if (!date) return "—";
	const dateObj = toDate(date);
	if (!dateObj) return "—";
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Kuala_Lumpur",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(dateObj);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Value for `<input type="date" />` (YYYY-MM-DD). */
export function toDateInputValue(
	date: Date | string | null | undefined,
): string {
	if (!date) return "";
	const dateObj = toDate(date);
	if (!dateObj) return "";
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
