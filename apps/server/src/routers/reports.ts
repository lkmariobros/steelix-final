import { and, desc, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	reports,
	performanceMetrics,
	insertReportSchema,
	selectReportSchema,
	REPORT_EXPIRY_DAYS,
	PERFORMANCE_PERIODS,
} from "../db/schema/reports";
import { user, agencies, teams } from "../db/schema/auth";
import { transactions } from "../db/schema/transactions";
import { commissionApprovals } from "../db/schema/approvals";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";

// Input schemas
const generateReportInput = insertReportSchema.extend({
	generateNow: z.boolean().default(true),
});

const listReportsInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	type: z.enum(["performance", "financial", "agent_activity", "transaction_summary", "commission_analysis", "custom"]).optional(),
	status: z.enum(["pending", "generating", "completed", "failed", "scheduled"]).optional(),
	generatedBy: z.string().optional(),
	sortBy: z.enum(["createdAt", "generatedAt", "name"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const reportIdInput = z.object({
	id: z.string().uuid(),
});

const dashboardStatsInput = z.object({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	agencyId: z.string().uuid().optional(),
	teamId: z.string().uuid().optional(),
});

const performanceAnalyticsInput = z.object({
	periodType: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	agentIds: z.array(z.string()).optional(),
	teamIds: z.array(z.string().uuid()).optional(),
	agencyIds: z.array(z.string().uuid()).optional(),
});

const transactionAnalyticsInput = z.object({
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	groupBy: z.enum(["day", "week", "month", "quarter", "year"]).default("month"),
	marketType: z.enum(["primary", "secondary"]).optional(),
	transactionType: z.enum(["sale", "lease", "rental"]).optional(),
	agentIds: z.array(z.string()).optional(),
});

export const reportsRouter = router({
	// Generate a new report (admin only)
	generate: adminProcedure
		.input(generateReportInput)
		.mutation(async ({ ctx, input }) => {
			const { generateNow, ...reportData } = input;

			// Calculate expiry date based on frequency
			const expiryDays = REPORT_EXPIRY_DAYS[reportData.frequency] || 30;
			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + expiryDays);

			const newReport = {
				...reportData,
				generatedBy: ctx.session.user.id,
				status: generateNow ? "generating" as const : "scheduled" as const,
				expiresAt,
			};

			const [report] = await db
				.insert(reports)
				.values(newReport)
				.returning();

			if (generateNow) {
				// In a real implementation, this would trigger background job
				// For now, we'll generate basic report data immediately
				const reportData = await generateReportData(report.id, report.type, report.filters, report.startDate, report.endDate);
				
				const [updatedReport] = await db
					.update(reports)
					.set({
						status: "completed",
						data: reportData,
						generatedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(reports.id, report.id))
					.returning();

				return updatedReport;
			}

			return report;
		}),

	// List reports (admin only)
	list: adminProcedure
		.input(listReportsInput)
		.query(async ({ input }) => {
			const conditions = [];

			if (input.type) {
				conditions.push(eq(reports.type, input.type));
			}
			if (input.status) {
				conditions.push(eq(reports.status, input.status));
			}
			if (input.generatedBy) {
				conditions.push(eq(reports.generatedBy, input.generatedBy));
			}

			const orderByColumn = input.sortBy === "createdAt" 
				? reports.createdAt
				: input.sortBy === "generatedAt"
				? reports.generatedAt
				: reports.name;

			const orderByClause = input.sortOrder === "asc" 
				? orderByColumn 
				: desc(orderByColumn);

			const reportsList = await db
				.select({
					report: reports,
					generatedByUser: {
						id: user.id,
						name: user.name,
						email: user.email,
					},
				})
				.from(reports)
				.leftJoin(user, eq(reports.generatedBy, user.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(orderByClause)
				.limit(input.limit)
				.offset(input.offset);

			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(reports)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			return {
				reports: reportsList,
				total: count,
				hasMore: input.offset + input.limit < count,
			};
		}),

	// Get report by ID (admin only)
	getById: adminProcedure
		.input(reportIdInput)
		.query(async ({ input }) => {
			const [reportData] = await db
				.select({
					report: reports,
					generatedByUser: {
						id: user.id,
						name: user.name,
						email: user.email,
					},
				})
				.from(reports)
				.leftJoin(user, eq(reports.generatedBy, user.id))
				.where(eq(reports.id, input.id))
				.limit(1);

			if (!reportData) {
				throw new Error("Report not found");
			}

			return reportData;
		}),

	// Get dashboard statistics (admin only)
	getDashboardStats: adminProcedure
		.input(dashboardStatsInput)
		.query(async ({ input }) => {
			const conditions = [];
			const userConditions = [];

			// Date range conditions
			if (input.startDate) {
				conditions.push(gte(transactions.createdAt, input.startDate));
			}
			if (input.endDate) {
				conditions.push(lte(transactions.createdAt, input.endDate));
			}

			// Filter conditions
			if (input.agencyId) {
				userConditions.push(eq(user.agencyId, input.agencyId));
			}
			if (input.teamId) {
				userConditions.push(eq(user.teamId, input.teamId));
			}

			// Get transaction statistics
			const transactionStatsQuery = db
				.select({
					totalTransactions: sql<number>`count(*)`,
					completedTransactions: sql<number>`count(*) filter (where ${transactions.status} = 'completed')`,
					pendingTransactions: sql<number>`count(*) filter (where ${transactions.status} in ('draft', 'submitted', 'under_review'))`,
					approvedTransactions: sql<number>`count(*) filter (where ${transactions.status} = 'approved')`,
					totalCommission: sql<number>`sum(cast(${transactions.commissionAmount} as decimal))`,
					averageCommission: sql<number>`avg(cast(${transactions.commissionAmount} as decimal))`,
				})
				.from(transactions);

			if (userConditions.length > 0) {
				transactionStatsQuery
					.leftJoin(user, eq(transactions.agentId, user.id))
					.where(and(...conditions, ...userConditions));
			} else {
				transactionStatsQuery.where(conditions.length > 0 ? and(...conditions) : undefined);
			}

			const [transactionStats] = await transactionStatsQuery;

			// Get approval statistics - FIXED: Properly define approvalConditions
			const approvalConditions = [];
			if (input.startDate) {
				approvalConditions.push(gte(commissionApprovals.submittedAt, input.startDate));
			}
			if (input.endDate) {
				approvalConditions.push(lte(commissionApprovals.submittedAt, input.endDate));
			}

			const approvalStatsQuery = db
				.select({
					totalApprovals: sql<number>`count(*)`,
					pendingApprovals: sql<number>`count(*) filter (where ${commissionApprovals.status} = 'pending')`,
					approvedApprovals: sql<number>`count(*) filter (where ${commissionApprovals.status} = 'approved')`,
					rejectedApprovals: sql<number>`count(*) filter (where ${commissionApprovals.status} = 'rejected')`,
					totalRequestedAmount: sql<number>`sum(cast(${commissionApprovals.requestedAmount} as decimal))`,
					totalApprovedAmount: sql<number>`sum(cast(${commissionApprovals.approvedAmount} as decimal))`,
				})
				.from(commissionApprovals);

			if (userConditions.length > 0) {
				approvalStatsQuery
					.leftJoin(user, eq(commissionApprovals.agentId, user.id))
					.where(and(...approvalConditions, ...userConditions));
			} else {
				approvalStatsQuery.where(approvalConditions.length > 0 ? and(...approvalConditions) : undefined);
			}

			const [approvalStats] = await approvalStatsQuery;

			// Get agent statistics
			const agentStatsQuery = db
				.select({
					totalAgents: sql<number>`count(*)`,
					activeAgents: sql<number>`count(*) filter (where ${user.role} = 'agent')`,
					teamLeads: sql<number>`count(*) filter (where ${user.role} = 'team_lead')`,
				})
				.from(user);

			if (userConditions.length > 0) {
				agentStatsQuery.where(and(...userConditions));
			}

			const [agentStats] = await agentStatsQuery;

			// Get top performers (last 30 days)
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const topPerformersQuery = db
				.select({
					agentId: performanceMetrics.agentId,
					agentName: user.name,
					totalTransactions: performanceMetrics.totalTransactions,
					totalCommission: performanceMetrics.totalCommission,
					conversionRate: performanceMetrics.conversionRate,
				})
				.from(performanceMetrics)
				.leftJoin(user, eq(performanceMetrics.agentId, user.id))
				.where(
					and(
						eq(performanceMetrics.periodType, "monthly"),
						gte(performanceMetrics.periodStart, thirtyDaysAgo),
						...(userConditions.length > 0 ? userConditions : [])
					)
				)
				.orderBy(desc(performanceMetrics.totalCommission))
				.limit(10);

			const topPerformers = await topPerformersQuery;

			return {
				transactions: transactionStats,
				approvals: approvalStats,
				agents: agentStats,
				topPerformers,
			};
		}),

	// Get performance analytics (admin only)
	getPerformanceAnalytics: adminProcedure
		.input(performanceAnalyticsInput)
		.query(async ({ input }) => {
			const conditions = [
				eq(performanceMetrics.periodType, input.periodType),
				gte(performanceMetrics.periodStart, input.startDate),
				lte(performanceMetrics.periodEnd, input.endDate),
			];

			if (input.agentIds && input.agentIds.length > 0) {
				conditions.push(inArray(performanceMetrics.agentId, input.agentIds));
			}

			// If team or agency filters are provided, join with user table
			let query = db
				.select({
					metrics: performanceMetrics,
					agent: {
						id: user.id,
						name: user.name,
						email: user.email,
						agentTier: user.agentTier,
					},
					team: {
						id: teams.id,
						name: teams.name,
					},
					agency: {
						id: agencies.id,
						name: agencies.name,
					},
				})
				.from(performanceMetrics)
				.leftJoin(user, eq(performanceMetrics.agentId, user.id))
				.leftJoin(teams, eq(user.teamId, teams.id))
				.leftJoin(agencies, eq(user.agencyId, agencies.id));

			if (input.teamIds && input.teamIds.length > 0) {
				conditions.push(inArray(user.teamId, input.teamIds));
			}
			if (input.agencyIds && input.agencyIds.length > 0) {
				conditions.push(inArray(user.agencyId, input.agencyIds));
			}

			const performanceData = await query
				.where(and(...conditions))
				.orderBy(desc(performanceMetrics.periodStart));

			// Aggregate data by period
			const aggregatedData = performanceData.reduce((acc, item) => {
				const periodKey = item.metrics.periodStart.toISOString().split('T')[0];
				if (!acc[periodKey]) {
					acc[periodKey] = {
						period: periodKey,
						totalTransactions: 0,
						totalCommission: 0,
						averageCommission: 0,
						agentCount: 0,
						agents: [],
					};
				}

				acc[periodKey].totalTransactions += item.metrics.totalTransactions;
				acc[periodKey].totalCommission += parseFloat(item.metrics.totalCommission);
				acc[periodKey].agentCount += 1;
				acc[periodKey].agents.push({
					...item.agent,
					metrics: item.metrics,
					team: item.team,
					agency: item.agency,
				});

				return acc;
			}, {} as Record<string, any>);

			// Calculate averages
			Object.values(aggregatedData).forEach((period: any) => {
				period.averageCommission = period.totalCommission / period.agentCount;
			});

			return {
				periods: Object.values(aggregatedData),
				summary: {
					totalPeriods: Object.keys(aggregatedData).length,
					totalAgents: new Set(performanceData.map(p => p.metrics.agentId)).size,
					overallCommission: Object.values(aggregatedData).reduce((sum: number, p: any) => sum + p.totalCommission, 0),
					overallTransactions: Object.values(aggregatedData).reduce((sum: number, p: any) => sum + p.totalTransactions, 0),
				},
			};
		}),

	// Get transaction analytics (admin only)
	getTransactionAnalytics: adminProcedure
		.input(transactionAnalyticsInput)
		.query(async ({ input }) => {
			const conditions = [
				gte(transactions.createdAt, input.startDate),
				lte(transactions.createdAt, input.endDate),
			];

			if (input.marketType) {
				conditions.push(eq(transactions.marketType, input.marketType));
			}
			if (input.transactionType) {
				conditions.push(eq(transactions.transactionType, input.transactionType));
			}
			if (input.agentIds && input.agentIds.length > 0) {
				conditions.push(inArray(transactions.agentId, input.agentIds));
			}

			// Build date truncation based on groupBy
			const dateTrunc = input.groupBy === "day" ? "day"
				: input.groupBy === "week" ? "week"
				: input.groupBy === "month" ? "month"
				: input.groupBy === "quarter" ? "quarter"
				: "year";

			const analyticsData = await db
				.select({
					period: sql<string>`date_trunc(${dateTrunc}, ${transactions.createdAt})::date`,
					totalTransactions: sql<number>`count(*)`,
					completedTransactions: sql<number>`count(*) filter (where ${transactions.status} = 'completed')`,
					totalCommission: sql<number>`sum(cast(${transactions.commissionAmount} as decimal))`,
					averageCommission: sql<number>`avg(cast(${transactions.commissionAmount} as decimal))`,
					primaryMarketCount: sql<number>`count(*) filter (where ${transactions.marketType} = 'primary')`,
					secondaryMarketCount: sql<number>`count(*) filter (where ${transactions.marketType} = 'secondary')`,
					salesCount: sql<number>`count(*) filter (where ${transactions.transactionType} = 'sale')`,
					leaseCount: sql<number>`count(*) filter (where ${transactions.transactionType} = 'lease')`,
				})
				.from(transactions)
				.where(and(...conditions))
				.groupBy(sql`date_trunc(${dateTrunc}, ${transactions.createdAt})`)
				.orderBy(sql`date_trunc(${dateTrunc}, ${transactions.createdAt})`);

			// Get status breakdown
			const statusBreakdown = await db
				.select({
					status: transactions.status,
					count: sql<number>`count(*)`,
					totalCommission: sql<number>`sum(cast(${transactions.commissionAmount} as decimal))`,
				})
				.from(transactions)
				.where(and(...conditions))
				.groupBy(transactions.status);

			return {
				timeSeriesData: analyticsData,
				statusBreakdown,
				summary: {
					totalTransactions: analyticsData.reduce((sum, item) => sum + item.totalTransactions, 0),
					totalCommission: analyticsData.reduce((sum, item) => sum + (item.totalCommission || 0), 0),
					averageCommission: analyticsData.reduce((sum, item) => sum + (item.averageCommission || 0), 0) / analyticsData.length,
					completionRate: analyticsData.reduce((sum, item) => sum + item.completedTransactions, 0) / 
						analyticsData.reduce((sum, item) => sum + item.totalTransactions, 0) * 100,
				},
			};
		}),

	// Get co-broking reports (admin only)
	getCoBrokingReports: adminProcedure
		.input(z.object({
			startDate: z.coerce.date().optional(),
			endDate: z.coerce.date().optional(),
			agencyName: z.string().optional(),
			limit: z.number().min(1).max(100).default(50),
			offset: z.number().min(0).default(0),
		}))
		.query(async ({ input }) => {
			const conditions = [
				eq(transactions.isCoBroking, true),
			];

			if (input.startDate) {
				conditions.push(gte(transactions.createdAt, input.startDate));
			}
			if (input.endDate) {
				conditions.push(lte(transactions.createdAt, input.endDate));
			}

			// Get co-broking transactions with agent info
			const coBrokingTransactions = await db
				.select({
					id: transactions.id,
					agentId: transactions.agentId,
					agentName: user.name,
					agentEmail: user.email,
					propertyData: transactions.propertyData,
					clientData: transactions.clientData,
					coBrokingData: transactions.coBrokingData,
					commissionAmount: transactions.commissionAmount,
					transactionType: transactions.transactionType,
					marketType: transactions.marketType,
					status: transactions.status,
					transactionDate: transactions.transactionDate,
					createdAt: transactions.createdAt,
				})
				.from(transactions)
				.leftJoin(user, eq(transactions.agentId, user.id))
				.where(and(...conditions))
				.orderBy(desc(transactions.createdAt))
				.limit(input.limit)
				.offset(input.offset);

			// Filter by agency name if provided (post-query filter since it's in JSONB)
			const filteredTransactions = input.agencyName
				? coBrokingTransactions.filter(t =>
					t.coBrokingData?.agencyName?.toLowerCase().includes(input.agencyName!.toLowerCase())
				)
				: coBrokingTransactions;

			// Get total count
			const [{ count: totalCount }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(transactions)
				.where(and(...conditions));

			// Aggregate by partner agency
			const agencyAggregation = filteredTransactions.reduce((acc, t) => {
				const agencyName = t.coBrokingData?.agencyName || 'Unknown Agency';
				if (!acc[agencyName]) {
					acc[agencyName] = {
						agencyName,
						totalDeals: 0,
						totalCommission: 0,
						averageSplit: 0,
						agents: new Set<string>(),
						transactions: [],
					};
				}
				acc[agencyName].totalDeals += 1;
				acc[agencyName].totalCommission += parseFloat(t.commissionAmount || '0');
				acc[agencyName].averageSplit += t.coBrokingData?.commissionSplit || 0;
				acc[agencyName].agents.add(t.coBrokingData?.agentName || 'Unknown');
				acc[agencyName].transactions.push(t);
				return acc;
			}, {} as Record<string, any>);

			// Calculate averages and convert Sets to arrays
			const partnerAgencies = Object.values(agencyAggregation).map((agency: any) => ({
				...agency,
				averageSplit: agency.averageSplit / agency.totalDeals,
				agents: Array.from(agency.agents),
				agentCount: agency.agents.size,
			}));

			// Summary stats
			const summary = {
				totalCoBrokingDeals: filteredTransactions.length,
				totalCoBrokingCommission: filteredTransactions.reduce((sum, t) => sum + parseFloat(t.commissionAmount || '0'), 0),
				uniquePartnerAgencies: partnerAgencies.length,
				averageCommissionSplit: filteredTransactions.reduce((sum, t) => sum + (t.coBrokingData?.commissionSplit || 0), 0) / filteredTransactions.length || 0,
			};

			return {
				transactions: filteredTransactions,
				partnerAgencies: partnerAgencies.sort((a, b) => b.totalDeals - a.totalDeals),
				summary,
				totalCount,
				hasMore: input.offset + input.limit < totalCount,
			};
		}),

	// Get client data with transaction history (admin only)
	getClientData: adminProcedure
		.input(z.object({
			startDate: z.coerce.date().optional(),
			endDate: z.coerce.date().optional(),
			clientType: z.enum(['buyer', 'seller', 'tenant', 'landlord']).optional(),
			searchQuery: z.string().optional(),
			limit: z.number().min(1).max(100).default(50),
			offset: z.number().min(0).default(0),
		}))
		.query(async ({ input }) => {
			const conditions = [];

			if (input.startDate) {
				conditions.push(gte(transactions.createdAt, input.startDate));
			}
			if (input.endDate) {
				conditions.push(lte(transactions.createdAt, input.endDate));
			}

			// Get transactions with client data
			const transactionsWithClients = await db
				.select({
					id: transactions.id,
					agentId: transactions.agentId,
					agentName: user.name,
					clientData: transactions.clientData,
					propertyData: transactions.propertyData,
					commissionAmount: transactions.commissionAmount,
					transactionType: transactions.transactionType,
					marketType: transactions.marketType,
					status: transactions.status,
					transactionDate: transactions.transactionDate,
					createdAt: transactions.createdAt,
				})
				.from(transactions)
				.leftJoin(user, eq(transactions.agentId, user.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(transactions.createdAt));

			// Filter by client type and search query
			let filteredTransactions = transactionsWithClients.filter(t => t.clientData !== null);

			if (input.clientType) {
				filteredTransactions = filteredTransactions.filter(t =>
					t.clientData?.type === input.clientType
				);
			}

			if (input.searchQuery) {
				const query = input.searchQuery.toLowerCase();
				filteredTransactions = filteredTransactions.filter(t =>
					t.clientData?.name?.toLowerCase().includes(query) ||
					t.clientData?.email?.toLowerCase().includes(query) ||
					t.clientData?.phone?.includes(query)
				);
			}

			// Group by client (using email as unique identifier)
			const clientMap = filteredTransactions.reduce((acc, t) => {
				const clientEmail = t.clientData?.email || 'unknown';
				if (!acc[clientEmail]) {
					acc[clientEmail] = {
						client: t.clientData,
						transactions: [],
						totalValue: 0,
						firstTransaction: t.createdAt,
						lastTransaction: t.createdAt,
					};
				}
				acc[clientEmail].transactions.push({
					id: t.id,
					agentName: t.agentName,
					propertyAddress: t.propertyData?.address,
					propertyPrice: t.propertyData?.price,
					commissionAmount: t.commissionAmount,
					transactionType: t.transactionType,
					status: t.status,
					transactionDate: t.transactionDate,
				});
				acc[clientEmail].totalValue += parseFloat(t.commissionAmount || '0');
				if (t.createdAt < acc[clientEmail].firstTransaction) {
					acc[clientEmail].firstTransaction = t.createdAt;
				}
				if (t.createdAt > acc[clientEmail].lastTransaction) {
					acc[clientEmail].lastTransaction = t.createdAt;
				}
				return acc;
			}, {} as Record<string, any>);

			const clients = Object.values(clientMap)
				.sort((a, b) => b.totalValue - a.totalValue)
				.slice(input.offset, input.offset + input.limit);

			// Summary by client type
			const clientTypeSummary = filteredTransactions.reduce((acc, t) => {
				const type = t.clientData?.type || 'unknown';
				if (!acc[type]) {
					acc[type] = { count: 0, totalValue: 0 };
				}
				acc[type].count += 1;
				acc[type].totalValue += parseFloat(t.commissionAmount || '0');
				return acc;
			}, {} as Record<string, { count: number; totalValue: number }>);

			return {
				clients,
				totalClients: Object.keys(clientMap).length,
				clientTypeSummary,
				hasMore: input.offset + input.limit < Object.keys(clientMap).length,
			};
		}),

	// Delete report (admin only)
	delete: adminProcedure
		.input(reportIdInput)
		.mutation(async ({ input }) => {
			const [deletedReport] = await db
				.delete(reports)
				.where(eq(reports.id, input.id))
				.returning();

			if (!deletedReport) {
				throw new Error("Report not found");
			}

			return { success: true };
		}),
});

// Helper function to generate report data
async function generateReportData(reportId: string, type: string, filters: any, startDate: Date, endDate: Date) {
	// This is a simplified implementation
	// In a real application, this would be much more comprehensive
	
	const summary = {
		totalTransactions: 0,
		totalCommission: 0,
		averageCommission: 0,
		topPerformers: [],
	};

	const details: any[] = [];
	const charts: any[] = [];

	// Add basic chart structure
	charts.push({
		type: "line",
		title: "Transaction Trends",
		data: [],
	});

	return {
		summary,
		details,
		charts,
		generatedAt: new Date().toISOString(),
		reportType: type,
		dateRange: {
			start: startDate.toISOString(),
			end: endDate.toISOString(),
		},
	};
}
