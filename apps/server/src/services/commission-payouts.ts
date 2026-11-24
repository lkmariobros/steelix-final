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
	commissionPayoutPayments,
	commissionPayouts,
	leadershipBonusPaymentItems,
	projectClaimSchedules,
} from "../models/commission-payouts";
import { leadershipBonusPayments, user } from "../models/auth";
import { transactions } from "../models/transactions";
import { calculateSchemeCommission } from "./commission-schemes";
import {
	PRIMARY_OVERRIDE_LAYERS,
	recordSecondaryLeadershipBonus,
	resolvePrimaryOverridePayees,
	type PrimaryOverrideLayerSnapshot,
} from "./commission-calculation";
import { resolveOverrideLayerRates } from "./commission-schemes";
import { cancelLeadershipBonusForTransaction } from "./leadership-bonus";
import { db } from "../utils/db";

type TxRow = typeof transactions.$inferSelect;

export type FinanceMarketSegment = "new_project" | "subsale" | "rental";

function dec(n: number) {
	return n.toFixed(2);
}

function round2(n: number) {
	return Math.round(n * 100) / 100;
}

function segmentSql(segment?: FinanceMarketSegment) {
	if (!segment) return undefined;
	if (segment === "new_project") {
		return eq(transactions.marketType, "primary");
	}
	if (segment === "subsale") {
		return and(
			eq(transactions.marketType, "secondary"),
			or(
				eq(transactions.transactionType, "sale"),
				sql`${transactions.transactionType} is null`,
			)!,
		);
	}
	return and(
		eq(transactions.marketType, "secondary"),
		or(
			eq(transactions.transactionType, "rental"),
			eq(transactions.transactionType, "lease"),
		)!,
	);
}

type ShareRow = {
	payeeAgentId: string | null;
	sharePercent: number;
	shareLabel: string;
	isCompanyShare: boolean;
	nettShare: number;
	gross: number;
	sst: number;
	net: number;
	commissionPercent: number;
};

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

function resolveCoAgentShares(tx: TxRow): Array<{
	agentId: string | null;
	label: string;
	percent: number;
	isCompany: boolean;
}> {
	const co = tx.coBrokingData as {
		agents?: Array<{
			internalAgentId?: string;
			agentName?: string;
			commissionSplit?: number;
		}>;
		internalAgentId?: string;
		agentName?: string;
		commissionSplit?: number;
	} | null;

	const agents = co?.agents?.length
		? co.agents
		: co?.commissionSplit != null || co?.internalAgentId || co?.agentName
			? [
					{
						internalAgentId: co.internalAgentId,
						agentName: co.agentName,
						commissionSplit: co.commissionSplit,
					},
				]
			: [];

	const shares: Array<{
		agentId: string | null;
		label: string;
		percent: number;
		isCompany: boolean;
	}> = [];

	if (agents.length === 0) {
		shares.push({
			agentId: tx.agentId,
			label: "Transaction agent",
			percent: 100,
			isCompany: false,
		});
		return shares;
	}

	// Case agent share = remainder after listed co-agents (unless case agent already listed)
	let listed = 0;
	let caseAgentListed = false;
	for (const a of agents) {
		const pct = Number(a.commissionSplit) || 0;
		if (pct <= 0) continue;
		listed += pct;
		const id = a.internalAgentId ?? null;
		if (id && id === tx.agentId) caseAgentListed = true;
		shares.push({
			agentId: id,
			label: a.agentName?.trim() || "Co-agent",
			percent: pct,
			isCompany: false,
		});
	}

	if (!caseAgentListed) {
		const casePct = Math.max(0, round2(100 - listed));
		if (casePct > 0) {
			shares.unshift({
				agentId: tx.agentId,
				label: "Transaction agent",
				percent: casePct,
				isCompany: false,
			});
			listed += casePct;
		}
	}

	const companyPct = Math.max(0, round2(100 - listed));
	if (companyPct > 0.001) {
		shares.push({
			agentId: null,
			label: "Devots",
			percent: companyPct,
			isCompany: true,
		});
	}

	return shares;
}

