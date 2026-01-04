import { eq } from "drizzle-orm";
import { db } from "../db";
import {
	user,
	agentTierHistory,
	commissionAuditLog,
	leadershipBonusPayments,
	tierCommissionConfig,
	type AgentTier,
	AGENT_TIER_CONFIG
} from "../db/schema/auth";

/**
 * Agent tier management utilities for commission calculations
 * Updated for New Leadership Plan with Leadership Bonus support
 */

export interface TierPromotionResult {
	success: boolean;
	previousTier: AgentTier | null;
	newTier: AgentTier;
	effectiveDate: Date;
	error?: string;
}

// Simplified representation type - 2 options only
export type RepresentationType = 'direct' | 'co_broking';

// Leadership bonus calculation result
export interface LeadershipBonusInfo {
	uplineId: string | null;
	uplineName?: string;
	uplineTier: AgentTier | null;
	bonusRate: number; // Percentage (e.g., 7 = 7%)
	bonusAmount: number;
	fromCompanyShare: number; // The company share before bonus deduction
}

export interface CommissionBreakdown {
	// Level 1: Property-based commission
	propertyPrice: number;
	commissionRate: number;
	totalCommission: number;

	// Level 2: Representation type (direct vs co_broking)
	representationType: RepresentationType;
	agentCommissionShare: number;
	coBrokerShare?: number;

	// Level 3: Company-agent split based on tier
	agentTier: AgentTier;
	companyCommissionSplit: number;
	companyShare: number;
	agentEarnings: number;

	// Level 4: Leadership Bonus (from company's share to upline)
	leadershipBonus?: LeadershipBonusInfo;
	companyNetShare: number; // Company share after leadership bonus

	// Summary
	breakdown: {
		totalCommission: number;
		coBrokerShare?: number;
		agentEarnings: number;
		leadershipBonus?: number;
		companyShare: number; // Net company share after all deductions
	};
}

/**
 * Get agent tier information with commission split and upline info
 */
export async function getAgentTierInfo(agentId: string) {
	const [agent] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			agentTier: user.agentTier,
			companyCommissionSplit: user.companyCommissionSplit,
			tierEffectiveDate: user.tierEffectiveDate,
			tierPromotedBy: user.tierPromotedBy,
			recruitedBy: user.recruitedBy,
			recruitedAt: user.recruitedAt,
		})
		.from(user)
		.where(eq(user.id, agentId))
		.limit(1);

	if (!agent) {
		throw new Error(`Agent not found: ${agentId}`);
	}

	const tierConfig = AGENT_TIER_CONFIG[agent.agentTier as AgentTier];

	return {
		...agent,
		tierConfig,
		displayName: tierConfig.displayName,
		description: tierConfig.description,
		requirements: tierConfig.requirements,
		leadershipBonusRate: tierConfig.leadershipBonusRate,
	};
}

/**
 * Get upline (recruiter) information for leadership bonus calculation
 */
export async function getUplineInfo(agentId: string): Promise<{
	uplineId: string | null;
	uplineName: string | null;
	uplineTier: AgentTier | null;
	leadershipBonusRate: number;
} | null> {
	// First, get the agent's recruiter
	const [agent] = await db
		.select({
			recruitedBy: user.recruitedBy,
		})
		.from(user)
		.where(eq(user.id, agentId))
		.limit(1);

	if (!agent || !agent.recruitedBy) {
		return null;
	}

	// Get the upline's information
	const [upline] = await db
		.select({
			id: user.id,
			name: user.name,
			agentTier: user.agentTier,
		})
		.from(user)
		.where(eq(user.id, agent.recruitedBy))
		.limit(1);

	if (!upline) {
		return null;
	}

	const uplineTier = upline.agentTier as AgentTier;
	const leadershipBonusRate = AGENT_TIER_CONFIG[uplineTier].leadershipBonusRate;

	return {
		uplineId: upline.id,
		uplineName: upline.name,
		uplineTier,
		leadershipBonusRate,
	};
}

/**
 * Calculate enhanced commission with tier-based splits and Leadership Bonus
 * New Leadership Plan: Leadership bonus is calculated from company's share
 */
