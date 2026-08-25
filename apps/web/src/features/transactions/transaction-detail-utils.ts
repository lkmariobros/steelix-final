import { differenceInCalendarDays } from "date-fns";
import { formatDateDMY, formatDateTimeDMY } from "@/lib/date-format";

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
	return formatDateDMY(date);
}

export function formatTransactionDateTime(
	date: Date | string | null | undefined,
): string {
	return formatDateTimeDMY(date);
}

export const CANONICAL_TRANSACTION_STATUSES = [
	"draft",
	"pending",
	"verified",
	"converted",
	"cancelled",
	"revoke",
	"void",
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
	_agentEditAllowed?: boolean | null,
): boolean {
	// Agents may only edit case details while the case is Draft.
	// Document upload / status requests remain available separately when locked.
	return normalizeTransactionStatus(status) === "draft";
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
		case "void":
			return "Void";
		default:
			return n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}
}

/** Tailwind classes for status badges (canonical + legacy-safe). */
export function getStatusBadgeClass(status: string | null | undefined): string {
	const n = normalizeTransactionStatus(status);
	const base =
		"rounded-full border-0 px-2.5 py-0.5 font-medium text-[11px] shadow-none";
	switch (n) {
		case "draft":
			return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200`;
		case "pending":
			return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300`;
		case "verified":
			return `${base} bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300`;
		case "converted":
			return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300`;
		case "cancelled":
			return `${base} bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-300`;
		case "revoke":
			return `${base} bg-orange-100 text-orange-800 dark:bg-orange-900/35 dark:text-orange-300`;
		case "void":
			return `${base} bg-zinc-200 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200`;
		default:
			return `${base} bg-muted text-muted-foreground`;
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