function applySstToShare(opts: {
	gross: number;
	sstPercent: number;
	sstPayBy: "client" | "landlord" | "agent" | string | undefined;
	isCompanyShare: boolean;
	sstBearDeduction: number;
}): { sst: number; net: number } {
	const payBy = opts.sstPayBy ?? "client";
	if (opts.isCompanyShare) {
		return { sst: 0, net: round2(opts.gross) };
	}
	if (payBy === "client" || payBy === "landlord") {
		return { sst: 0, net: round2(opts.gross) };
	}
	const sst = round2(opts.gross * (opts.sstPercent / 100));
	const net = round2(Math.max(0, opts.gross - sst - opts.sstBearDeduction));
	return { sst, net };
}

/**
 * Creates payout rows when a transaction is Verified or Converted.
 * Explodes co-agent + Devots company share rows. Idempotent per transaction.
 */
export async function ensurePayoutsForApprovedTransaction(tx: TxRow) {
	const status = String(tx.status ?? "").toLowerCase();
	if (
		status !== "approved" &&
		status !== "verified" &&
		status !== "converted"
	) {
		return [];
	}

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
		immediateUplineOverridePercent?: number;
		teamManagerOverridePercent?: number;
		groupManagerOverridePercent?: number;
		directorOverridePercent?: number;
		overrideLayers?: PrimaryOverrideLayerSnapshot[];
		incSst?: boolean;
		sstPercent?: number;
		sstBorneBy?: "client" | "agent";
	} | null;

	const prop = tx.propertyData as {
		spaPrice?: number;
		nettPrice?: number;
		price?: number;
		listingTitle?: string;
		sstPayBy?: "client" | "landlord" | "agent";
		sstPercent?: number;
		sstBearTransactionAgent?: number;
		sstBearCoBrokeAgent?: number;
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
	const isPrimary = !isSecondary;

	const incSst = schemeSnap?.incSst ?? false;
	const sstPct =
		Number(prop?.sstPercent ?? schemeSnap?.sstPercent ?? (isSecondary ? 8 : 0)) ||
		0;
	const sstBorne =
		prop?.sstPayBy ??
		schemeSnap?.sstBorneBy ??
		(isSecondary ? "client" : "agent");

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
			sstBorneBy: sstBorne === "landlord" ? "client" : sstBorne,
		});
		grossN = calc.grossCommission;
		sstN = calc.sstAmount;
		netN = calc.agentNetCommission;
		pctN = tierPct;
	}

	const existing = await db
		.select({ id: commissionPayouts.id })
		.from(commissionPayouts)
		.where(eq(commissionPayouts.transactionId, tx.id))
		.limit(1);

	const created: (typeof commissionPayouts.$inferSelect)[] = [];

	if (existing.length === 0) {
		const nowIso = new Date().toISOString();
		const baseAudit: PayoutAuditEntry = {
			at: nowIso,
			byUserId: "system",
			action: "created_from_transaction_approval",
			notes: "Commission payout created when transaction was verified/converted",
		};

		const blockLabel =
			schemeSnap?.blockListingTitle ?? prop?.listingTitle ?? null;

		const shares = resolveCoAgentShares(tx);
		const totalCommissionBase = isSecondary
			? Number(tx.commissionAmount) || grossN || nett
			: nett;
		const dealRatePct = isSecondary ? pctN : pctN;
		const bearTx = Number(prop?.sstBearTransactionAgent ?? 0) || 0;
		const bearCo = Number(prop?.sstBearCoBrokeAgent ?? 0) || 0;

		const shareRows: ShareRow[] = [];
		for (const share of shares) {
			const nettShare = round2(totalCommissionBase * (share.percent / 100));
			let gross: number;
			let commissionPercent = dealRatePct;

			if (isPrimary) {
				// Sample: nett share × scheme %
				const calc = calculateSchemeCommission({
					nettPrice: nettShare,
					commissionPercent: dealRatePct || (schemeSnap?.commissionPercent ?? 0),
					incSst,
					sstPercent: sstPct,
					sstBorneBy: sstBorne === "landlord" ? "client" : sstBorne,
				});
				gross = calc.grossCommission;
				commissionPercent = dealRatePct || (schemeSnap?.commissionPercent ?? 0);
				const sstPayBy =
					sstBorne === "client" || share.isCompany ? "client" : sstBorne;
				const { sst, net } = applySstToShare({
					gross: share.isCompany ? nettShare * (commissionPercent / 100) : gross,
					sstPercent: sstPct,
					sstPayBy,
					isCompanyShare: share.isCompany,
					sstBearDeduction: 0,
				});
				// For primary company row use gross from % of nett share without agent SST rules
				if (share.isCompany) {
					const companyGross = round2(nettShare * (commissionPercent / 100));
					shareRows.push({
						payeeAgentId: null,
						sharePercent: share.percent,
						shareLabel: share.label,
						isCompanyShare: true,
						nettShare,
						gross: companyGross,
						sst: 0,
						net: companyGross,
						commissionPercent,
					});
				} else {
					shareRows.push({
						payeeAgentId: share.agentId,
						sharePercent: share.percent,
						shareLabel: share.label,
						isCompanyShare: false,
						nettShare,
						gross,
						sst,
						net,
						commissionPercent,
					});
				}
			} else {
				// Subsale/Rental: Total commission × deal rate × tier% already in agentNet;
				// for exploded rows scale by share of remaining after co-broke.
				gross = round2(
					(breakdown?.agentNetCommission != null
						? Number(breakdown.agentNetCommission) +
							Number(breakdown.companyShare ?? 0)
						: totalCommissionBase * (dealRatePct / 100)) *
						(share.percent / 100),
				);
				if (share.isCompany) {
					gross = round2(Number(breakdown?.companyShare ?? gross));
				} else if (
					breakdown?.agentNetCommission != null &&
					!share.isCompany &&
					shares.filter((s) => !s.isCompany).length === 1
				) {
					gross = round2(Number(breakdown.agentNetCommission));
				}

				const isCaseAgent =
					share.agentId === tx.agentId || share.label === "Transaction agent";
				const bearDeduction =
					sstBorne === "agent" ? (isCaseAgent ? bearTx : bearCo) : 0;
				const { sst, net } = applySstToShare({
					gross,
					sstPercent: sstPct,
					sstPayBy: sstBorne,
					isCompanyShare: share.isCompany,
					sstBearDeduction: bearDeduction,
				});
				shareRows.push({
					payeeAgentId: share.agentId,
					sharePercent: share.percent,
					shareLabel: share.label,
					isCompanyShare: share.isCompany,
					nettShare: round2(totalCommissionBase * (share.percent / 100)),
					gross,
					sst,
					net,
					commissionPercent: dealRatePct,
				});
			}
		}

		// Fallback: if share resolution produced nothing usable, keep legacy single row
		if (shareRows.length === 0) {
			shareRows.push({
				payeeAgentId: tx.agentId,
				sharePercent: 100,
				shareLabel: "Transaction agent",
				isCompanyShare: false,
				nettShare: nett,
				gross: grossN,
				sst: sstBorne === "client" || sstBorne === "landlord" ? 0 : sstN,
				net:
					sstBorne === "client" || sstBorne === "landlord"
						? round2(grossN)
						: netN,
				commissionPercent: pctN,
			});
		}

		for (const row of shareRows) {
			if (!row.isCompanyShare && !row.payeeAgentId) continue;
			const [inserted] = await db
				.insert(commissionPayouts)
				.values({
					transactionId: tx.id,
					payeeAgentId: row.isCompanyShare ? null : row.payeeAgentId,
					payoutType: "negotiator",
					status: "pending_approval",
					caseNo: tx.caseNo ?? null,
					projectName: tx.projectName ?? schemeSnap?.projectName ?? null,
					blockLabel,
					unitNo: tx.unitNo ?? null,
					bookingDate: tx.bookingDate ?? tx.transactionDate,
					spaPrice: dec(spa),
					nettPrice: dec(row.nettShare),
					commissionPercent: dec(row.commissionPercent),
					grossCommission: dec(row.gross),
					sstAmount: dec(row.sst),
					netCommission: dec(row.net),
					sharePercent: dec(row.sharePercent),
					shareLabel: row.shareLabel,
					isCompanyShare: row.isCompanyShare,
					paidAmount: "0",
					commissionSchemeSnapshot: schemeSnap,
					claimStageLabel: claim?.claimStage ?? null,
					claimStagePercent: claim ? dec(Number(claim.percentPayable)) : null,
					auditLog: [
						{
							...baseAudit,
							notes: row.isCompanyShare
								? `Devots company share (${row.sharePercent}%) — tracking only`
								: `${row.shareLabel} share (${row.sharePercent}%)`,
						},
					],
				})
				.returning();
			created.push(inserted);
		}

		if (isPrimary) {
			const rates = resolveOverrideLayerRates({
				overridePercent: schemeSnap?.overridePercent,
				immediateUplineOverridePercent:
					schemeSnap?.immediateUplineOverridePercent,
				teamManagerOverridePercent: schemeSnap?.teamManagerOverridePercent,
				groupManagerOverridePercent: schemeSnap?.groupManagerOverridePercent,
				directorOverridePercent: schemeSnap?.directorOverridePercent,
			});

			const snapLayers = schemeSnap?.overrideLayers;
			const payees =
				snapLayers && snapLayers.length > 0
					? snapLayers.map((l) =>
							l.payeeAgentId
								? { agentId: l.payeeAgentId, name: l.payeeName ?? "" }
								: null,
						)
					: await resolvePrimaryOverridePayees(
							tx.agentId,
							tx.teamLeaderAgentId,
						);

			for (let i = 0; i < PRIMARY_OVERRIDE_LAYERS.length; i++) {
				const meta = PRIMARY_OVERRIDE_LAYERS[i];
				const percent = rates[meta.rateKey];
				const payee = payees[i] ?? null;
				if (percent <= 0 || !payee?.agentId) continue;

				const oCalc = calculateSchemeCommission({
					nettPrice: nett,
					commissionPercent: percent,
					incSst,
					sstPercent: sstPct,
					sstBorneBy: sstBorne === "landlord" ? "client" : sstBorne,
				});
				const [overrideRow] = await db
					.insert(commissionPayouts)
					.values({
						transactionId: tx.id,
						payeeAgentId: payee.agentId,
						payoutType: "override",
						status: "pending_approval",
						caseNo: tx.caseNo ?? null,
						projectName: tx.projectName ?? schemeSnap?.projectName ?? null,
						blockLabel,
						unitNo: tx.unitNo ?? null,
						bookingDate: tx.bookingDate ?? tx.transactionDate,
						spaPrice: dec(spa),
						nettPrice: dec(nett),
						commissionPercent: dec(percent),
						grossCommission: dec(oCalc.grossCommission),
						sstAmount: dec(oCalc.sstAmount),
						netCommission: dec(oCalc.agentNetCommission),
						shareLabel: meta.label,
						isCompanyShare: false,
						paidAmount: "0",
						commissionSchemeSnapshot: schemeSnap,
						claimStageLabel: claim?.claimStage ?? null,
						claimStagePercent: claim
							? dec(Number(claim.percentPayable))
							: null,
						auditLog: [
							{
								...baseAudit,
								notes: `${meta.label} override (${percent}%) — paid separately; not deducted from agent`,
							},
						],
					})
					.returning();
				created.push(overrideRow);
			}
		}
	}

	// Leadership Bonus: New Project only (never Subsale/Rental).
	if (
		(status === "verified" || status === "converted" || status === "approved") &&
		isPrimary
	) {
		try {
			const agentRows = await db
				.select()
				.from(commissionPayouts)
				.where(
					and(
						eq(commissionPayouts.transactionId, tx.id),
						eq(commissionPayouts.isCompanyShare, false),
						eq(commissionPayouts.payoutType, "negotiator"),
					),
				);
			const targets =
				agentRows.length > 0
					? agentRows
					: [
							{
								payeeAgentId: tx.agentId,
								netCommission: String(netN),
								grossCommission: String(grossN),
							},
						];

			for (const row of targets) {
				if (!row.payeeAgentId) continue;
				const agentNet = Number(row.netCommission);
				if (agentNet <= 0) continue;
				await recordSecondaryLeadershipBonus(
					{ ...tx, agentId: row.payeeAgentId },
					{
						marketType: "primary",
						grossCommission: Number(row.grossCommission ?? agentNet),
						agentNetCommission: agentNet,
						agentSharePercent: 100,
						companyShare: breakdown?.companyShare,
						leadershipBonus: breakdown?.leadershipBonus,
					},
				);
			}
		} catch (e) {
			console.warn(
				"[ensurePayouts] leadership bonus record failed:",
				tx.caseNo ?? tx.id,
				e instanceof Error ? e.message : e,
			);
		}
	}

	return created;
}

