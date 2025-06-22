import { and, avg, count, desc, eq, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { agencies, teams, user } from "../db/schema/auth";
import { transactions } from "../db/schema/transactions";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";

// Input schemas for admin operations
const dateRangeInput = z.object({
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

const commissionApprovalInput = z.object({
	transactionId: z.string().uuid(),
	action: z.enum(["approve", "reject"]),
	reviewNotes: z.string().optional(),
});

const agentFilterInput = z.object({
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	dateRange: dateRangeInput.optional(),
});

export const adminRouter = router({
	// Check if user has admin role (lightweight endpoint for role validation)
	checkAdminRole: protectedProcedure.query(async ({ ctx }) => {
		// Get user role from database
		const { db } = await import("../db");
		const { user } = await import("../db/schema/auth");
		const { eq } = await import("drizzle-orm");

		const [userRecord] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, ctx.session.user.id))
			.limit(1);

		const userRole = userRecord?.role;
		const isAdmin = userRole === "admin" || userRole === "team_lead";

		return {
			hasAdminAccess: isAdmin,
			role: userRole,
		};
	}),

	// Get commission approval queue
	getCommissionApprovalQueue: adminProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
				status: z.enum(["submitted", "under_review"]).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { userRole } = ctx;
			const userId = ctx.session.user.id;

			// Build base query
			const whereConditions = [];

			// Filter by status if provided
			if (input.status) {
				whereConditions.push(eq(transactions.status, input.status));
			} else {
				// Default to pending approvals
				whereConditions.push(
					sql`${transactions.status} IN ('submitted', 'under_review')`,
				);
			}

			// Role-based filtering
			if (userRole === "team_lead") {
				// Team leads only see their team's transactions
				const userRecord = await db
					.select({ teamId: user.teamId })
					.from(user)
					.where(eq(user.id, userId))
					.limit(1);

				if (userRecord[0]?.teamId) {
					const teamMembers = await db
						.select({ id: user.id })
						.from(user)
						.where(eq(user.teamId, userRecord[0].teamId));

					const memberIds = teamMembers.map((m) => m.id);
					whereConditions.push(
						sql`${transactions.agentId} IN (${memberIds.join(",")})`,
					);
				}
			}
			// Admins see all transactions (no additional filtering)

			const pendingTransactions = await db
				.select({
					id: transactions.id,
					agentId: transactions.agentId,
					clientData: transactions.clientData,
					propertyData: transactions.propertyData,
					transactionType: transactions.transactionType,
					commissionAmount: transactions.commissionAmount,
					commissionValue: transactions.commissionValue,
					status: transactions.status,
					submittedAt: transactions.submittedAt,
					createdAt: transactions.createdAt,
					// Join agent info
					agentName: user.name,
					agentEmail: user.email,
				})
				.from(transactions)
				.leftJoin(user, eq(transactions.agentId, user.id))
				.where(and(...whereConditions))
				.orderBy(desc(transactions.submittedAt))
				.limit(input.limit)
				.offset(input.offset);

			// Get total count for pagination
			const [totalCount] = await db
				.select({ count: count() })
				.from(transactions)
				.where(and(...whereConditions));

			return {
				transactions: pendingTransactions,
				totalCount: totalCount.count,
				hasMore: input.offset + input.limit < totalCount.count,
			};
		}),

	// Approve or reject commission
	processCommissionApproval: adminProcedure
		.input(commissionApprovalInput)
		.mutation(async ({ ctx, input }) => {
			const reviewerId = ctx.session.user.id;
			const newStatus = input.action === "approve" ? "approved" : "rejected";

			// Verify transaction exists and is in correct state
			const [existingTransaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						sql`${transactions.status} IN ('submitted', 'under_review')`,
					),
				)
				.limit(1);

			if (!existingTransaction) {
				throw new Error("Transaction not found or not in reviewable state");
			}

			// Role-based authorization check
			if (ctx.userRole === "team_lead") {
				// Verify the transaction belongs to team lead's team
				const [agentInfo] = await db
					.select({ teamId: user.teamId })
					.from(user)
					.where(eq(user.id, existingTransaction.agentId))
					.limit(1);

				const [reviewerInfo] = await db
					.select({ teamId: user.teamId })
					.from(user)
					.where(eq(user.id, reviewerId))
					.limit(1);

				if (agentInfo?.teamId !== reviewerInfo?.teamId) {
					throw new Error(
						"Team lead can only review their team's transactions",
					);
				}
			}

			// Update transaction status
			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: newStatus,
					reviewedAt: new Date(),
					reviewedBy: reviewerId,
					reviewNotes: input.reviewNotes,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.transactionId))
				.returning();

			return updatedTransaction;
		}),

	// Get agent performance metrics
	getAgentPerformance: adminProcedure
		.input(agentFilterInput)
		.query(async ({ ctx, input }) => {
			const { userRole } = ctx;
			const userId = ctx.session.user.id;

			// Build agent filter conditions
			const agentWhereConditions = [];

			// Role-based filtering
			if (userRole === "team_lead") {
				const [userRecord] = await db
					.select({ teamId: user.teamId })
					.from(user)
					.where(eq(user.id, userId))
					.limit(1);

				if (userRecord?.teamId) {
					agentWhereConditions.push(eq(user.teamId, userRecord.teamId));
				}
			} else if (input.teamId) {
				agentWhereConditions.push(eq(user.teamId, input.teamId));
			} else if (input.agencyId) {
				agentWhereConditions.push(eq(user.agencyId, input.agencyId));
			}

			// Get agents with their performance metrics
			const agentPerformance = await db
				.select({
					agentId: user.id,
					agentName: user.name,
					agentEmail: user.email,
					teamId: user.teamId,
					totalTransactions: count(transactions.id),
					totalCommission: sum(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
					avgCommission: avg(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
					approvedCount: count(
						sql`CASE WHEN ${transactions.status} = 'approved' THEN 1 END`,
					),
					pendingCount: count(
						sql`CASE WHEN ${transactions.status} IN ('submitted', 'under_review') THEN 1 END`,
					),
				})
				.from(user)
				.leftJoin(transactions, eq(user.id, transactions.agentId))
				.where(and(...agentWhereConditions))
				.groupBy(user.id, user.name, user.email, user.teamId)
				.orderBy(desc(count(transactions.id)));

			return agentPerformance;
		}),

	// Get urgent tasks/alerts
	getUrgentTasks: adminProcedure.query(async ({ ctx }) => {
		const { userRole } = ctx;
		const userId = ctx.session.user.id;

		// Get overdue transactions (submitted > 7 days ago)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const whereConditions = [
			eq(transactions.status, "submitted"),
			sql`${transactions.submittedAt} < ${sevenDaysAgo}`,
		];

		// Role-based filtering for team leads
		if (userRole === "team_lead") {
			const [userRecord] = await db
				.select({ teamId: user.teamId })
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			if (userRecord?.teamId) {
				const teamMembers = await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.teamId, userRecord.teamId));

				const memberIds = teamMembers.map((m) => m.id);
				whereConditions.push(
					sql`${transactions.agentId} IN (${memberIds.join(",")})`,
				);
			}
		}

		const urgentTasks = await db
			.select({
				id: transactions.id,
				type: sql`'overdue_approval'`.as("type"),
				title: sql`'Overdue Commission Approval'`.as("title"),
				description:
					sql`CONCAT('Transaction pending approval for ', EXTRACT(DAY FROM NOW() - ${transactions.submittedAt}), ' days')`.as(
						"description",
					),
				priority: sql`'high'`.as("priority"),
				agentName: user.name,
				createdAt: transactions.submittedAt,
				clientData: transactions.clientData,
			})
			.from(transactions)
			.leftJoin(user, eq(transactions.agentId, user.id))
			.where(and(...whereConditions))
			.orderBy(desc(transactions.submittedAt))
			.limit(10);

		return urgentTasks;
	}),

	// Get admin dashboard summary stats
	getDashboardSummary: adminProcedure
		.input(dateRangeInput.optional())
		.query(async ({ ctx, input }) => {
			const { userRole } = ctx;
			const userId = ctx.session.user.id;

			// Build date filter
			const dateConditions = [];
			if (input?.startDate) {
				dateConditions.push(
					sql`${transactions.createdAt} >= ${input.startDate}`,
				);
			}
			if (input?.endDate) {
				dateConditions.push(sql`${transactions.createdAt} <= ${input.endDate}`);
			}

			// Role-based filtering
			const roleConditions = [];
			if (userRole === "team_lead") {
				const [userRecord] = await db
					.select({ teamId: user.teamId })
					.from(user)
					.where(eq(user.id, userId))
					.limit(1);

				if (userRecord?.teamId) {
					const teamMembers = await db
						.select({ id: user.id })
						.from(user)
						.where(eq(user.teamId, userRecord.teamId));

					const memberIds = teamMembers.map((m) => m.id);
					roleConditions.push(
						sql`${transactions.agentId} IN (${memberIds.join(",")})`,
					);
				}
			}

			const allConditions = [...dateConditions, ...roleConditions];

			// Get summary statistics
			const [summaryStats] = await db
				.select({
					totalTransactions: count(transactions.id),
					pendingApprovals: count(
						sql`CASE WHEN ${transactions.status} IN ('submitted', 'under_review') THEN 1 END`,
					),
					approvedTransactions: count(
						sql`CASE WHEN ${transactions.status} = 'approved' THEN 1 END`,
					),
					totalCommissionValue: sum(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
					avgCommissionValue: avg(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
				})
				.from(transactions)
				.where(allConditions.length > 0 ? and(...allConditions) : undefined);

			return summaryStats;
		}),
});
