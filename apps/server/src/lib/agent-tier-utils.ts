import { eq } from "drizzle-orm";
import { db } from "../db";
import { 
	user, 
	agentTierHistory, 
	commissionAuditLog,
	type AgentTier,
	AGENT_TIER_CONFIG 
} from "../db/schema/auth";

/**
 * Agent tier management utilities for commission calculations
 */

export interface TierPromotionResult {
	success: boolean;
	previousTier: AgentTier | null;
	newTier: AgentTier;
	effectiveDate: Date;
	error?: string;
}

export interface CommissionBreakdown {
	// Level 1: Property-based commission
	propertyPrice: number;
	commissionRate: number;
	totalCommission: number;
	
	// Level 2: Representation type (single_side vs dual_agency)
	representationType: 'single_side' | 'dual_agency';
	agentCommissionShare: number;
	coBrokerShare?: number;
	
	// Level 3: Company-agent split based on tier
	agentTier: AgentTier;
	companyCommissionSplit: number;
	companyShare: number;
	agentEarnings: number;
	
	// Summary
	breakdown: {
		totalCommission: number;
		coBrokerShare?: number;
		companyShare: number;
		agentEarnings: number;
	};
}

/**
 * Get agent tier information with commission split
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
	};
}

/**
 * Calculate enhanced commission with tier-based splits
 */
export function calculateEnhancedCommission(
	propertyPrice: number,
	commissionRate: number,
	representationType: 'single_side' | 'dual_agency',
	agentTier: AgentTier,
	companyCommissionSplit: number
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
	
	// Level 2: Apply representation type split
	let agentCommissionShare: number;
	let coBrokerShare: number | undefined;
	
	if (representationType === 'dual_agency') {
		// Dual agency: agent gets full commission
		agentCommissionShare = totalCommission;
	} else {
		// Single side (co-broking): split 50/50
		agentCommissionShare = totalCommission * 0.5;
		coBrokerShare = totalCommission * 0.5;
	}
	
	// Level 3: Apply company-agent split based on tier
	const agentSharePercentage = companyCommissionSplit / 100;
	const companyShare = agentCommissionShare * (1 - agentSharePercentage);
	const agentEarnings = agentCommissionShare * agentSharePercentage;

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
		breakdown: {
			totalCommission,
			coBrokerShare,
			companyShare,
			agentEarnings,
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
