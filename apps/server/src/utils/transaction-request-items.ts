import { z } from "zod";

/** Mirrors apps/web request-items.ts — keep labels in sync. */
export const TRANSACTION_REQUEST_ITEM_VALUES = [
	"add_change_name",
	"cancel_case",
	"case_status_update",
	"converted_case",
	"la_signing_arrangement",
	"spa_signing_arrangement",
	"lo_signing_arrangement",
	"spa_la_lo_signing_arrangement",
	"spa_la_signing_arrangement",
	"downpayment",
	"change_unit",
	"others",
] as const;

export const transactionRequestItemSchema = z.enum(
	TRANSACTION_REQUEST_ITEM_VALUES,
);

export type TransactionRequestItem = z.infer<typeof transactionRequestItemSchema>;