export type PayoutListFilters = {
	search?: string;
	agentId?: string;
	projectName?: string;
	status?: (typeof commissionPayouts.$inferSelect)["status"];
	statuses?: Array<(typeof commissionPayouts.$inferSelect)["status"]>;
	segment?: FinanceMarketSegment;
	dateFrom?: Date;
	dateTo?: Date;
	limit: number;
	offset: number;
};

export async function listCommissionPayoutsAdmin(opts: PayoutListFilters) {
	const cond: any[] = [];
	if (opts.status) cond.push(eq(commissionPayouts.status, opts.status));
	if (opts.statuses?.length)
		cond.push(inArray(commissionPayouts.status, opts.statuses));
	if (opts.agentId) cond.push(eq(commissionPayouts.payeeAgentId, opts.agentId));
	if (opts.projectName)
		cond.push(eq(commissionPayouts.projectName, opts.projectName));
	if (opts.dateFrom)
		cond.push(gte(commissionPayouts.bookingDate, opts.dateFrom));
	if (opts.dateTo) cond.push(lte(commissionPayouts.bookingDate, opts.dateTo));
	const seg = segmentSql(opts.segment);
	if (seg) cond.push(seg);
	if (opts.search?.trim()) {
		const q = `%${opts.search.trim()}%`;
		cond.push(
			or(
				ilike(commissionPayouts.caseNo, q),
				ilike(user.name, q),
				ilike(commissionPayouts.projectName, q),
				ilike(commissionPayouts.unitNo, q),
				ilike(commissionPayouts.shareLabel, q),
				sql`${transactions.propertyData}->>'address' ilike ${q}`,
			)!,
		);
	}

	const whereClause = cond.length ? and(...cond) : undefined;

	const rows = await db
		.select({
			payout: commissionPayouts,
			agentName: user.name,
			agentNickName: user.nickName,
			agentCode: user.agentCode,
			marketType: transactions.marketType,
			transactionType: transactions.transactionType,
			propertyAddress: sql<string | null>`${transactions.propertyData}->>'address'`,
			verifiedDate: transactions.updatedAt,
		})
		.from(commissionPayouts)
		.leftJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.leftJoin(transactions, eq(commissionPayouts.transactionId, transactions.id))
		.where(whereClause)
		.orderBy(desc(commissionPayouts.updatedAt))
		.limit(opts.limit)
		.offset(opts.offset);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(commissionPayouts)
		.leftJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.leftJoin(transactions, eq(commissionPayouts.transactionId, transactions.id))
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
		.leftJoin(user, eq(commissionPayouts.payeeAgentId, user.id))
		.where(eq(commissionPayouts.id, id))
		.limit(1);
	return row ?? null;
}

