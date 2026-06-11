/**
 * Agent Tier Configuration - Frontend
 * New Leadership Plan commission structure with Leadership Bonus
 */

// Tier types matching backend schema
export type AgentTier =
	| "advisor"
	| "sales_leader"
	| "team_leader"
	| "group_leader"
	| "supreme_leader";

export interface TierConfig {
	commissionSplit: number;
	leadershipBonusRate: number; // Percentage from company's share paid to upline
	requirements: {
		monthlySales: number;
		teamMembers: number;
	};
	displayName: string;
	description: string;
}

// Secondary market tier splits (70/80/85/90). Primary market uses Commission Schemes.
export const AGENT_TIER_CONFIG: Record<AgentTier, TierConfig> = {
	advisor: {
		commissionSplit: 70,
		leadershipBonusRate: 0,
		requirements: { monthlySales: 0, teamMembers: 0 },
		displayName: "Advisor",
		description: "Entry level agent",
	},
	sales_leader: {
		commissionSplit: 80,
		leadershipBonusRate: 7,
		requirements: { monthlySales: 0, teamMembers: 2 },
		displayName: "Sales Leader",
		description: "2+ direct recruits",
	},
	team_leader: {
		commissionSplit: 85,
		leadershipBonusRate: 5,
		requirements: { monthlySales: 0, teamMembers: 5 },
		displayName: "Team Leader",
		description: "5+ direct recruits",
	},
	group_leader: {
		commissionSplit: 90,
		leadershipBonusRate: 8,
		requirements: { monthlySales: 0, teamMembers: 10 },
		displayName: "Group Leader",
		description: "10+ direct recruits",
	},
	supreme_leader: {
		commissionSplit: 90,
		leadershipBonusRate: 6,
		requirements: { monthlySales: 0, teamMembers: 20 },
		displayName: "Supreme Leader",
		description: "20+ direct recruits",
	},
};

// Tier order for progression
export const TIER_ORDER: AgentTier[] = [
	"advisor",
	"sales_leader",
	"team_leader",
	"group_leader",
	"supreme_leader",
];

// Gamification colors - themed for motivation
export const TIER_COLORS: Record<
	AgentTier,
	{
		bg: string;
		text: string;
		border: string;
		gradient: string;
		icon: string;
	}
> = {
	advisor: {
		bg: "bg-slate-100 dark:bg-slate-800",
		text: "text-slate-700 dark:text-slate-300",
		border: "border-slate-300 dark:border-slate-600",
		gradient: "from-slate-400 to-slate-600",
		icon: "🌱",
	},
	sales_leader: {
		bg: "bg-blue-100 dark:bg-blue-900/50",
		text: "text-blue-700 dark:text-blue-300",
		border: "border-blue-300 dark:border-blue-600",
		gradient: "from-blue-400 to-blue-600",
		icon: "⭐",
	},
	team_leader: {
		bg: "bg-purple-100 dark:bg-purple-900/50",
		text: "text-purple-700 dark:text-purple-300",
		border: "border-purple-300 dark:border-purple-600",
		gradient: "from-purple-400 to-purple-600",
		icon: "💫",
	},
	group_leader: {
		bg: "bg-amber-100 dark:bg-amber-900/50",
		text: "text-amber-700 dark:text-amber-300",
		border: "border-amber-300 dark:border-amber-600",
		gradient: "from-amber-400 to-amber-600",
		icon: "🔥",
	},
	supreme_leader: {
		bg: "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/50 dark:to-amber-900/50",
		text: "text-yellow-700 dark:text-yellow-300",
		border: "border-yellow-400 dark:border-yellow-500",
		gradient: "from-yellow-400 via-amber-500 to-orange-500",
		icon: "👑",
	},
};

// Helper functions
export function getTierIndex(tier: AgentTier): number {
	return TIER_ORDER.indexOf(tier);
}

export function getNextTier(tier: AgentTier): AgentTier | null {
	const index = getTierIndex(tier);
	return index < TIER_ORDER.length - 1 ? TIER_ORDER[index + 1] : null;
}

export function getPreviousTier(tier: AgentTier): AgentTier | null {
	const index = getTierIndex(tier);
	return index > 0 ? TIER_ORDER[index - 1] : null;
}

export function calculateTierProgress(
	currentTier: AgentTier,
	metrics: { monthlySales: number; teamMembers: number },
): { salesProgress: number; teamProgress: number; overallProgress: number } {
	const nextTier = getNextTier(currentTier);
	if (!nextTier) {
		return { salesProgress: 100, teamProgress: 100, overallProgress: 100 };
	}

	const requirements = AGENT_TIER_CONFIG[nextTier].requirements;
	const salesProgress =
		requirements.monthlySales > 0
			? Math.min(100, (metrics.monthlySales / requirements.monthlySales) * 100)
			: 100;
	const teamProgress =
		requirements.teamMembers > 0
			? Math.min(100, (metrics.teamMembers / requirements.teamMembers) * 100)
			: 100;

	const overallProgress = (salesProgress + teamProgress) / 2;
	return { salesProgress, teamProgress, overallProgress };
}

export function formatTierName(tier: AgentTier): string {
	return AGENT_TIER_CONFIG[tier].displayName;
}

export function getCommissionBenefit(tier: AgentTier): string {
	const config = AGENT_TIER_CONFIG[tier];
	if (config.leadershipBonusRate > 0) {
		return `${config.commissionSplit}% commission + ${config.leadershipBonusRate}% leadership bonus`;
	}
	return `${config.commissionSplit}% commission split`;
}

export function getLeadershipBonusRate(tier: AgentTier): number {
	return AGENT_TIER_CONFIG[tier].leadershipBonusRate;
}

export function hasLeadershipBonus(tier: AgentTier): boolean {
	return AGENT_TIER_CONFIG[tier].leadershipBonusRate > 0;
}
