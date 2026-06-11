import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	ne,
	or,
	sql,
	sum,
} from "drizzle-orm";
import type { PayoutAuditEntry } from "../models/commission-payouts";
import {
	commissionPayouts,
	projectClaimSchedules,
} from "../models/commission-payouts";
import { user } from "../models/auth";
import type { AgentTier } from "../models/auth";
import { transactions } from "../models/transactions";
import { calculateSchemeCommission } from "./commission-schemes";
import {
	recordPrimaryLeadershipBonus,
	recordSecondaryLeadershipBonus,
} from "./commission-calculation";
import { db } from "../utils/db";

type TxRow = typeof transactions.$inferSelect;

function dec(n: number) {
	return n.toFixed(2);
}

async function getClaimStageForProject(projectName: string | null | undefined) {
	if (!projectName?.trim()) return null;
	const [row] = await db
		.select()
		.from(projectClaimSchedules)
		.where(eq(projectClaimSchedules.projectName, projectName))
		.orderBy(asc(projectClaimSchedules.sortOrder))
		.limit(1);
	return row ?? null;
}

function appendAudit(
	existing: PayoutAuditEntry[] | null | undefined,
	entry: PayoutAuditEntry,
): PayoutAuditEntry[] {
	return [...(existing ?? []), entry];
}

/**
 * Creates negotiator (+ optional override) payout rows when a transaction is approved.
 * Idempotent per transaction.
 */
