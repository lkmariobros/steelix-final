import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { user } from "../models/auth";
import {
	type NewTransaction,
	type Transaction,
	insertTransactionSchema,
	selectTransactionSchema,
	transactions,
} from "../models/transactions";
import {
	calculateEnhancedCommission,
	logCommissionAudit,
} from "../services/agent-tier";
import { lockCommissionOnSubmit } from "../services/commission-calculation";
import {
	addTransactionMessage,
	assertCanAccessTransactionMessages,
	listTransactionMessages,
} from "../services/transaction-messages";
import {
	transactionRequestItemSchema,
} from "../utils/transaction-request-items";
import { db } from "../utils/db";
import {
	agentCanEditTransaction,
	dbStatusesForCanonicalFilter,
	normalizeTransactionStatus,
} from "../utils/transaction-status";
import {
	isTransactionsSchemaOutdatedError,
	transactionsSchemaOutdatedMessage,
} from "../utils/transactions-schema-hint";
import { hasAdminAccess } from "../utils/user-roles";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";

// Base transaction input schema (without validation)
// All fields are optional to support draft saving with partial data
const baseTransactionInput = z.object({
	marketType: z.enum(["primary", "secondary"]).optional(),
	transactionType: z.enum(["sale", "lease"]).optional(),
	transactionDate: z.coerce.date().optional(),
	propertyData: z
		.object({
			address: z.string().optional(),
			propertyType: z.string().optional(),
			listingId: z.string().uuid().optional(),
			listingTitle: z.string().optional(),
			schemeId: z.string().uuid().optional(),
			salesPackage: z.string().optional(),
			rebateAmount: z.number().nonnegative().optional(),
			purchasingMethod: z.enum(["cash", "loan"]).optional(),
			sstPayBy: z.enum(["landlord", "agent"]).optional(),
			listingReferralShareType: z.enum(["percentage", "fixed"]).optional(),
			listingReferralShareValue: z.number().nonnegative().optional(),
			price: z.number().positive("Price must be positive"),
			spaPrice: z.number().positive().optional(),
			nettPrice: z.number().positive().optional(),
			description: z.string().optional(),
		})
		.optional(),
	projectName: z.string().optional(),
	unitNo: z.string().optional(),
	blockListingId: z.string().uuid().optional(),
	bookingDate: z.coerce.date().optional(),
	representationType: z.enum(["direct", "co_broking"]).optional(),
	clientData: z
		.object({
			name: z.string().min(1, "Purchaser name is required"),
			icNo: z.string().optional(),
			email: z.string().email().optional().or(z.literal("")),
			phone: z.string().min(1, "Phone number is required"),
			address: z.string().optional(),
			race: z.string().optional(),
			nationality: z.string().optional(),
			gender: z.string().optional(),
			emergencyName: z.string().optional(),
			emergencyContact: z.string().optional(),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]).optional(),
			source: z.string().optional(),
			notes: z.string().optional(),
		})
		.optional(),
	isCoBroking: z.boolean().default(false),
	coBrokingData: z
		.object({
			internalAgentId: z.string().optional(),
			agentName: z.string().optional(),
			agencyName: z.string().optional(),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%")
				.optional(),
			contactInfo: z.string().optional(),
			agentEmail: z.string().email().optional().or(z.literal("")),
			agentPhone: z.string().optional(),
		})
		.optional(),
	commissionType: z.enum(["percentage", "fixed"]).optional(),
	commissionValue: z.number().positive().optional(),
	commissionAmount: z.number().positive().optional(),
	documents: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				url: z.string(),
				uploadedAt: z.string(),
			}),
		)
		.optional(),
	notes: z.string().optional(),
});

// Input schemas with Primary Market → Sale validation and Co-broking validation
const createTransactionInput = baseTransactionInput
	.refine(
		(data: z.infer<typeof baseTransactionInput>) => {
			// Primary market transactions must be sales
			if (data.marketType === "primary") {
				return data.transactionType === "sale";
			}
			return true;
		},
		{
			message: "Primary market transactions must be sales",
			path: ["transactionType"],
		},
	)
	.refine(
		(data) => {
			if ("isCoBroking" in data && data.isCoBroking && data.coBrokingData) {
				const { internalAgentId, agentName, agentPhone } = data.coBrokingData;
				if (internalAgentId?.trim()) return true;
				return Boolean(
					agentName?.trim() && agentPhone?.trim(),
				);
			}
			return true;
		},
		{
			message: "Co-broking agent is required when co-broking is enabled",
			path: ["coBrokingData"],
		},
	);

