/**
 * Leadership bonus — Elson rules (9 Nov 2026 + confirmed 10 Nov 2026).
 *
 * Base: agent receivable commission on the case.
 * Rates: per-tier own rates from admin config (year-to-year editable).
 * Allocation: seller → direct upline chain; each person claims unclaimed tiers
 * up to their rank (cumulative ceilings). Each tier once per case.
 * Rounding: nearest sen, half-up.
 * Timing: record on admin verify/approval (same path as commission payouts).
 * Revoke: cancel pending/paid leadership bonus rows for the case.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import {
	type AgentTier,
	leadershipBonusPayments,
	user,
} from "../models/auth";
import type { transactions } from "../models/transactions";
import { db } from "../utils/db";
import { resolveTierConfig } from "./tier-config";

type TxRow = typeof transactions.$inferSelect;

export const LEADERSHIP_RANK_ORDER: AgentTier[] = [
	"advisor",
	"sales_leader",
	"team_leader",
	"group_leader",
	"supreme_leader",
];

export type LeadershipChainNode = {
	agentId: string;
	tier: AgentTier;
	rank: number;
};

export type LeadershipAllocation = {
	agentId: string;
	tier: AgentTier;
	rank: number;
	/** Effective % of base this person receives (e.g. 14 for SL+TL). */
	effectiveRatePercent: number;
	amountSen: number;
	amountRm: number;
	claimedFromRank: number;
	claimedToRank: number;
};

export type LeadershipCalculationResult = {
	baseSen: number;
	baseRm: number;
	/** Own-tier rates in % for ranks 1..4 (SL, TL, GL, SU). */
	ownTierPercents: number[];
	/** Cumulative ceilings in % for ranks 0..4. */
	cumulativePercents: number[];
	allocations: LeadershipAllocation[];
	allocatedSen: number;
	unclaimedSen: number;
};

/** Half-up to nearest integer sen (non-negative). */
export function roundToSen(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.round(value);
}

export function rmToSen(rm: number): number {
	if (!Number.isFinite(rm) || rm <= 0) return 0;
	return roundToSen(rm * 100);
}

export function senToRm(sen: number): number {
	return Math.round(sen) / 100;
}

export function tierRank(tier: AgentTier | string | null | undefined): number {
	const idx = LEADERSHIP_RANK_ORDER.indexOf(
		(tier ?? "advisor") as AgentTier,
	);
	return idx >= 0 ? idx : 0;
}

/**
 * Build cumulative % ceilings from own-tier rates.
 * ownTierPercents[0]=SL, [1]=TL, [2]=GL, [3]=SU
 * returns length 5: [0, SL, SL+TL, …]
 */
export function buildCumulativePercents(ownTierPercents: number[]): number[] {
	const own = [
		Number(ownTierPercents[0]) || 0,
		Number(ownTierPercents[1]) || 0,
		Number(ownTierPercents[2]) || 0,
		Number(ownTierPercents[3]) || 0,
	];
	const out = [0];
	let sum = 0;
	for (const p of own) {
		sum += p;
		out.push(sum);
	}
	return out;
}

/**
 * Pure allocation over an ordered chain (seller first).
 * Matches Elson guide: current rate = max(0, cum[rank] - cum[highestClaimed]).
 */
export function allocateLeadershipBonus(
	baseRm: number,
	chain: Array<{ agentId: string; tier: AgentTier }>,
	ownTierPercents: number[],
): LeadershipCalculationResult {
	const baseSen = rmToSen(baseRm);
	const cumulativePercents = buildCumulativePercents(ownTierPercents);
	const cumulativeBps = cumulativePercents.map((p) => roundToSen(p * 100));

	const targetSen = (rank: number) => {
		const r = Math.max(0, Math.min(4, rank));
		if (baseSen <= 0) return 0;
		return roundToSen((baseSen * cumulativeBps[r]) / 10_000);
	};

	const allocations: LeadershipAllocation[] = [];
	let highest = 0;

	for (const node of chain) {
		const rank = tierRank(node.tier);
		if (rank <= highest) {
			allocations.push({
				agentId: node.agentId,
				tier: node.tier,
				rank,
				effectiveRatePercent: 0,
				amountSen: 0,
				amountRm: 0,
				claimedFromRank: highest,
				claimedToRank: highest,
			});
			continue;
		}

		const amountSen = targetSen(rank) - targetSen(highest);
		const claimedFrom = highest;
		const effectiveRatePercent =
			Math.round((cumulativePercents[rank] - cumulativePercents[highest]) * 100) /
			100;

		allocations.push({
			agentId: node.agentId,
			tier: node.tier,
			rank,
			effectiveRatePercent,
			amountSen,
			amountRm: senToRm(amountSen),
			claimedFromRank: claimedFrom,
			claimedToRank: rank,
		});
		highest = rank;
	}

	const allocatedSen = targetSen(highest);
	const unclaimedSen = targetSen(4) - allocatedSen;

	return {
		baseSen,
		baseRm: senToRm(baseSen),
		ownTierPercents: [
			Number(ownTierPercents[0]) || 0,
			Number(ownTierPercents[1]) || 0,
			Number(ownTierPercents[2]) || 0,
			Number(ownTierPercents[3]) || 0,
		],
		cumulativePercents,
		allocations,
		allocatedSen,
		unclaimedSen,
	};
}

