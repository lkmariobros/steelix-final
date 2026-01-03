import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";
import {
	calculateEnhancedCommission,
	getAgentTierInfo,
	getAgentTierHistory,
	promoteAgentTier,
	validateTierRequirements,
} from "../lib/agent-tier-utils";
import { agentTierSchema, AGENT_TIER_CONFIG, type AgentTier } from "../db/schema/auth";

/**
 * Agent tier management router for commission calculations
 */

// Input schemas
const calculateCommissionInput = z.object({
	propertyPrice: z.number().positive("Property price must be positive"),
	commissionRate: z.number().min(0.1).max(100, "Commission rate must be between 0.1 and 100"),
	representationType: z.enum(['single_side', 'dual_agency']),
});

const promoteAgentInput = z.object({
	agentId: z.string().min(1, "Agent ID is required"),
	newTier: agentTierSchema,
	reason: z.string().min(1, "Reason is required"),
	performanceMetrics: z.object({
		monthlySales: z.number().min(0),
		teamMembers: z.number().min(0),
	}).optional(),
});

const validateTierInput = z.object({
	targetTier: agentTierSchema,
	performanceMetrics: z.object({
		monthlySales: z.number().min(0),
		teamMembers: z.number().min(0),
	}),
});

export const agentTiersRouter = router({
	// Get current agent's tier information
	getMyTierInfo: protectedProcedure.query(async ({ ctx }) => {
		return await getAgentTierInfo(ctx.session.user.id);
	}),

	// Get specific agent's tier information (admin only)
	getAgentTierInfo: adminProcedure
		.input(z.object({ agentId: z.string() }))
		.query(async ({ input }) => {
			return await getAgentTierInfo(input.agentId);
		}),

	// Calculate enhanced commission with current user's tier
	calculateCommission: protectedProcedure
		.input(calculateCommissionInput)
		.query(async ({ ctx, input }) => {
			// Get user's tier information from enhanced session
			const userSession = ctx.session.user as any;
			const agentTier = (userSession.agentTier || 'advisor') as AgentTier;
			const companyCommissionSplit = userSession.companyCommissionSplit || 60;

			return calculateEnhancedCommission(
				input.propertyPrice,
				input.commissionRate,
				input.representationType,
				agentTier,
				companyCommissionSplit
			);
		}),

	// Calculate commission for specific agent (admin only)
	calculateCommissionForAgent: adminProcedure
		.input(calculateCommissionInput.extend({
			agentId: z.string(),
		}))
		.query(async ({ input }) => {
			const agentInfo = await getAgentTierInfo(input.agentId);
			
			return calculateEnhancedCommission(
				input.propertyPrice,
				input.commissionRate,
				input.representationType,
				(agentInfo.agentTier || 'advisor') as AgentTier,
				agentInfo.companyCommissionSplit || 60
			);
		}),

	// Get tier configuration
	getTierConfig: protectedProcedure.query(() => {
		return AGENT_TIER_CONFIG;
	}),

	// Validate tier promotion requirements
	validateTierRequirements: protectedProcedure
		.input(validateTierInput)
		.query(async ({ ctx, input }) => {
			const agentInfo = await getAgentTierInfo(ctx.session.user.id);
			
			return validateTierRequirements(
				(agentInfo.agentTier || 'advisor') as AgentTier,
				input.targetTier,
				input.performanceMetrics
			);
		}),

	// Promote agent tier (admin only)
	promoteAgent: adminProcedure
		.input(promoteAgentInput)
		.mutation(async ({ ctx, input }) => {
			return await promoteAgentTier(
				input.agentId,
				input.newTier,
				ctx.session.user.id,
				input.reason,
				input.performanceMetrics
			);
		}),

	// Get agent tier history
	getMyTierHistory: protectedProcedure.query(async ({ ctx }) => {
		return await getAgentTierHistory(ctx.session.user.id);
	}),

	// Get specific agent's tier history (admin only)
	getAgentTierHistory: adminProcedure
		.input(z.object({ agentId: z.string() }))
		.query(async ({ input }) => {
			return await getAgentTierHistory(input.agentId);
		}),

	// Get commission preview for transaction
	getCommissionPreview: protectedProcedure
		.input(z.object({
			propertyPrice: z.number().positive(),
			commissionType: z.enum(['percentage', 'fixed']),
			commissionValue: z.number().positive(),
			representationType: z.enum(['single_side', 'dual_agency']),
		}))
		.query(async ({ ctx, input }) => {
			const userSession = ctx.session.user as any;
			const agentTier = (userSession.agentTier || 'advisor') as AgentTier;
			const companyCommissionSplit = userSession.companyCommissionSplit || 60;

			// Calculate commission rate
			let commissionRate: number;
			if (input.commissionType === 'percentage') {
				commissionRate = input.commissionValue;
			} else {
				// Convert fixed amount to percentage
				commissionRate = (input.commissionValue / input.propertyPrice) * 100;
			}

			const breakdown = calculateEnhancedCommission(
				input.propertyPrice,
				commissionRate,
				input.representationType,
				agentTier,
				companyCommissionSplit
			);

			return {
				...breakdown,
				commissionType: input.commissionType,
				commissionValue: input.commissionValue,
				tierInfo: {
					tier: agentTier,
					displayName: AGENT_TIER_CONFIG[agentTier].displayName,
					description: AGENT_TIER_CONFIG[agentTier].description,
				},
			};
		}),

	// Get all agents with tier information (admin only)
	getAllAgentsWithTiers: adminProcedure
		.input(z.object({
			limit: z.number().min(1).max(100).default(50),
			offset: z.number().min(0).default(0),
		}))
		.query(async ({ input }) => {
			const { db } = await import("../db");
			const { user } = await import("../db/schema/auth");
			
			const agents = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					agentTier: user.agentTier,
					companyCommissionSplit: user.companyCommissionSplit,
					tierEffectiveDate: user.tierEffectiveDate,
					role: user.role,
					createdAt: user.createdAt,
				})
				.from(user)
				.limit(input.limit)
				.offset(input.offset)
				.orderBy(user.createdAt);

			return agents.map(agent => ({
				...agent,
				tierConfig: AGENT_TIER_CONFIG[(agent.agentTier || 'advisor') as AgentTier],
			}));
		}),

	// Bulk tier update (admin only) - for future use
	bulkUpdateTiers: adminProcedure
		.input(z.object({
			updates: z.array(z.object({
				agentId: z.string(),
				newTier: agentTierSchema,
				reason: z.string(),
			})),
		}))
		.mutation(async ({ ctx, input }) => {
			const results = [];
			
			for (const update of input.updates) {
				const result = await promoteAgentTier(
					update.agentId,
					update.newTier,
					ctx.session.user.id,
					update.reason
				);
				results.push({ agentId: update.agentId, ...result });
			}
			
			return results;
		}),
});
