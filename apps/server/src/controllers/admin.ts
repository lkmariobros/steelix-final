import { and, avg, count, desc, eq, gte, inArray, isNull, sql, sum } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	agencies,
	agentTierSchema,
	leadershipBonusPayments,
	teams,
	tierCommissionConfig,
	tierConfigChangeLog,
	user,
} from "../models/auth";
import { transactions } from "../models/transactions";
import { ensurePayoutsForApprovedTransaction } from "../services/commission-payouts";
import { addTransactionMessage } from "../services/transaction-messages";
import {
	ensurePortalRecordLogTable,
	purgeExpiredRecordLogs,
	RECORD_LOG_RETENTION_DAYS,
	recordLogRetentionCutoff,
	withinRecordLogRetention,
	writeRecordLog,
} from "../services/record-log";
import { portalRecordLog } from "../models/portal-record-log";
import { db } from "../utils/db";
import { resolveUserRole } from "../utils/rbac";
import {
	ADMIN_QUEUE_DB_STATUSES,
	CANONICAL_TRANSACTION_STATUSES,
	dbStatusesForCanonicalFilter,
} from "../utils/transaction-status";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";
import {
	getEffectiveRoles,
	getPrimaryRole,
	hasAdminAccess,
	hasAgentAccess,
	hasSuperAdminAccess,
} from "../utils/user-roles";

// Input schemas for admin operations
const dateRangeInput = z.object({
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
});

const commissionApprovalInput = z.object({
	transactionId: z.string().uuid(),
	action: z.enum(["approve", "reject"]),
	/** Required for both approve and reject (audit trail). */
	reviewNotes: z
		.string()
		.min(1, "Review notes are required")
		.max(5000),
});

const editRequestInput = z.object({
	transactionId: z.string().uuid(),
	action: z.enum(["approve", "reject"]),
	reviewNotes: z
		.string()
		.min(1, "Review notes are required")
		.max(5000),
});

const agentFilterInput = z.object({
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	dateRange: dateRangeInput.optional(),
	limit: z.number().min(1).max(100).default(24),
});

