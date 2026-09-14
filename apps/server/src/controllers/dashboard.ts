import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { agencies, dashboardPreferences, teams, user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import { protectedProcedure, router } from "../utils/trpc";

// Input schemas
const dashboardPreferencesInput = z.object({
	dashboardType: z.enum(["agent", "admin"]),
	layoutConfig: z.record(z.any()).optional(),
	widgetVisibility: z.record(z.boolean()).optional(),
	notificationSettings: z.record(z.any()).optional(),
});

const dateRangeInput = z.object({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
});

const leaderboardPeriodInput = z.object({
	period: z.enum(["month", "30d", "all"]).default("month"),
});

/** Primary → project · unit; secondary → address, then project/unit. */
const propertyLabelSql = sql<string>`CASE
	WHEN ${transactions.marketType} = 'primary' THEN COALESCE(
		NULLIF(
			TRIM(BOTH ' · ' FROM CONCAT_WS(
				' · ',
				NULLIF(TRIM(${transactions.projectName}), ''),
				CASE
					WHEN NULLIF(TRIM(${transactions.unitNo}), '') IS NOT NULL
					THEN CONCAT('Unit ', TRIM(${transactions.unitNo}))
					ELSE NULL
				END
			)),
			''
		),
		NULLIF(TRIM(${transactions.propertyData}->>'address'), ''),
		'Unknown Property'
	)
	ELSE COALESCE(
		NULLIF(TRIM(${transactions.propertyData}->>'address'), ''),
		NULLIF(
			TRIM(BOTH ' · ' FROM CONCAT_WS(
				' · ',
				NULLIF(TRIM(${transactions.projectName}), ''),
				CASE
					WHEN NULLIF(TRIM(${transactions.unitNo}), '') IS NOT NULL
					THEN CONCAT('Unit ', TRIM(${transactions.unitNo}))
					ELSE NULL
				END
			)),
			''
		),
		'Unknown Property'
	)
END`;

type OverviewTotals = {
	totalCommission: number;
	completedDeals: number;
	pendingCommission: number;
	averageDealValue: number;
};

function parseOverviewRow(
	row:
		| {
				totalCommission: string;
				completedDeals: string;
				pendingCommission: string;
				averageDealValue: string;
		  }
		| undefined,
): OverviewTotals {
	if (!row) {
		return {
			totalCommission: 0,
			completedDeals: 0,
			pendingCommission: 0,
			averageDealValue: 0,
		};
	}
	return {
		totalCommission: Number(row.totalCommission) || 0,
		completedDeals: Number(row.completedDeals) || 0,
		pendingCommission: Number(row.pendingCommission) || 0,
		averageDealValue: Number(row.averageDealValue) || 0,
	};
}

function pctChange(current: number, previous: number): number | null {
	if (previous === 0 && current === 0) return null;
	if (previous === 0) return null;
	return Math.round(((current - previous) / previous) * 100);
}

function comparisonMeta(
	current: number,
	previous: number,
	suffix: string,
): { changePct: number | null; label: string; trend: "up" | "down" | "neutral" } {
	const changePct = pctChange(current, previous);
	if (changePct === null) {
		return {
			changePct: null,
			label: current === 0 && previous === 0 ? "No prior data" : suffix,
			trend: "neutral",
		};
	}
	const sign = changePct > 0 ? "+" : "";
	return {
		changePct,
		label: `${sign}${changePct}% ${suffix}`,
		trend: changePct > 0 ? "up" : changePct < 0 ? "down" : "neutral",
	};
}

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

			const overviewSelect = {
				totalCommission: sql<string>`COALESCE(SUM(${transactions.commissionAmount}), 0)`,
				completedDeals: sql<string>`COUNT(CASE WHEN ${transactions.status} = 'completed' THEN 1 END)`,
				pendingCommission: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.status} IN ('approved', 'under_review', 'verified', 'pending') THEN ${transactions.commissionAmount} ELSE 0 END), 0)`,
				averageDealValue: sql<string>`COALESCE(AVG(CASE WHEN ${transactions.propertyData}->>'price' IS NOT NULL THEN CAST(${transactions.propertyData}->>'price' AS DECIMAL) END), 0)`,
			};

			// Get commission data (PostgreSQL returns strings for aggregates)
			const rawCommissionData = await db
				.select(overviewSelect)
				.from(transactions)
				.where(and(eq(transactions.agentId, userId), ...dateConditions));

			// Prior equal window when a date range is set; otherwise MoM from monthly trend
			let previousOverview: OverviewTotals | null = null;
			let comparisonSuffix = "vs prior period";
			if (startDate && endDate) {
				const durationMs = Math.max(
					endDate.getTime() - startDate.getTime(),
					24 * 60 * 60 * 1000,
				);
				const prevEnd = new Date(startDate.getTime() - 1);
				const prevStart = new Date(prevEnd.getTime() - durationMs);
				const prevRows = await db
					.select(overviewSelect)
					.from(transactions)
					.where(
						and(
							eq(transactions.agentId, userId),
							sql`${transactions.transactionDate} >= ${prevStart}`,
							sql`${transactions.transactionDate} <= ${prevEnd}`,
						),
					);
				previousOverview = parseOverviewRow(prevRows[0]);
			}

			// Get monthly trend data
			const rawMonthlyTrend = await db
				.select({
					month: sql<string>`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`,
					commission: sql<string>`COALESCE(SUM(${transactions.commissionAmount}), 0)`,
					deals: sql<string>`COUNT(*)`,
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

			const overview = parseOverviewRow(rawCommissionData[0]);

			const monthlyTrend = rawMonthlyTrend.map((item) => ({
				month: item.month,
				commission: Number(item.commission) || 0,
				deals: Number(item.deals) || 0,
			}));

			// Dated range → prior equal window on full overview; all-time → last vs prior month
			let compareCurrent = overview;
			let comparePrevious = previousOverview;
			if (!(startDate && endDate)) {
				comparisonSuffix = "vs last month";
				if (monthlyTrend.length >= 1) {
					const last = monthlyTrend[monthlyTrend.length - 1];
					const prior =
						monthlyTrend.length >= 2
							? monthlyTrend[monthlyTrend.length - 2]
							: { commission: 0, deals: 0, month: "" };
					compareCurrent = {
						totalCommission: last.commission,
						completedDeals: last.deals,
						pendingCommission: overview.pendingCommission,
						averageDealValue: overview.averageDealValue,
					};
					comparePrevious = {
						totalCommission: prior.commission,
						completedDeals: prior.deals,
						pendingCommission: 0,
						averageDealValue: 0,
					};
				} else {
					comparePrevious = {
						totalCommission: 0,
						completedDeals: 0,
						pendingCommission: 0,
						averageDealValue: 0,
					};
				}
			}

			const prev = comparePrevious ?? {
				totalCommission: 0,
				completedDeals: 0,
				pendingCommission: 0,
				averageDealValue: 0,
			};

			const hasDateRange = Boolean(startDate && endDate);
			const comparisons = {
				totalCommission: comparisonMeta(
					compareCurrent.totalCommission,
					prev.totalCommission,
					comparisonSuffix,
				),
				completedDeals: comparisonMeta(
					compareCurrent.completedDeals,
					prev.completedDeals,
					comparisonSuffix,
				),
				pendingCommission: hasDateRange
					? comparisonMeta(
							compareCurrent.pendingCommission,
							prev.pendingCommission,
							comparisonSuffix,
						)
					: {
							changePct: null,
							label: "Open pipeline",
							trend: "neutral" as const,
						},
				averageDealValue: hasDateRange
					? comparisonMeta(
							compareCurrent.averageDealValue,
							prev.averageDealValue,
							comparisonSuffix,
						)
					: {
							changePct: null,
							label: "All time avg",
							trend: "neutral" as const,
						},
			};

			return {
				overview,
				monthlyTrend,
				comparisons,
				scopeLabel: startDate && endDate ? "Selected period" : "All time",
			};
		}),

	// Get sales pipeline data
	getSalesPipeline: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		// Get pipeline status breakdown
		// Note: Use commission_amount for total value, not property price
		const rawPipelineData = await db
			.select({
				status: transactions.status,
				count: sql<string>`COUNT(*)`,
				totalValue: sql<string>`COALESCE(SUM(${transactions.commissionAmount}), 0)`,
			})
			.from(transactions)
			.where(
				and(
					eq(transactions.agentId, userId),
					sql`${transactions.status} NOT IN ('completed', 'rejected')`,
				),
			)
			.groupBy(transactions.status);

		// Convert string values to numbers (PostgreSQL returns strings for aggregates)
		const pipelineData = rawPipelineData.map((item) => ({
			status: item.status,
			count: Number(item.count) || 0,
			totalValue: Number(item.totalValue) || 0,
		}));

		// Get active transactions
		const activeTransactions = await db
			.select({
				id: transactions.id,
				propertyAddress: propertyLabelSql,
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

		const rawStatusData = await db
			.select({
				status: transactions.status,
				count: sql<string>`COUNT(*)`,
				percentage: sql<string>`ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2)`,
			})
			.from(transactions)
			.where(eq(transactions.agentId, userId))
			.groupBy(transactions.status)
			.orderBy(sql`COUNT(*) DESC`);

		// Convert string values to numbers (PostgreSQL returns strings for aggregates)
		const statusData = rawStatusData.map((item) => ({
			status: item.status,
			count: Number(item.count) || 0,
			percentage: Number(item.percentage) || 0,
		}));

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
						agentImage: user.image,
						propertyAddress: propertyLabelSql,
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
					agentImage: user.image,
					propertyAddress: propertyLabelSql,
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
	getTeamLeaderboard: protectedProcedure
		.input(leaderboardPeriodInput)
		.query(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const periodCondition =
			input.period === "all"
				? sql`TRUE`
				: input.period === "30d"
					? sql`${transactions.transactionDate} >= NOW() - INTERVAL '30 days'`
					: sql`DATE_TRUNC('month', ${transactions.transactionDate}) = DATE_TRUNC('month', NOW())`;

		// Get user's team
		const userInfo = await db
			.select({ teamId: user.teamId })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		const whereCondition = userInfo[0]?.teamId
			? eq(user.teamId, userInfo[0].teamId)
			: eq(user.id, userId);

		// Get team member performance (PostgreSQL returns strings for aggregates)
		const rawLeaderboard = await db
			.select({
				agentId: user.id,
				agentName: user.name,
				agentImage: user.image,
				totalCommission: sql<string>`COALESCE(SUM(${transactions.commissionAmount}), 0)`,
				completedDeals: sql<string>`COUNT(CASE WHEN ${transactions.status} = 'completed' THEN 1 END)`,
				activeDeals: sql<string>`COUNT(CASE WHEN ${transactions.status} NOT IN ('completed', 'rejected') THEN 1 END)`,
				submittedDeals: sql<string>`COUNT(CASE WHEN ${transactions.status} = 'submitted' THEN 1 END)`,
				recentCompletedDeals: sql<string>`COUNT(CASE WHEN ${transactions.status} = 'completed' AND ${transactions.updatedAt} >= NOW() - INTERVAL '7 days' THEN 1 END)`,
			})
			.from(user)
			.leftJoin(
				transactions,
				and(eq(user.id, transactions.agentId), periodCondition),
			)
			.where(whereCondition)
			.groupBy(user.id, user.name, user.image)
			.limit(10);

		// Convert string values to numbers and calculate gamification fields
		const withGamification = rawLeaderboard.map((item) => {
			const totalCommission = Number(item.totalCommission) || 0;
			const completedDeals = Number(item.completedDeals) || 0;
			const activeDeals = Number(item.activeDeals) || 0;
			const submittedDeals = Number(item.submittedDeals) || 0;
			const recentCompletedDeals = Number(item.recentCompletedDeals) || 0;
			const score = Math.round(
				completedDeals * 100 +
					activeDeals * 25 +
					submittedDeals * 40 +
					totalCommission / 1000 +
					recentCompletedDeals * 20,
			);
			const level = Math.floor(score / 300) + 1;
			const badges: string[] = [];
			if (completedDeals >= 1) badges.push("Deal Closer");
			if (completedDeals >= 5) badges.push("Top Seller");
			if (totalCommission >= 10000) badges.push("Commission Pro");
			if (recentCompletedDeals >= 2) badges.push("On Fire");
			if (activeDeals >= 3) badges.push("Pipeline Builder");

			return {
				agentId: item.agentId,
				agentName: item.agentName,
				agentImage: item.agentImage,
				totalCommission,
				completedDeals,
				activeDeals,
				score,
				level,
				streakDays: recentCompletedDeals * 2,
				badges,
			};
		});

		// Sort by gamification score first, then commission
		const ranked = withGamification
			.sort((a, b) => b.score - a.score || b.totalCommission - a.totalCommission)
			.map((item, index) => ({
				...item,
				rank: index + 1,
			}));

		const leaderboard = ranked.map((item) => ({
			agentId: item.agentId,
			agentName: item.agentName,
			agentImage: item.agentImage,
			totalCommission: item.totalCommission,
			completedDeals: item.completedDeals,
			activeDeals: item.activeDeals,
			score: item.score,
			level: item.level,
			rank: item.rank,
			streakDays: item.streakDays,
			badges: item.badges,
		}));

		return leaderboard;
	}),
});
