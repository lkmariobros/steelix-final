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

export type TransactionRequestItemValue =
	(typeof TRANSACTION_REQUEST_ITEM_VALUES)[number];

export const TRANSACTION_REQUEST_ITEMS: {
	value: TransactionRequestItemValue;
	label: string;
}[] = [
	{ value: "add_change_name", label: "Add/Change Name" },
	{ value: "cancel_case", label: "Cancel Case" },
	{ value: "case_status_update", label: "Case Status Update" },
	{ value: "converted_case", label: "Converted Case" },
	{ value: "la_signing_arrangement", label: "LA Signing Arrangement" },
	{ value: "spa_signing_arrangement", label: "SPA Signing Arrangement" },
	{ value: "lo_signing_arrangement", label: "LO Signing Arrangement" },
	{
		value: "spa_la_lo_signing_arrangement",
		label: "SPA, LA & LO Signing Arrangement",
	},
	{
		value: "spa_la_signing_arrangement",
		label: "SPA & LA Signing Arrangement",
	},
	{ value: "downpayment", label: "Downpayment" },
	{ value: "change_unit", label: "Change Unit" },
	{ value: "others", label: "Others" },
];

const labelByValue = new Map(
	TRANSACTION_REQUEST_ITEMS.map((item) => [item.value, item.label]),
);

export function formatRequestItemLabel(
	value: string | null | undefined,
): string {
	if (!value) return "—";
	return labelByValue.get(value as TransactionRequestItemValue) ?? value;
}
