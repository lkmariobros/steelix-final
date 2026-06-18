import { eq } from "drizzle-orm";
import { leadershipBonusPayments, type AgentTier } from "../models/auth";
import type { transactions } from "../models/transactions";
import { db } from "../utils/db";
import {
	calculateEnhancedCommission,
	createLeadershipBonusPayment,
	getAgentTierInfo,
	getUplineInfo,
	type RepresentationType,
} from "./agent-tier";
import {
	calculateSchemeCommission,
	resolveSchemeForBlockAtDate,
} from "./commission-schemes";
import { resolveTierConfig } from "./tier-config";

type TxRow = typeof transactions.$inferSelect;

function getRepresentationType(tx: TxRow): RepresentationType {
	return tx.representationType === "co_broking" ? "co_broking" : "direct";
}

function getCoBrokerSplit(tx: TxRow): number {
	const co = tx.coBrokingData as { commissionSplit?: number } | null;
	return co?.commissionSplit ?? 50;
}

/**
 * Primary market: lock project commission scheme — agent receives 100% of scheme net.
 */
export async function buildPrimaryCommissionPatch(
	tx: TxRow,
): Promise<Record<string, unknown>> {
	if (tx.marketType !== "primary") return {};
	if (tx.commissionSchemeSnapshot) return {};

	const property = tx.propertyData as
		| { listingId?: string; price?: number }
		| null
		| undefined;
	const blockId = tx.blockListingId ?? property?.listingId ?? undefined;
	if (!blockId || !property?.price) return {};

	const resolved = await resolveSchemeForBlockAtDate({
		blockListingId: blockId,
		at: tx.transactionDate ?? new Date(),
	});
	if (!resolved) return {};

	const { scheme, tier } = resolved;
	const nettPrice = Number(property.price);
	const breakdown = calculateSchemeCommission({
		nettPrice,
		commissionPercent: tier.commissionPercent,
		incSst: scheme.incSst,
		sstPercent: scheme.sstPercent,
		sstBorneBy: scheme.sstBorneBy,
	});

	const overridePercent = tier.overridePercent ?? 0;
	const overrideBreakdown =
		overridePercent > 0
			? calculateSchemeCommission({
					nettPrice,
					commissionPercent: overridePercent,
					incSst: scheme.incSst,
					sstPercent: scheme.sstPercent,
					sstBorneBy: scheme.sstBorneBy,
				})
			: null;

	return {
		commissionType: "percentage" as const,
		commissionValue: tier.commissionPercent.toFixed(2),
		commissionAmount: breakdown.grossCommission.toFixed(2),
		commissionSchemeSnapshot: {
			schemeId: scheme.id,
			schemeName: scheme.schemeName,
			shortform: scheme.shortform,
			projectName: scheme.projectName,
			blockListingId: scheme.blockListingId,
			blockListingTitle: scheme.blockListingTitle,
			tierId: tier.id,
			tierName: tier.tierName,
			commissionPercent: tier.commissionPercent,
			overridePercent: tier.overridePercent,
			incSst: scheme.incSst,
			sstPercent: scheme.sstPercent,
			sstBorneBy: scheme.sstBorneBy,
			lockedAt: new Date().toISOString(),
		},
		commissionBreakdown: {
			marketType: "primary" as const,
			spaPrice: nettPrice,
			nettPrice,
			commissionRatePercent: tier.commissionPercent,
			baseCommission: breakdown.baseCommission,
			grossCommission: breakdown.grossCommission,
			sstPercent: scheme.sstPercent,
			sstAmount: breakdown.sstAmount,
			agentNetCommission: breakdown.agentNetCommission,
			agentSharePercent: 100,
			overridePercent,
			overrideGrossCommission: overrideBreakdown?.grossCommission ?? 0,
			overrideNetCommission: overrideBreakdown?.agentNetCommission ?? 0,
		},
	};
}

/**
 * Secondary market: lock agent tier split (70/80/85/90%) + leadership bonus preview.
 */
