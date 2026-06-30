import { differenceInCalendarDays } from "date-fns";

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

export const CANONICAL_TRANSACTION_STATUSES = [
	"draft",
	"pending",
	"verified",
	"converted",
	"cancelled",
	"revoke",
] as const;

export type CanonicalTransactionStatus =
	(typeof CANONICAL_TRANSACTION_STATUSES)[number];

export function normalizeTransactionStatus(
	status: string | null | undefined,
): string {
	if (!status) return "draft";
	const legacy: Record<string, string> = {
		submitted: "pending",
		under_review: "pending",
		approved: "verified",
		commission_released: "verified",
		completed: "converted",
		rejected: "cancelled",
		cancel: "cancelled",
	};
	return legacy[status] ?? status;
}

export function agentCanEditTransaction(
	status: string | null | undefined,
	agentEditAllowed?: boolean | null,
): boolean {
	const n = normalizeTransactionStatus(status);
	if (n === "draft") return true;
	if (n === "pending" && agentEditAllowed === true) return true;
	return false;
}

export function formatStatusLabel(status: string | null | undefined): string {
	const n = normalizeTransactionStatus(status);
	switch (n) {
		case "draft":
			return "Draft";
		case "pending":
			return "Pending";
		case "verified":
			return "Verified";
		case "converted":
			return "Converted";
		case "cancelled":
			return "Cancelled";
		case "revoke":
			return "Revoke";
		default:
			return n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}
}

/** Tailwind classes for status badges (canonical + legacy-safe). */
export function getStatusBadgeClass(status: string | null | undefined): string {
	const n = normalizeTransactionStatus(status);
	switch (n) {
		case "draft":
			return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
		case "pending":
			return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
		case "verified":
			return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
		case "converted":
			return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
		case "cancelled":
			return "bg-red-500/15 text-red-800 dark:text-red-300";
		case "revoke":
			return "bg-orange-500/15 text-orange-800 dark:text-orange-300";
		default:
			return "bg-muted text-muted-foreground";
	}
}

/** Days from booking/offer date; stops at converted date when status is converted. */
export function formatTransactionAging(
	bookingDate: Date | string | null | undefined,
	status: string | null | undefined,
	convertedAt?: Date | string | null,
	reviewedAt?: Date | string | null,
): string {
	if (!bookingDate) return "—";
	const start =
		typeof bookingDate === "string" ? new Date(bookingDate) : bookingDate;
	if (Number.isNaN(start.getTime())) return "—";

	let end = new Date();
	if (normalizeTransactionStatus(status) === "converted") {
		const anchor = convertedAt ?? reviewedAt;
		if (anchor) {
			end = typeof anchor === "string" ? new Date(anchor) : anchor;
		}
	}

	const days = differenceInCalendarDays(end, start);
	if (days < 0) return "0d";
	return `${days}d`;
}