const updateTransactionInput = baseTransactionInput
	.partial()
	.extend({
		id: z.string().uuid(),
	})
	.refine(
		(data) => {
			// Primary market transactions must be sales (only validate if both fields are present)
			if (data.marketType === "primary" && data.transactionType) {
				return data.transactionType === "sale";
			}
			return true;
		},
		{
			message: "Primary market transactions must be sales",
			path: ["transactionType"],
		},
	)
	.refine(
		(data) => {
			if ("isCoBroking" in data && data.isCoBroking && data.coBrokingData) {
				const { internalAgentId, agentName, agentPhone } = data.coBrokingData;
				if (internalAgentId?.trim()) return true;
				return Boolean(
					agentName?.trim() && agentPhone?.trim(),
				);
			}
			return true;
		},
		{
			message: "Co-broking agent is required when co-broking is enabled",
			path: ["coBrokingData"],
		},
	);

const transactionIdInput = z.object({
	id: z.string().uuid(),
});

const TRANSACTION_STATUS_VALUES = [
	"draft",
	"pending",
	"verified",
	"converted",
	"cancelled",
	"revoke",
	// legacy (mapped on write)
	"submitted",
	"under_review",
	"approved",
	"commission_released",
	"rejected",
	"completed",
] as const;

const changeStatusInput = z.object({
	id: z.string().uuid(),
	status: z.enum(TRANSACTION_STATUS_VALUES),
	reviewNotes: z.string().optional(),
	/** When true with status=pending, agent may edit the case again. */
	allowAgentEdit: z.boolean().optional(),
});

const addMessageInput = z.object({
	transactionId: z.string().uuid(),
	body: z.string().min(1).max(5000),
	messageType: z
		.enum(["remark", "edit_request", "status_note", "admin_reply"])
		.default("remark"),
	requestItem: transactionRequestItemSchema.optional(),
});

const listTransactionsInput = z.object({
	limit: z.number().min(1).max(100).default(10),
	offset: z.number().min(0).default(0),
	status: z.enum(TRANSACTION_STATUS_VALUES).optional(),
});

const adminListTransactionsInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	search: z.string().optional(),
	caseNo: z.string().optional(),
	unitNo: z.string().optional(),
	buyerName: z.string().optional(),
	projectName: z.string().optional(),
	blockListingId: z.string().uuid().optional(),
	agentId: z.string().optional(),
	status: z.enum(TRANSACTION_STATUS_VALUES).optional(),
	marketType: z.enum(["primary", "secondary"]).optional(),
	transactionType: z.enum(["sale", "lease", "rental"]).optional(),
	pendingApprovalOnly: z.boolean().optional(),
	editRequestsOnly: z.boolean().optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
});

function normalizeLegacyStatus(status: string | null | undefined) {
	return normalizeTransactionStatus(status);
}

function mapIncomingStatus(status: string): string {
	const n = normalizeTransactionStatus(status);
	return typeof n === "string" ? n : status;
}

// Enhanced commission calculation input - simplified representation type
const enhancedCommissionInput = z.object({
	propertyPrice: z.number().positive("Property price must be positive"),
	commissionType: z.enum(["percentage", "fixed"]),
	commissionValue: z.number().positive("Commission value must be positive"),
	representationType: z.enum(["direct", "co_broking"]),
	coBrokerSplitPercentage: z.number().min(0).max(100).optional().default(50),
});