export function calculateEnhancedCommission(
	propertyPrice: number,
	commissionRate: number,
	representationType: RepresentationType,
	agentTier: AgentTier,
	companyCommissionSplit: number,
	coBrokerSplitPercentage: number = 50,
	uplineInfo?: { uplineTier: AgentTier; leadershipBonusRate: number } | null
): CommissionBreakdown {
	// Input validation
	if (propertyPrice <= 0) {
		throw new Error("Property price must be positive");
	}
	if (commissionRate <= 0 || commissionRate > 100) {
		throw new Error("Commission rate must be between 0 and 100");
	}
	if (companyCommissionSplit <= 0 || companyCommissionSplit > 100) {
		throw new Error("Company commission split must be between 0 and 100");
	}

	// Level 1: Calculate total commission
	const totalCommission = propertyPrice * (commissionRate / 100);

	// Level 2: Apply representation type split (simplified to 2 options)
	let agentCommissionShare: number;
	let coBrokerShare: number | undefined;

	if (representationType === 'co_broking') {
		agentCommissionShare = totalCommission * ((100 - coBrokerSplitPercentage) / 100);
		coBrokerShare = totalCommission * (coBrokerSplitPercentage / 100);
	} else {
		agentCommissionShare = totalCommission;
		coBrokerShare = undefined;
	}

	// Level 3: Apply company-agent split based on tier
	const agentSharePercentage = companyCommissionSplit / 100;
	const companyShare = agentCommissionShare * (1 - agentSharePercentage);
	const agentEarnings = agentCommissionShare * agentSharePercentage;

	// Level 4: Calculate Leadership Bonus from company's share
	let leadershipBonus: LeadershipBonusInfo | undefined;
	let companyNetShare = companyShare;

	if (uplineInfo && uplineInfo.leadershipBonusRate > 0) {
		const bonusAmount = companyShare * (uplineInfo.leadershipBonusRate / 100);
		companyNetShare = companyShare - bonusAmount;

		leadershipBonus = {
			uplineId: null, // Will be populated by the calling function
			uplineTier: uplineInfo.uplineTier,
			bonusRate: uplineInfo.leadershipBonusRate,
			bonusAmount: Math.round(bonusAmount * 100) / 100, // Round to 2 decimal places
			fromCompanyShare: companyShare,
		};
	}

	return {
		propertyPrice,
		commissionRate,
		totalCommission,
		representationType,
		agentCommissionShare,
		coBrokerShare,
		agentTier,
		companyCommissionSplit,
		companyShare,
		agentEarnings,
		leadershipBonus,
		companyNetShare: Math.round(companyNetShare * 100) / 100,
		breakdown: {
			totalCommission,
			coBrokerShare,
			agentEarnings,
			leadershipBonus: leadershipBonus?.bonusAmount,
			companyShare: Math.round(companyNetShare * 100) / 100,
		}
	};
}

/**
 * Promote agent to new tier with audit trail
 */
export async function promoteAgentTier(
	agentId: string,
	newTier: AgentTier,
	promotedBy: string,
	reason: string,
	performanceMetrics?: Record<string, any>
): Promise<TierPromotionResult> {
	try {
		// Get current agent info
		const currentAgent = await getAgentTierInfo(agentId);
		const previousTier = currentAgent.agentTier;
		
		// Validate tier progression (optional business rule)
		const tierOrder: AgentTier[] = ['advisor', 'sales_leader', 'team_leader', 'group_leader', 'supreme_leader'];
		const currentIndex = previousTier ? tierOrder.indexOf(previousTier) : -1;
		const newIndex = tierOrder.indexOf(newTier);
		
		if (currentIndex >= 0 && newIndex < currentIndex) {
			return {
				success: false,
				previousTier,
				newTier,
				effectiveDate: new Date(),
				error: "Cannot demote agent tier. Use separate demotion process.",
			};
		}

		const effectiveDate = new Date();
		const newCommissionSplit = AGENT_TIER_CONFIG[newTier].commissionSplit;

		// Update user tier and commission split
		await db
			.update(user)
			.set({
				agentTier: newTier,
				companyCommissionSplit: newCommissionSplit,
				tierEffectiveDate: effectiveDate,
				tierPromotedBy: promotedBy,
				updatedAt: effectiveDate,
			})
			.where(eq(user.id, agentId));

		// Create audit trail entry
		await db.insert(agentTierHistory).values({
			agentId,
			previousTier,
			newTier,
			effectiveDate,
			promotedBy,
			reason,
			performanceMetrics: performanceMetrics ? JSON.stringify(performanceMetrics) : null,
		});

		return {
			success: true,
			previousTier,
			newTier,
			effectiveDate,
		};
	} catch (error) {
		return {
			success: false,
			previousTier: null,
			newTier,
			effectiveDate: new Date(),
			error: error instanceof Error ? error.message : 'Unknown error occurred',
		};
	}
}

/**
 * Get agent tier history for audit purposes
 */