export async function listPayoutPayments(payoutId: string) {
	return db
		.select()
		.from(commissionPayoutPayments)
		.where(eq(commissionPayoutPayments.payoutId, payoutId))
		.orderBy(desc(commissionPayoutPayments.paymentDate));
}

export async function summarizePayoutTotalsAdmin(filters: {
	agentId?: string;
	projectName?: string;
	dateFrom?: Date;
	dateTo?: Date;
	segment?: FinanceMarketSegment;
}) {
	const cond: any[] = [ne(commissionPayouts.status, "voided")];
	if (filters.agentId) cond.push(eq(commissionPayouts.payeeAgentId, filters.agentId));
	if (filters.projectName)
		cond.push(eq(commissionPayouts.projectName, filters.projectName));
	if (filters.dateFrom)
		cond.push(gte(commissionPayouts.bookingDate, filters.dateFrom));
	if (filters.dateTo) cond.push(lte(commissionPayouts.bookingDate, filters.dateTo));
	const seg = segmentSql(filters.segment);
	if (seg) cond.push(seg);
	const w = and(...cond);

	const sumNetForStatuses = async (statuses: string[]) => {
		const [{ v }] = await db
			.select({
				v: sum(sql`CAST(${commissionPayouts.netCommission} AS DECIMAL)`),
			})
			.from(commissionPayouts)
			.leftJoin(transactions, eq(commissionPayouts.transactionId, transactions.id))
			.where(and(w, inArray(commissionPayouts.status, statuses as any)));
		return Number(v ?? 0);
	};

	const pending = await sumNetForStatuses(["pending_approval", "on_hold"]);
	const approvedOnly = await sumNetForStatuses(["approved", "released", "paid"]);
	const cancelled = await sumNetForStatuses(["cancelled"]);
	const totalCommission = pending + approvedOnly + cancelled;

	return {
		pendingRm: pending,
		approvedRm: approvedOnly,
		cancelledRm: cancelled,
		totalCommissionRm: totalCommission,
		/** @deprecated use cancelledRm */
		releasedRm: cancelled,
		/** @deprecated use totalCommissionRm */
		paidRm: totalCommission,
	};
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

/**
 * Case revoke: recall unpaid/paid commission payouts + cancel leadership bonus.
 */
export async function recallPayoutsOnCaseRevoke(opts: {
	transactionId: string;
	adminId: string;
	adminName?: string;
}) {
	const now = new Date();
	const rows = await db
		.select()
		.from(commissionPayouts)
		.where(eq(commissionPayouts.transactionId, opts.transactionId));

	let voided = 0;
	for (const row of rows) {
		if (row.status === "voided") continue;
		const audit = appendAudit(row.auditLog, {
			at: now.toISOString(),
			byUserId: opts.adminId,
			byName: opts.adminName,
			action: "voided",
			notes: "Case revoked — commission recalled",
		});
		await db
			.update(commissionPayouts)
			.set({
				status: "voided",
				auditLog: audit,
				updatedAt: now,
			})
			.where(eq(commissionPayouts.id, row.id));
		voided += 1;
	}

	const cancelledLb = await cancelLeadershipBonusForTransaction(
		opts.transactionId,
	);
	return { voidedPayouts: voided, cancelledLeadershipBonus: cancelledLb };
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

/** Reject on Approval → Cancelled (final unless case returns to Verified/Converted). */
export async function cancelPayoutAdmin(opts: {
	id: string;
	adminId: string;
	adminName?: string;
	reason?: string;
}) {
	const row = await getCommissionPayoutById(opts.id);
	if (!row) throw new Error("Payout not found");
	if (row.payout.status !== "pending_approval" && row.payout.status !== "on_hold") {
		throw new Error("Only pending commissions can be rejected");
	}
	// Company share may be cancelled for tracking status (payments remain disallowed).
	const now = new Date();
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "cancelled",
		notes: opts.reason ?? "Rejected on Commissions Approval",
	});
	const [updated] = await db
		.update(commissionPayouts)
		.set({
			status: "cancelled",
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.id))
		.returning();
	return updated;
}

