import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { agencies, teams, user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";

/** Business date for reporting (falls back to createdAt). */
export const transactionDateExpr = sql`COALESCE(${transactions.transactionDate}, ${transactions.createdAt})`;

export type DateTruncUnit = "day" | "week" | "month" | "quarter" | "year";

export function periodTypeToDateTrunc(
	periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
): DateTruncUnit {
	switch (periodType) {
		case "daily":
			return "day";
		case "weekly":
			return "week";
		case "quarterly":
			return "quarter";
		case "yearly":
			return "year";
		default:
			return "month";
	}
}


/**
 * date_trunc() unit must be a SQL literal — binding it as $1 breaks GROUP BY
 * matching and can fail at runtime when reused across SELECT/GROUP BY/ORDER BY.
 */
export function transactionPeriodTrunc(unit: DateTruncUnit) {
	switch (unit) {
		case "day":
			return sql<string>`date_trunc('day', ${transactionDateExpr})`;
		case "week":
			return sql<string>`date_trunc('week', ${transactionDateExpr})`;
		case "quarter":
			return sql<string>`date_trunc('quarter', ${transactionDateExpr})`;
		case "year":
			return sql<string>`date_trunc('year', ${transactionDateExpr})`;
		default:
			return sql<string>`date_trunc('month', ${transactionDateExpr})`;
	}
}

export function buildTransactionDateConditions(
	startDate?: Date,
	endDate?: Date,
) {
	const conditions = [];
	if (startDate) {
		conditions.push(gte(transactionDateExpr, startDate));
	}
	if (endDate) {
		conditions.push(lte(transactionDateExpr, endDate));
	}
	return conditions;
}

export async function getTopPerformersFromTransactions(options: {
	startDate?: Date;
	endDate?: Date;
	agencyId?: string;
	teamId?: string;
	limit?: number;
}) {
	const { startDate, endDate, agencyId, teamId, limit = 10 } = options;
	const conditions = buildTransactionDateConditions(startDate, endDate);
	const userConditions = [];
	if (agencyId) userConditions.push(eq(user.agencyId, agencyId));
	if (teamId) userConditions.push(eq(user.teamId, teamId));

	const whereClause =
		conditions.length > 0 || userConditions.length > 0
			? and(...conditions, ...userConditions)
			: undefined;

	const rows = await db
		.select({
			agentId: transactions.agentId,
			agentName: user.name,
			totalTransactions: sql<number>`count(*)::int`,
			totalCommission: sql<string>`coalesce(sum(cast(${transactions.commissionAmount} as decimal)), 0)`,
			completedTransactions: sql<number>`count(*) filter (where ${transactions.status} in ('completed', 'approved', 'commission_released'))::int`,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.agentId, user.id))
		.where(whereClause)
		.groupBy(transactions.agentId, user.name)
		.orderBy(
			desc(
				sql`coalesce(sum(cast(${transactions.commissionAmount} as decimal)), 0)`,
			),
		)
		.limit(limit);

	return rows.map((row) => {
		const total = row.totalTransactions || 0;
		const completed = row.completedTransactions || 0;
		return {
			agentId: row.agentId,
			agentName: row.agentName ?? "Unknown",
			totalTransactions: total,
			totalCommission: row.totalCommission ?? "0",
			conversionRate:
				total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
		};
	});
}

export async function getPerformanceAnalyticsFromTransactions(input: {
	periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
	startDate: Date;
	endDate: Date;
	agentIds?: string[];
	teamIds?: string[];
	agencyIds?: string[];
}) {
	const dateTrunc = periodTypeToDateTrunc(input.periodType);
	const conditions = [
		...buildTransactionDateConditions(input.startDate, input.endDate),
	];

	if (input.agentIds?.length) {
		conditions.push(inArray(transactions.agentId, input.agentIds));
	}
	if (input.teamIds?.length) {
		conditions.push(inArray(user.teamId, input.teamIds));
	}
	if (input.agencyIds?.length) {
		conditions.push(inArray(user.agencyId, input.agencyIds));
	}

	const whereClause = and(...conditions);

	const periodExpr = transactionPeriodTrunc(dateTrunc);

	const periodRows = await db
		.select({
			period: periodExpr,
			totalTransactions: sql<number>`count(*)::int`,
			totalCommission: sql<string>`coalesce(sum(cast(${transactions.commissionAmount} as decimal)), 0)`,
			completedTransactions: sql<number>`count(*) filter (where ${transactions.status} in ('completed', 'approved', 'commission_released'))::int`,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.agentId, user.id))
		.where(whereClause)
		.groupBy(periodExpr)
		.orderBy(periodExpr);

	const agentPeriodRows = await db
		.select({
			period: periodExpr,
			agentId: transactions.agentId,
			agentName: user.name,
			agentTier: user.agentTier,
			teamId: teams.id,
			teamName: teams.name,
			agencyId: agencies.id,
			agencyName: agencies.name,
			totalTransactions: sql<number>`count(*)::int`,
			totalCommission: sql<string>`coalesce(sum(cast(${transactions.commissionAmount} as decimal)), 0)`,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.agentId, user.id))
		.leftJoin(teams, eq(user.teamId, teams.id))
		.leftJoin(agencies, eq(user.agencyId, agencies.id))
		.where(whereClause)
		.groupBy(
			periodExpr,
			transactions.agentId,
			user.name,
			user.agentTier,
			teams.id,
			teams.name,
			agencies.id,
			agencies.name,
		)
		.orderBy(periodExpr);

	const transactionRows = await db
		.select({
			id: transactions.id,
			caseNo: transactions.caseNo,
			agentId: transactions.agentId,
			agentName: user.name,
			commissionAmount: transactions.commissionAmount,
			status: transactions.status,
			transactionType: transactions.transactionType,
			marketType: transactions.marketType,
			transactionDate: transactions.transactionDate,
			createdAt: transactions.createdAt,
			propertyAddress: sql<string | null>`${transactions.propertyData}->>'address'`,
			propertyPrice: sql<string | null>`${transactions.propertyData}->>'price'`,
			clientName: sql<string | null>`${transactions.clientData}->>'name'`,
		})
		.from(transactions)
		.leftJoin(user, eq(transactions.agentId, user.id))
		.where(whereClause)
		.orderBy(desc(transactionDateExpr))
		.limit(200);

	const periodsMap = new Map<
		string,
		{
			period: string;
			periodStart: string;
			totalTransactions: number;
			totalCommission: number;
			averageCommission: number;
			agentCount: number;
			agents: Array<{
				id: string;
				name: string | null;
				agentTier: string | null;
				metrics: {
					totalTransactions: number;
					totalCommission: string;
				};
				team: { id: string | null; name: string | null } | null;
				agency: { id: string | null; name: string | null } | null;
			}>;
		}
	>();

	for (const row of periodRows) {
		const periodKey = new Date(row.period).toISOString();
		const totalCommission = Number.parseFloat(row.totalCommission || "0");
		const totalTransactions = row.totalTransactions || 0;
		periodsMap.set(periodKey, {
			period: periodKey.split("T")[0] ?? periodKey,
			periodStart: periodKey,
			totalTransactions,
			totalCommission,
			averageCommission:
				totalTransactions > 0 ? totalCommission / totalTransactions : 0,
			agentCount: 0,
			agents: [],
		});
	}

	for (const row of agentPeriodRows) {
		const periodKey = new Date(row.period).toISOString();
		let period = periodsMap.get(periodKey);
		if (!period) {
			const totalCommission = Number.parseFloat(row.totalCommission || "0");
			const totalTransactions = row.totalTransactions || 0;
			period = {
				period: periodKey.split("T")[0] ?? periodKey,
				periodStart: periodKey,
				totalTransactions,
				totalCommission,
				averageCommission:
					totalTransactions > 0 ? totalCommission / totalTransactions : 0,
				agentCount: 0,
				agents: [],
			};
			periodsMap.set(periodKey, period);
		}
		period.agents.push({
			id: row.agentId,
			name: row.agentName,
			agentTier: row.agentTier,
			metrics: {
				totalTransactions: row.totalTransactions || 0,
				totalCommission: row.totalCommission || "0",
			},
			team: row.teamId ? { id: row.teamId, name: row.teamName } : null,
			agency: row.agencyId ? { id: row.agencyId, name: row.agencyName } : null,
		});
		period.agentCount = period.agents.length;
	}

	const periods = Array.from(periodsMap.values()).sort((a, b) =>
		a.periodStart.localeCompare(b.periodStart),
	);

	const overallCommission = periods.reduce((sum, p) => sum + p.totalCommission, 0);
	const overallTransactions = periods.reduce(
		(sum, p) => sum + p.totalTransactions,
		0,
	);
	const uniqueAgents = new Set(agentPeriodRows.map((r) => r.agentId));

	return {
		periods,
		transactions: transactionRows.map((t) => ({
			id: t.id,
			caseNo: t.caseNo,
			agentId: t.agentId,
			agentName: t.agentName,
			commissionAmount: t.commissionAmount,
			status: t.status,
			transactionType: t.transactionType,
			marketType: t.marketType,
			transactionDate: t.transactionDate,
			createdAt: t.createdAt,
			propertyAddress: t.propertyAddress,
			propertyPrice: t.propertyPrice,
			clientName: t.clientName,
		})),
		summary: {
			totalPeriods: periods.length,
			totalAgents: uniqueAgents.size,
			overallCommission,
			overallTransactions,
		},
	};
}
