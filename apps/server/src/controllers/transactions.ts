import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
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
import {
	calculateSchemeCommission,
	resolveSchemeForBlockAtDate,
} from "../services/commission-schemes";
import { db } from "../utils/db";
import {
	isTransactionsSchemaOutdatedError,
	transactionsSchemaOutdatedMessage,
} from "../utils/transactions-schema-hint";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";

// Base transaction input schema (without validation)
// All fields are optional to support draft saving with partial data
const baseTransactionInput = z.object({
	marketType: z.enum(["primary", "secondary"]).optional(),
	transactionType: z.enum(["sale", "lease"]).optional(),
	transactionDate: z.coerce.date().optional(),
	propertyData: z
		.object({
			address: z.string().min(1, "Address is required"),
			propertyType: z.string().min(1, "Property type is required"),
			listingId: z.string().uuid().optional(),
			listingTitle: z.string().optional(),
			listingReferralShareType: z.enum(["percentage", "fixed"]).optional(),
			listingReferralShareValue: z.number().nonnegative().optional(),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number().positive("Price must be positive"),
			description: z.string().optional(),
		})
		.optional(),
	clientData: z
		.object({
			name: z.string().min(1, "Client name is required"),
			email: z
				.string()
				.email("Valid email is required")
				.optional()
				.or(z.literal("")),
			phone: z.string().min(1, "Phone number is required"),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string().min(1, "Client source is required"),
			notes: z.string().optional(),
		})
		.optional(),
	isCoBroking: z.boolean().default(false),
	coBrokingData: z
		.object({
			agentName: z.string().optional(),
			agencyName: z.string().optional(),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%")
				.optional(),
			contactInfo: z.string().optional(),
			// New fields for enhanced co-broking
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
			// If co-broking is enabled, validate required fields
			if ("isCoBroking" in data && data.isCoBroking && data.coBrokingData) {
				const { agentName, agencyName, contactInfo } = data.coBrokingData;
				return (
					agentName &&
					agentName.trim().length > 0 &&
					agencyName &&
					agencyName.trim().length > 0 &&
					contactInfo &&
					contactInfo.trim().length > 0
				);
			}
			// If co-broking is disabled, it's valid
			return true;
		},
		{
			message: "Co-broking fields are required when co-broking is enabled",
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
			// If co-broking is enabled, validate required fields
			if ("isCoBroking" in data && data.isCoBroking && data.coBrokingData) {
				const { agentName, agencyName, contactInfo } = data.coBrokingData;
				return (
					agentName &&
					agentName.trim().length > 0 &&
					agencyName &&
					agencyName.trim().length > 0 &&
					contactInfo &&
					contactInfo.trim().length > 0
				);
			}
			// If co-broking is disabled, it's valid
			return true;
		},
		{
			message: "Co-broking fields are required when co-broking is enabled",
			path: ["coBrokingData"],
		},
	);

const transactionIdInput = z.object({
	id: z.string().uuid(),
});

const changeStatusInput = z.object({
	id: z.string().uuid(),
	status: z.enum([
		"draft",
		"submitted",
		"under_review",
		"pending",
		"verified",
		"approved",
		"commission_released",
		"rejected",
		"completed",
		"cancelled",
	]),
	reviewNotes: z.string().optional(),
});

const listTransactionsInput = z.object({
	limit: z.number().min(1).max(100).default(10),
	offset: z.number().min(0).default(0),
	status: z
		.enum([
			"draft",
			"submitted",
			"under_review",
			"pending",
			"verified",
			"approved",
			"commission_released",
			"rejected",
			"completed",
			"cancelled",
		])
		.optional(),
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
	status: z
		.enum([
			"draft",
			"submitted",
			"under_review",
			"pending",
			"verified",
			"approved",
			"commission_released",
			"rejected",
			"completed",
			"cancelled",
		])
		.optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
});

function normalizeLegacyStatus(status: string | null | undefined) {
	if (!status) return status;
	if (status === "submitted" || status === "under_review") return "pending";
	return status;
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
				// Convert numbers to strings for decimal fields (handle optional values)
				commissionValue: input.commissionValue?.toString() ?? "0",
				commissionAmount: input.commissionAmount?.toString() ?? "0",
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

			// Convert number fields to strings for decimal columns
			const processedUpdateData: Record<string, unknown> = {
				...updateData,
				updatedAt: new Date(),
			};

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

			if (input.status) conditions.push(eq(transactions.status, input.status));
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
					sql`(lower(${transactions.caseNo}) like ${q} or lower(${transactions.unitNo}) like ${q} or lower(${transactions.clientData}::text) like ${q})`,
				);
			}

			if (input.dateFrom)
				conditions.push(sql`${transactions.bookingDate} >= ${input.dateFrom}`);
			if (input.dateTo)
				conditions.push(sql`${transactions.bookingDate} <= ${input.dateTo}`);

			const rows = await db
				.select()
				.from(transactions)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(transactions.updatedAt))
				.limit(input.limit)
				.offset(input.offset);

			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(transactions)
				.where(conditions.length ? and(...conditions) : undefined);

			return {
				transactions: rows.map((t: any) => ({
					...t,
					status: normalizeLegacyStatus(t.status),
				})),
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
					"Transaction not found, access denied, or already submitted",
				);
			}

			// Lock commission scheme snapshot at submission time (if available)
			let schemePatch: Record<string, unknown> = {};
			try {
				const tx = existingTransaction as any;
				const hasSnapshot = Boolean(tx.commissionSchemeSnapshot);
				const property = tx.propertyData as
					| { listingId?: string; price?: number }
					| null
					| undefined;
				if (!hasSnapshot && property?.listingId && property.price) {
					const resolved = await resolveSchemeForBlockAtDate({
						blockListingId: property.listingId,
						at: tx.transactionDate ?? new Date(),
					});
					if (resolved) {
						const { scheme, tier } = resolved;
						const nettPrice = Number(property.price);
						const breakdown = calculateSchemeCommission({
							nettPrice,
							commissionPercent: tier.commissionPercent,
							incSst: scheme.incSst,
							sstPercent: scheme.sstPercent,
							sstBorneBy: scheme.sstBorneBy,
						});

						schemePatch = {
							commissionType: "percentage",
							commissionValue: tier.commissionPercent.toFixed(2),
							commissionAmount: breakdown.grossCommission.toFixed(2),
							commissionSchemeSnapshot: {
								schemeId: scheme.id,
								schemeName: scheme.schemeName,
								shortform: scheme.shortform,
								projectName: scheme.projectName,
								blockListingId: scheme.blockListingId,
								blockListingTitle: scheme.blockListingTitle,
								tierId: tier.id,
								tierName: tier.tierName,
								commissionPercent: tier.commissionPercent,
								overridePercent: tier.overridePercent,
								incSst: scheme.incSst,
								sstPercent: scheme.sstPercent,
								sstBorneBy: scheme.sstBorneBy,
								lockedAt: new Date().toISOString(),
							},
							commissionBreakdown: {
								spaPrice: nettPrice,
								nettPrice,
								commissionRatePercent: tier.commissionPercent,
								baseCommission: breakdown.baseCommission,
								grossCommission: breakdown.grossCommission,
								sstPercent: scheme.sstPercent,
								sstAmount: breakdown.sstAmount,
								agentNetCommission: breakdown.agentNetCommission,
							},
						};
					}
				}
			} catch {
				// If commission scheme tables aren't migrated yet, submission should still work.
			}

			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: "pending",
					submittedAt: new Date(),
					...schemePatch,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id))
				.returning();

			return updatedTransaction;
		}),

	// Change transaction status (admin function)
	changeStatus: protectedProcedure
		.input(changeStatusInput)
		.mutation(async ({ ctx, input }) => {
			// Note: In a real app, you'd check if the user has admin privileges
			// For now, we'll allow any authenticated user to change status

			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: input.status,
					reviewedAt: new Date(),
					reviewedBy: ctx.session.user.id,
					reviewNotes: input.reviewNotes,
					updatedAt: new Date(),
				})
				.where(eq(transactions.id, input.id))
				.returning();

			if (!updatedTransaction) {
				throw new Error("Transaction not found");
			}

			return updatedTransaction;
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
			const companyCommissionSplit = userSession.companyCommissionSplit ?? 60;

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
			const companyCommissionSplit = userSession.companyCommissionSplit ?? 60;

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