export const adminRouter = router({
	// Authoritative role for UI guards — always resolved server-side (DB-backed).
	checkAdminRole: protectedProcedure.query(async ({ ctx }) => {
		// Get user role from database
		const { db } = await import("../utils/db");
		const { user } = await import("../models/auth");
		const { eq } = await import("drizzle-orm");

		const [userRecord] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, ctx.session.user.id))
			.limit(1);

		const roles = getEffectiveRoles(userRecord ?? {});
		const userRole = getPrimaryRole(userRecord ?? {});

		return {
			hasAdminAccess: hasAdminAccess(userRecord ?? {}),
			hasSuperAdminAccess: hasSuperAdminAccess(userRecord ?? {}),
			hasAgentAccess: hasAgentAccess(userRecord ?? {}),
			role: userRole,
		};
	}),

	// Get commission approval queue
	getCommissionApprovalQueue: adminProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
				status: z.enum(CANONICAL_TRANSACTION_STATUSES).optional(),
				marketType: z.enum(["primary", "secondary"]).optional(),
				transactionType: z.enum(["sale", "lease", "rental"]).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const { userRole } = ctx;
			const userId = ctx.session.user.id;

			// Build base query
			const whereConditions = [];

			// Filter by status if provided
			if (input.status) {
				whereConditions.push(
					inArray(transactions.status, dbStatusesForCanonicalFilter(input.status)),
				);
			} else {
				whereConditions.push(
					inArray(transactions.status, [...ADMIN_QUEUE_DB_STATUSES]),
				);
			}

			if (input.marketType) {
				whereConditions.push(eq(transactions.marketType, input.marketType));
			}
			if (input.transactionType) {
				if (input.transactionType === "rental") {
					whereConditions.push(
						inArray(transactions.transactionType, ["rental", "lease"]),
					);
				} else {
					whereConditions.push(
						eq(transactions.transactionType, input.transactionType),
					);
				}
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

			const pendingWhere = and(...whereConditions);

			const [pendingTransactions, totalCountRow] = await Promise.all([
				db
					.select({
						id: transactions.id,
						agentId: transactions.agentId,
						clientData: transactions.clientData,
						propertyData: transactions.propertyData,
						transactionType: transactions.transactionType,
						marketType: transactions.marketType,
						transactionDate: transactions.transactionDate,
						commissionAmount: transactions.commissionAmount,
						commissionValue: transactions.commissionValue,
						status: transactions.status,
						submittedAt: transactions.submittedAt,
						createdAt: transactions.createdAt,
						caseNo: transactions.caseNo,
						bookingDate: transactions.bookingDate,
						projectName: transactions.projectName,
						unitNo: transactions.unitNo,
						isCoBroking: transactions.isCoBroking,
						coBrokingData: transactions.coBrokingData,
						agentName: user.name,
						agentEmail: user.email,
						agentImage: user.image,
						agentCode: user.agentCode,
					})
					.from(transactions)
					.leftJoin(user, eq(transactions.agentId, user.id))
					.where(pendingWhere)
					.orderBy(desc(transactions.submittedAt))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ count: count() })
					.from(transactions)
					.where(pendingWhere)
					.then((rows) => rows[0]),
			]);

			const coAgentIds = [
				...new Set(
					pendingTransactions
						.map((row) => {
							const co = row.coBrokingData as
								| { internalAgentId?: string }
								| null;
							return co?.internalAgentId;
						})
						.filter((id): id is string => Boolean(id)),
				),
			];

			const coAgents =
				coAgentIds.length > 0
					? await db
							.select({
								id: user.id,
								name: user.name,
								agentCode: user.agentCode,
							})
							.from(user)
							.where(inArray(user.id, coAgentIds))
					: [];

			const coAgentMap = new Map(coAgents.map((a) => [a.id, a]));

			const enrichedTransactions = pendingTransactions.map((row) => {
				const co = row.coBrokingData as
					| { internalAgentId?: string; agentName?: string }
					| null;
				const coAgent = co?.internalAgentId
					? coAgentMap.get(co.internalAgentId)
					: null;
				return {
					...row,
					coAgentName: coAgent?.name ?? co?.agentName ?? null,
					coAgentCode: coAgent?.agentCode ?? null,
				};
			});

			const totalCount = totalCountRow?.count ?? 0;

			return {
				transactions: enrichedTransactions,
				totalCount,
				hasMore: input.offset + input.limit < totalCount,
			};
		}),

	// Approve or reject commission
	processCommissionApproval: adminProcedure
		.input(commissionApprovalInput)
		.mutation(async ({ ctx, input }) => {
			const reviewerId = ctx.session.user.id;
			const newStatus = input.action === "approve" ? "verified" : "cancelled";
			const reviewableStatuses = [
				...dbStatusesForCanonicalFilter("pending"),
			];

			// Verify transaction exists and is in correct state
			const [existingTransaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						inArray(transactions.status, reviewableStatuses),
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

			if (newStatus === "verified" && updatedTransaction) {
				try {
					await ensurePayoutsForApprovedTransaction(updatedTransaction);
				} catch (e) {
					console.warn("ensurePayoutsForApprovedTransaction:", e);
				}
			}

			return updatedTransaction;
		}),

	processEditRequest: adminProcedure
		.input(editRequestInput)
		.mutation(async ({ ctx, input }) => {
			const reviewerId = ctx.session.user.id;

			const [existingTransaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.transactionId),
						eq(transactions.pendingEditRequest, true),
					),
				)
				.limit(1);

			if (!existingTransaction) {
				throw new Error("Edit request not found or already processed");
			}

			if (ctx.userRole === "team_lead") {
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
						"Team lead can only review their team's edit requests",
					);
				}
			}

			const patch: Record<string, unknown> = {
				pendingEditRequest: false,
				reviewedAt: new Date(),
				reviewedBy: reviewerId,
				reviewNotes: input.reviewNotes,
				updatedAt: new Date(),
			};

			if (input.action === "approve") {
				// Acknowledge the request without unlocking full case-detail editing.
				// Agents may only edit details in Draft; docs/status go through requests.
				patch.status = "pending";
			}

			const [updatedTransaction] = await db
				.update(transactions)
				.set(patch)
				.where(eq(transactions.id, input.transactionId))
				.returning();

			await addTransactionMessage({
				transactionId: input.transactionId,
				authorId: reviewerId,
				authorRole: "admin",
				body: input.reviewNotes,
				messageType: "admin_reply",
			});

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

			// Get agents with their performance metrics (date range applied on join)
			const txJoinParts: SQL[] = [eq(user.id, transactions.agentId)];
			if (input.dateRange?.startDate) {
				txJoinParts.push(
					sql`${transactions.createdAt} >= ${input.dateRange.startDate}`,
				);
			}
			if (input.dateRange?.endDate) {
				txJoinParts.push(
					sql`${transactions.createdAt} <= ${input.dateRange.endDate}`,
				);
			}

			agentWhereConditions.push(
				inArray(user.role, ["agent", "team_lead"]),
			);

			const agentPerformance = await db
				.select({
					agentId: user.id,
					agentName: user.name,
					agentEmail: user.email,
					agentImage: user.image,
					teamId: user.teamId,
					totalTransactions: count(transactions.id),
					totalCommission: sum(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
					avgCommission: avg(
						sql`CAST(${transactions.commissionAmount} AS DECIMAL)`,
					),
					approvedCount: count(
						sql`CASE WHEN ${transactions.status} IN ('verified', 'approved', 'commission_released') THEN 1 END`,
					),
					pendingCount: count(
						sql`CASE WHEN ${transactions.status} IN ('submitted', 'under_review', 'pending') THEN 1 END`,
					),
				})
				.from(user)
				.leftJoin(transactions, and(...txJoinParts))
				.where(and(...agentWhereConditions))
				.groupBy(user.id, user.name, user.email, user.image, user.teamId)
				.orderBy(desc(count(transactions.id)))
				.limit(input.limit);

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

	/**
	 * Dashboard deal-mix insights (date-filtered).
	 * Aging buckets were unused by the UI and skipped to keep this cheap.
	 */
	getDashboardInsights: adminProcedure
		.input(dateRangeInput.optional())
		.query(async ({ ctx, input }) => {
			const { userRole } = ctx;
			const userId = ctx.session.user.id;

			let teamMemberIds: string[] | null = null;
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
					teamMemberIds = teamMembers.map((m) => m.id);
				}
			}

			const roleCondition =
				teamMemberIds && teamMemberIds.length > 0
					? inArray(transactions.agentId, teamMemberIds)
					: undefined;

			const mixConditions = [];
			if (input?.startDate) {
				mixConditions.push(
					sql`${transactions.createdAt} >= ${input.startDate}`,
				);
			}
			if (input?.endDate) {
				mixConditions.push(sql`${transactions.createdAt} <= ${input.endDate}`);
			}
			if (roleCondition) {
				mixConditions.push(roleCondition);
			}
			// Exclude drafts from deal mix — keeps scan smaller and more meaningful
			mixConditions.push(sql`${transactions.status} <> 'draft'`);

			const mixWhere = and(...mixConditions);

			const mixRows = await db
				.select({
					segment: sql<string>`
						CASE
							WHEN lower(coalesce(${transactions.transactionType}::text, '')) IN ('rental', 'lease')
								THEN 'rental'
							WHEN lower(coalesce(${transactions.marketType}::text, '')) = 'primary'
								THEN 'newProject'
							ELSE 'subsale'
						END
					`.as("segment"),
					count: count(transactions.id),
					amount: sql<number>`coalesce(sum(CAST(${transactions.commissionAmount} AS DECIMAL)), 0)`,
				})
				.from(transactions)
				.where(mixWhere)
				.groupBy(sql`1`);

			const mix = {
				newProject: {
					key: "newProject" as const,
					label: "New Project",
					count: 0,
					amount: 0,
				},
				subsale: {
					key: "subsale" as const,
					label: "Subsale",
					count: 0,
					amount: 0,
				},
				rental: {
					key: "rental" as const,
					label: "Rental",
					count: 0,
					amount: 0,
				},
			};

			for (const row of mixRows) {
				const key = row.segment as keyof typeof mix;
				if (key in mix) {
					mix[key].count = Number(row.count);
					mix[key].amount = Number(row.amount) || 0;
				}
			}

			const mixTotalCount =
				mix.newProject.count + mix.subsale.count + mix.rental.count;
			const mixTotalAmount =
				mix.newProject.amount + mix.subsale.amount + mix.rental.amount;

			return {
				aging: {
					buckets: [
						{ key: "fresh" as const, label: "0–2 days", count: 0, amount: 0 },
						{
							key: "attention" as const,
							label: "3–7 days",
							count: 0,
							amount: 0,
						},
						{ key: "overdue" as const, label: "7+ days", count: 0, amount: 0 },
					],
					totalPending: 0,
					totalPendingAmount: 0,
					oldestDays: null,
				},
				dealMix: {
					segments: [mix.newProject, mix.subsale, mix.rental],
					totalCount: mixTotalCount,
					totalAmount: mixTotalAmount,
				},
			};
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
						sql`CASE WHEN ${transactions.status} IN ('submitted', 'under_review', 'pending') THEN 1 END`,
					),
					approvedTransactions: count(
						sql`CASE WHEN ${transactions.status} IN ('verified', 'approved', 'commission_released') THEN 1 END`,
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

	// ========== TIER CONFIGURATION MANAGEMENT ==========

	// Get all tier configurations
	getTierConfigurations: adminProcedure.query(async () => {
		const configs = await db
			.select()
			.from(tierCommissionConfig)
			.where(eq(tierCommissionConfig.isActive, true))
			.orderBy(tierCommissionConfig.tier);

		// If no configs in DB, return defaults from AGENT_TIER_CONFIG
		if (configs.length === 0) {
			return Object.entries(AGENT_TIER_CONFIG).map(([tier, config]) => ({
				id: null,
				tier: tier as AgentTier,
				commissionSplit: config.commissionSplit,
				leadershipBonusRate: config.leadershipBonusRate,
				requirements: config.requirements,
				displayName: config.displayName,
				description: config.description,
				isActive: true,
				effectiveFrom: new Date(),
				effectiveTo: null,
				isDefault: true,
			}));
		}

		return configs.map((config) => ({
			...config,
			isDefault: false,
		}));
	}),

	// Update tier configuration
	updateTierConfiguration: adminProcedure
		.input(
			z.object({
				tier: agentTierSchema,
				commissionSplit: z.number().min(0).max(100),
				leadershipBonusRate: z.number().min(0).max(100),
				requirements: z.object({
					monthlySales: z.number().min(0),
					teamMembers: z.number().min(0),
				}),
				displayName: z.string().min(1),
				description: z.string().optional(),
				changeReason: z.string().min(1, "Change reason is required"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { tier, changeReason, ...configData } = input;

			// Check if config exists
			const [existingConfig] = await db
				.select()
				.from(tierCommissionConfig)
				.where(
					and(
						eq(tierCommissionConfig.tier, tier),
						eq(tierCommissionConfig.isActive, true),
					),
				)
				.limit(1);

			let configId: string;
			let oldValues: Record<string, unknown> | null = null;

			if (existingConfig) {
				// Update existing config
				oldValues = {
					commissionSplit: existingConfig.commissionSplit,
					leadershipBonusRate: existingConfig.leadershipBonusRate,
					requirements: existingConfig.requirements,
					displayName: existingConfig.displayName,
					description: existingConfig.description,
				};

				const [updated] = await db
					.update(tierCommissionConfig)
					.set({
						...configData,
						updatedBy: ctx.session.user.id,
						updatedAt: new Date(),
					})
					.where(eq(tierCommissionConfig.id, existingConfig.id))
					.returning();

				configId = updated.id;
			} else {
				// Insert new config
				const [inserted] = await db
					.insert(tierCommissionConfig)
					.values({
						tier,
						...configData,
						createdBy: ctx.session.user.id,
						updatedBy: ctx.session.user.id,
					})
					.returning();

				configId = inserted.id;
			}

			// Create audit log entry
			await db.insert(tierConfigChangeLog).values({
				configId,
				tier,
				changeType: existingConfig ? "update" : "create",
				oldValues: oldValues ? JSON.stringify(oldValues) : null,
				newValues: JSON.stringify(configData),
				changedBy: ctx.session.user.id,
				changeReason,
			});

			void writeRecordLog({
				category: "configuration",
				action: existingConfig ? "tier_config_update" : "tier_config_create",
				summary: existingConfig
					? "Updated tier configuration"
					: "Created tier configuration",
				actorId: ctx.session.user.id,
				actorRole: getPrimaryRole({
					role: (ctx.session.user as { role?: string }).role,
					roles: (ctx.session.user as { roles?: string[] }).roles,
				}),
				entityType: "tier_config",
				entityId: configId,
				detail: changeReason,
				metadata: {
					tier,
					displayName: configData.displayName,
				},
			});

			return { success: true, configId };
		}),

	// Unified Record Log (configuration + transaction actions, last 365 days)
	getRecordLog: adminProcedure
		.input(
			z.object({
				category: z.enum(["all", "configuration", "transaction"]).default("all"),
				limit: z.number().min(1).max(200).default(100),
			}),
		)
		.query(async ({ input }) => {
			await ensurePortalRecordLogTable();
			void purgeExpiredRecordLogs().catch(() => undefined);

			const conditions = [withinRecordLogRetention()];
			if (input.category !== "all") {
				conditions.push(eq(portalRecordLog.category, input.category));
			}

			const rows = await db
				.select({
					id: portalRecordLog.id,
					category: portalRecordLog.category,
					action: portalRecordLog.action,
					summary: portalRecordLog.summary,
					actorId: portalRecordLog.actorId,
					actorRole: portalRecordLog.actorRole,
					entityType: portalRecordLog.entityType,
					entityId: portalRecordLog.entityId,
					caseNo: portalRecordLog.caseNo,
					detail: portalRecordLog.detail,
					metadata: portalRecordLog.metadata,
					createdAt: portalRecordLog.createdAt,
					actorName: user.name,
				})
				.from(portalRecordLog)
				.leftJoin(user, eq(portalRecordLog.actorId, user.id))
				.where(and(...conditions))
				.orderBy(desc(portalRecordLog.createdAt))
				.limit(input.limit);

			return {
				retentionDays: RECORD_LOG_RETENTION_DAYS,
				cutoff: recordLogRetentionCutoff().toISOString(),
				entries: rows,
			};
		}),

	// Get tier configuration change history
	getTierConfigHistory: adminProcedure
		.input(
			z.object({
				tier: agentTierSchema.optional(),
				limit: z.number().min(1).max(100).default(50),
			}),
		)
		.query(async ({ input }) => {
			const conditions = [
				gte(tierConfigChangeLog.timestamp, recordLogRetentionCutoff()),
			];
			if (input.tier) {
				conditions.push(eq(tierConfigChangeLog.tier, input.tier));
			}

			const history = await db
				.select({
					id: tierConfigChangeLog.id,
					tier: tierConfigChangeLog.tier,
					changeType: tierConfigChangeLog.changeType,
					oldValues: tierConfigChangeLog.oldValues,
					newValues: tierConfigChangeLog.newValues,
					changedBy: tierConfigChangeLog.changedBy,
					changeReason: tierConfigChangeLog.changeReason,
					timestamp: tierConfigChangeLog.timestamp,
					changedByName: user.name,
				})
				.from(tierConfigChangeLog)
				.leftJoin(user, eq(tierConfigChangeLog.changedBy, user.id))
				.where(and(...conditions))
				.orderBy(desc(tierConfigChangeLog.timestamp))
				.limit(input.limit);

			return history;
		}),

	// Get all leadership bonus payments (admin overview)
	getAllLeadershipBonusPayments: adminProcedure
		.input(
			z.object({
				status: z.enum(["pending", "paid", "cancelled"]).optional(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ input }) => {
			const conditions = [];
			if (input.status) {
				conditions.push(eq(leadershipBonusPayments.status, input.status));
			}

			const payments = await db
				.select({
					id: leadershipBonusPayments.id,
					transactionId: leadershipBonusPayments.transactionId,
					downlineAgentId: leadershipBonusPayments.downlineAgentId,
					uplineAgentId: leadershipBonusPayments.uplineAgentId,
					uplineTier: leadershipBonusPayments.uplineTier,
					originalCommissionAmount:
						leadershipBonusPayments.originalCommissionAmount,
					companyShareAmount: leadershipBonusPayments.companyShareAmount,
					leadershipBonusRate: leadershipBonusPayments.leadershipBonusRate,
					leadershipBonusAmount: leadershipBonusPayments.leadershipBonusAmount,
					status: leadershipBonusPayments.status,
					paidAt: leadershipBonusPayments.paidAt,
					createdAt: leadershipBonusPayments.createdAt,
				})
				.from(leadershipBonusPayments)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(leadershipBonusPayments.createdAt))
				.limit(input.limit)
				.offset(input.offset);

			// Get total count
			const [countResult] = await db
				.select({ count: count() })
				.from(leadershipBonusPayments)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			return {
				payments,
				totalCount: countResult.count,
				hasMore: input.offset + input.limit < countResult.count,
			};
		}),

	// Mark leadership bonus as paid
	markLeadershipBonusPaid: adminProcedure
		.input(
			z.object({
				paymentId: z.string().uuid(),
			}),
		)
		.mutation(async ({ input }) => {
			const [updated] = await db
				.update(leadershipBonusPayments)
				.set({
					status: "paid",
					paidAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(leadershipBonusPayments.id, input.paymentId))
				.returning();

			if (!updated) {
				throw new Error("Payment not found");
			}

			return updated;
		}),

	// Get leadership bonus summary for admin dashboard
	getLeadershipBonusSummary: adminProcedure.query(async () => {
		const [pendingStats] = await db
			.select({
				count: count(),
				total: sum(
					sql`CAST(${leadershipBonusPayments.leadershipBonusAmount} AS DECIMAL)`,
				),
			})
			.from(leadershipBonusPayments)
			.where(eq(leadershipBonusPayments.status, "pending"));

		const [paidStats] = await db
			.select({
				count: count(),
				total: sum(
					sql`CAST(${leadershipBonusPayments.leadershipBonusAmount} AS DECIMAL)`,
				),
			})
			.from(leadershipBonusPayments)
			.where(eq(leadershipBonusPayments.status, "paid"));

		return {
			pending: {
				count: pendingStats.count || 0,
				total: Number.parseFloat(String(pendingStats.total || 0)),
			},
			paid: {
				count: paidStats.count || 0,
				total: Number.parseFloat(String(paidStats.total || 0)),
			},
		};
	}),
});
