import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";

type Party = {
	name?: string;
	icNo?: string;
	email?: string;
	phone?: string;
	address?: string;
};

function blank(v: unknown): string {
	if (v === null || v === undefined) return "N/A";
	const s = String(v).trim();
	return s === "" ? "N/A" : s;
}

function formatMoney(v: unknown): string {
	const n = typeof v === "number" ? v : Number(v);
	if (!Number.isFinite(n)) return blank(v);
	return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v: unknown): string {
	if (!v) return "N/A";
	const d = v instanceof Date ? v : new Date(String(v));
	if (Number.isNaN(d.getTime())) return "N/A";
	return d.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function fillTemplate(html: string, vars: Record<string, string>): string {
	let out = html;
	for (const [key, value] of Object.entries(vars)) {
		out = out.replaceAll(`{{${key}}}`, value);
	}
	return out;
}

function loadTemplate(): string {
	const path = join(
		process.cwd(),
		"src",
		"templates",
		"secondary-transaction-form.html",
	);
	try {
		return readFileSync(path, "utf8");
	} catch {
		// Fallback when running from monorepo root / dist
		const alt = join(
			process.cwd(),
			"apps",
			"server",
			"src",
			"templates",
			"secondary-transaction-form.html",
		);
		return readFileSync(alt, "utf8");
	}
}

/**
 * Build printable Devots letterhead HTML for secondary (subsale / subrent) deals.
 * Client can Print → Save as PDF until an official template PDF pipeline is added.
 */
export async function generateSecondaryTransactionFormHtml(
	transactionId: string,
): Promise<{ html: string; fileName: string; caseNo: string | null }> {
	const [row] = await db
		.select({
			tx: transactions,
			agentName: user.name,
			agentEmail: user.email,
			agentNick: user.nickName,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.agentId, user.id))
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!row) throw new Error("Transaction not found");

	const tx = row.tx;
	if ((tx.marketType ?? "").toLowerCase() !== "secondary") {
		throw new Error("Letterhead form is only available for secondary market deals");
	}

	const prop = (tx.propertyData ?? {}) as {
		address?: string;
		propertyType?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
		listingTitle?: string;
	};
	const client = (tx.clientData ?? {}) as Party & {
		vendors?: Party[];
		type?: string;
	};
	const vendor = client.vendors?.[0] ?? {};
	const co = (tx.coBrokingData ?? {}) as {
		agentName?: string;
		agents?: Array<{ agentName?: string; commissionSplit?: number }>;
		commissionSplit?: number;
	};

	const isLease =
		tx.transactionType === "lease" || tx.transactionType === "rental";
	const formTitle = isLease
		? "Subrent / Tenancy Transaction Form"
		: "Subsale Transaction Form";

	const partyALabel = isLease ? "Landlord" : "Purchaser / Buyer";
	const partyBLabel = isLease ? "Tenant" : "Vendor / Seller";

	// Secondary sale UI: root client = purchaser; vendors[] = seller.
	// Secondary lease UI: root often landlord; vendors/tenants may vary — use best effort.
	const partyA: Party = client;
	const partyB: Party = vendor;

	const coBrokeAgents =
		co.agents && co.agents.length > 0
			? co.agents
					.map((a) =>
						[a.agentName, a.commissionSplit != null ? `${a.commissionSplit}%` : null]
							.filter(Boolean)
							.join(" "),
					)
					.filter(Boolean)
					.join("; ")
			: blank(co.agentName);

	const agentDisplay =
		(row.agentNick?.trim() || row.agentName?.trim() || "") || "N/A";

	const price =
		prop.spaPrice ??
		prop.nettPrice ??
		prop.price ??
		tx.commissionAmount ??
		null;

	const html = fillTemplate(loadTemplate(), {
		FORM_TITLE: formTitle,
		CASE_NO: blank(tx.caseNo),
		GENERATED_AT: formatDate(new Date()),
		MARKET_TYPE: blank(tx.marketType),
		TRANSACTION_TYPE: blank(tx.transactionType),
		TRANSACTION_DATE: formatDate(tx.transactionDate),
		BOOKING_DATE: formatDate(tx.bookingDate),
		STATUS: blank(tx.status),
		PROJECT_NAME: blank(tx.projectName ?? prop.listingTitle),
		UNIT_NO: blank(tx.unitNo),
		PROPERTY_ADDRESS: blank(prop.address),
		PROPERTY_TYPE: blank(prop.propertyType),
		PRICE: formatMoney(price),
		PARTY_A_LABEL: partyALabel,
		PARTY_A_NAME: blank(partyA.name),
		PARTY_A_IC: blank(partyA.icNo),
		PARTY_A_PHONE: blank(partyA.phone),
		PARTY_A_EMAIL: blank(partyA.email),
		PARTY_A_ADDRESS: blank(partyA.address),
		PARTY_B_LABEL: partyBLabel,
		PARTY_B_NAME: blank(partyB.name),
		PARTY_B_IC: blank(partyB.icNo),
		PARTY_B_PHONE: blank(partyB.phone),
		PARTY_B_EMAIL: blank(partyB.email),
		PARTY_B_ADDRESS: blank(partyB.address),
		AGENT_NAME: blank(agentDisplay),
		AGENT_EMAIL: blank(row.agentEmail),
		CO_BROKING: tx.isCoBroking ? "Yes" : "No",
		CO_BROKE_AGENTS: blank(coBrokeAgents),
	});

	const caseSlug = (tx.caseNo ?? transactionId.slice(0, 8)).replace(
		/[^\w.-]+/g,
		"_",
	);
	return {
		html,
		fileName: `Devots-${isLease ? "Subrent" : "Subsale"}-${caseSlug}.html`,
		caseNo: tx.caseNo,
	};
}
