export function isRentalTransactionType(type?: string | null) {
	return type === "rental" || type === "lease";
}

export const purchasingMethodOptions = [
	{ value: "cash", label: "Cash" },
	{ value: "loan", label: "Loan" },
] as const;

export const sstPayByOptions = [
	{ value: "landlord", label: "Landlord" },
	{ value: "agent", label: "Agent" },
] as const;

export type PurchasingMethod = (typeof purchasingMethodOptions)[number]["value"];
export type SstPayBy = (typeof sstPayByOptions)[number]["value"];

export function formatCashLoan(method?: string | null) {
	if (!method) return "—";
	return method === "cash" ? "Cash" : method === "loan" ? "Loan" : method;
}

export function formatSstPayBy(value?: string | null) {
	if (!value) return "—";
	if (value === "landlord") return "Landlord";
	if (value === "agent") return "Agent";
	if (value === "client") return "Client";
	return value;
}

export function formatPaymentMethodField(
	transactionType: string | null | undefined,
	propertyData?: {
		purchasingMethod?: string | null;
		sstPayBy?: string | null;
	} | null,
) {
	if (isRentalTransactionType(transactionType)) {
		return formatSstPayBy(propertyData?.sstPayBy);
	}
	return formatCashLoan(propertyData?.purchasingMethod);
}

export function paymentMethodColumnLabel(
	transactionType?: string | null,
	segment?: "new-project" | "subsale" | "rental",
) {
	if (segment === "rental" || isRentalTransactionType(transactionType)) {
		return "SST Pay By";
	}
	return "Cash/Loan";
}
