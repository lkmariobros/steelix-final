import { and, eq } from "drizzle-orm";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	tierCommissionConfig,
} from "../models/auth";
import { db } from "../utils/db";

export type ResolvedTierConfig = {
	commissionSplit: number;
	leadershipBonusRate: number;
	requirements: { monthlySales: number; teamMembers: number };
	displayName: string;
	description: string;
};

/** Read admin-editable tier config from DB, falling back to AGENT_TIER_CONFIG. */
export async function resolveTierConfig(
	tier: AgentTier,
): Promise<ResolvedTierConfig> {
	const [row] = await db
		.select()
		.from(tierCommissionConfig)
		.where(
			and(
				eq(tierCommissionConfig.tier, tier),
				eq(tierCommissionConfig.isActive, true),
			),
		)
		.limit(1);

	if (row) {
		const req = row.requirements as {
			monthlySales: number;
			teamMembers: number;
		};
		return {
			commissionSplit: row.commissionSplit,
			leadershipBonusRate: row.leadershipBonusRate,
			requirements: req,
			displayName: row.displayName,
			description: row.description ?? "",
		};
	}

	const fallback = AGENT_TIER_CONFIG[tier];
	return {
		commissionSplit: fallback.commissionSplit,
		leadershipBonusRate: fallback.leadershipBonusRate,
		requirements: { ...fallback.requirements },
		displayName: fallback.displayName,
		description: fallback.description,
	};
}