export async function addPayoutPaymentAdmin(opts: {
	payoutId: string;
	adminId: string;
	adminName?: string;
	paymentDate: Date;
	amount: number;
	receiptUrl?: string;
	note?: string;
}) {
	const row = await getCommissionPayoutById(opts.payoutId);
	if (!row) throw new Error("Payout not found");
	if (row.payout.isCompanyShare || !row.payout.payeeAgentId) {
		throw new Error("Company share has no payee — payments not allowed");
	}
	if (
		row.payout.status !== "approved" &&
		row.payout.status !== "released" &&
		row.payout.status !== "paid"
	) {
		throw new Error("Only approved commissions can receive payments");
	}

	const net = Number(row.payout.netCommission);
	const paidSoFar = Number(row.payout.paidAmount ?? 0);
	const outstanding = round2(Math.max(0, net - paidSoFar));
	const amount = round2(opts.amount);
	if (amount <= 0) throw new Error("Amount must be positive");
	if (amount > outstanding + 0.001) {
		throw new Error(`Payment may not exceed outstanding (${outstanding.toFixed(2)})`);
	}

	const now = new Date();
	const [payment] = await db
		.insert(commissionPayoutPayments)
		.values({
			payoutId: opts.payoutId,
			paymentDate: opts.paymentDate,
			amount: dec(amount),
			receiptUrl: opts.receiptUrl?.trim() || null,
			note: opts.note ?? null,
			createdBy: opts.adminId,
		})
		.returning();

	const newPaid = round2(paidSoFar + amount);
	const fullyPaid = newPaid >= net - 0.001;
	const audit = appendAudit(row.payout.auditLog, {
		at: now.toISOString(),
		byUserId: opts.adminId,
		byName: opts.adminName,
		action: "payment_added",
		notes: `Payment RM ${amount.toFixed(2)}${opts.receiptUrl ? " (receipt uploaded)" : ""}`,
	});

	const [updated] = await db
		.update(commissionPayouts)
		.set({
			paidAmount: dec(newPaid),
			status: fullyPaid ? "paid" : row.payout.status === "paid" ? "approved" : row.payout.status,
			paymentDate: opts.paymentDate,
			paymentReceiptUrl: opts.receiptUrl?.trim() || row.payout.paymentReceiptUrl,
			paidConfirmedBy: fullyPaid ? opts.adminId : row.payout.paidConfirmedBy,
			paidConfirmedAt: fullyPaid ? now : row.payout.paidConfirmedAt,
			auditLog: audit,
			updatedAt: now,
		})
		.where(eq(commissionPayouts.id, opts.payoutId))
		.returning();

	return {
		payment,
		payout: updated,
		paidAmount: newPaid,
		outstandingAmount: round2(Math.max(0, net - newPaid)),
	};
}

