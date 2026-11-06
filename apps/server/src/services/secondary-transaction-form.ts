import { eq } from "drizzle-orm";
import { user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import {
	DEVOTS_LOGO_DATA_URI,
	EJEN_HARTA_STAMP_DATA_URI,
} from "./letterhead-assets";

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

const COMPANY = {
	name: "DEVOTS REALTY",
	reg: "RA0078434-M",
	address:
		"C-1-P20, Jalan Permai 2, Genting Permai Avenue, 69000 Bentong, Pahang.",
	phone: "03-61000688",
	email: "Devots.inc@gmail.com",
	sst: "C11-2205-32100002",
};

function esc(v: unknown): string {
	return String(v ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function text(v: unknown): string {
	if (v === null || v === undefined) return "";
	const s = String(v).trim();
	return s;
}

function num(v: unknown): number {
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
}

function formatMoney(v: unknown): string {
	const n = typeof v === "number" ? v : Number(v);
	if (!Number.isFinite(n)) return "";
	return n.toLocaleString("en-MY", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function trimNum(n: number, digits = 2): string {
	if (!Number.isFinite(n)) return "";
	if (Number.isInteger(n)) return String(n);
	return n.toFixed(digits).replace(/\.?0+$/, "");
}

function formatDate(v: unknown): string {
	if (!v) return "";
	if (typeof v === "string") {
		const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
		if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
	}
	const d = v instanceof Date ? v : new Date(String(v));
	if (Number.isNaN(d.getTime())) return "";
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${d.getFullYear()}`;
}

function addMonths(date: Date, months: number): Date {
	const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	out.setMonth(out.getMonth() + months);
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

const ONES = [
	"",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
	"Eleven",
	"Twelve",
	"Thirteen",
	"Fourteen",
	"Fifteen",
	"Sixteen",
	"Seventeen",
	"Eighteen",
	"Nineteen",
];
const TENS = [
	"",
	"",
	"Twenty",
	"Thirty",
	"Forty",
	"Fifty",
	"Sixty",
	"Seventy",
	"Eighty",
	"Ninety",
];

function chunkToWords(n: number): string {
	if (n < 20) return ONES[n];
	if (n < 100) {
		const rest = n % 10;
		return `${TENS[Math.floor(n / 10)]}${rest ? `-${ONES[rest]}` : ""}`;
	}
	const rest = n % 100;
	return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${chunkToWords(rest)}` : ""}`;
}

function integerToWords(n: number): string {
	if (n === 0) return "Zero";
	const scales = ["", "Thousand", "Million", "Billion"];
	const parts: string[] = [];
	let scale = 0;
	let x = n;
	while (x > 0 && scale < scales.length) {
		const chunk = x % 1000;
		if (chunk) {
			const words = chunkToWords(chunk);
			parts.unshift(scale ? `${words} ${scales[scale]}` : words);
		}
		x = Math.floor(x / 1000);
		scale += 1;
	}
	return parts.join(" ");
}

function ringgitWords(v: unknown): string {
	const n = typeof v === "number" ? v : Number(v);
	if (!Number.isFinite(n)) return "";
	const ringgit = Math.floor(n + 1e-9);
	const sen = Math.round((n - ringgit) * 100);
	let out = integerToWords(ringgit);
	if (sen > 0) out += ` and ${integerToWords(sen)} Sen`;
	return out;
}

function u(v: unknown, minEm = 6): string {
	return `<span class="u" style="min-width:${minEm}em">${esc(text(v))}</span>`;
}

function uBlock(v: unknown): string {
	return `<div class="u-block">${esc(text(v))}</div>`;
}

function firstDate(...vals: unknown[]): Date | null {
	for (const v of vals) {
		if (v instanceof Date) {
			const d = parseDate(v);
			if (d) return d;
			continue;
		}
		if (text(v) === "") continue;
		const d = parseDate(v);
		if (d) return d;
	}
	return null;
}

function tenancyYears(
	rentPeriod: string | undefined,
	from: Date | null,
	to: Date | null,
): string {
	if (from && to) {
		const days =
			Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
		if (days > 0) {
			const years = days / 365;
			const rounded = Math.round(years);
			if (rounded > 0 && Math.abs(years - rounded) < 0.08) {
				return String(rounded);
			}
			return trimNum(years, 2);
		}
	}
	const s = (rentPeriod ?? "").trim().toLowerCase();
	if (!s) return "";
	const yearMatch = s.match(/(\d+(?:\.\d+)?)\s*y/);
	if (yearMatch) return trimNum(Number(yearMatch[1]));
	const monthMatch = s.match(/(\d+(?:\.\d+)?)\s*m/);
	if (monthMatch) return trimNum(Number(monthMatch[1]) / 12);
	if (/^\d+(?:\.\d+)?$/.test(s)) {
		const n = Number(s);
		// Bare 12+ is months; smaller values are years ("1" = 1 year).
		return n >= 12 ? trimNum(n / 12) : trimNum(n);
	}
	return "";
}

function partyLine(p?: Party | null): string {
	if (!p?.name) return "";
	const ic = text(p.icNo);
	return ic ? `${p.name} (${ic})` : p.name;
}

function sigCol(label: string, party?: Party | null): string {
	return `<div class="sig-col">
  <div class="sig-head">${esc(label)}</div>
  <div class="sig-line"></div>
  <div class="sig-row"><span>Name</span><span>:</span>${u(party?.name, 14)}</div>
  <div class="sig-row"><span>NRIC No</span><span>:</span>${u(party?.icNo, 14)}</div>
  <div class="sig-row"><span>Address</span><span>:</span>${u(party?.address, 14)}</div>
  <div class="sig-row"><span>Date</span><span>:</span>${u("", 14)}</div>
</div>`;
}

function sigColShort(label: string, party?: Party | null): string {
	return `<div class="sig-col">
  <div class="sig-head">${esc(label)}</div>
  <div class="sig-line"></div>
  <div class="sig-row"><span>Name</span><span>:</span>${u(party?.name, 14)}</div>
  <div class="sig-row"><span>NRIC No</span><span>:</span>${u(party?.icNo, 14)}</div>
  <div class="sig-row"><span>Date</span><span>:</span>${u("", 14)}</div>
</div>`;
}

function agencyNotes(): string {
	return `<div class="notes">
  <p><strong>Exclusive Agency</strong> — This refers to the instruction from a principal to a single estate agent to act on his behalf. The principal may make introductions but will leave the closing of the transaction to the estate agent. The principal must pay the appointed estate agent the agreed fee even if the estate agent was not the effective cause of the transaction.</p>
  <p><strong>Sole Agency</strong> — Just as in exclusive agency, a single estate agent is engaged. The principal may, however, wish to reserve the right to close deals himself and is not obligated to pay the agent his fee in addition to making introductions or an arrangement may be made for a discount in fees where the principal plays an active role.</p>
  <p><strong>Sole Joint Agency</strong> — This is a variation of the Sole Agency. The estate agent works together with the principal as a team and the fee is divided on a pre-agreed formula. The principal has the flexibility to compensate additional estate agents and at the same time maintain the advantage of having one estate agent in control.</p>
  <p><strong>Joint Agency</strong> — This is where more than one estate agent is appointed and only the estate agent who closes the deals gets paid. The number of agents appointed is limited and each is aware of the appointment of the others.</p>
  <p><strong>Ad Hoc Basis</strong> — or commonly referred to as “Open Listing” — In this case, the principal can engage an unlimited number of estate agents on an adhoc basis and fees are paid only on successful conclusion of the estate agency transaction.</p>
  <p class="tiny">Note: * Tick or Delete where appropriate. All practices are in accordance to the Valuers, Appraisers and Estate Agents Act 1981 (Amended 2009).</p>
</div>`;
}

function legalFooter(): string {
	return `<p class="footer-legal">All practices are in accordance to the Valuers, Appraisers, Estate Agents and Property Managers Act 1981 and Rules 1981 and Rules 1986 (As Amended). This document is executed in compliance with the requirements of the Personal Data Protection Act 2010. For a detailed explanation, please refer to our website.</p>`;
}

function letterShell(
	title: string,
	caseNo: string,
	body: string,
	opts?: { compact?: boolean },
): string {
	const compact = opts?.compact === true;
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — ${esc(caseNo)}</title>
  <style>
    @page { size: A4; margin: ${compact ? "7mm 9mm" : "10mm 12mm"}; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; color: #111; font-size: ${compact ? "9.25px" : "11px"}; line-height: ${compact ? "1.16" : "1.32"}; margin: 0; }
    .no-print { margin-bottom: 10px; }
    .header { display: grid; grid-template-columns: ${compact ? "58px 1fr 64px" : "78px 1fr 88px"}; gap: ${compact ? "6px" : "10px"}; align-items: start; margin-bottom: ${compact ? "2px" : "8px"}; }
    .header img.logo { width: ${compact ? "58px" : "78px"}; height: ${compact ? "58px" : "78px"}; object-fit: contain; }
    .header img.stamp { width: ${compact ? "64px" : "88px"}; height: auto; object-fit: contain; }
    .co-name { font-size: ${compact ? "13px" : "16px"}; font-weight: 700; letter-spacing: 0.02em; }
    .co-reg { font-size: ${compact ? "9px" : "11px"}; font-weight: 400; }
    .co-meta { font-size: ${compact ? "8.5px" : "10px"}; line-height: 1.25; margin-top: 2px; }
    h1 { text-align: center; font-size: ${compact ? "12px" : "14px"}; margin: ${compact ? "2px 0 1px" : "6px 0 4px"}; letter-spacing: 0.04em; text-decoration: underline; }
    .case { text-align: right; font-size: ${compact ? "10px" : "12px"}; margin: 0 0 ${compact ? "2px" : "8px"}; }
    ol.clauses { padding-left: ${compact ? "15px" : "18px"}; margin: ${compact ? "2px 0" : "6px 0"}; }
    ol.clauses ol { margin: ${compact ? "1px 0" : "4px 0"}; padding-left: 16px; }
    ol.clauses li { margin: 0 0 ${compact ? "1px" : "6px"}; }
    p { margin: ${compact ? "2px 0" : "5px 0"}; }
    .u { display: inline-block; min-height: 1em; border-bottom: 1px solid #111; padding: 0 4px; line-height: 1.2; }
    .u-block { border-bottom: 1px solid #111; min-height: ${compact ? "1.05em" : "1.3em"}; padding: 1px 4px ${compact ? "1px" : "2px"}; margin: ${compact ? "1px 0 2px" : "2px 0 6px"}; }
    .intro { text-align: justify; }
    .sig { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: ${compact ? "8px" : "16px"}; margin-top: ${compact ? "4px" : "16px"}; }
    .sig.two { grid-template-columns: 1fr 1fr; }
    .sig-col { min-width: 0; }
    .sig-head { font-weight: 700; min-height: ${compact ? "1.15em" : "2.4em"}; }
    .sig-line { border-bottom: 1px solid #111; height: ${compact ? "14px" : "28px"}; margin: ${compact ? "0 0 2px" : "2px 0 8px"}; }
    .sig-row { display: grid; grid-template-columns: 4.6em 0.7em 1fr; gap: 4px; align-items: end; margin: ${compact ? "0" : "3px 0"}; }
    .rule { border: 0; border-top: 1px dashed #111; margin: ${compact ? "4px 0" : "12px 0"}; }
    .notes { margin-top: 14px; font-size: 8.5px; line-height: 1.25; }
    .notes p { margin: 3px 0; text-align: justify; }
    .tiny { font-size: 8px; font-style: italic; }
    .other { margin-top: ${compact ? "2px" : "8px"}; }
    .footer-legal { margin-top: ${compact ? "3px" : "10px"}; font-size: ${compact ? "7.5px" : "8px"}; text-align: justify; }
    @media print { .no-print { display: none !important; } body { font-size: ${compact ? "9.25px" : "10.5px"}; } }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="header">
    <img class="logo" src="${DEVOTS_LOGO_DATA_URI}" alt="Devots" />
    <div>
      <div class="co-name">${COMPANY.name} <span class="co-reg">(${COMPANY.reg})</span></div>
      <div class="co-meta">
        Address: ${COMPANY.address}<br/>
        Phone No: ${COMPANY.phone}<br/>
        Email: ${COMPANY.email}<br/>
        SST No: ${COMPANY.sst}
      </div>
    </div>
    <img class="stamp" src="${EJEN_HARTA_STAMP_DATA_URI}" alt="Ejen Harta Tanah E(3)0716" />
  </div>
  <h1>${esc(title)}</h1>
  <div class="case"><strong>CASE NO.:</strong> ${u(caseNo, 10)}</div>
  ${body}
</body>
</html>`;
}

type FormCtx = {
	caseNo: string;
	prop: {
		address?: string;
		propertyType?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
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
	tx: {
		marketType: string | null;
		transactionType: string | null;
		commissionAmount: unknown;
		commissionValue: unknown;
		bookingDate: Date | string | null;
	};
	landlord: Party;
	secondLandlord?: Party;
	tenant: Party;
	secondTenant?: Party;
	purchaser: Party;
	secondPurchaser?: Party;
	vendor: Party;
	secondVendor?: Party;
	witness: Party;
};

function loaRent(ctx: FormCtx): string {
	const monthly = num(ctx.prop.price);
	const commission = num(ctx.tx.commissionAmount);
	const months =
		monthly > 0 ? trimNum(Math.round((commission / monthly) * 100) / 100) : "";
	const sstPercent = num(ctx.prop.sstPercent) || 8;
	const sstAmount = commission * (sstPercent / 100);
	const total = commission + sstAmount;
	const earnest = num(ctx.prop.earnestDeposit) || monthly;
	const offerDate = firstDate(ctx.prop.offerDate, ctx.tx.bookingDate);
	const validityEnd = offerDate ? addMonths(offerDate, 3) : null;

	return `
  <p class="intro">I/We, the undersigned, being the registered owner(s) of the below stated property do hereby appoint you as our <strong>${COMPANY.name}</strong> agent on a sole and exclusive agency basis to act on my/our behalf to rent the said property. I/We also authorize you to display signboards, to advertise in any media, or in any form to promote the rent of the said property subject to the following terms:-</p>
  <p><strong>Property Address:</strong></p>
  ${uBlock(ctx.prop.address)}
  <p>(hereinafter called the “SAID PROPERTY”).</p>
  <ol class="clauses">
    <li>I/We hereby authorize <strong>${COMPANY.name}</strong> to accept rental earnest deposit of RM ${u(formatMoney(earnest), 8)} (Ringgit Malaysia ${u(ringgitWords(earnest), 22)} only) on my/our behalf from any intended tenants.</li>
    <li>I/We hereby agree to pay <strong>${COMPANY.name}</strong> a commission equivalent to ${u(months, 4)} (${u(months, 3)}) month of the rental plus GST/SST ${u(trimNum(sstPercent), 3)}% RM ${u(formatMoney(sstAmount), 7)} on the agency fees amounting to a total of RM ${u(formatMoney(total), 8)} for any tenant introduced by you. Such commission shall be payable upon the signing of the Tenancy Agreement.</li>
    <li>I/We hereby agree to pay the said commission for any tenant introduced by you even if the tenant concludes the lease with me/us after the expiry date of this appointment.</li>
    <li>In the event that the transaction is aborted by either the tenant or the landlord before the Tenancy Agreement is signed but an earnest deposit has been paid, I/We agree to pay you (50%) of the Full agreed commission or (50%) of the forfeitable earnest deposit, whichever is lesser.</li>
    <li>In the event either the tenant or the landlord aborts the transaction after the Tenancy Agreement is signed, I/We agree to pay you the full commission as agreed above.</li>
    <li>I/We hereby authorize <strong>${COMPANY.name}</strong> to act as stakeholder and to accept on my/our behalf the Earnest Deposit and to deduct from the earnest deposit the full agency fee upon signing of the Tenancy Agreement.</li>
    <li>This appointment shall be valid for a period from ${u(formatDate(offerDate), 8)} to ${u(formatDate(validityEnd), 8)}.</li>
  </ol>
  <div class="sig">
    ${sigCol("Landlord's Signature :", ctx.landlord)}
    ${sigCol("Landlord's Signature :", ctx.secondLandlord)}
    ${sigCol("Witness Signature :", ctx.witness)}
  </div>
  ${agencyNotes()}`;
}

function looRent(ctx: FormCtx): string {
	const monthly = num(ctx.prop.price);
	const earnest = num(ctx.prop.earnestDeposit) || monthly;
	const security = monthly * 2;
	const utilities = monthly * 0.5;
	const stamping = 0;
	const total = earnest + security + utilities + stamping;
	const from = parseDate(ctx.prop.rentFrom);
	const to = parseDate(ctx.prop.rentTo);
	const years = tenancyYears(ctx.prop.rentPeriod, from, to);
	const renew =
		ctx.prop.renewOptionYears != null
			? trimNum(num(ctx.prop.renewOptionYears))
			: "";

	return `
  <p><strong>Property Address:</strong></p>
  ${uBlock(ctx.prop.address)}
  <p><strong>Landlord:</strong> ${u(partyLine(ctx.landlord) || text(ctx.landlord.name), 28)}</p>
  <p><strong>Tenant:</strong> ${u(partyLine(ctx.tenant) || text(ctx.tenant.name), 28)}</p>
  <p class="intro">I/We (“Tenant”) have inspected the above property and hereby offer to rent the said property on the following terms &amp; conditions:-</p>
  <ol class="clauses">
    <li>Advance Rental for one month (inclusive / exclusive of service charge) : RM ${u(formatMoney(earnest), 8)}</li>
    <li>Security Deposit (equivalent to ${u("2", 2)} month/s rental) : RM ${u(formatMoney(security), 8)}</li>
    <li>Utility Deposit (Electricity, Water and Sewerage) (equivalent to ${u("0.5", 3)} month/s rental) : RM ${u(formatMoney(utilities), 8)}</li>
    <li>Stamping fee and disbursement of Tenancy Agreement : RM ${u(formatMoney(stamping), 8)}</li>
  </ol>
  <p><strong>Total to be paid before the release of keys : RM ${u(formatMoney(total), 8)}</strong></p>
  <ol class="clauses" start="5">
    <li>Period of Tenancy : ${u(years, 4)} year/s with an option to renew for another ${u(renew, 4)} year/s at the prevailing market rate.</li>
    <li>Commencement Date : ${u(formatDate(ctx.prop.rentFrom), 16)}</li>
    <li>Fittings &amp; Furnishing : The Rental shall include fittings &amp; furnishing as per attached inventory list (if any).</li>
    <li>Legal Fees: Tenant to bear all costs incurred in the preparation and stamping of the Tenancy Agreement (“TA”). I/We shall bear my/our own solicitors’ fees and legal expenses.</li>
    <li>Vacant Possession : Delivery of Vacant Possession shall be upon the payment of all deposits and advance rental.</li>
    <li>Execution: I/We shall execute the TA within fourteen (14) working days from the date of Landlord’s acceptance, failing which; the above earnest deposit shall be forfeited. Should the Landlord fail to sign the TA or aborts the deal before signing of the TA, not due to any reason of dispute in the terms of the TA, and the Tenant agrees to a compensation of equal amount to the Earnest Deposit or any other amount, the said compensation sum received shall be shared equally with <strong>${COMPANY.name}</strong>.</li>
    <li>Other Condition : ${uBlock("")}</li>
  </ol>
  <p class="intro">I/We hereby attached herewith the sum of RM ${u(formatMoney(earnest), 8)} payable to <strong>${COMPANY.name}</strong> as stakeholder being Earnest Deposit towards the Rental of the said property. This deposit shall form part of the payment towards the rental of the property. I/We irrevocably permit <strong>${COMPANY.name}</strong> to bank in the cheque prior to the Landlord(s) acceptance of this offer. <strong>${COMPANY.name}</strong> undertakes to refund the Earnest Deposit to the Tenant in the event the Landlord(s) reject the offer. Any cash payment will only be accepted through direct bank in to <strong>${COMPANY.name}</strong>. <strong>${COMPANY.name}</strong> shall not be held responsible or liable for any losses or damages (if any) in relations to the handling of cash.</p>
  <div class="sig two">
    ${sigColShort("Tenant's Signature :", ctx.tenant)}
    ${sigColShort("Witness Signature :", ctx.witness)}
  </div>
  <hr class="rule" />
  <p><strong>LANDLORD(S) ACCEPTANCE</strong> (This offer is subjected to the final acceptance by the Landlord(s) counter signing on this Letter Offer to Rent)</p>
  <ol class="clauses">
    <li>I/We, the undersigned, being the registered owner(s)/person(s) authorized by the registered owner(s) of the above mentioned property, confirm acceptance of the above offer and the terms and conditions therein.</li>
    <li>In the event that after having accepted this offer and the Earnest Deposit and not due to the reasons of any dispute in the terms of the TA, I/We refused to rent the said premises to the Tenant, I/We shall immediately refund the Earnest Deposit to the Tenant plus agreed liquidated damages (compensation) being a sum equivalent to the Earnest Deposit.</li>
    <li>In the event that the transaction is aborted by the Tenant and/or by his refusal to proceed with the TA for whatsoever reason before the TA is signed but after the earnest deposit is paid, I/We agree to pay <strong>${COMPANY.name}</strong> a fee equivalent to 50% of the forfeited deposit or 50% of the above mentioned agency fee, whichever is lesser.</li>
    <li>I/We agree to pay you Professional Agency Fees plus Sales &amp; Service Tax (SST) of 8% on the Professional Fees as stated in the signed Letter of Appointment, and payable upon the signing of the Tenancy Agreement or upon possession being given whichever is earlier.</li>
  </ol>
  <div class="sig two">
    ${sigColShort("Landlord's Signature :", ctx.landlord)}
    ${sigColShort("Witness Signature :", ctx.witness)}
  </div>
  <p class="other"><strong>Other Conditions:</strong></p>
  ${uBlock("")}
  ${legalFooter()}`;
}

function loaSell(ctx: FormCtx): string {
	const spa = num(ctx.prop.spaPrice ?? ctx.prop.nettPrice ?? ctx.prop.price);
	const fee = num(ctx.tx.commissionAmount);
	const percent = num(ctx.tx.commissionValue);
	const offerDate = firstDate(ctx.prop.offerDate, ctx.tx.bookingDate);

	return `
  <p class="intro">I/We, the undersigned, being the registered owner(s)/duly authorised representatives, hereby appoint <strong>${COMPANY.name}</strong> to be our agent for a period of six (6) calendar months commencing on ${u(formatDate(offerDate), 8)} to secure a Purchaser for the property stated below and on terms &amp; conditions following:-</p>
  <p><strong>Property Address:</strong></p>
  ${uBlock(ctx.prop.address)}
  <p><strong>Selling Price:</strong> RM ${u(formatMoney(spa), 10)} Selling price or such other sum as may be subsequently agreed to by me/us as vendor(s).</p>
  <p><strong>Payment Terms and conditions:</strong></p>
  <p>a) 10% of selling price to be paid by purchaser on signing of Sales &amp; Purchase Agreement (SPA)</p>
  <p>b) 90% of selling price to be paid:</p>
  <ol class="clauses" type="i">
    <li>Within 90 calendar days from the date of SPA or date of receipt of consent from developer / Statutory Body and / or relevant authorities and / or Certificate of Fitness, whichever is later.</li>
    <li>30 calendar days extension after expiry of clause bi), may be granted to the Purchaser for him to settle in full the outstanding balance at an interest rate of 8% per annum on all unpaid sum calculated on a daily basis.</li>
  </ol>
  <p>I/We agree to pay you Professional Fees of RM ${u(formatMoney(fee), 8)} or ${u(trimNum(percent), 4)} % of the transacted sale price and an included 8% SST on the professional fees, and payable upon the signing of the SPA or execution of Memorandum of Transfer whichever is earlier.</p>
  <ol class="clauses" start="2">
    <li>In acting as Estate Agent you are permitted to display “FOR SALE” signboards at the said property / advertise in the media / send out flyer or any other forms / activities to promote generally the sale of the property.</li>
    <li>You are entitled to your fees if any introduction made during the period of your appointment leads to a successfully concluded sale even if the appointment has expired or has been terminated at the time of completion of the transaction. The fee is further payable based on the following:
      <ol type="i">
        <li>You procure a Purchaser on the terms specified herein; OR</li>
        <li>A lease/rent, sale, exchange or other transfer of the property is made by me/us after the termination of this agreement or any extension thereof, with any persons introduced by you.</li>
        <li>A lease/rent, sale, exchange or other transfer of the property is made by me/us, or through other sources (Exclusive Appointment only); OR</li>
        <li>The Property is withdrawn from the market or if this authorization is revoked or if I/we prevent the performance hereunder by you. (Exclusive Appointment only)</li>
        <li>In the event the transaction is aborted by Vendor/Purchaser before the SPA is signed but Earnest Deposit is paid, I/we agree to pay you a fee equivalent to 50% of the Earnest Deposit or 50% of the agreed fees, whichever is lesser.</li>
      </ol>
    </li>
    <li>You are authorized to accept on my/our behalf an earnest deposit of 3.5% of purchase price and to deduct therefrom your fees due upon signing of the SPA. In the event the earnest deposit is insufficient to cover the professional fees payable to you, I/we shall immediately pay the shortfall due to you upon signing of the SPA.</li>
    <li>I/We fully indemnify <strong>${COMPANY.name}</strong> against all claims by the Purchaser(s) if I/we for any reason whatsoever, do not proceed to execute the SPA after earnest deposit has been collected and offer duly accepted by me or either one of us.</li>
    <li>I/We shall bear my/our solicitors’ fees and legal expenses.</li>
  </ol>
  <div class="sig">
    ${sigCol("Vendor's Signature :", ctx.vendor)}
    ${sigCol("Vendor's Signature :", ctx.secondVendor)}
    ${sigCol("Witness Signature :", ctx.witness)}
  </div>
  <p class="other"><strong>Other Conditions:</strong></p>
  ${uBlock("")}
  ${agencyNotes()}`;
}

function looPurchase(ctx: FormCtx): string {
	const spa = num(ctx.prop.spaPrice ?? ctx.prop.nettPrice ?? ctx.prop.price);
	const earnest = num(ctx.prop.earnestDeposit);

	return `
  <p><strong>Property Address:</strong></p>
  ${uBlock(ctx.prop.address)}
  <p><strong>Vendor:</strong> ${u(partyLine(ctx.vendor) || text(ctx.vendor.name), 28)}</p>
  <p><strong>Purchaser:</strong> ${u(partyLine(ctx.purchaser) || text(ctx.purchaser.name), 28)}</p>
  <p class="intro">I/We have inspected the above property and hereby offer to purchase the said property on the following terms &amp; conditions:-</p>
  <ol class="clauses">
    <li>Purchase Price: RM ${u(formatMoney(spa), 10)} Only.</li>
    <li>Payment Terms: Payment shall be in the following terms:-
      <ol type="a">
        <li>10% of price stated in the Sale &amp; Purchase Agreement (“SPA”) to be paid upon signing SPA;</li>
        <li>90% balance to be paid within 90 days from date of execution of SPA or date of receipt of consent from the Developer / Statutory Body and / or relevant authorities or from the date of issuance of Certificate of Fitness, whichever is later than the (“Completion Date”);</li>
        <li>Upon expiry of the Completion Date, to grant an extension period of 30 days to pay the unpaid balance sum which is subjected to 8% interest per annum calculated on daily basis.</li>
      </ol>
    </li>
    <li>Encumbrance, etc: This offer is subjected to the Vendor delivering to the Purchaser a valid and registrable transfer for the aforesaid property free from any charges or encumbrances at the date when the final payment is made to the Vendor.</li>
    <li>Fittings &amp; Furnishing: The Purchase Price shall include fitting &amp; furnishing as per attached inventory list (if any): ${u("", 12)}</li>
    <li>Vacant Possession: ${u("", 16)}</li>
    <li>Sale &amp; Purchase Agreement:
      <ol type="a">
        <li>To bear my own costs and fees for the appointment of my Solicitor and related costs.</li>
        <li>I/We hereby undertake to execute the SPA within fourteen (14) working days from the date of acceptance of this offer by the Vendor, failing which; the said earnest deposit shall be forfeited, provided that such failure is not due to the default or omission of the Vendor or there is no delay on the part of the Vendor or Vendor’s lawyer in agreeing to the terms and conditions of the SPA. Should the Vendor fail to execute the SPA for whatsoever reasons before signing of the SPA and Purchaser, agrees to a compensation of equal amount to the Earnest Deposit or any other amount, the said compensation sum received shall then be shared equally with <strong>${COMPANY.name}</strong>.</li>
        <li>In the event the Vendor(s) fails to execute the SPA within the said Period, the Purchaser shall be entitled to remedy by Specific Performance against and at the cost and expense of the Vendor(s). If the Purchaser does not institute an action for Specific Performance, the Purchaser may have the Earnest Deposit refunded plus a sum equivalent to the Earnest Deposit as compensation.</li>
      </ol>
    </li>
    <li>Others (if any): ${uBlock("")}</li>
  </ol>
  <p class="intro">I/We hereby attached herewith the sum of RM ${u(formatMoney(earnest), 8)} (${u(ringgitWords(earnest), 22)}) payable to <strong>${COMPANY.name}</strong> as stakeholder being Earnest Deposit towards the purchase of the property. I/We irrevocably permit <strong>${COMPANY.name}</strong> to bank in the cheque prior to the Vendor(s) acceptance of this offer. <strong>${COMPANY.name}</strong> undertakes to refund the Earnest Deposit to the Purchaser in the event the Vendor(s) reject the offer. Any cash payment will only be accepted through direct bank in to <strong>${COMPANY.name}</strong> client’s account. <strong>${COMPANY.name}</strong> shall not be held responsible or liable for any losses or damages (if any) in relations to the handling of cash.</p>
  <div class="sig">
    ${sigColShort("Purchaser's Signature :", ctx.purchaser)}
    ${sigColShort("Purchaser's Signature :", ctx.secondPurchaser)}
    ${sigColShort("Witness Signature :", ctx.witness)}
  </div>
  <hr class="rule" />
  <p><strong>VENDOR(S) ACCEPTANCE</strong> (This offer is subjected to the final acceptance by the Vendor(s) counter signing on this Letter Offer to Purchase)</p>
  <ol class="clauses">
    <li>I/We, the undersigned, being the registered owner(s) / person(s) authorized by the registered owner(s) of the above mentioned property, acknowledge acceptance of the above offer and the terms and conditions therein.</li>
    <li>If I/We withdraw from this transaction or fail to execute the SPA after having accepted this offer, I/We shall refund the Earnest Deposit plus an additional equal amount as compensation to the Purchaser(s) provided the Purchaser(s) do not file for specific performance. The said compensation sum shall be shared equally with <strong>${COMPANY.name}</strong>.</li>
    <li>Should the transaction is aborted by the Purchaser(s) and/or due to Purchaser’s refusal to proceed with the sale for whatsoever reason before the SPA is signed but after the earnest deposit is paid, the said earnest deposit shall be forfeited. I/We agree to pay <strong>${COMPANY.name}</strong> an equivalent to 50% of the forfeited Earnest Deposit or 50% of the above mentioned agency fees, whichever is lesser.</li>
    <li>I/We agree to pay you Professional Fees as stated in the signed Letter of Appointment, and payable upon the signing of the SPA or execution of Memorandum of Transfer whichever is earlier.</li>
  </ol>
  <div class="sig">
    ${sigColShort("Vendor's Signature :", ctx.vendor)}
    ${sigColShort("Vendor's Signature :", ctx.secondVendor)}
    ${sigColShort("Witness Signature :", ctx.witness)}
  </div>
  <p class="other"><strong>Other Conditions:</strong></p>
  ${uBlock("")}
  ${legalFooter()}`;
}

function summaryBody(ctx: FormCtx, isLease: boolean): string {
	const monthly = num(ctx.prop.price);
	const spa = num(ctx.prop.spaPrice ?? ctx.prop.nettPrice ?? ctx.prop.price);
	const commission = num(ctx.tx.commissionAmount);
	const sstPercent = num(ctx.prop.sstPercent) || 8;
	const sstAmount = commission * (sstPercent / 100);
	return `
  <table style="width:100%;border-collapse:collapse">
    <tr><th style="text-align:left;border:1px solid #ccc;padding:6px;width:34%">Market / Type</th><td style="border:1px solid #ccc;padding:6px">${esc(text(ctx.tx.marketType))} / ${esc(text(ctx.tx.transactionType))}</td></tr>
    <tr><th style="text-align:left;border:1px solid #ccc;padding:6px">Property Address</th><td style="border:1px solid #ccc;padding:6px">${esc(text(ctx.prop.address))}</td></tr>
    <tr><th style="text-align:left;border:1px solid #ccc;padding:6px">${isLease ? "Monthly Rental" : "Purchase Price"}</th><td style="border:1px solid #ccc;padding:6px">RM ${esc(formatMoney(isLease ? monthly : spa))}</td></tr>
    <tr><th style="text-align:left;border:1px solid #ccc;padding:6px">Commission</th><td style="border:1px solid #ccc;padding:6px">RM ${esc(formatMoney(commission))}</td></tr>
    <tr><th style="text-align:left;border:1px solid #ccc;padding:6px">SST</th><td style="border:1px solid #ccc;padding:6px">${esc(trimNum(sstPercent))}% (RM ${esc(formatMoney(sstAmount))})</td></tr>
  </table>`;
}

/**
 * Build printable Devots official eForm HTML for secondary (subsale / rental) deals.
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

	const prop = (tx.propertyData ?? {}) as FormCtx["prop"];
	const client = (tx.clientData ?? {}) as Party & {
		vendors?: Party[];
		additionalPurchasers?: Party[];
		type?: string;
	};

	const isLease =
		tx.transactionType === "lease" || tx.transactionType === "rental";
	const extraLandlords = client.additionalPurchasers ?? [];
	const tenants = client.vendors ?? [];
	const vendors = client.vendors ?? [];
	const extraPurchasers = client.additionalPurchasers ?? [];

	const landlord: Party = client;
	const secondLandlord = extraLandlords[0];
	const tenant = tenants[0] ?? {};
	const secondTenant = tenants[1];
	const purchaser: Party = client;
	const secondPurchaser = extraPurchasers[0];
	const vendor = vendors[0] ?? {};
	const secondVendor = vendors[1];
	const witness: Party = {
		name: text(row.agentNick) || text(row.agentName),
	};

	const ctx: FormCtx = {
		caseNo: text(tx.caseNo),
		prop,
		tx: {
			marketType: tx.marketType,
			transactionType: tx.transactionType,
			commissionAmount: tx.commissionAmount,
			commissionValue: tx.commissionValue,
			bookingDate: tx.bookingDate,
		},
		landlord,
		secondLandlord,
		tenant,
		secondTenant,
		purchaser,
		secondPurchaser,
		vendor,
		secondVendor,
		witness,
	};

	let title = "";
	let body = "";
	let fileSuffix = "Form";

	if (formType === "summary") {
		title = isLease ? "Subrent Transaction Form" : "Subsale Transaction Form";
		fileSuffix = "Summary";
		body = summaryBody(ctx, isLease);
	} else if (isLease && formType === "letter_of_appointment") {
		title = "LETTER OF APPOINTMENT TO RENT";
		fileSuffix = "LOA-Rent";
		body = loaRent(ctx);
	} else if (isLease && formType === "letter_of_offer") {
		title = "LETTER OFFER TO RENT";
		fileSuffix = "LOO-Rent";
		body = looRent(ctx);
	} else if (!isLease && formType === "letter_of_appointment") {
		title = "LETTER OF APPOINTMENT TO SELL";
		fileSuffix = "LOA-Sell";
		body = loaSell(ctx);
	} else {
		title = "LETTER OFFER TO PURCHASE";
		fileSuffix = "LOO-Purchase";
		body = looPurchase(ctx);
	}

	const html = letterShell(title, ctx.caseNo, body, {
		compact: formType === "letter_of_offer",
	});
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
