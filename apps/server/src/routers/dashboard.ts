import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { agencies, dashboardPreferences, teams, user } from "../db/schema/auth";
import { transactions } from "../db/schema/transactions";
import { protectedProcedure, router } from "../lib/trpc";

// Input schemas
const dashboardPreferencesInput = z.object({
	dashboardType: z.enum(["agent", "admin"]),
	layoutConfig: z.record(z.any()).optional(),
	widgetVisibility: z.record(z.boolean()).optional(),
	notificationSettings: z.record(z.any()).optional(),
});

const dateRangeInput = z.object({
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export const dashboardRouter = router({
	// Get financial overview for agent dashboard
	getFinancialOverview: protectedProcedure
		.input(dateRangeInput)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { startDate, endDate } = input;

			// Build date filter conditions
			const dateConditions = [];
			if (startDate) {
				dateConditions.push(
					sql`${transactions.transactionDate} >= ${startDate}`,
				);
			}
			if (endDate) {
				dateConditions.push(sql`${transactions.transactionDate} <= ${endDate}`);
			}

			// Get commission data
			const commissionData = await db
				.select({
					totalCommission: sql<number>`SUM(CAST(${transactions.commissionAmount} AS DECIMAL))`,
					completedDeals: sql<number>`COUNT(CASE WHEN ${transactions.status} = 'completed' THEN 1 END)`,
					pendingCommission: sql<number>`SUM(CASE WHEN ${transactions.status} IN ('approved', 'under_review') THEN CAST(${transactions.commissionAmount} AS DECIMAL) ELSE 0 END)`,
					averageDealValue: sql<number>`AVG(CASE WHEN ${transactions.propertyData}->>'price' IS NOT NULL THEN CAST(${transactions.propertyData}->>'price' AS DECIMAL) END)`,
				})
				.from(transactions)
				.where(and(eq(transactions.agentId, userId), ...dateConditions));

			// Get monthly trend data
			const monthlyTrend = await db
				.select({
					month: sql<string>`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`,
					commission: sql<number>`SUM(CAST(${transactions.commissionAmount} AS DECIMAL))`,
					deals: sql<number>`COUNT(*)`,
				})
				.from(transactions)
				.where(
					and(
						eq(transactions.agentId, userId),
						sql`${transactions.transactionDate} >= NOW() - INTERVAL '12 months'`,
					),
				)
				.groupBy(sql`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`)
				.orderBy(sql`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`);

			return {
				overview: commissionData[0] || {
					totalCommission: 0,
					completedDeals: 0,
					pendingCommission: 0,
					averageDealValue: 0,
				},
				monthlyTrend,
			};
		}),

	// Get sales pipeline data
	getSalesPipeline: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// Get pipeline status breakdown
		const pipelineData = await db
			.select({
				status: transactions.status,
				count: sql<number>`COUNT(*)`,
				totalValue: sql<number>`SUM(CASE WHEN ${transactions.propertyData}->>'price' IS NOT NULL THEN CAST(${transactions.propertyData}->>'price' AS DECIMAL) ELSE 0 END)`,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.agentId, userId),
					sql`${transactions.status} NOT IN ('completed', 'rejected')`,
				),
			)
			.groupBy(transactions.status);

		// Get active transactions
		const activeTransactions = await db
			.select({
				id: transactions.id,
				propertyAddress: sql<string>`${transactions.propertyData}->>'address'`,
				propertyPrice: sql<number>`CAST(${transactions.propertyData}->>'price' AS DECIMAL)`,
				clientName: sql<string>`${transactions.clientData}->>'name'`,
				status: transactions.status,
				transactionDate: transactions.transactionDate,
				commissionAmount: transactions.commissionAmount,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.agentId, userId),
					sql`${transactions.status} NOT IN ('completed', 'rejected')`,
				),
			)
			.orderBy(desc(transactions.updatedAt))
			.limit(10);

		return {
			pipeline: pipelineData,
			activeTransactions,
		};
	}),

	// Get transaction status overview
	getTransactionStatus: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const statusData = await db
			.select({
				status: transactions.status,
				count: sql<number>`COUNT(*)`,
				percentage: sql<number>`ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2)`,
			})
			.from(transactions)
			.where(eq(transactions.agentId, userId))
			.groupBy(transactions.status)
			.orderBy(sql`COUNT(*) DESC`);

		return statusData;
	}),

	// Get recent transactions for team activity feed
	getRecentTransactions: protectedProcedure
		.input(z.object({ limit: z.number().default(20) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			// Get user's team information
			const userInfo = await db
				.select({
					teamId: user.teamId,
					agencyId: user.agencyId,
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			if (!userInfo[0]?.teamId) {
				// If user has no team, return only their transactions
				const userTransactions = await db
					.select({
						id: transactions.id,
						agentId: transactions.agentId,
						agentName: user.name,
						propertyAddress: sql<string>`${transactions.propertyData}->>'address'`,
						propertyPrice: sql<number>`CAST(${transactions.propertyData}->>'price' AS DECIMAL)`,
						clientName: sql<string>`${transactions.clientData}->>'name'`,
						status: transactions.status,
						transactionDate: transactions.transactionDate,
						updatedAt: transactions.updatedAt,
					})
					.from(transactions)
					.innerJoin(user, eq(transactions.agentId, user.id))
					.where(eq(transactions.agentId, userId))
					.orderBy(desc(transactions.updatedAt))
					.limit(input.limit);

				return userTransactions;
			}

			// Get team transactions
			const teamTransactions = await db
				.select({
					id: transactions.id,
					agentId: transactions.agentId,
					agentName: user.name,
					propertyAddress: sql<string>`${transactions.propertyData}->>'address'`,
					propertyPrice: sql<number>`CAST(${transactions.propertyData}->>'price' AS DECIMAL)`,
					clientName: sql<string>`${transactions.clientData}->>'name'`,
					status: transactions.status,
					transactionDate: transactions.transactionDate,
					updatedAt: transactions.updatedAt,
				})
				.from(transactions)
				.innerJoin(user, eq(transactions.agentId, user.id))
				.where(eq(user.teamId, userInfo[0].teamId))
				.orderBy(desc(transactions.updatedAt))
				.limit(input.limit);

			return teamTransactions;
		}),

	// Get/Update dashboard preferences
	getPreferences: protectedProcedure
		.input(z.object({ dashboardType: z.enum(["agent", "admin"]) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const preferences = await db
				.select()
				.from(dashboardPreferences)
				.where(
					and(
						eq(dashboardPreferences.userId, userId),
						eq(dashboardPreferences.dashboardType, input.dashboardType),
					),
				)
				.limit(1);

			return preferences[0] || null;
		}),

	updatePreferences: protectedProcedure
		.input(dashboardPreferencesInput)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [updatedPreference] = await db
				.insert(dashboardPreferences)
				.values({
					userId,
					dashboardType: input.dashboardType,
					layoutConfig: input.layoutConfig
						? JSON.stringify(input.layoutConfig)
						: null,
					widgetVisibility: input.widgetVisibility
						? JSON.stringify(input.widgetVisibility)
						: null,
					notificationSettings: input.notificationSettings
						? JSON.stringify(input.notificationSettings)
						: null,
				})
				.onConflictDoUpdate({
					target: [
						dashboardPreferences.userId,
						dashboardPreferences.dashboardType,
					],
					set: {
						layoutConfig: input.layoutConfig
							? JSON.stringify(input.layoutConfig)
							: null,
						widgetVisibility: input.widgetVisibility
							? JSON.stringify(input.widgetVisibility)
							: null,
						notificationSettings: input.notificationSettings
							? JSON.stringify(input.notificationSettings)
							: null,
						updatedAt: sql`NOW()`,
					},
				})
				.returning();

			return updatedPreference;
		}),

	// Get team leaderboard for competitive element
	getTeamLeaderboard: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// Get user's team
		const userInfo = await db
			.select({ teamId: user.teamId })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!userInfo[0]?.teamId) {
			return [];
		}

		// Get team member performance
		const leaderboard = await db
			.select({
				agentId: user.id,
				agentName: user.name,
				agentImage: user.image,
				totalCommission: sql<number>`COALESCE(SUM(CAST(${transactions.commissionAmount} AS DECIMAL)), 0)`,
				completedDeals: sql<number>`COUNT(CASE WHEN ${transactions.status} = 'completed' THEN 1 END)`,
				activeDeals: sql<number>`COUNT(CASE WHEN ${transactions.status} NOT IN ('completed', 'rejected') THEN 1 END)`,
			})
			.from(user)
			.leftJoin(transactions, eq(user.id, transactions.agentId))
			.where(eq(user.teamId, userInfo[0].teamId))
			.groupBy(user.id, user.name, user.image)
			.orderBy(
				sql`COALESCE(SUM(CAST(${transactions.commissionAmount} AS DECIMAL)), 0) DESC`,
			)
			.limit(10);

		return leaderboard;
	}),
});
