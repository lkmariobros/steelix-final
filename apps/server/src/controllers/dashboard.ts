import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { agencies, dashboardPreferences, teams, user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import {
	agentVisibleTransactionsSql,
	resolveViewerCommission,
} from "../utils/transaction-visibility";
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

			const dateConditions = [];
			if (startDate) {
				dateConditions.push(
					sql`${transactions.transactionDate} >= ${startDate}`,
				);
			}
			if (endDate) {
				dateConditions.push(sql`${transactions.transactionDate} <= ${endDate}`);
			}

			const visibility = agentVisibleTransactionsSql(userId);

			const visibleRows = await db
				.select({
					agentId: transactions.agentId,
					status: transactions.status,
					commissionAmount: transactions.commissionAmount,
					coBrokingData: transactions.coBrokingData,
					commissionBreakdown: transactions.commissionBreakdown,
					propertyData: transactions.propertyData,
					transactionDate: transactions.transactionDate,
				})
				.from(transactions)
				.where(and(visibility, ...dateConditions));

			const shareOf = (row: (typeof visibleRows)[number]) =>
				resolveViewerCommission({
					viewerId: userId,
					agentId: row.agentId,
					commissionAmount: row.commissionAmount,
					coBrokingData: row.coBrokingData,
					commissionBreakdown: row.commissionBreakdown,
				}).myCommissionAmount;

			const PENDING_STATUSES = new Set([
				"approved",
				"under_review",
				"verified",
				"pending",
				"submitted",
			]);

			let totalCommission = 0;
			let pendingCommission = 0;
			let completedDeals = 0;
			let dealValueSum = 0;
			let dealValueCount = 0;
			for (const row of visibleRows) {
				const mine = shareOf(row);
				totalCommission += mine;
				if (row.status && PENDING_STATUSES.has(row.status)) {
					pendingCommission += mine;
				}
				if (row.status === "completed" || row.status === "converted") {
					completedDeals += 1;
				}
				const price = (row.propertyData as { price?: number } | null)?.price;
				if (price != null && Number(price) > 0) {
					dealValueSum += Number(price);
					dealValueCount += 1;
				}
			}

			const overview: OverviewTotals = {
				totalCommission: Math.round(totalCommission * 100) / 100,
				completedDeals,
				pendingCommission: Math.round(pendingCommission * 100) / 100,
				averageDealValue:
					dealValueCount > 0
						? Math.round((dealValueSum / dealValueCount) * 100) / 100
						: 0,
			};

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
					.select({
						agentId: transactions.agentId,
						status: transactions.status,
						commissionAmount: transactions.commissionAmount,
						coBrokingData: transactions.coBrokingData,
						commissionBreakdown: transactions.commissionBreakdown,
						propertyData: transactions.propertyData,
					})
					.from(transactions)
					.where(
						and(
							visibility,
							sql`${transactions.transactionDate} >= ${prevStart}`,
							sql`${transactions.transactionDate} <= ${prevEnd}`,
						),
					);
				let prevTotal = 0;
				let prevPending = 0;
				let prevCompleted = 0;
				let prevDealSum = 0;
				let prevDealCount = 0;
				for (const row of prevRows) {
					const mine = resolveViewerCommission({
						viewerId: userId,
						agentId: row.agentId,
						commissionAmount: row.commissionAmount,
						coBrokingData: row.coBrokingData,
						commissionBreakdown: row.commissionBreakdown,
					}).myCommissionAmount;
					prevTotal += mine;
					if (row.status && PENDING_STATUSES.has(row.status)) prevPending += mine;
					if (row.status === "completed" || row.status === "converted") {
						prevCompleted += 1;
					}
					const price = (row.propertyData as { price?: number } | null)?.price;
					if (price != null && Number(price) > 0) {
						prevDealSum += Number(price);
						prevDealCount += 1;
					}
				}
				previousOverview = {
					totalCommission: Math.round(prevTotal * 100) / 100,
					completedDeals: prevCompleted,
					pendingCommission: Math.round(prevPending * 100) / 100,
					averageDealValue:
						prevDealCount > 0
							? Math.round((prevDealSum / prevDealCount) * 100) / 100
							: 0,
				};
			}

			// Get monthly trend data (owner cases + co-broker share attributed in JS)
			const trendRows = await db
				.select({
					month: sql<string>`TO_CHAR(${transactions.transactionDate}, 'YYYY-MM')`,
					agentId: transactions.agentId,
					commissionAmount: transactions.commissionAmount,
					coBrokingData: transactions.coBrokingData,
					commissionBreakdown: transactions.commissionBreakdown,
				})
				.from(transactions)
				.where(
					and(
						visibility,
						sql`${transactions.transactionDate} >= NOW() - INTERVAL '12 months'`,
					),
				);

			const trendMap = new Map<string, { commission: number; deals: number }>();
			for (const row of trendRows) {
				const month = row.month;
				const cur = trendMap.get(month) ?? { commission: 0, deals: 0 };
				cur.commission += resolveViewerCommission({
					viewerId: userId,
					agentId: row.agentId,
					commissionAmount: row.commissionAmount,
					coBrokingData: row.coBrokingData,
					commissionBreakdown: row.commissionBreakdown,
				}).myCommissionAmount;
				cur.deals += 1;
				trendMap.set(month, cur);
			}
			const rawMonthlyTrend = [...trendMap.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, v]) => ({
					month,
					commission: String(Math.round(v.commission * 100) / 100),
					deals: String(v.deals),
				}));

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
		const visibility = agentVisibleTransactionsSql(userId);

		const activeRows = await db
			.select({
				id: transactions.id,
				agentId: transactions.agentId,
				status: transactions.status,
				transactionDate: transactions.transactionDate,
				updatedAt: transactions.updatedAt,
				commissionAmount: transactions.commissionAmount,
				coBrokingData: transactions.coBrokingData,
				commissionBreakdown: transactions.commissionBreakdown,
				propertyAddress: propertyLabelSql,
				propertyPrice: sql<number>`CAST(${transactions.propertyData}->>'price' AS DECIMAL)`,
				clientName: sql<string>`${transactions.clientData}->>'name'`,
			})
			.from(transactions)
			.where(
				and(
					visibility,
					sql`${transactions.status} NOT IN ('completed', 'rejected', 'converted', 'cancelled')`,
				),
			)
			.orderBy(desc(transactions.updatedAt));

		const byStatus = new Map<string, { count: number; totalValue: number }>();
		for (const row of activeRows) {
			const status = row.status ?? "draft";
			const mine = resolveViewerCommission({
				viewerId: userId,
				agentId: row.agentId,
				commissionAmount: row.commissionAmount,
				coBrokingData: row.coBrokingData,
				commissionBreakdown: row.commissionBreakdown,
			}).myCommissionAmount;
			const cur = byStatus.get(status) ?? { count: 0, totalValue: 0 };
			cur.count += 1;
			cur.totalValue += mine;
			byStatus.set(status, cur);
		}

		const pipelineData = [...byStatus.entries()].map(([status, v]) => ({
			status,
			count: v.count,
			totalValue: Math.round(v.totalValue * 100) / 100,
		}));

		const activeTransactions = activeRows.slice(0, 10).map((row) => {
			const share = resolveViewerCommission({
				viewerId: userId,
				agentId: row.agentId,
				commissionAmount: row.commissionAmount,
				coBrokingData: row.coBrokingData,
				commissionBreakdown: row.commissionBreakdown,
			});
			return {
				id: row.id,
				propertyAddress: row.propertyAddress,
				propertyPrice: row.propertyPrice,
				clientName: row.clientName,
				status: row.status,
				transactionDate: row.transactionDate,
				commissionAmount: String(share.myCommissionAmount),
			};
		});

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
			.where(agentVisibleTransactionsSql(userId))
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
				// Owner cases + cases where this agent is an internal co-broker
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
					.where(agentVisibleTransactionsSql(userId))
					.orderBy(desc(transactions.updatedAt))
					.limit(input.limit);

				return userTransactions;
			}

			// Team feed, plus any co-broker cases for this user outside the team
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
				.where(
					or(
						eq(user.teamId, userInfo[0].teamId),
						agentVisibleTransactionsSql(userId),
					),
				)
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