/** Load own-tier % from admin config (flexible year to year). */
export async function loadOwnTierPercents(): Promise<number[]> {
	const tiers: AgentTier[] = [
		"sales_leader",
		"team_leader",
		"group_leader",
		"supreme_leader",
	];
	const rates: number[] = [];
	for (const t of tiers) {
		const cfg = await resolveTierConfig(t);
		rates.push(Number(cfg.leadershipBonusRate) || 0);
	}
	return rates;
}

/**
 * Walk seller → recruiter → … (direct chain only). Detects cycles.
 */
export async function getLeadershipChain(
	sellerAgentId: string,
): Promise<LeadershipChainNode[]> {
	const chain: LeadershipChainNode[] = [];
	const seen = new Set<string>();
	let currentId: string | null = sellerAgentId;

	while (currentId) {
		if (seen.has(currentId)) {
			throw new Error(
				`Leadership hierarchy cycle detected at agent ${currentId}`,
			);
		}
		seen.add(currentId);

		const [row] = await db
			.select({
				id: user.id,
				agentTier: user.agentTier,
				recruitedBy: user.recruitedBy,
			})
			.from(user)
			.where(eq(user.id, currentId))
			.limit(1);

		if (!row) {
			throw new Error(`Leadership hierarchy lookup failed for ${currentId}`);
		}

		const tier = (row.agentTier ?? "advisor") as AgentTier;
		chain.push({
			agentId: row.id,
			tier,
			rank: tierRank(tier),
		});

		currentId = row.recruitedBy ?? null;
	}

	return chain;
}

/**
 * Agent receivable commission = what the selling agent earns on the case.
 */
export function resolveAgentReceivableCommission(
	tx: TxRow,
	breakdown?: {
		agentNetCommission?: number;
		agentEarnings?: number;
		grossCommission?: number;
		agentSharePercent?: number;
	} | null,
): number {
	const fromBreakdown =
		breakdown?.agentNetCommission ?? breakdown?.agentEarnings;
	if (typeof fromBreakdown === "number" && Number.isFinite(fromBreakdown) && fromBreakdown > 0) {
		return Math.round(fromBreakdown * 100) / 100;
	}

	const gross =
		breakdown?.grossCommission ??
		Number(tx.commissionAmount ?? 0);
	const sharePct = breakdown?.agentSharePercent;
	if (
		typeof sharePct === "number" &&
		Number.isFinite(sharePct) &&
		sharePct > 0 &&
		gross > 0
	) {
		return Math.round(gross * (sharePct / 100) * 100) / 100;
	}

	const amount = Number(tx.commissionAmount ?? 0);
	return Number.isFinite(amount) && amount > 0
		? Math.round(amount * 100) / 100
		: 0;
}

export async function calculateLeadershipBonusForSeller(
	sellerAgentId: string,
	agentReceivableRm: number,
): Promise<LeadershipCalculationResult> {
	const [ownTierPercents, chain] = await Promise.all([
		loadOwnTierPercents(),
		getLeadershipChain(sellerAgentId),
	]);
	return allocateLeadershipBonus(
		agentReceivableRm,
		chain.map((n) => ({ agentId: n.agentId, tier: n.tier })),
		ownTierPercents,
	);
}

/**
 * Idempotent: if any non-cancelled LB rows exist for this case, skip.
 * Creates one payment row per positive recipient.
 */
export async function recordLeadershipBonusForTransaction(
	tx: TxRow,
	breakdown?: {
		agentNetCommission?: number;
		agentEarnings?: number;
		grossCommission?: number;
		agentSharePercent?: number;
	} | null,
): Promise<LeadershipCalculationResult | null> {
	if (!tx.agentId) return null;

	const [existing] = await db
		.select({ id: leadershipBonusPayments.id })
		.from(leadershipBonusPayments)
		.where(
			and(
				eq(leadershipBonusPayments.transactionId, tx.id),
				ne(leadershipBonusPayments.status, "cancelled"),
			),
		)
		.limit(1);
	if (existing) return null;

	const baseRm = resolveAgentReceivableCommission(tx, breakdown);
	if (baseRm <= 0) return null;

	const result = await calculateLeadershipBonusForSeller(tx.agentId, baseRm);
	const positive = result.allocations.filter((a) => a.amountSen > 0);
	if (positive.length === 0) return result;

	for (const alloc of positive) {
		await db.insert(leadershipBonusPayments).values({
			transactionId: tx.id,
			downlineAgentId: tx.agentId,
			uplineAgentId: alloc.agentId,
			uplineTier: alloc.tier,
			// original = agent receivable base; companyShare column reused as base snapshot
			originalCommissionAmount: result.baseRm.toFixed(2),
			companyShareAmount: result.baseRm.toFixed(2),
			leadershipBonusRate: Math.round(alloc.effectiveRatePercent),
			leadershipBonusAmount: alloc.amountRm.toFixed(2),
			status: "pending",
		});
	}

	return result;
}

/** Recall leadership bonus when a case is revoked. */
export async function cancelLeadershipBonusForTransaction(
	transactionId: string,
): Promise<number> {
	const updated = await db
		.update(leadershipBonusPayments)
		.set({
			status: "cancelled",
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(leadershipBonusPayments.transactionId, transactionId),
				inArray(leadershipBonusPayments.status, ["pending", "paid"]),
			),
		)
		.returning({ id: leadershipBonusPayments.id });
	return updated.length;
}
