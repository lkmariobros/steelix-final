import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/src/routers";
import type {
	ClientData,
	CompleteTransactionData,
	PartyPerson,
} from "../transaction-schema";

export type TransactionRow =
	inferRouterOutputs<AppRouter>["transactions"]["getById"];

type RawParty = {
	name?: string;
	icNo?: string;
	email?: string;
	phone?: string;
	address?: string;
	race?: string;
	nationality?: string;
	gender?: string;
	emergencyName?: string;
	emergencyContact?: string;
};

function mapPartyPerson(p: RawParty): PartyPerson {
	return {
		name: p.name ?? "",
		icNo: p.icNo ?? "",
		email: p.email ?? "",
		phone: p.phone ?? "",
		address: p.address ?? "",
		race: p.race ?? "",
		nationality: p.nationality ?? "",
		gender: p.gender ?? "",
		emergencyName: p.emergencyName ?? "",
		emergencyContact: p.emergencyContact ?? "",
	};
}

/**
 * Maps API transaction row to the sales-entry wizard shape.
 */
export function mapTransactionRowToFormData(
	row: TransactionRow,
): Partial<CompleteTransactionData> {
	const isCo =
		row.representationType === "co_broking" || (row.isCoBroking ?? false);
	const tt =
		row.transactionType === "rental"
			? ("lease" as const)
			: (row.transactionType as "sale" | "lease");

	const td = row.transactionDate
		? new Date(row.transactionDate as string | number | Date)
		: undefined;
	const bd = row.bookingDate
		? new Date(row.bookingDate as string | number | Date)
		: td;

	const prop = row.propertyData;
	const client = row.clientData;

	const clientData: ClientData | undefined = client
		? {
				name: client.name ?? "",
				icNo: client.icNo ?? "",
				email: client.email ?? "",
				phone: client.phone ?? "",
				address: client.address ?? "",
				race: client.race ?? "",
				nationality: client.nationality ?? "",
				gender: client.gender ?? "",
				emergencyName: client.emergencyName ?? "",
				emergencyContact: client.emergencyContact ?? "",
				type: client.type,
				source: client.source,
				notes: client.notes,
				additionalPurchasers: client.additionalPurchasers?.map(mapPartyPerson),
				vendors: client.vendors?.map(mapPartyPerson),
			}
		: undefined;

	return {
		marketType: row.marketType ?? "primary",
		transactionType: tt,
		transactionDate: td,
		projectName: row.projectName ?? prop?.listingTitle ?? "",
		unitNo: row.unitNo ?? "",
		blockListingId: row.blockListingId ?? undefined,
		bookingDate: bd,
		propertyData: prop
			? {
					...prop,
					price:
						typeof prop.price === "number" ? prop.price : Number(prop.price),
				}
			: undefined,
		clientData,
		representationType: isCo ? "co_broking" : "direct",
		isCoBroking: isCo,
		coBrokingData: row.coBrokingData ?? undefined,
		commissionType: row.commissionType,
		commissionValue: Number(row.commissionValue),
		commissionAmount: Number(row.commissionAmount),
		documents: row.documents ?? [],
		notes: row.notes ?? "",
		agentId: row.agentId ?? undefined,
	};
}
