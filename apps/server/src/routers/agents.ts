import { and, desc, eq, inArray, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	user,
	agencies,
	teams,
	agentTierHistory,
	agentActivities,
	agentGoals,
	AGENT_TIER_CONFIG,
	type AgentTier,
} from "../db/schema/auth";
import { transactions } from "../db/schema/transactions";
import { commissionApprovals } from "../db/schema/approvals";
import { performanceMetrics } from "../db/schema/reports";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";

// Input schemas
const listAgentsInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	role: z.enum(["agent", "team_lead", "admin"]).optional(),
	agentTier: z.enum(["advisor", "sales_leader", "team_leader", "group_leader", "supreme_leader"]).optional(),
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	searchQuery: z.string().optional(),
	sortBy: z.enum(["name", "email", "createdAt", "agentTier"]).default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const agentIdInput = z.object({
	id: z.string(),
});

const updateAgentInput = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	role: z.enum(["agent", "team_lead", "admin"]).optional(),
	agentTier: z.enum(["advisor", "sales_leader", "team_leader", "group_leader", "supreme_leader"]).optional(),
	companyCommissionSplit: z.number().min(0).max(100).optional(),
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	permissions: z.string().optional(),
});

const agentPerformanceInput = z.object({
	agentId: z.string(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	periodType: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
});

const createGoalInput = z.object({
	agentId: z.string(),
	title: z.string().min(1),
	description: z.string().optional(),
	goalType: z.enum(["sales", "commission", "clients", "custom"]),
	targetValue: z.number().positive(),
	unit: z.string().min(1),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
});

const bulkAgentActionInput = z.object({
	agentIds: z.array(z.string()).min(1).max(50),
	action: z.enum(["activate", "deactivate", "change_tier", "assign_team"]),
	actionData: z.object({
		agentTier: z.enum(["advisor", "sales_leader", "team_leader", "group_leader", "supreme_leader"]).optional(),
		teamId: z.string().uuid().optional(),
		reason: z.string().optional(),
	}).optional(),
});

export const agentsRouter = router({
	// List all agents (admin only)
	list: adminProcedure
		.input(listAgentsInput)
		.query(async ({ input }) => {
			const conditions = [];

			if (input.role) {
				conditions.push(eq(user.role, input.role));
			}
			if (input.agentTier) {
				conditions.push(eq(user.agentTier, input.agentTier));
			}
			if (input.teamId) {
				conditions.push(eq(user.teamId, input.teamId));
			}
			if (input.agencyId) {
				conditions.push(eq(user.agencyId, input.agencyId));
			}
			if (input.searchQuery) {
				conditions.push(
					sql`(${user.name} ILIKE ${`%${input.searchQuery}%`} OR ${user.email} ILIKE ${`%${input.searchQuery}%`})`
				);
			}

			// Build order by clause
			const orderByColumn = input.sortBy === "name" 
				? user.name
				: input.sortBy === "email"
				? user.email
				: input.sortBy === "createdAt"
				? user.createdAt
				: user.agentTier;

			const orderByClause = input.sortOrder === "asc" 
				? orderByColumn 
				: desc(orderByColumn);

			// Get agents with team and agency details
			const agentsList = await db
				.select({
					agent: user,
					team: {
						id: teams.id,
						name: teams.name,
						slug: teams.slug,
					},
					agency: {
						id: agencies.id,
						name: agencies.name,
						slug: agencies.slug,
					},
				})
				.from(user)
				.leftJoin(teams, eq(user.teamId, teams.id))
				.leftJoin(agencies, eq(user.agencyId, agencies.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(orderByClause)
				.limit(input.limit)
				.offset(input.offset);

			// Get total count
			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(user)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			// Get performance metrics for each agent
			const agentIds = agentsList.map(a => a.agent.id);
			const performanceData = agentIds.length > 0 ? await db
				.select({
					agentId: performanceMetrics.agentId,
					totalTransactions: performanceMetrics.totalTransactions,
					totalCommission: performanceMetrics.totalCommission,
					averageCommission: performanceMetrics.averageCommission,
					conversionRate: performanceMetrics.conversionRate,
				})
				.from(performanceMetrics)
				.where(
					and(
						inArray(performanceMetrics.agentId, agentIds),
						eq(performanceMetrics.periodType, "monthly")
					)
				) : [];

			// Combine agent data with performance metrics
			const agentsWithPerformance = agentsList.map(agentData => {
				const performance = performanceData.find(p => p.agentId === agentData.agent.id);
				return {
					...agentData,
					performance: performance || {
						totalTransactions: 0,
						totalCommission: "0",
						averageCommission: "0",
						conversionRate: "0",
					},
				};
			});

			return {
				agents: agentsWithPerformance,
				total: count,
				hasMore: input.offset + input.limit < count,
			};
		}),

	// Get agent details (admin only)
	getById: adminProcedure
		.input(agentIdInput)
		.query(async ({ input }) => {
			const [agentData] = await db
				.select({
					agent: user,
					team: teams,
					agency: agencies,
				})
				.from(user)
				.leftJoin(teams, eq(user.teamId, teams.id))
				.leftJoin(agencies, eq(user.agencyId, agencies.id))
				.where(eq(user.id, input.id))
				.limit(1);

			if (!agentData) {
				throw new Error("Agent not found");
			}

			// Get tier history
			const tierHistory = await db
				.select({
					history: agentTierHistory,
					promotedByUser: {
						id: user.id,
						name: user.name,
						email: user.email,
					},
				})
				.from(agentTierHistory)
				.leftJoin(user, eq(agentTierHistory.promotedBy, user.id))
				.where(eq(agentTierHistory.agentId, input.id))
				.orderBy(desc(agentTierHistory.createdAt))
				.limit(10);

			// Get recent activities
			const recentActivities = await db
				.select()
				.from(agentActivities)
				.where(eq(agentActivities.agentId, input.id))
				.orderBy(desc(agentActivities.timestamp))
				.limit(20);

			// Get current goals
			const currentGoals = await db
				.select()
				.from(agentGoals)
				.where(
					and(
						eq(agentGoals.agentId, input.id),
						eq(agentGoals.isActive, true)
					)
				)
				.orderBy(desc(agentGoals.createdAt));

			// Get performance metrics for last 6 months
			const sixMonthsAgo = new Date();
			sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

			const performanceHistory = await db
				.select()
				.from(performanceMetrics)
				.where(
					and(
						eq(performanceMetrics.agentId, input.id),
						gte(performanceMetrics.periodStart, sixMonthsAgo)
					)
				)
				.orderBy(desc(performanceMetrics.periodStart));

			return {
				...agentData,
				tierHistory,
				recentActivities,
				currentGoals,
				performanceHistory,
			};
		}),

	// Update agent details (admin only)
	update: adminProcedure
		.input(updateAgentInput)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Get current agent data for tier change tracking
			const [currentAgent] = await db
				.select()
				.from(user)
				.where(eq(user.id, id))
				.limit(1);

			if (!currentAgent) {
				throw new Error("Agent not found");
			}

			// Update agent
			const [updatedAgent] = await db
				.update(user)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(user.id, id))
				.returning();

			// If agent tier changed, log it
			if (updateData.agentTier && updateData.agentTier !== currentAgent.agentTier) {
				await db.insert(agentTierHistory).values({
					agentId: id,
					previousTier: currentAgent.agentTier,
					newTier: updateData.agentTier,
					promotedBy: ctx.session.user.id,
					reason: "Admin tier change",
					effectiveDate: new Date(),
				});
			}

			return updatedAgent;
		}),

	// Get agent performance metrics
	getPerformance: adminProcedure
		.input(agentPerformanceInput)
		.query(async ({ input }) => {
			const conditions = [eq(performanceMetrics.agentId, input.agentId)];

			if (input.startDate) {
				conditions.push(gte(performanceMetrics.periodStart, input.startDate));
			}
			if (input.endDate) {
				conditions.push(lte(performanceMetrics.periodEnd, input.endDate));
			}
			if (input.periodType) {
				conditions.push(eq(performanceMetrics.periodType, input.periodType));
			}

			const metrics = await db
				.select()
				.from(performanceMetrics)
				.where(and(...conditions))
				.orderBy(desc(performanceMetrics.periodStart));

			// Get transaction summary
			const transactionConditions = [eq(transactions.agentId, input.agentId)];
			if (input.startDate) {
				transactionConditions.push(gte(transactions.createdAt, input.startDate));
			}
			if (input.endDate) {
				transactionConditions.push(lte(transactions.createdAt, input.endDate));
			}

			const [transactionSummary] = await db
				.select({
					totalTransactions: sql<number>`count(*)`,
					completedTransactions: sql<number>`count(*) filter (where status = 'completed')`,
					pendingTransactions: sql<number>`count(*) filter (where status in ('draft', 'submitted', 'under_review'))`,
					totalCommissionAmount: sql<number>`sum(cast(commission_amount as decimal))`,
					averageCommissionAmount: sql<number>`avg(cast(commission_amount as decimal))`,
				})
				.from(transactions)
				.where(and(...transactionConditions));

			return {
				metrics,
				transactionSummary,
			};
		}),

	// Create goal for agent (admin only)
	createGoal: adminProcedure
		.input(createGoalInput)
		.mutation(async ({ ctx, input }) => {
			const [goal] = await db
				.insert(agentGoals)
				.values({
					...input,
					targetValue: input.targetValue.toString(),
					createdBy: ctx.session.user.id,
				})
				.returning();

			return goal;
		}),

	// Bulk actions on agents (admin only)
	bulkAction: adminProcedure
		.input(bulkAgentActionInput)
		.mutation(async ({ ctx, input }) => {
			const { agentIds, action, actionData } = input;

			// Verify agents exist
			const agents = await db
				.select()
				.from(user)
				.where(inArray(user.id, agentIds));

			if (agents.length !== agentIds.length) {
				throw new Error("Some agents not found");
			}

			let updateData: any = { updatedAt: new Date() };
			let tierHistoryEntries: any[] = [];

			switch (action) {
				case "change_tier":
					if (!actionData?.agentTier) {
						throw new Error("Agent tier is required for tier change");
					}
					updateData.agentTier = actionData.agentTier;
					
					// Create tier history entries
					tierHistoryEntries = agents
						.filter(agent => agent.agentTier !== actionData.agentTier)
						.map(agent => ({
							agentId: agent.id,
							previousTier: agent.agentTier,
							newTier: actionData.agentTier,
							promotedBy: ctx.session.user.id,
							reason: actionData.reason || "Bulk tier change",
							effectiveDate: new Date(),
						}));
					break;

				case "assign_team":
					if (!actionData?.teamId) {
						throw new Error("Team ID is required for team assignment");
					}
					updateData.teamId = actionData.teamId;
					break;

				default:
					throw new Error("Invalid bulk action");
			}

			// Update agents
			const updatedAgents = await db
				.update(user)
				.set(updateData)
				.where(inArray(user.id, agentIds))
				.returning();

			// Insert tier history if applicable
			if (tierHistoryEntries.length > 0) {
				await db.insert(agentTierHistory).values(tierHistoryEntries);
			}

			return {
				updatedCount: updatedAgents.length,
				agents: updatedAgents,
			};
		}),

	// Get agent statistics (admin only)
	getStats: adminProcedure
		.query(async () => {
			// Overall agent stats
			const [agentStats] = await db
				.select({
					totalAgents: sql<number>`count(*)`,
					activeAgents: sql<number>`count(*) filter (where role = 'agent')`,
					teamLeads: sql<number>`count(*) filter (where role = 'team_lead')`,
					admins: sql<number>`count(*) filter (where role = 'admin')`,
				})
				.from(user);

			// Tier distribution
			const tierDistribution = await db
				.select({
					tier: user.agentTier,
					count: sql<number>`count(*)`,
				})
				.from(user)
				.where(eq(user.role, "agent"))
				.groupBy(user.agentTier);

			// Team distribution
			const teamDistribution = await db
				.select({
					teamId: user.teamId,
					teamName: teams.name,
					agentCount: sql<number>`count(*)`,
				})
				.from(user)
				.leftJoin(teams, eq(user.teamId, teams.id))
				.where(eq(user.role, "agent"))
				.groupBy(user.teamId, teams.name);

			return {
				...agentStats,
				tierDistribution,
				teamDistribution,
				tierConfig: AGENT_TIER_CONFIG,
			};
		}),

	// Get my profile (for any authenticated user)
	getMyProfile: protectedProcedure
		.query(async ({ ctx }) => {
			const [profileData] = await db
				.select({
					agent: user,
					team: teams,
					agency: agencies,
				})
				.from(user)
				.leftJoin(teams, eq(user.teamId, teams.id))
				.leftJoin(agencies, eq(user.agencyId, agencies.id))
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (!profileData) {
				throw new Error("Profile not found");
			}

			// Get my goals
			const myGoals = await db
				.select()
				.from(agentGoals)
				.where(
					and(
						eq(agentGoals.agentId, ctx.session.user.id),
						eq(agentGoals.isActive, true)
					)
				)
				.orderBy(desc(agentGoals.createdAt));

			// Get my recent performance
			const [recentPerformance] = await db
				.select()
				.from(performanceMetrics)
				.where(
					and(
						eq(performanceMetrics.agentId, ctx.session.user.id),
						eq(performanceMetrics.periodType, "monthly")
					)
				)
				.orderBy(desc(performanceMetrics.periodStart))
				.limit(1);

			return {
				...profileData,
				goals: myGoals,
				recentPerformance,
			};
		}),
});
