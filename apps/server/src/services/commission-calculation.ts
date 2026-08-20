import { eq } from "drizzle-orm";
import { leadershipBonusPayments, user, type AgentTier } from "../models/auth";
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
	resolveOverrideLayerRates,
	resolveSchemeForBlockAtDate,
} from "./commission-schemes";
import { resolveTierConfig } from "./tier-config";

type TxRow = typeof transactions.$inferSelect;

export const PRIMARY_OVERRIDE_LAYERS = [
	{
		key: "immediateUpline",
		label: "Immediate Upline",
		rateKey: "immediateUplineOverridePercent",
	},
	{
		key: "teamManager",
		label: "Team Manager",
		rateKey: "teamManagerOverridePercent",
	},
	{
		key: "groupManager",
		label: "Group Manager",
		rateKey: "groupManagerOverridePercent",
	},
	{
		key: "director",
		label: "Director",
		rateKey: "directorOverridePercent",
	},
] as const;

export type PrimaryOverrideLayerKey =
	(typeof PRIMARY_OVERRIDE_LAYERS)[number]["key"];

export type PrimaryOverrideLayerSnapshot = {
	layer: PrimaryOverrideLayerKey;
	label: string;
	percent: number;
	payeeAgentId: string | null;
	payeeName: string | null;
	grossCommission: number;
	netCommission: number;
	sstAmount: number;
};

/**
 * Walk `recruitedBy` upward up to 4 levels from the selling agent.
 * Layer 1 falls back to deal teamLeaderAgentId only when no direct recruiter exists
 * (does not stuff remaining layers onto the team leader).
 */
export async function resolvePrimaryOverridePayees(
	agentId: string,
	teamLeaderAgentId: string | null | undefined,
): Promise<Array<{ agentId: string; name: string } | null>> {
	const payees: Array<{ agentId: string; name: string } | null> = [
		null,
		null,
		null,
		null,
	];
	const seen = new Set<string>([agentId]);
	let currentId: string | null = agentId;

	for (let i = 0; i < 4; i++) {
		if (!currentId) break;
		const [row]: Array<{ recruitedBy: string | null } | undefined> = await db
			.select({
				recruitedBy: user.recruitedBy,
			})
			.from(user)
			.where(eq(user.id, currentId))
			.limit(1);

		let nextId: string | null = row?.recruitedBy ?? null;

		// Optional layer-1 fallback only — never used for layers 2–4.
		if (i === 0 && !nextId && teamLeaderAgentId) {
			nextId = teamLeaderAgentId;
		}

		if (!nextId || nextId === agentId || seen.has(nextId)) {
			currentId = null;
			continue;
		}

		const [payee]: Array<{ id: string; name: string } | undefined> = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.id, nextId))
			.limit(1);

		if (!payee) {
			currentId = null;
			continue;
		}

		seen.add(payee.id);
		payees[i] = { agentId: payee.id, name: payee.name };
		currentId = payee.id;
	}

	return payees;
}

function getRepresentationType(tx: TxRow): RepresentationType {
	return tx.representationType === "co_broking" ? "co_broking" : "direct";
}

function getCoBrokerSplit(tx: TxRow): number {
	const co = tx.coBrokingData as {
		commissionSplit?: number;
		agents?: Array<{ commissionSplit?: number }>;
	} | null;
	if (co?.agents && co.agents.length > 0) {
		return co.agents.reduce(
			(sum, a) => sum + (Number(a.commissionSplit) || 0),
			0,
		);
	}
	return co?.commissionSplit ?? 50;
}

/**
 * Primary market: lock project commission scheme — agent receives 100% of scheme net.
 * Upline override is paid separately across up to 4 recruitment-chain layers.
 */
export async function buildPrimaryCommissionPatch(
	tx: TxRow,
): Promise<Record<string, unknown>> {
	if (tx.marketType !== "primary") return {};
	if (tx.commissionSchemeSnapshot) return {};

	const property = tx.propertyData as
		| {
				listingId?: string;
				price?: number;
				nettPrice?: number;
				rebateAmount?: number;
		  }
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
	const nettPrice =
		typeof property.nettPrice === "number"
			? Number(property.nettPrice)
			: Math.max(
					0,
					Number(property.price) - Number(property.rebateAmount ?? 0),
				);
	const breakdown = calculateSchemeCommission({
		nettPrice,
		commissionPercent: tier.commissionPercent,
		incSst: scheme.incSst,
		sstPercent: scheme.sstPercent,
		sstBorneBy: scheme.sstBorneBy,
	});

	const rates = resolveOverrideLayerRates(tier);
	const payees = await resolvePrimaryOverridePayees(
		tx.agentId,
		tx.teamLeaderAgentId,
	);

	const overrideLayers: PrimaryOverrideLayerSnapshot[] = [];
	for (let i = 0; i < PRIMARY_OVERRIDE_LAYERS.length; i++) {
		const meta = PRIMARY_OVERRIDE_LAYERS[i];
		const percent = rates[meta.rateKey];
		const payee = payees[i];
		if (percent <= 0 || !payee) {
			overrideLayers.push({
				layer: meta.key,
				label: meta.label,
				percent,
				payeeAgentId: payee?.agentId ?? null,
				payeeName: payee?.name ?? null,
				grossCommission: 0,
				netCommission: 0,
				sstAmount: 0,
			});
			continue;
		}
		const layerCalc = calculateSchemeCommission({
			nettPrice,
			commissionPercent: percent,
			incSst: scheme.incSst,
			sstPercent: scheme.sstPercent,
			sstBorneBy: scheme.sstBorneBy,
		});
		overrideLayers.push({
			layer: meta.key,
			label: meta.label,
			percent,
			payeeAgentId: payee.agentId,
			payeeName: payee.name,
			grossCommission: layerCalc.grossCommission,
			netCommission: layerCalc.agentNetCommission,
			sstAmount: layerCalc.sstAmount,
		});
	}

	const payableLayers = overrideLayers.filter(
		(l) => l.percent > 0 && l.payeeAgentId,
	);
	const overrideGrossCommission = payableLayers.reduce(
		(sum, l) => sum + l.grossCommission,
		0,
	);
	const overrideNetCommission = payableLayers.reduce(
		(sum, l) => sum + l.netCommission,
		0,
	);

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
			overridePercent: rates.overridePercent,
			immediateUplineOverridePercent: rates.immediateUplineOverridePercent,
			teamManagerOverridePercent: rates.teamManagerOverridePercent,
			groupManagerOverridePercent: rates.groupManagerOverridePercent,
			directorOverridePercent: rates.directorOverridePercent,
			overrideLayers,
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
			overridePercent: rates.overridePercent,
			overrideGrossCommission,
			overrideNetCommission,
			overrideLayers,
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
 * @deprecated Prefer resolvePrimaryOverridePayees (4-layer). Kept for callers
 * that only need layer-1 payee id.
 */
export async function resolvePrimaryOverridePayeeAgentId(
	agentId: string,
	teamLeaderAgentId: string | null | undefined,
): Promise<string | null> {
	const [layer1] = await resolvePrimaryOverridePayees(
		agentId,
		teamLeaderAgentId,
	);
	return layer1?.agentId ?? null;
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
