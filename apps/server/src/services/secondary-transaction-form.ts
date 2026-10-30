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

export type SecondaryFormType =
	| "letter_of_appointment"
	| "letter_of_offer"
	| "summary";

function blank(v: unknown): string {
	if (v === null || v === undefined) return "N/A";
	const s = String(v).trim();
	return s === "" ? "N/A" : s;
}

function formatMoney(v: unknown): string {
	const n = typeof v === "number" ? v : Number(v);
	if (!Number.isFinite(n)) return blank(v);
	return `RM ${n.toLocaleString("en-MY", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatDate(v: unknown): string {
	if (!v) return "N/A";
	if (typeof v === "string") {
		const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
		if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
	}
	const d = v instanceof Date ? v : new Date(String(v));
	if (Number.isNaN(d.getTime())) return "N/A";
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${d.getFullYear()}`;
}

function addMonths(date: Date, months: number): Date {
	const out = new Date(date.getTime());
	out.setMonth(out.getMonth() + months);
	out.setDate(out.getDate() - 1);
	return out;
}

function parseDate(v: unknown): Date | null {
	if (!v) return null;
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	const s = String(v).trim();
	const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (isoDay) {
		return new Date(
			Number(isoDay[1]),
			Number(isoDay[2]) - 1,
			Number(isoDay[3]),
		);
	}
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d;
}

