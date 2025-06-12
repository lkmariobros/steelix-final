import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type NewTransaction,
	type Transaction,
	insertTransactionSchema,
	selectTransactionSchema,
	transactions,
} from "../db/schema/transactions";
import { protectedProcedure, router } from "../lib/trpc";

// Input schemas for specific operations
const createTransactionInput = z.object({
	marketType: z.enum(["primary", "secondary"]),
	transactionType: z.enum(["sale", "lease", "rental"]),
	transactionDate: z.coerce.date(),
	propertyData: z
		.object({
			address: z.string().min(1, "Address is required"),
			propertyType: z.string().min(1, "Property type is required"),
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
			email: z.string().email("Valid email is required"),
			phone: z.string().min(1, "Phone number is required"),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string().min(1, "Client source is required"),
			notes: z.string().optional(),
		})
		.optional(),
	isCoBroking: z.boolean().default(false),
	coBrokingData: z
		.object({
			agentName: z.string().min(1, "Agent name is required"),
			agencyName: z.string().min(1, "Agency name is required"),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%"),
			contactInfo: z.string().min(1, "Contact info is required"),
		})
		.optional(),
	commissionType: z.enum(["percentage", "fixed"]),
	commissionValue: z.number().positive(),
	commissionAmount: z.number().positive(),
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

const updateTransactionInput = createTransactionInput.partial().extend({
	id: z.string().uuid(),
});

const transactionIdInput = z.object({
	id: z.string().uuid(),
});

const changeStatusInput = z.object({
	id: z.string().uuid(),
	status: z.enum([
		"draft",
		"submitted",
		"under_review",
		"approved",
		"rejected",
		"completed",
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
			"approved",
			"rejected",
			"completed",
		])
		.optional(),
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
				// Convert numbers to strings for decimal fields
				commissionValue: input.commissionValue.toString(),
				commissionAmount: input.commissionAmount.toString(),
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
		}),

	// List transactions for the current user
	list: protectedProcedure
		.input(listTransactionsInput)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(transactions.agentId, ctx.session.user.id)];

			if (input.status) {
				conditions.push(eq(transactions.status, input.status));
			}

			const transactionList = await db
				.select()
				.from(transactions)
				.where(and(...conditions))
				.orderBy(desc(transactions.updatedAt))
				.limit(input.limit)
				.offset(input.offset);

			// Get total count for pagination
			const [{ count }] = await db
				.select({ count: sql<number>`count(*)` })
				.from(transactions)
				.where(and(...conditions));

			return {
				transactions: transactionList,
				total: count,
				hasMore: input.offset + input.limit < count,
			};
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

			const [updatedTransaction] = await db
				.update(transactions)
				.set({
					status: "submitted",
					submittedAt: new Date(),
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
});