export const transactionsRouter = router({
	// Create a new transaction
	create: protectedProcedure
		.input(createTransactionInput)
		.mutation(async ({ ctx, input }) => {
			const newTransaction = {
				...input,
				agentId: ctx.session.user.id,
				status: "draft" as const,
				agentEditAllowed: true,
				representationType: input.representationType ?? "direct",
				isCoBroking: input.representationType === "co_broking",
				marketType: input.marketType ?? "primary",
				transactionType: input.transactionType ?? "sale",
				transactionDate: input.transactionDate ?? input.bookingDate ?? new Date(),
				commissionType: input.commissionType ?? "percentage",
				commissionValue: input.commissionValue?.toString() ?? "0",
				commissionAmount: input.commissionAmount?.toString() ?? "0",
			};

			const [transaction] = await db
				.insert(transactions)
				.values(newTransaction)
				.returning();

			return transaction;
		}),

	// Update an existing transaction
	update: protectedProcedure
		.input(updateTransactionInput)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updateData } = input;

			// Verify the transaction belongs to the current user
			const existingTransaction = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, id),
						eq(transactions.agentId, ctx.session.user.id),
					),
				)
				.limit(1);

			if (existingTransaction.length === 0) {
				throw new Error("Transaction not found or access denied");
			}

			const existing = existingTransaction[0] as {
				status: string | null;
				agentEditAllowed?: boolean | null;
			};

			if (
				!agentCanEditTransaction(existing.status, existing.agentEditAllowed)
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"This transaction is locked. Submit a request to admin for amendments.",
				});
			}

			// Convert number fields to strings for decimal columns
			const processedUpdateData: Record<string, unknown> = {
				...updateData,
				updatedAt: new Date(),
			};

			if (updateData.representationType !== undefined) {
				processedUpdateData.isCoBroking =
					updateData.representationType === "co_broking";
			}

			// Ensure commission fields are strings
			if (updateData.commissionValue !== undefined) {
				processedUpdateData.commissionValue =
					updateData.commissionValue.toString();
			}
			if (updateData.commissionAmount !== undefined) {
				processedUpdateData.commissionAmount =
					updateData.commissionAmount.toString();
			}

			const [updatedTransaction] = await db
				.update(transactions)
				.set(processedUpdateData)
				.where(eq(transactions.id, id))
				.returning();

			return updatedTransaction;
		}),

	// Get a transaction by ID
	getById: protectedProcedure
		.input(transactionIdInput)
		.query(async ({ ctx, input }) => {
			try {
				const [transaction] = await db
					.select()
					.from(transactions)
					.where(
						and(
							eq(transactions.id, input.id),
							eq(transactions.agentId, ctx.session.user.id),
						),
					)
					.limit(1);

				if (!transaction) {
					throw new Error("Transaction not found or access denied");
				}

				return transaction;
			} catch (e) {
				if (isTransactionsSchemaOutdatedError(e)) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: transactionsSchemaOutdatedMessage(),
					});
				}
				throw e;
			}
		}),

	// List transactions for the current user
	list: protectedProcedure
		.input(listTransactionsInput)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(transactions.agentId, ctx.session.user.id)];

			if (input.status) {
				conditions.push(eq(transactions.status, input.status));
			}

			try {
				const transactionList = await db
					.select()
					.from(transactions)
					.where(and(...conditions))
					.orderBy(desc(transactions.updatedAt))
					.limit(input.limit)
					.offset(input.offset);

				const [{ count }] = await db
					.select({ count: sql<number>`count(*)` })
					.from(transactions)
					.where(and(...conditions));

				return {
					transactions: transactionList.map((t: any) => ({
						...t,
						status: normalizeLegacyStatus(t.status),
					})),
					total: count,
					hasMore: input.offset + input.limit < count,
				};
			} catch (e) {
				if (isTransactionsSchemaOutdatedError(e)) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: transactionsSchemaOutdatedMessage(),
					});
				}
				throw e;
			}
		}),

	// Admin: list transactions across all agents with filters/search
	adminList: adminProcedure
		.input(adminListTransactionsInput)
		.query(async ({ input }) => {
			const conditions: any[] = [];

			if (input.marketType) {
				conditions.push(eq(transactions.marketType, input.marketType));
			}
			if (input.transactionType) {
				if (input.transactionType === "rental") {
					conditions.push(
						inArray(transactions.transactionType, ["rental", "lease"]),
					);
				} else {
					conditions.push(eq(transactions.transactionType, input.transactionType));
				}
			}
			if (input.pendingApprovalOnly) {
				conditions.push(
					inArray(transactions.status, [
						"pending",
						"submitted",
						"under_review",
					]),
				);
			}
			if (input.editRequestsOnly) {
				conditions.push(eq(transactions.pendingEditRequest, true));
			}

			if (input.status) {
				conditions.push(
					inArray(transactions.status, dbStatusesForCanonicalFilter(input.status)),
				);
			}
			if (input.projectName)
				conditions.push(eq(transactions.projectName, input.projectName));
			if (input.blockListingId)
				conditions.push(eq(transactions.blockListingId, input.blockListingId));
			if (input.agentId) conditions.push(eq(transactions.agentId, input.agentId));

			if (input.caseNo) {
				const q = `%${input.caseNo.toLowerCase()}%`;
				conditions.push(sql`lower(${transactions.caseNo}) like ${q}`);
			}
			if (input.unitNo) {
				const q = `%${input.unitNo.toLowerCase()}%`;
				conditions.push(sql`lower(${transactions.unitNo}) like ${q}`);
			}
			if (input.buyerName) {
				const q = `%${input.buyerName.toLowerCase()}%`;
				conditions.push(sql`lower(${transactions.clientData}::text) like ${q}`);
			}

			if (input.search) {
				const q = `%${input.search.toLowerCase()}%`;
				conditions.push(
					sql`(lower(${transactions.caseNo}) like ${q} or lower(${transactions.unitNo}) like ${q} or lower(${transactions.projectName}) like ${q} or lower(${transactions.clientData}::text) like ${q} or lower(${user.name}) like ${q})`,
				);
			}

			if (input.dateFrom)
				conditions.push(sql`${transactions.bookingDate} >= ${input.dateFrom}`);
			if (input.dateTo)
				conditions.push(sql`${transactions.bookingDate} <= ${input.dateTo}`);

			const whereClause = conditions.length ? and(...conditions) : undefined;

			const rows = await db
				.select({
					transaction: transactions,
					agentName: user.name,
					agentCode: user.agentCode,
				})
				.from(transactions)
				.leftJoin(user, eq(transactions.agentId, user.id))
				.where(whereClause)
				.orderBy(desc(transactions.updatedAt))
				.limit(input.limit)
				.offset(input.offset);

			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(transactions)
				.leftJoin(user, eq(transactions.agentId, user.id))
				.where(whereClause);

			const coAgentIds = [
				...new Set(
					rows
						.map((r) => {
							const co = r.transaction.coBrokingData as
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

			return {
				transactions: rows.map((r) => {
					const co = r.transaction.coBrokingData as
						| { internalAgentId?: string; agentName?: string }
						| null;
					const coAgent = co?.internalAgentId
						? coAgentMap.get(co.internalAgentId)
						: null;
					return {
						...r.transaction,
						status: normalizeLegacyStatus(r.transaction.status),
						agentName: r.agentName,
						agentCode: r.agentCode,
						coAgentName: coAgent?.name ?? co?.agentName ?? null,
						coAgentCode: coAgent?.agentCode ?? null,
					};
				}),
				total: count,
				hasMore: input.offset + input.limit < count,
			};
		}),

	/** Admin read-only access to any transaction (for approvals / support). */
	adminGetById: adminProcedure
		.input(transactionIdInput)
		.query(async ({ input }) => {
			try {
				const [row] = await db
					.select()
					.from(transactions)
					.where(eq(transactions.id, input.id))
					.limit(1);

				if (!row) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Transaction not found",
					});
				}

				return {
					...row,
					status: normalizeLegacyStatus(row.status),
				};
			} catch (e) {
				if (isTransactionsSchemaOutdatedError(e)) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: transactionsSchemaOutdatedMessage(),
					});
				}
				throw e;
			}
		}),

	// Submit transaction for review
	submit: protectedProcedure
		.input(transactionIdInput)
		.mutation(async ({ ctx, input }) => {
			// Verify the transaction belongs to the current user and is submittable
			const [existingTransaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.agentId, ctx.session.user.id),
					),
				)
				.limit(1);

			if (!existingTransaction) {
				throw new Error("Transaction not found or access denied");
			}

			const txRow = existingTransaction as {
				status: string | null;
				agentEditAllowed?: boolean | null;
			};
			const normalizedStatus = normalizeTransactionStatus(txRow.status);
			const canSubmit =
				normalizedStatus === "draft" ||
				(normalizedStatus === "pending" && txRow.agentEditAllowed === true);

			if (!canSubmit) {
				throw new Error(
					"Transaction already submitted or locked for editing",
				);
			}

			// Lock commission at submission (primary = scheme 100%, secondary = tier split)
			let schemePatch: Record<string, unknown> = {};
			try {
				schemePatch = await lockCommissionOnSubmit(
					existingTransaction as typeof transactions.$inferSelect,
					ctx.session.user.id,
				);
			} catch {
				// If commission tables aren't migrated yet, submission should still work.
			}

			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: "pending",
					submittedAt: new Date(),
					agentEditAllowed: false,
					...schemePatch,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id))
				.returning();

			return updatedTransaction;
		}),

	// Change transaction status (admin)
	adminChangeStatus: adminProcedure
		.input(changeStatusInput)
		.mutation(async ({ ctx, input }) => {
			const mappedStatus = mapIncomingStatus(input.status) as (typeof TRANSACTION_STATUS_VALUES)[number];
			const patch: Record<string, unknown> = {
				status: mappedStatus,
				reviewedAt: new Date(),
				reviewedBy: ctx.session.user.id,
				reviewNotes: input.reviewNotes,
				updatedAt: new Date(),
			};

			if (input.allowAgentEdit !== undefined) {
				patch.agentEditAllowed = input.allowAgentEdit;
			} else if (mappedStatus === "pending") {
				patch.agentEditAllowed = false;
			} else if (mappedStatus === "draft") {
				patch.agentEditAllowed = true;
			}

			const [updatedTransaction] = await db
				.update(transactions)
				.set(patch)
				.where(eq(transactions.id, input.id))
				.returning();

			if (!updatedTransaction) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transaction not found",
				});
			}

			return updatedTransaction;
		}),

	// Legacy alias
	changeStatus: adminProcedure
		.input(changeStatusInput)
		.mutation(async ({ ctx, input }) => {
			const mappedStatus = mapIncomingStatus(input.status) as (typeof TRANSACTION_STATUS_VALUES)[number];
			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: mappedStatus,
					reviewedAt: new Date(),
					reviewedBy: ctx.session.user.id,
					reviewNotes: input.reviewNotes,
					updatedAt: new Date(),
					...(input.allowAgentEdit !== undefined
						? { agentEditAllowed: input.allowAgentEdit }
						: {}),
				})
				.where(eq(transactions.id, input.id))
				.returning();

			if (!updatedTransaction) {
				throw new Error("Transaction not found");
			}

			return updatedTransaction;
		}),

	adminUpdate: adminProcedure
		.input(baseTransactionInput.partial().extend({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const { id, ...updateData } = input;
			const processedUpdateData: Record<string, unknown> = {
				...updateData,
				updatedAt: new Date(),
			};
			if (updateData.commissionValue !== undefined) {
				processedUpdateData.commissionValue =
					updateData.commissionValue.toString();
			}
			if (updateData.commissionAmount !== undefined) {
				processedUpdateData.commissionAmount =
					updateData.commissionAmount.toString();
			}
			if (updateData.representationType !== undefined) {
				processedUpdateData.isCoBroking =
					updateData.representationType === "co_broking";
			}
			const [updated] = await db
				.update(transactions)
				.set(processedUpdateData)
				.where(eq(transactions.id, id))
				.returning();
			if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
			return updated;
		}),

	listMessages: protectedProcedure
		.input(transactionIdInput)
		.query(async ({ ctx, input }) => {
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionMessages(
				input.id,
				ctx.session.user.id,
				sessionUser.role,
				sessionUser.roles,
			);
			return await listTransactionMessages(input.id);
		}),

	addMessage: protectedProcedure
		.input(addMessageInput)
		.mutation(async ({ ctx, input }) => {
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionMessages(
				input.transactionId,
				ctx.session.user.id,
				sessionUser.role,
				sessionUser.roles,
			);
			const isAdmin = hasAdminAccess({
				role: sessionUser.role,
				roles: sessionUser.roles,
			});
			const [txRow] = await db
				.select({ agentId: transactions.agentId })
				.from(transactions)
				.where(eq(transactions.id, input.transactionId))
				.limit(1);

			if (!txRow) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transaction not found",
				});
			}

			const isTransactionAgent = txRow.agentId === ctx.session.user.id;
			const isEditRequest = input.messageType === "edit_request";

			const authorRole =
				isTransactionAgent && isEditRequest
					? "agent"
					: isAdmin
						? "admin"
						: "agent";

			if (!isAdmin && input.messageType === "admin_reply") {
				throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
			}

			if (isEditRequest && isTransactionAgent && !input.requestItem) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Request item is required for edit requests",
				});
			}

			const message = await addTransactionMessage({
				transactionId: input.transactionId,
				authorId: ctx.session.user.id,
				authorRole,
				body: input.body,
				messageType: input.messageType,
			});

			// Queue for admin Approval Requests when the case owner submits an edit request
			// (works even if the user also has admin role in their session).
			if (isEditRequest && isTransactionAgent && input.requestItem) {
				try {
					await db
						.update(transactions)
						.set({
							pendingEditRequest: true,
							requestItem: input.requestItem,
							requestSubmittedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(transactions.id, input.transactionId));
				} catch (err) {
					if (isTransactionsSchemaOutdatedError(err)) {
						throw new TRPCError({
							code: "PRECONDITION_FAILED",
							message: transactionsSchemaOutdatedMessage(),
						});
					}
					throw err;
				}
			}

			return message;
		}),

	// Delete a transaction (only if in draft status)
	delete: protectedProcedure
		.input(transactionIdInput)
		.mutation(async ({ ctx, input }) => {
			// Verify the transaction belongs to the current user and is in draft status
			const [existingTransaction] = await db
				.select()
				.from(transactions)
				.where(
					and(
						eq(transactions.id, input.id),
						eq(transactions.agentId, ctx.session.user.id),
						eq(transactions.status, "draft"),
					),
				)
				.limit(1);

			if (!existingTransaction) {
				throw new Error(
					"Transaction not found, access denied, or cannot be deleted",
				);
			}

			await db.delete(transactions).where(eq(transactions.id, input.id));

			return { success: true };
		}),

	// Calculate enhanced commission with agent tier
	calculateEnhancedCommission: protectedProcedure
		.input(enhancedCommissionInput)
		.query(async ({ ctx, input }) => {
			// Get user's tier information from enhanced session
			const userSession = ctx.session.user as typeof ctx.session.user & {
				agentTier?: string;
				companyCommissionSplit?: number;
			};
			type AgentTier = import("../models/auth").AgentTier;
			const agentTier: AgentTier =
				(userSession.agentTier as AgentTier) || "advisor";
			const companyCommissionSplit = userSession.companyCommissionSplit ?? 70;

			// Calculate commission rate
			let commissionRate: number;
			if (input.commissionType === "percentage") {
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
				companyCommissionSplit,
				input.coBrokerSplitPercentage,
			);

			return {
				...breakdown,
				commissionType: input.commissionType,
				commissionValue: input.commissionValue,
				agentInfo: {
					tier: agentTier,
					commissionSplit: companyCommissionSplit,
				},
			};
		}),

	// Create transaction with enhanced commission calculation
	createWithEnhancedCommission: protectedProcedure
		.input(
			baseTransactionInput
				.extend({
					representationType: z
						.enum(["direct", "co_broking"])
						.default("direct"),
					coBrokerSplitPercentage: z
						.number()
						.min(0)
						.max(100)
						.optional()
						.default(50),
				})
				.refine(
					(data: z.infer<typeof baseTransactionInput>) => {
						// Primary market transactions must be sales
						if (data.marketType === "primary") {
							return data.transactionType === "sale";
						}
						return true;
					},
					{
						message: "Primary market transactions must be sales",
						path: ["transactionType"],
					},
				),
		)
		.mutation(async ({ ctx, input }) => {
			// Get user's tier information
			const userSession = ctx.session.user as typeof ctx.session.user & {
				agentTier?: string;
				companyCommissionSplit?: number;
			};
			type AgentTier = import("../models/auth").AgentTier;
			const agentTier: AgentTier =
				(userSession.agentTier as AgentTier) || "advisor";
			const companyCommissionSplit = userSession.companyCommissionSplit ?? 70;

			// Calculate enhanced commission
			let commissionRate: number;
			const commissionValue = input.commissionValue ?? 0;
			if (input.commissionType === "percentage") {
				commissionRate = commissionValue;
			} else {
				commissionRate =
					(commissionValue / (input.propertyData?.price || 1)) * 100;
			}

			const commissionBreakdown = calculateEnhancedCommission(
				input.propertyData?.price || 0,
				commissionRate,
				input.representationType,
				agentTier,
				companyCommissionSplit,
				input.coBrokerSplitPercentage,
			);

			const newTransaction = {
				...input,
				agentId: ctx.session.user.id,
				status: "draft" as const,
				// Convert numbers to strings for decimal fields
				commissionValue: commissionValue.toString(),
				commissionAmount: commissionBreakdown.totalCommission.toString(),
				// Ensure required fields have defaults for drafts
				marketType: input.marketType ?? "secondary",
				transactionType: input.transactionType ?? "sale",
				transactionDate: input.transactionDate ?? new Date(),
				commissionType: input.commissionType ?? "percentage",
			};

			const [transaction] = await db
				.insert(transactions)
				.values(newTransaction)
				.returning();

			// Log commission calculation for audit
			await logCommissionAudit(
				transaction.id,
				ctx.session.user.id,
				{}, // No old values for new transaction
				commissionBreakdown as unknown as Record<string, unknown>,
				ctx.session.user.id,
				"Transaction created with enhanced commission calculation",
			);

			return {
				transaction,
				commissionBreakdown,
			};
		}),
});
