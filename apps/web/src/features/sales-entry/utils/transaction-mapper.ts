import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/src/routers";
import type { CompleteTransactionData } from "../transaction-schema";

export type TransactionRow = inferRouterOutputs<AppRouter>["transactions"]["getById"];

/**
 * Maps API transaction row to the sales-entry wizard shape.
 */
export function mapTransactionRowToFormData(
	row: TransactionRow,
): Partial<CompleteTransactionData> {
	const isCo = row.isCoBroking ?? false;
	const tt =
		row.transactionType === "rental"
			? ("lease" as const)
			: (row.transactionType as "sale" | "lease");

	const td = new Date(row.transactionDate as string | number | Date);

	const prop = row.propertyData;
	const client = row.clientData;

	return {
		marketType: row.marketType,
		transactionType: tt,
		transactionDate: td,
		propertyData: prop
			? {
					...prop,
					price: typeof prop.price === "number" ? prop.price : Number(prop.price),
				}
			: undefined,
		clientData: client
			? {
					...client,
					email: client.email ?? "",
					source: client.source ?? "",
				}
			: undefined,
		representationType: isCo ? "co_broking" : "direct",
		isCoBroking: isCo,
		coBrokingData: row.coBrokingData ?? undefined,
		commissionType: row.commissionType,
		commissionValue: Number(row.commissionValue),
		commissionAmount: Number(row.commissionAmount),
		documents: row.documents ?? [],
		notes: row.notes ?? "",
	};
}