function shell(title: string, body: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 16mm 14mm; }
    body { font-family: "Times New Roman", Times, serif; color: #111; font-size: 12px; line-height: 1.45; margin: 0; }
    .brand { font-family: Arial, Helvetica, sans-serif; }
    .header { display:flex; justify-content:space-between; gap:16px; border-bottom:2px solid #166534; padding-bottom:10px; margin-bottom:16px; }
    .company { font-size:18px; font-weight:700; color:#166534; }
    .company-sub { font-size:10px; color:#555; }
    .meta { text-align:right; font-size:11px; }
    h1 { text-align:center; font-size:15px; margin: 12px 0 18px; text-decoration: underline; }
    ol { padding-left: 18px; }
    li { margin-bottom: 8px; }
    .sig { margin-top: 28px; display:grid; grid-template-columns:1fr 1fr; gap:28px; }
    .sig-line { border-top:1px solid #333; margin-top:48px; padding-top:6px; font-size:11px; }
    .muted { color:#555; font-size:10px; }
    table { width:100%; border-collapse:collapse; margin:10px 0 14px; }
    th, td { border:1px solid #ccc; padding:6px 8px; text-align:left; vertical-align:top; }
    th { width:34%; background:#f7f7f7; }
    .no-print { margin-bottom:12px; }
    @media print { .no-print { display:none !important; } }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="header brand">
    <div>
      <div class="company">DEVOTS REALTY</div>
      <div class="company-sub">No. 21-1, Jalan Genting Permai Avenue, 28700 Bentong, Pahang</div>
      <div class="company-sub">SST No: C11-2205-32100002</div>
    </div>
    <div class="meta">
      <div><strong>CASE NO.:</strong> {{CASE_NO}}</div>
      <div><strong>Generated:</strong> {{GENERATED_AT}}</div>
    </div>
  </div>
  ${body}
</body>
</html>`;
}

function fill(html: string, vars: Record<string, string>): string {
	let out = html;
	for (const [k, v] of Object.entries(vars)) {
		out = out.replaceAll(`{{${k}}}`, v);
	}
	return out;
}

/**
 * Build printable Devots eForm HTML for secondary (subsale / rental) deals.
 */
export async function generateSecondaryTransactionFormHtml(
	transactionId: string,
	formType: SecondaryFormType = "letter_of_appointment",
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
		throw new Error("eForm is only available for secondary market deals");
	}

	const prop = (tx.propertyData ?? {}) as {
		address?: string;
		propertyType?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
		listingTitle?: string;
		offerDate?: string;
		submitDate?: string;
		rentFrom?: string;
		rentTo?: string;
		rentPeriod?: string;
		renewOptionYears?: number;
		earnestDeposit?: number;
		sstPercent?: number;
		sstPayBy?: string;
		purchasingMethod?: string;
	};
	const client = (tx.clientData ?? {}) as Party & {
		vendors?: Party[];
		additionalPurchasers?: Party[];
		type?: string;
	};

	const isLease =
		tx.transactionType === "lease" || tx.transactionType === "rental";
	const landlord = client;
	const secondLandlord = client.additionalPurchasers?.[0];
	const tenant = client.vendors?.[0] ?? {};
	const purchaser = client;
	const secondPurchaser = client.additionalPurchasers?.[0];
	const vendor = client.vendors?.[0] ?? {};

	const monthlyRental = Number(prop.price ?? 0) || 0;
	const caseCommission = Number(tx.commissionAmount ?? 0) || 0;
	const sstPercent = Number(prop.sstPercent ?? 8) || 8;
	const sstAmount = caseCommission * (sstPercent / 100);
	const commissionWithSst = caseCommission + sstAmount;
	const commissionMonths =
		monthlyRental > 0
			? Math.round((caseCommission / monthlyRental) * 100) / 100
			: 0;
	const earnest = Number(prop.earnestDeposit ?? monthlyRental) || 0;
	const securityDeposit = monthlyRental * 2;
	const utilitiesDeposit = monthlyRental * 0.5;
	const stampingFee = 0;
	const totalToPay =
		earnest + securityDeposit + utilitiesDeposit + stampingFee;
	const spaPrice = Number(prop.spaPrice ?? prop.nettPrice ?? prop.price ?? 0);
	const commissionPercent = Number(tx.commissionValue ?? 0) || 0;

	const offerDate = parseDate(prop.offerDate ?? tx.bookingDate);
	const validityEnd = offerDate ? addMonths(offerDate, 3) : null;

	const caseNo = blank(tx.caseNo);
	const generatedAt = formatDate(new Date());
	const common = {
		CASE_NO: caseNo,
		GENERATED_AT: generatedAt,
		PROPERTY_ADDRESS: blank(prop.address),
	};

	let title = "";
	let body = "";
	let fileSuffix = "Form";

	if (formType === "summary") {
		title = isLease ? "Subrent Transaction Form" : "Subsale Transaction Form";
		fileSuffix = "Summary";
		body = `
  <h1>${title}</h1>
  <table>
    <tr><th>Market / Type</th><td>${blank(tx.marketType)} / ${blank(tx.transactionType)}</td></tr>
    <tr><th>Property Address</th><td>${blank(prop.address)}</td></tr>
    <tr><th>Property Type</th><td>${blank(prop.propertyType)}</td></tr>
    <tr><th>Price / Rental</th><td>${formatMoney(isLease ? monthlyRental : spaPrice)}</td></tr>
    <tr><th>Commission</th><td>${formatMoney(caseCommission)}</td></tr>
    <tr><th>SST</th><td>${sstPercent}% (${formatMoney(sstAmount)})</td></tr>
  </table>`;
	} else if (isLease && formType === "letter_of_appointment") {
		title = "LETTER OF APPOINTMENT TO RENT";
		fileSuffix = "LOA-Rent";
		body = `
  <h1>${title}</h1>
  <p>I/We, the undersigned Landlord(s), hereby appoint DEVOTS REALTY as my/our agent for the rental of the property below.</p>
  <table>
    <tr><th>Property Address</th><td>${blank(prop.address)}</td></tr>
    <tr><th>Earnest Deposit</th><td>${formatMoney(earnest)}</td></tr>
    <tr><th>Case Commission</th><td>${formatMoney(caseCommission)} (${commissionMonths} month)</td></tr>
    <tr><th>SST (${sstPercent}%)</th><td>${formatMoney(sstAmount)}</td></tr>
    <tr><th>Total Commission + SST</th><td>${formatMoney(commissionWithSst)}</td></tr>
    <tr><th>Validity</th><td>${formatDate(offerDate)} to ${formatDate(validityEnd)} (3 months from Offer Date)</td></tr>
  </table>
  <ol>
    <li>The Landlord authorises the Agency to market and rent the Property.</li>
    <li>Commission payable is ${formatMoney(caseCommission)} (${commissionMonths} month of rental), plus SST ${sstPercent}% amounting to ${formatMoney(sstAmount)}. Total payable: ${formatMoney(commissionWithSst)}.</li>
    <li>This appointment is valid for three (3) months from the Offer Date.</li>
  </ol>
  <div class="sig">
    <div>
      <div class="sig-line">Landlord<br/>Name: ${blank(landlord.name)}<br/>IC / Passport: ${blank(landlord.icNo)}</div>
    </div>
    <div>
      <div class="sig-line">Landlord’s (Second)<br/>Name: ${blank(secondLandlord?.name)}<br/>IC / Passport: ${blank(secondLandlord?.icNo)}</div>
    </div>
  </div>`;
	} else if (isLease && formType === "letter_of_offer") {
		title = "LETTER OF OFFER TO RENT";
		fileSuffix = "LOO-Rent";
		body = `
  <h1>${title}</h1>
  <table>
    <tr><th>Property Address</th><td>${blank(prop.address)}</td></tr>
    <tr><th>Landlord</th><td>${blank(landlord.name)} (${blank(landlord.icNo)})</td></tr>
    <tr><th>Tenant</th><td>${blank(tenant.name)} (${blank(tenant.icNo)})</td></tr>
    <tr><th>Rent From</th><td>${formatDate(prop.rentFrom)}</td></tr>
    <tr><th>Period of Tenancy</th><td>${blank(prop.rentPeriod)} month(s)</td></tr>
    <tr><th>Renew Option (Year)</th><td>${prop.renewOptionYears != null ? String(prop.renewOptionYears) : "N/A"}</td></tr>
  </table>
  <p><strong>Terms &amp; conditions — amounts to be paid:</strong></p>
  <ol>
    <li>Advance Rental / Earnest Deposit: ${formatMoney(earnest)}</li>
    <li>Security Deposit (2 months): ${formatMoney(securityDeposit)}</li>
    <li>Utilities Deposit (0.5 month): ${formatMoney(utilitiesDeposit)}</li>
    <li>Stamping fee: ${formatMoney(stampingFee)}</li>
  </ol>
  <p><strong>Total to be paid:</strong> ${formatMoney(totalToPay)}</p>
  <div class="sig">
    <div>
      <div class="sig-line">Tenant<br/>Name: ${blank(tenant.name)}<br/>IC / Passport: ${blank(tenant.icNo)}</div>
    </div>
    <div>
      <div class="sig-line">Landlord<br/>Name: ${blank(landlord.name)}<br/>IC / Passport: ${blank(landlord.icNo)}</div>
    </div>
  </div>`;
	} else if (!isLease && formType === "letter_of_appointment") {
		title = "LETTER OF APPOINTMENT TO SELL";
		fileSuffix = "LOA-Sell";
		body = `
  <h1>${title}</h1>
  <p>I/We, the undersigned Vendor(s), hereby appoint DEVOTS REALTY as my/our agent to sell the property below.</p>
  <table>
    <tr><th>Property Address</th><td>${blank(prop.address)}</td></tr>
    <tr><th>Selling Price (SPA)</th><td>${formatMoney(spaPrice)}</td></tr>
    <tr><th>Commission</th><td>${commissionPercent}% / ${formatMoney(caseCommission)}</td></tr>
  </table>
  <ol>
    <li>The Vendor authorises the Agency to market and sell the Property.</li>
    <li>Agency fee / commission of ${commissionPercent}% amounting to ${formatMoney(caseCommission)} is payable as per agency terms.</li>
    <li>This appointment follows the agency period stated in the official letter template.</li>
  </ol>
  <div class="sig">
    <div>
      <div class="sig-line">Vendor<br/>Name: ${blank(vendor.name)}<br/>IC / Passport: ${blank(vendor.icNo)}</div>
    </div>
    <div>
      <div class="sig-line">Vendor’s (Second)<br/>Name: ${blank(secondLandlord?.name)}<br/>IC / Passport: ${blank(secondLandlord?.icNo)}</div>
    </div>
  </div>`;
	} else {
		title = "LETTER OF OFFER TO PURCHASE";
		fileSuffix = "LOO-Purchase";
		body = `
  <h1>${title}</h1>
  <table>
    <tr><th>Property Address</th><td>${blank(prop.address)}</td></tr>
    <tr><th>Vendor</th><td>${blank(vendor.name)}</td></tr>
    <tr><th>Purchaser</th><td>${blank(purchaser.name)}</td></tr>
    <tr><th>Purchase Price (SPA)</th><td>${formatMoney(spaPrice)}</td></tr>
    <tr><th>Earnest Deposit</th><td>${formatMoney(earnest)} (${commissionPercent}%)</td></tr>
  </table>
  <p>I/We hereby attach herewith the sum of ${formatMoney(earnest)} as earnest deposit.</p>
  <div class="sig">
    <div>
      <div class="sig-line">Purchaser’s Signature<br/>Name: ${blank(secondPurchaser?.name ?? purchaser.name)}<br/>IC / Passport: ${blank(secondPurchaser?.icNo ?? purchaser.icNo)}</div>
    </div>
    <div>
      <div class="sig-line">Vendor's Acceptance<br/>Name: ${blank(vendor.name)}<br/>IC / Passport: ${blank(vendor.icNo)}</div>
    </div>
  </div>`;
	}

	const html = fill(shell(title, body), common);
	const caseSlug = (tx.caseNo ?? transactionId.slice(0, 8)).replace(
		/[^\w.-]+/g,
		"_",
	);
	return {
		html,
		fileName: `Devots-${fileSuffix}-${caseSlug}.html`,
		caseNo: tx.caseNo,
	};
}