export async function approveLeadershipBonusAdmin(paymentId: string) {
	const [updated] = await db
		.update(leadershipBonusPayments)
		.set({ status: "approved", updatedAt: new Date() })
		.where(
			and(
				eq(leadershipBonusPayments.id, paymentId),
				eq(leadershipBonusPayments.status, "pending"),
			),
		)
		.returning();
	if (!updated) throw new Error("Leadership bonus not found or not pending");
	return updated;
}

export async function cancelLeadershipBonusAdmin(paymentId: string) {
	const [updated] = await db
		.update(leadershipBonusPayments)
		.set({ status: "cancelled", updatedAt: new Date() })
		.where(
			and(
				eq(leadershipBonusPayments.id, paymentId),
				inArray(leadershipBonusPayments.status, ["pending", "approved"]),
			),
		)
		.returning();
	if (!updated) throw new Error("Leadership bonus not found or cannot cancel");
	return updated;
}

export async function addLeadershipBonusPaymentAdmin(opts: {
	paymentId: string;
	adminId: string;
	paymentDate: Date;
	amount: number;
	receiptUrl?: string;
	note?: string;
}) {
	const [row] = await db
		.select()
		.from(leadershipBonusPayments)
		.where(eq(leadershipBonusPayments.id, opts.paymentId))
		.limit(1);
	if (!row) throw new Error("Leadership bonus not found");
	if (row.status !== "approved" && row.status !== "paid") {
		throw new Error("Approve leadership bonus before adding payments");
	}

	const net = Number(row.leadershipBonusAmount);
	const paidSoFar = Number(row.paidAmount ?? 0);
	const outstanding = round2(Math.max(0, net - paidSoFar));
	const amount = round2(opts.amount);
	if (amount <= 0) throw new Error("Amount must be positive");
	if (amount > outstanding + 0.001) {
		throw new Error(`Payment may not exceed outstanding (${outstanding.toFixed(2)})`);
	}

	const [item] = await db
		.insert(leadershipBonusPaymentItems)
		.values({
			leadershipBonusPaymentId: opts.paymentId,
			paymentDate: opts.paymentDate,
			amount: dec(amount),
			receiptUrl: opts.receiptUrl?.trim() || null,
			note: opts.note ?? null,
			createdBy: opts.adminId,
		})
		.returning();

	const newPaid = round2(paidSoFar + amount);
	const fullyPaid = newPaid >= net - 0.001;
	const [updated] = await db
		.update(leadershipBonusPayments)
		.set({
			paidAmount: dec(newPaid),
			status: fullyPaid ? "paid" : "approved",
			paidAt: fullyPaid ? new Date() : row.paidAt,
			updatedAt: new Date(),
		})
		.where(eq(leadershipBonusPayments.id, opts.paymentId))
		.returning();

	return {
		item,
		payment: updated,
		paidAmount: newPaid,
		outstandingAmount: round2(Math.max(0, net - newPaid)),
	};
}

export async function listLeadershipBonusPaymentItems(paymentId: string) {
	return db
		.select()
		.from(leadershipBonusPaymentItems)
		.where(eq(leadershipBonusPaymentItems.leadershipBonusPaymentId, paymentId))
		.orderBy(desc(leadershipBonusPaymentItems.paymentDate));
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
