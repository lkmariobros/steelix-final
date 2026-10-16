/** Malaysia is fixed UTC+8 with no daylight saving. */
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 Malaysia time on the Malaysia calendar day containing `at`, shifted by `dayOffset` days. */
export function startOfMalaysiaDay(at: Date, dayOffset = 0): Date {
	const local = at.getTime() + MALAYSIA_OFFSET_MS;
	const localMidnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
	return new Date(localMidnight - MALAYSIA_OFFSET_MS + dayOffset * DAY_MS);
}

/** Malaysia calendar day as YYYY-MM-DD. */
export function malaysiaDayKey(at: Date): string {
	return new Date(at.getTime() + MALAYSIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole Malaysia calendar days from `from`'s day to `to`'s day (negative when `to` is earlier). */
export function malaysiaDayDiff(from: Date, to: Date): number {
	return Math.round(
		(startOfMalaysiaDay(to).getTime() - startOfMalaysiaDay(from).getTime()) /
			DAY_MS,
	);
}

export function formatMalaysiaTime(at: Date): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: MALAYSIA_TIME_ZONE,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(at);
}

/** e.g. "Sat, 17 Oct" */
export function formatMalaysiaShortDate(at: Date): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: MALAYSIA_TIME_ZONE,
		weekday: "short",
		day: "numeric",
		month: "short",
	}).format(at);
}