export async function ensurePayoutsForApprovedTransaction(tx: TxRow) {
	if (tx.status !== "approved" && tx.status !== "verified") return [];

	const existing = await db
		.select({ id: commissionPayouts.id })
		.from(commissionPayouts)
		.where(eq(commissionPayouts.transactionId, tx.id))
		.limit(1);
	if (existing.length > 0) return [];

	const breakdown = tx.commissionBreakdown as {
		marketType?: "primary" | "secondary";
		spaPrice?: number;
		nettPrice?: number;
		commissionRatePercent?: number;
		grossCommission?: number;
		sstAmount?: number;
		agentNetCommission?: number;
		agentSharePercent?: number;
		companyShare?: number;
		leadershipBonus?: {
			uplineId?: string | null;
			uplineTier?: string | null;
			bonusRate?: number;
			bonusAmount?: number;
			fromCompanyShare?: number;
		};
	} | null;
	const snapshot = tx.commissionSchemeSnapshot as {
		projectName?: string;
		blockListingTitle?: string | null;
		commissionPercent?: number;
		overridePercent?: number;
		incSst?: boolean;
		sstPercent?: number;
		sstBorneBy?: "client" | "agent";
	} | null;

	const prop = tx.propertyData as {
		spaPrice?: number;
		nettPrice?: number;
		price?: number;
		listingTitle?: string;
	} | null;

	const nett =
		breakdown?.nettPrice ??
		prop?.nettPrice ??
		prop?.price ??
		Number(tx.commissionAmount);
	const spa = breakdown?.spaPrice ?? prop?.spaPrice ?? nett;

	const schemeSnap = snapshot ?? null;
	const claim = await getClaimStageForProject(
		tx.projectName ?? schemeSnap?.projectName ?? null,
	);

	const isSecondary = tx.marketType === "secondary";

	const incSst = schemeSnap?.incSst ?? false;
	const sstPct = schemeSnap?.sstPercent ?? 0;
	const sstBorne = schemeSnap?.sstBorneBy ?? "agent";

	let grossN = breakdown?.grossCommission ?? Number(tx.commissionAmount);
	let sstN = breakdown?.sstAmount ?? 0;
	let netN =
		tx.commissionOverrideAgentNet != null
			? Number(tx.commissionOverrideAgentNet)
			: (breakdown?.agentNetCommission ?? Number(tx.commissionAmount));
	let pctN =
		breakdown?.commissionRatePercent ?? Number(tx.commissionValue) ?? 0;

	if (isSecondary && breakdown?.agentNetCommission != null) {
		grossN = breakdown.grossCommission ?? grossN;
		netN = breakdown.agentNetCommission;
		pctN = breakdown.commissionRatePercent ?? pctN;
		sstN = breakdown.sstAmount ?? 0;
	} else if (schemeSnap && breakdown == null) {
		const tierPct = schemeSnap.commissionPercent ?? pctN;
		const calc = calculateSchemeCommission({
			nettPrice: nett,
			commissionPercent: tierPct,
			incSst,
			sstPercent: sstPct,
			sstBorneBy: sstBorne,
		});
		grossN = calc.grossCommission;
		sstN = calc.sstAmount;
		netN = calc.agentNetCommission;
		pctN = tierPct;
	}

	const nowIso = new Date().toISOString();
	const baseAudit: PayoutAuditEntry = {
		at: nowIso,
		byUserId: "system",
		action: "created_from_transaction_approval",
		notes: "Commission payout created when transaction was approved",
	};

	const blockLabel =
		schemeSnap?.blockListingTitle ?? prop?.listingTitle ?? null;

	const [negotiator] = await db
		.insert(commissionPayouts)
		.values({
			transactionId: tx.id,
			payeeAgentId: tx.agentId,
			payoutType: "negotiator",
			status: "pending_approval",
			caseNo: tx.caseNo ?? null,
			projectName: tx.projectName ?? schemeSnap?.projectName ?? null,
			blockLabel,
			unitNo: tx.unitNo ?? null,
			bookingDate: tx.bookingDate ?? tx.transactionDate,
			spaPrice: dec(spa),
			nettPrice: dec(nett),
			commissionPercent: dec(pctN),
			grossCommission: dec(grossN),
			sstAmount: dec(sstN),
			netCommission: dec(netN),
			commissionSchemeSnapshot: schemeSnap,
			claimStageLabel: claim?.claimStage ?? null,
			claimStagePercent: claim ? dec(Number(claim.percentPayable)) : null,
			auditLog: [baseAudit],
		})
		.returning();

	const created = [negotiator];

	const overridePct = schemeSnap?.overridePercent ?? 0;
	if (
		!isSecondary &&
		overridePct > 0 &&
		tx.teamLeaderAgentId &&
		tx.teamLeaderAgentId !== tx.agentId
	) {
		const oCalc = calculateSchemeCommission({
			nettPrice: nett,
			commissionPercent: overridePct,
			incSst,
			sstPercent: sstPct,
			sstBorneBy: sstBorne,
		});
		const [overrideRow] = await db
			.insert(commissionPayouts)
			.values({
				transactionId: tx.id,
				payeeAgentId: tx.teamLeaderAgentId,
				payoutType: "override",
				status: "pending_approval",
				caseNo: tx.caseNo ?? null,
				projectName: tx.projectName ?? schemeSnap?.projectName ?? null,
				blockLabel,
				unitNo: tx.unitNo ?? null,
				bookingDate: tx.bookingDate ?? tx.transactionDate,
				spaPrice: dec(spa),
				nettPrice: dec(nett),
				commissionPercent: dec(overridePct),
				grossCommission: dec(oCalc.grossCommission),
				sstAmount: dec(oCalc.sstAmount),
				netCommission: dec(oCalc.agentNetCommission),
				commissionSchemeSnapshot: schemeSnap,
				claimStageLabel: claim?.claimStage ?? null,
				claimStagePercent: claim ? dec(Number(claim.percentPayable)) : null,
				auditLog: [baseAudit],
			})
			.returning();
		created.push(overrideRow);
	}

	try {
		if (isSecondary && breakdown) {
			await recordSecondaryLeadershipBonus(tx, breakdown);
		} else if (!isSecondary) {
			await recordPrimaryLeadershipBonus(tx, grossN);
		}
	} catch {
		// Leadership bonus tables may not be migrated yet
	}

	return created;
}

export type PayoutListFilters = {
	search?: string;
	agentId?: string;
	projectName?: string;
	status?: (typeof commissionPayouts.$inferSelect)["status"];
	dateFrom?: Date;
	dateTo?: Date;
	limit: number;
	offset: number;
};

