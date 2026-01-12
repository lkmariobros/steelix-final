import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type InsertProspect,
	type SelectProspect,
	type UpdateProspect,
	insertProspectSchema,
	prospects,
	selectProspectSchema,
	updateProspectSchema,
} from "../db/schema/crm";
import { protectedProcedure, router } from "../lib/trpc";

// List prospects input schema
const listProspectsInput = z.object({
	search: z.string().optional(),
	type: z.enum(["tenant", "owner"]).optional(),
	property: z.enum(["property_developer", "secondary_market_owner"]).optional(),
	status: z.enum(["active", "inactive", "pending"]).optional(),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(10),
});

// Get prospect by ID input schema
const getProspectInput = z.object({
	id: z.string().uuid(),
});

// Create prospect input schema
const createProspectInput = insertProspectSchema;

// Update prospect input schema
const updateProspectInput = updateProspectSchema;

// Delete prospect input schema
const deleteProspectInput = z.object({
	id: z.string().uuid(),
});

export const crmRouter = router({
	// List all prospects with filters and pagination
	list: protectedProcedure.input(listProspectsInput).query(async ({ input, ctx }) => {
		try {
			const { search, type, property, status, page, limit } = input;
			const agentId = ctx.session.user.id;

			// Build where conditions
			const conditions = [eq(prospects.agentId, agentId)];

			// Search filter (name, email, or phone)
			if (search) {
				const searchConditions = or(
					ilike(prospects.name, `%${search}%`),
					ilike(prospects.email, `%${search}%`),
					ilike(prospects.phone, `%${search}%`),
				);
				if (searchConditions) {
					conditions.push(searchConditions);
				}
			}

			// Type filter
			if (type) {
				conditions.push(eq(prospects.type, type));
			}

			// Property filter
			if (property) {
				conditions.push(eq(prospects.property, property));
			}

			// Status filter
			if (status) {
				conditions.push(eq(prospects.status, status));
			}

			// Get total count for pagination
			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(prospects)
				.where(and(...conditions));

			const total = Number(countResult?.count || 0);

			// Get paginated results
			const offset = (page - 1) * limit;
			const results = await db
				.select()
				.from(prospects)
				.where(and(...conditions))
				.orderBy(desc(prospects.createdAt))
				.limit(limit)
				.offset(offset);

			return {
				prospects: results.map((p) => selectProspectSchema.parse(p)),
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			console.error("❌ CRM list error:", error);
			throw error;
		}
	}),

	// Get a single prospect by ID
	get: protectedProcedure.input(getProspectInput).query(async ({ input, ctx }) => {
		const { id } = input;
		const agentId = ctx.session.user.id;

		const [prospect] = await db
			.select()
			.from(prospects)
			.where(and(eq(prospects.id, id), eq(prospects.agentId, agentId)))
			.limit(1);

		if (!prospect) {
			throw new Error("Prospect not found");
		}

		return selectProspectSchema.parse(prospect);
	}),

	// Create a new prospect
	create: protectedProcedure
		.input(createProspectInput)
		.mutation(async ({ input, ctx }) => {
			const agentId = ctx.session.user.id;

			const newProspect: InsertProspect & { agentId: string } = {
				...input,
				agentId,
			};

			const [created] = await db
				.insert(prospects)
				.values(newProspect)
				.returning();

			return selectProspectSchema.parse(created);
		}),

	// Update an existing prospect
	update: protectedProcedure
		.input(updateProspectInput)
		.mutation(async ({ input, ctx }) => {
			const { id, ...updateData } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect belongs to the agent
			const [existing] = await db
				.select()
				.from(prospects)
				.where(and(eq(prospects.id, id), eq(prospects.agentId, agentId)))
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			const [updated] = await db
				.update(prospects)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(prospects.id, id))
				.returning();

			return selectProspectSchema.parse(updated);
		}),

	// Delete a prospect
	delete: protectedProcedure
		.input(deleteProspectInput)
		.mutation(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect belongs to the agent
			const [existing] = await db
				.select()
				.from(prospects)
				.where(and(eq(prospects.id, id), eq(prospects.agentId, agentId)))
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			await db.delete(prospects).where(eq(prospects.id, id));

			return { success: true, id };
		}),
});
