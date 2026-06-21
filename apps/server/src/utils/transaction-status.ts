import { transactions } from "../models/transactions";

/** Canonical transaction lifecycle statuses (client spec). */
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

type TransactionStatusDb = NonNullable<
	typeof transactions.$inferSelect.status
>;

/** Default admin approval queue — transactions awaiting review only. */
export const ADMIN_QUEUE_DB_STATUSES = [
	"submitted",
	"under_review",
	"pending",
] as const satisfies readonly TransactionStatusDb[];

/** Map a canonical filter to DB values (includes legacy aliases). */
export function dbStatusesForCanonicalFilter(
	status: CanonicalTransactionStatus | string,
): TransactionStatusDb[] {
	switch (status) {
		case "pending":
			return ["pending", "submitted", "under_review"];
		case "verified":
			return ["verified", "approved", "commission_released"];
		case "converted":
			return ["converted", "completed"];
		case "cancelled":
			return ["cancelled", "rejected"];
		case "draft":
			return ["draft"];
		case "revoke":
			return ["revoke"];
		default:
			return [status as TransactionStatusDb];
	}
}

/** Legacy DB values still readable until migration completes. */
const LEGACY_STATUS_MAP: Record<string, CanonicalTransactionStatus> = {
	submitted: "pending",
	under_review: "pending",
	approved: "verified",
	commission_released: "verified",
	completed: "converted",
	rejected: "cancelled",
	cancel: "cancelled",
};

export function normalizeTransactionStatus(
	status: string | null | undefined,
): CanonicalTransactionStatus | string {
	if (!status) return "draft";
	if (status in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[status]!;
	if (CANONICAL_TRANSACTION_STATUSES.includes(status as CanonicalTransactionStatus)) {
		return status as CanonicalTransactionStatus;
	}
	return status;
}

export function agentCanEditTransaction(
	status: string | null | undefined,
	agentEditAllowed: boolean | null | undefined,
): boolean {
	const normalized = normalizeTransactionStatus(status);
	if (normalized === "draft") return true;
	if (normalized === "pending" && agentEditAllowed === true) return true;
	return false;
}

export function formatTransactionStatusLabel(
	status: string | null | undefined,
): string {
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
			return "Cancel";
		case "revoke":
			return "Revoke";
		default:
			return String(n).replace(/_/g, " ");
	}
}