export async function listCommissionPayoutsAdmin(opts: PayoutListFilters) {
	const cond: any[] = [];
	if (opts.status) cond.push(eq(commissionPayouts.status, opts.status));
	if (opts.agentId) cond.push(eq(commissionPayouts.payeeAgentId, opts.agentId));
	if (opts.projectName)
		cond.push(eq(commissionPayouts.projectName, opts.projectName));
	if (opts.dateFrom)
		cond.push(gte(commissionPayouts.bookingDate, opts.dateFrom));
	if (opts.dateTo) cond.push(lte(commissionPayouts.bookingDate, opts.dateTo));
	if (opts.search?.trim()) {
		const q = `%${opts.search.trim()}%`;
		cond.push(
			or(
				ilike(commissionPayouts.caseNo, q),
				ilike(user.name, q),
			)!,
		);
	}

	const whereClause = cond.length ? and(...cond) : undefined;

	const rows = await db
		.select({
			payout: commissionPayouts,
			agentName: user.name,
		})
		.from(commissionPayouts)
		.innerJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.where(whereClause)
		.orderBy(desc(commissionPayouts.updatedAt))
		.limit(opts.limit)
		.offset(opts.offset);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(commissionPayouts)
		.innerJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.where(whereClause);

	return { rows, total: count };
}

export async function listCommissionPayoutsAgent(opts: {
	agentId: string;
	search?: string;
	status?: (typeof commissionPayouts.$inferSelect)["status"];
	dateFrom?: Date;
	dateTo?: Date;
	limit: number;
	offset: number;
}) {
	const cond: any[] = [eq(commissionPayouts.payeeAgentId, opts.agentId)];
	if (opts.status) cond.push(eq(commissionPayouts.status, opts.status));
	if (opts.dateFrom)
		cond.push(gte(commissionPayouts.bookingDate, opts.dateFrom));
	if (opts.dateTo) cond.push(lte(commissionPayouts.bookingDate, opts.dateTo));
	if (opts.search?.trim()) {
		const q = `%${opts.search.trim()}%`;
		cond.push(
			or(ilike(commissionPayouts.caseNo, q), ilike(commissionPayouts.projectName, q))!,
		);
	}
	const whereClause = and(...cond);

	const rows = await db
		.select({ payout: commissionPayouts })
		.from(commissionPayouts)
		.where(whereClause)
		.orderBy(desc(commissionPayouts.updatedAt))
		.limit(opts.limit)
		.offset(opts.offset);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(commissionPayouts)
		.where(whereClause);

	return { rows, total: count };
}

export async function getCommissionPayoutById(id: string) {
	const [row] = await db
		.select({
			payout: commissionPayouts,
			agentName: user.name,
			agentEmail: user.email,
			bankName: user.bankName,
			bankAccountNo: user.bankAccountNo,
		})
		.from(commissionPayouts)
		.innerJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.where(eq(commissionPayouts.id, id))
		.limit(1);
	return row ?? null;
}

export async function summarizePayoutTotalsAdmin(filters: {
	agentId?: string;
	projectName?: string;
	dateFrom?: Date;
	dateTo?: Date;
}) {
	const cond: any[] = [ne(commissionPayouts.status, "voided")];
	if (filters.agentId) cond.push(eq(commissionPayouts.payeeAgentId, filters.agentId));
	if (filters.projectName)
		cond.push(eq(commissionPayouts.projectName, filters.projectName));
	if (filters.dateFrom)
		cond.push(gte(commissionPayouts.bookingDate, filters.dateFrom));
	if (filters.dateTo) cond.push(lte(commissionPayouts.bookingDate, filters.dateTo));
	const w = and(...cond);

	const sumNetForStatuses = async (statuses: string[]) => {
		const [{ v }] = await db
			.select({
				v: sum(sql`CAST(${commissionPayouts.netCommission} AS DECIMAL)`),
			})
			.from(commissionPayouts)
			.where(and(w, inArray(commissionPayouts.status, statuses as any)));
		return Number(v ?? 0);
	};

	const pending = await sumNetForStatuses(["pending_approval", "on_hold"]);
	const approvedOnly = await sumNetForStatuses(["approved"]);
	const released = await sumNetForStatuses(["released"]);
	const paid = await sumNetForStatuses(["paid"]);

	return { pendingRm: pending, approvedRm: approvedOnly, releasedRm: released, paidRm: paid };
}

