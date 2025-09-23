import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type CommissionApproval,
	type NewCommissionApproval,
	type UpdateApprovalStatus,
	APPROVAL_WORKFLOW_ACTIONS,
	approvalWorkflowHistory,
	commissionApprovals,
	insertCommissionApprovalSchema,
	selectCommissionApprovalSchema,
	updateApprovalStatusSchema,
} from "../db/schema/approvals";
import { transactions } from "../db/schema/transactions";
import { user } from "../db/schema/auth";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";

// Input schemas
const listApprovalsInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	status: z.enum(["pending", "approved", "rejected", "requires_revision"]).optional(),
	priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
	agentId: z.string().optional(),
	sortBy: z.enum(["submittedAt", "requestedAmount", "priority"]).default("submittedAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const approvalIdInput = z.object({
	id: z.string().uuid(),
});

const bulkApprovalInput = z.object({
	approvalIds: z.array(z.string().uuid()).min(1).max(50),
	action: z.enum(["approve", "reject"]),
	reviewNotes: z.string().optional(),
	approvedAmount: z.number().positive().optional(),
});

const approvalStatsInput = z.object({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	agentId: z.string().optional(),
});

export const approvalsRouter = router({
	// Create a new commission approval request
	create: protectedProcedure
		.input(insertCommissionApprovalSchema)
		.mutation(async ({ ctx, input }) => {
			// Verify the transaction exists and belongs to the user
			const [transaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						eq(transactions.agentId, ctx.session.user.id)
					)
				)
				.limit(1);

			if (!transaction) {
				throw new Error("Transaction not found or access denied");
			}

			// Check if approval already exists for this transaction
			const [existingApproval] = await db
				.select()
				.from(commissionApprovals)
				.where(eq(commissionApprovals.transactionId, input.transactionId))
				.limit(1);

			if (existingApproval) {
				throw new Error("Approval request already exists for this transaction");
			}

			const newApproval = {
				...input,
				agentId: ctx.session.user.id,
				requestedAmount: input.requestedAmount.toString(),
				commissionPercentage: input.commissionPercentage?.toString(),
			};

			const [approval] = await db
				.insert(commissionApprovals)
				.values(newApproval)
				.returning();

			// Log workflow history
			await db.insert(approvalWorkflowHistory).values({
				approvalId: approval.id,
				fromStatus: null,
				toStatus: "pending",
				actionBy: ctx.session.user.id,
				actionType: APPROVAL_WORKFLOW_ACTIONS.SUBMIT,
				actionNotes: input.metadata?.submissionNotes,
			});

			return approval;
		}),

	// List approvals (admin only)
	list: adminProcedure
		.input(listApprovalsInput)
		.query(async ({ input }) => {
			const conditions = [];

			if (input.status) {
				conditions.push(eq(commissionApprovals.status, input.status));
			}
			if (input.priority) {
				conditions.push(eq(commissionApprovals.priority, input.priority));
			}
			if (input.agentId) {
				conditions.push(eq(commissionApprovals.agentId, input.agentId));
			}

			// Build order by clause
			const orderByColumn = input.sortBy === "submittedAt" 
				? commissionApprovals.submittedAt
				: input.sortBy === "requestedAmount"
				? commissionApprovals.requestedAmount
				: commissionApprovals.priority;

			const orderByClause = input.sortOrder === "asc" 
				? orderByColumn 
				: desc(orderByColumn);

			// Get approvals with agent and transaction details
			const approvalsList = await db
				.select({
					approval: commissionApprovals,
					agent: {
						id: user.id,
						name: user.name,
						email: user.email,
						agentTier: user.agentTier,
					},
					transaction: {
						id: transactions.id,
						marketType: transactions.marketType,
						transactionType: transactions.transactionType,
						propertyData: transactions.propertyData,
						clientData: transactions.clientData,
					},
				})
				.from(commissionApprovals)
				.leftJoin(user, eq(commissionApprovals.agentId, user.id))
				.leftJoin(transactions, eq(commissionApprovals.transactionId, transactions.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(orderByClause)
				.limit(input.limit)
				.offset(input.offset);

			// Get total count
			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(commissionApprovals)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			return {
				approvals: approvalsList,
				total: count,
				hasMore: input.offset + input.limit < count,
			};
		}),

	// Get approval by ID (admin only)
	getById: adminProcedure
		.input(approvalIdInput)
		.query(async ({ input }) => {
			const [approvalData] = await db
				.select({
					approval: commissionApprovals,
					agent: {
						id: user.id,
						name: user.name,
						email: user.email,
						agentTier: user.agentTier,
						companyCommissionSplit: user.companyCommissionSplit,
					},
					transaction: transactions,
				})
				.from(commissionApprovals)
				.leftJoin(user, eq(commissionApprovals.agentId, user.id))
				.leftJoin(transactions, eq(commissionApprovals.transactionId, transactions.id))
				.where(eq(commissionApprovals.id, input.id))
				.limit(1);

			if (!approvalData) {
				throw new Error("Approval not found");
			}

			// Get workflow history
			const workflowHistory = await db
				.select({
					history: approvalWorkflowHistory,
					actionByUser: {
						id: user.id,
						name: user.name,
						email: user.email,
					},
				})
				.from(approvalWorkflowHistory)
				.leftJoin(user, eq(approvalWorkflowHistory.actionBy, user.id))
				.where(eq(approvalWorkflowHistory.approvalId, input.id))
				.orderBy(desc(approvalWorkflowHistory.timestamp));

			return {
				...approvalData,
				workflowHistory,
			};
		}),

	// Update approval status (admin only)
	updateStatus: adminProcedure
		.input(updateApprovalStatusSchema)
		.mutation(async ({ ctx, input }) => {
			// Get current approval
			const [currentApproval] = await db
				.select()
				.from(commissionApprovals)
				.where(eq(commissionApprovals.id, input.id))
				.limit(1);

			if (!currentApproval) {
				throw new Error("Approval not found");
			}

			// Update approval
			const updateData: any = {
				status: input.status,
				reviewedBy: ctx.session.user.id,
				reviewedAt: new Date(),
				reviewNotes: input.reviewNotes,
				updatedAt: new Date(),
			};

			if (input.approvedAmount) {
				updateData.approvedAmount = input.approvedAmount.toString();
			}

			const [updatedApproval] = await db
				.update(commissionApprovals)
				.set(updateData)
				.where(eq(commissionApprovals.id, input.id))
				.returning();

			// Log workflow history
			const actionType = input.status === "approved" 
				? APPROVAL_WORKFLOW_ACTIONS.APPROVE
				: input.status === "rejected"
				? APPROVAL_WORKFLOW_ACTIONS.REJECT
				: APPROVAL_WORKFLOW_ACTIONS.UPDATE;

			await db.insert(approvalWorkflowHistory).values({
				approvalId: input.id,
				fromStatus: currentApproval.status,
				toStatus: input.status,
				actionBy: ctx.session.user.id,
				actionType,
				actionNotes: input.reviewNotes,
			});

			return updatedApproval;
		}),

	// Bulk approve/reject (admin only)
	bulkAction: adminProcedure
		.input(bulkApprovalInput)
		.mutation(async ({ ctx, input }) => {
			const { approvalIds, action, reviewNotes, approvedAmount } = input;

			// Get current approvals
			const currentApprovals = await db
				.select()
				.from(commissionApprovals)
				.where(inArray(commissionApprovals.id, approvalIds));

			if (currentApprovals.length !== approvalIds.length) {
				throw new Error("Some approvals not found");
			}

			const newStatus = action === "approve" ? "approved" : "rejected";
			const updateData: any = {
				status: newStatus,
				reviewedBy: ctx.session.user.id,
				reviewedAt: new Date(),
				reviewNotes,
				updatedAt: new Date(),
			};

			if (action === "approve" && approvedAmount) {
				updateData.approvedAmount = approvedAmount.toString();
			}

			// Update all approvals
			const updatedApprovals = await db
				.update(commissionApprovals)
				.set(updateData)
				.where(inArray(commissionApprovals.id, approvalIds))
				.returning();

			// Log workflow history for each approval
			const workflowEntries = currentApprovals.map(approval => ({
				approvalId: approval.id,
				fromStatus: approval.status,
				toStatus: newStatus as any,
				actionBy: ctx.session.user.id,
				actionType: action === "approve"
					? APPROVAL_WORKFLOW_ACTIONS.APPROVE
					: APPROVAL_WORKFLOW_ACTIONS.REJECT,
				actionNotes: reviewNotes,
			}));

			await db.insert(approvalWorkflowHistory).values(workflowEntries);

			return {
				updatedCount: updatedApprovals.length,
				approvals: updatedApprovals,
			};
		}),

	// Get approval statistics (admin only)
	getStats: adminProcedure
		.input(approvalStatsInput)
		.query(async ({ input }) => {
			const conditions = [];

			if (input.startDate) {
				conditions.push(sql`${commissionApprovals.submittedAt} >= ${input.startDate}`);
			}
			if (input.endDate) {
				conditions.push(sql`${commissionApprovals.submittedAt} <= ${input.endDate}`);
			}
			if (input.agentId) {
				conditions.push(eq(commissionApprovals.agentId, input.agentId));
			}

			// Get overall stats
			const [stats] = await db
				.select({
					totalRequests: sql<number>`count(*)`,
					pendingRequests: sql<number>`count(*) filter (where status = 'pending')`,
					approvedRequests: sql<number>`count(*) filter (where status = 'approved')`,
					rejectedRequests: sql<number>`count(*) filter (where status = 'rejected')`,
					totalRequestedAmount: sql<number>`sum(cast(requested_amount as decimal))`,
					totalApprovedAmount: sql<number>`sum(cast(approved_amount as decimal))`,
					averageRequestedAmount: sql<number>`avg(cast(requested_amount as decimal))`,
					averageApprovedAmount: sql<number>`avg(cast(approved_amount as decimal))`,
				})
				.from(commissionApprovals)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			// Get priority breakdown
			const priorityStats = await db
				.select({
					priority: commissionApprovals.priority,
					count: sql<number>`count(*)`,
				})
				.from(commissionApprovals)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.groupBy(commissionApprovals.priority);

			return {
				...stats,
				priorityBreakdown: priorityStats,
			};
		}),

	// Get user's approval requests
	myRequests: protectedProcedure
		.input(z.object({
			limit: z.number().min(1).max(100).default(10),
			offset: z.number().min(0).default(0),
			status: z.enum(["pending", "approved", "rejected", "requires_revision"]).optional(),
		}))
		.query(async ({ ctx, input }) => {
			const conditions = [eq(commissionApprovals.agentId, ctx.session.user.id)];

			if (input.status) {
				conditions.push(eq(commissionApprovals.status, input.status));
			}

			const approvalsList = await db
				.select({
					approval: commissionApprovals,
					transaction: {
						id: transactions.id,
						marketType: transactions.marketType,
						transactionType: transactions.transactionType,
						propertyData: transactions.propertyData,
						clientData: transactions.clientData,
					},
				})
				.from(commissionApprovals)
				.leftJoin(transactions, eq(commissionApprovals.transactionId, transactions.id))
				.where(and(...conditions))
				.orderBy(desc(commissionApprovals.submittedAt))
				.limit(input.limit)
				.offset(input.offset);

			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(commissionApprovals)
				.where(and(...conditions));

			return {
				approvals: approvalsList,
				total: count,
				hasMore: input.offset + input.limit < count,
			};
		}),
});