export async function getAgentTierHistory(agentId: string) {
	return await db
		.select({
			id: agentTierHistory.id,
			previousTier: agentTierHistory.previousTier,
			newTier: agentTierHistory.newTier,
			effectiveDate: agentTierHistory.effectiveDate,
			promotedBy: agentTierHistory.promotedBy,
			reason: agentTierHistory.reason,
			performanceMetrics: agentTierHistory.performanceMetrics,
			createdAt: agentTierHistory.createdAt,
		})
		.from(agentTierHistory)
		.where(eq(agentTierHistory.agentId, agentId))
		.orderBy(agentTierHistory.effectiveDate);
}

/**
 * Log commission calculation for audit trail
 */
export async function logCommissionAudit(
	transactionId: string,
	agentId: string,
	oldValues: any,
	newValues: any,
	changedBy: string,
	changeReason: string,
	ipAddress?: string,
	userAgent?: string
) {
	await db.insert(commissionAuditLog).values({
		transactionId,
		agentId,
		oldValues: JSON.stringify(oldValues),
		newValues: JSON.stringify(newValues),
		changedBy,
		changeReason,
		ipAddress,
		userAgent,
	});
}

/**
 * Validate if agent meets requirements for tier promotion
 */
export function validateTierRequirements(
	currentTier: AgentTier,
	targetTier: AgentTier,
	performanceMetrics: {
		monthlySales: number;
		teamMembers: number;
	}
): { eligible: boolean; missingRequirements: string[] } {
	const requirements = AGENT_TIER_CONFIG[targetTier].requirements;
	const missingRequirements: string[] = [];

	if (performanceMetrics.monthlySales < requirements.monthlySales) {
		missingRequirements.push(
			`Need ${requirements.monthlySales} monthly sales (current: ${performanceMetrics.monthlySales})`
		);
	}

	if (performanceMetrics.teamMembers < requirements.teamMembers) {
		missingRequirements.push(
			`Need ${requirements.teamMembers} team members (current: ${performanceMetrics.teamMembers})`
		);
	}

	return {
		eligible: missingRequirements.length === 0,
		missingRequirements,
	};
}

/**
 * Create a leadership bonus payment record
 */
export async function createLeadershipBonusPayment(
	transactionId: string,
	downlineAgentId: string,
	uplineAgentId: string,
	uplineTier: AgentTier,
	originalCommissionAmount: number,
	companyShareAmount: number,
	leadershipBonusRate: number,
	leadershipBonusAmount: number
) {
	const [payment] = await db
		.insert(leadershipBonusPayments)
		.values({
			transactionId,
			downlineAgentId,
			uplineAgentId,
			uplineTier,
			originalCommissionAmount: originalCommissionAmount.toFixed(2),
			companyShareAmount: companyShareAmount.toFixed(2),
			leadershipBonusRate,
			leadershipBonusAmount: leadershipBonusAmount.toFixed(2),
			status: 'pending',
		})
		.returning();

	return payment;
}

/**
 * Get leadership bonus payments for an upline agent
 */
export async function getLeadershipBonusPayments(uplineAgentId: string) {
	return await db
		.select({
			id: leadershipBonusPayments.id,
			transactionId: leadershipBonusPayments.transactionId,
			downlineAgentId: leadershipBonusPayments.downlineAgentId,
			uplineTier: leadershipBonusPayments.uplineTier,
			originalCommissionAmount: leadershipBonusPayments.originalCommissionAmount,
			companyShareAmount: leadershipBonusPayments.companyShareAmount,
			leadershipBonusRate: leadershipBonusPayments.leadershipBonusRate,
			leadershipBonusAmount: leadershipBonusPayments.leadershipBonusAmount,
			status: leadershipBonusPayments.status,
			paidAt: leadershipBonusPayments.paidAt,
			createdAt: leadershipBonusPayments.createdAt,
		})
		.from(leadershipBonusPayments)
		.where(eq(leadershipBonusPayments.uplineAgentId, uplineAgentId))
		.orderBy(leadershipBonusPayments.createdAt);
}

/**
 * Set agent's upline (recruiter)
 */
export async function setAgentUpline(
	agentId: string,
	recruitedBy: string,
	setBy: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Validate that the recruiter exists and is not the same as the agent
		if (agentId === recruitedBy) {
			return { success: false, error: "Agent cannot recruit themselves" };
		}

		const [recruiter] = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.id, recruitedBy))
			.limit(1);

		if (!recruiter) {
			return { success: false, error: "Recruiter not found" };
		}

		// Update the agent's recruited_by field
		await db
			.update(user)
			.set({
				recruitedBy,
				recruitedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(user.id, agentId));

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Get downline agents (agents recruited by this agent)
 */
export async function getDownlineAgents(uplineAgentId: string) {
	return await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			agentTier: user.agentTier,
			recruitedAt: user.recruitedAt,
		})
		.from(user)
		.where(eq(user.recruitedBy, uplineAgentId));
}