export async function summarizeAgentPayoutDashboard(agentId: string) {
	const base = eq(commissionPayouts.payeeAgentId, agentId);
	const sumStatus = async (statuses: string[]) => {
		const [{ v }] = await db
			.select({
				v: sum(sql`CAST(${commissionPayouts.netCommission} AS DECIMAL)`),
			})
			.from(commissionPayouts)
			.where(
				and(
					base,
					inArray(commissionPayouts.status, statuses as any),
					ne(commissionPayouts.status, "voided"),
				),
			);
		return Number(v ?? 0);
	};

	const earned = await sumStatus([
		"pending_approval",
		"approved",
		"released",
		"paid",
		"on_hold",
	]);
	const received = await sumStatus(["paid"]);
	const outstanding = await sumStatus([
		"pending_approval",
		"approved",
		"released",
		"on_hold",
	]);

	return { totalEarnedRm: earned, totalReceivedRm: received, outstandingRm: outstanding };
}

export async function agentCommissionByMonth(agentId: string) {
	const rows = await db
		.select({
			ym: sql<string>`to_char(date_trunc('month', ${commissionPayouts.bookingDate}), 'YYYY-MM')`,
			total: sum(sql`CAST(${commissionPayouts.netCommission} AS DECIMAL)`),
		})
		.from(commissionPayouts)
		.where(
			and(
				eq(commissionPayouts.payeeAgentId, agentId),
				sql`${commissionPayouts.status} != 'voided'`,
				sql`${commissionPayouts.bookingDate} is not null`,
			),
		)
		.groupBy(sql`date_trunc('month', ${commissionPayouts.bookingDate})`)
		.orderBy(sql`date_trunc('month', ${commissionPayouts.bookingDate})`);

	return rows.map((r) => ({
		month: r.ym,
		amountRm: Number(r.total ?? 0),
	}));
}

export async function adminAgentCommissionSummary(agentId: string) {
	const payouts = await db
		.select()
		.from(commissionPayouts)
		.where(eq(commissionPayouts.payeeAgentId, agentId))
		.orderBy(desc(commissionPayouts.bookingDate));

	const nonVoid = payouts.filter((p) => p.status !== "voided");
	const sum = (fn: (p: (typeof payouts)[0]) => number) =>
		nonVoid.reduce((a, p) => a + fn(p), 0);

	const totalGross = sum((p) => Number(p.grossCommission));
	const totalSst = sum((p) => Number(p.sstAmount));
	const totalNet = sum((p) => Number(p.netCommission));
	const totalPaid = nonVoid
		.filter((p) => p.status === "paid")
		.reduce((a, p) => a + Number(p.netCommission), 0);
	const outstanding = nonVoid
		.filter((p) => p.status !== "paid" && p.status !== "voided")
		.reduce((a, p) => a + Number(p.netCommission), 0);

	return {
		totalTransactions: new Set(nonVoid.map((p) => p.transactionId)).size,
		totalGrossRm: totalGross,
		totalSstRm: totalSst,
		totalNetRm: totalNet,
		totalPaidRm: totalPaid,
		outstandingRm: outstanding,
		byMonth: await agentCommissionByMonth(agentId),
		payouts,
	};
}