export async function buildSecondaryCommissionPatch(
	tx: TxRow,
	agentId: string,
): Promise<Record<string, unknown>> {
	if (tx.marketType !== "secondary") return {};
	const existing = tx.commissionBreakdown as { marketType?: string } | null;
	if (existing?.marketType === "secondary") return {};

	const property = tx.propertyData as { price?: number } | null | undefined;
	const price = property?.price ?? 0;
	if (price <= 0) return {};

	const agentInfo = await getAgentTierInfo(agentId);
	const tier = (agentInfo.agentTier ?? "advisor") as AgentTier;
	const tierConfig = await resolveTierConfig(tier);
	const companySplit =
		agentInfo.companyCommissionSplit ?? tierConfig.commissionSplit;

	let commissionRate: number;
	const commissionValue = Number(tx.commissionValue ?? 0);
	if (tx.commissionType === "percentage") {
		commissionRate = commissionValue;
	} else if (commissionValue > 0) {
		commissionRate = (commissionValue / price) * 100;
	} else {
		return {};
	}

	const upline = await getUplineInfo(agentId);
	const uplineForCalc = upline?.uplineTier
		? {
				uplineTier: upline.uplineTier,
				leadershipBonusRate: upline.leadershipBonusRate,
			}
		: null;

	const enhanced = calculateEnhancedCommission(
		price,
		commissionRate,
		getRepresentationType(tx),
		tier,
		companySplit,
		getCoBrokerSplit(tx),
		uplineForCalc,
	);

	return {
		commissionType: tx.commissionType,
		commissionValue: commissionValue.toFixed(2),
		commissionAmount: enhanced.totalCommission.toFixed(2),
		commissionBreakdown: {
			marketType: "secondary" as const,
			spaPrice: price,
			nettPrice: price,
			commissionRatePercent: commissionRate,
			grossCommission: enhanced.totalCommission,
			agentNetCommission: enhanced.agentEarnings,
			agentSharePercent: companySplit,
			companyShare: enhanced.companyShare,
			companyNetShare: enhanced.companyNetShare,
			coBrokerShare: enhanced.coBrokerShare,
			leadershipBonus: enhanced.leadershipBonus
				? {
						uplineId: upline?.uplineId ?? null,
						uplineTier: enhanced.leadershipBonus.uplineTier,
						bonusRate: enhanced.leadershipBonus.bonusRate,
						bonusAmount: enhanced.leadershipBonus.bonusAmount,
						fromCompanyShare: enhanced.leadershipBonus.fromCompanyShare,
					}
				: undefined,
			agentTier: tier,
			lockedAt: new Date().toISOString(),
		},
	};
}

/** Lock commission at submission based on market type. */
export async function lockCommissionOnSubmit(
	tx: TxRow,
	agentId: string,
): Promise<Record<string, unknown>> {
	if (tx.marketType === "secondary") {
		return buildSecondaryCommissionPatch(tx, agentId);
	}
	if (tx.marketType === "primary") {
		return buildPrimaryCommissionPatch(tx);
	}
	return {};
}

/**
 * Primary market upline override payee: direct recruiter first, then team leader on the deal.
 * Override amount comes from commission scheme tiers — not secondary tier config.
 */
export async function resolvePrimaryOverridePayeeAgentId(
	agentId: string,
	teamLeaderAgentId: string | null | undefined,
): Promise<string | null> {
	const upline = await getUplineInfo(agentId);
	const payee = upline?.uplineId ?? teamLeaderAgentId ?? null;
	if (!payee || payee === agentId) return null;
	return payee;
}

/**
 * Secondary leadership bonus: paid from company share after tier split.
 */
export async function recordSecondaryLeadershipBonus(
	tx: TxRow,
	breakdown: {
		grossCommission?: number;
		companyShare?: number;
		leadershipBonus?: {
			uplineId?: string | null;
			uplineTier?: AgentTier | string | null;
			bonusRate?: number;
			bonusAmount?: number;
			fromCompanyShare?: number;
		};
	},
): Promise<void> {
	const [existing] = await db
		.select({ id: leadershipBonusPayments.id })
		.from(leadershipBonusPayments)
		.where(eq(leadershipBonusPayments.transactionId, tx.id))
		.limit(1);
	if (existing) return;

	const lb = breakdown.leadershipBonus;
	if (!lb?.uplineId || !lb.bonusAmount || lb.bonusAmount <= 0) return;

	const uplineTier = (lb.uplineTier ?? "advisor") as AgentTier;

	await createLeadershipBonusPayment(
		tx.id,
		tx.agentId,
		lb.uplineId,
		uplineTier,
		breakdown.grossCommission ?? 0,
		lb.fromCompanyShare ?? breakdown.companyShare ?? 0,
		lb.bonusRate ?? 0,
		lb.bonusAmount,
	);
}