export async function approvePayoutAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	internalNote?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	if (row.payout.status !== "pending_approval") {
		throw new Error("Only pending commissions can be approved");
	}
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "approved",
		notes: opts.internalNote,
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "approved",
			payoutApprovedBy: opts.adminId,
			payoutApprovedAt: now,
			internalNote: opts.internalNote ?? row.payout.internalNote,
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function releasePayoutAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	paymentMethod: "bank_transfer" | "cheque" | "cash";
	paymentDate: Date;
	paymentReferenceNo: string;
	paymentReceiptUrl?: string;
	internalNote?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	if (row.payout.status !== "approved") {
		throw new Error("Only approved commissions can be released");
	}
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "released",
		notes: opts.internalNote,
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "released",
			paymentMethod: opts.paymentMethod,
			paymentBankName: row.bankName,
			paymentBankAccountNo: row.bankAccountNo,
			paymentDate: opts.paymentDate,
			paymentReferenceNo: opts.paymentReferenceNo,
			paymentReceiptUrl: opts.paymentReceiptUrl ?? null,
			releasedBy: opts.adminId,
			releasedAt: now,
			internalNote: opts.internalNote ?? row.payout.internalNote,
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function markPaidAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	internalNote?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	if (row.payout.status !== "released") {
		throw new Error("Only released commissions can be marked paid");
	}
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "paid_confirmed",
		notes: opts.internalNote,
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "paid",
			paidConfirmedBy: opts.adminId,
			paidConfirmedAt: now,
			internalNote: opts.internalNote ?? row.payout.internalNote,
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function setOnHoldAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	reason?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "on_hold",
		notes: opts.reason,
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "on_hold",
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function voidPayoutAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	reason?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	if (row.payout.status === "paid") {
		throw new Error("Cannot void a paid commission");
	}
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "voided",
		notes: opts.reason,
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "voided",
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function bulkApproveAdmin(ids: string[], adminId: string) {
	const results = [];
	for (const id of ids) {
		try {
			results.push(await approvePayoutAdmin({ id, adminId }));
		} catch (e) {
			results.push({ id, error: String(e) });
		}
	}
	return results;
}

export async function bulkReleaseAdmin(
	ids: string[],
	adminId: string,
	common: {
		paymentMethod: "bank_transfer" | "cheque" | "cash";
		paymentDate: Date;
		paymentReferenceNo: string;
	},
) {
	const results = [];
	for (const id of ids) {
		try {
			results.push(
				await releasePayoutAdmin({
					id,
					adminId,
					paymentMethod: common.paymentMethod,
					paymentDate: common.paymentDate,
					paymentReferenceNo: `${common.paymentReferenceNo}-${id.slice(0, 8)}`,
				}),
			);
		} catch (e) {
			results.push({ id, error: String(e) });
		}
	}
	return results;
}

// --- Claim schedules ---

export async function listClaimSchedulesAdmin(projectName?: string) {
	if (projectName) {
		return db
			.select()
			.from(projectClaimSchedules)
			.where(eq(projectClaimSchedules.projectName, projectName))
			.orderBy(
				asc(projectClaimSchedules.projectName),
				asc(projectClaimSchedules.sortOrder),
			);
	}
	return db
		.select()
		.from(projectClaimSchedules)
		.orderBy(
			asc(projectClaimSchedules.projectName),
			asc(projectClaimSchedules.sortOrder),
		);
}

export async function upsertClaimScheduleAdmin(input: {
	id?: string;
	projectName: string;
	claimStage: string;
	percentPayable: number;
	sortOrder: number;
}) {
	if (input.id) {
		const [u] = await db
			.update(projectClaimSchedules)
			.set({
				projectName: input.projectName,
				claimStage: input.claimStage,
				percentPayable: dec(input.percentPayable),
				sortOrder: input.sortOrder,
				updatedAt: new Date(),
			})
			.where(eq(projectClaimSchedules.id, input.id))
			.returning();
		return u;
	}
	const [ins] = await db
		.insert(projectClaimSchedules)
		.values({
			projectName: input.projectName,
			claimStage: input.claimStage,
			percentPayable: dec(input.percentPayable),
			sortOrder: input.sortOrder,
		})
		.returning();
	return ins;
}

export async function deleteClaimScheduleAdmin(id: string) {
	await db.delete(projectClaimSchedules).where(eq(projectClaimSchedules.id, id));
	return { ok: true as const };
}
