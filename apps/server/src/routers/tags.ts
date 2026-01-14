import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	crmTags,
	prospectTags,
	type InsertCrmTag,
	type SelectCrmTag,
	type UpdateCrmTag,
	insertCrmTagSchema,
	selectCrmTagSchema,
	updateCrmTagSchema,
} from "../db/schema/crm";
import { user } from "../db/schema/auth";
import { adminProcedure, protectedProcedure, router } from "../lib/trpc";

// List tags input schema
const listTagsInput = z.object({
	search: z.string().optional(),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
});

// Get tag by ID input schema
const getTagInput = z.object({
	id: z.string().uuid(),
});

// Create tag input schema
const createTagInput = insertCrmTagSchema;

// Update tag input schema
const updateTagInput = updateCrmTagSchema;

// Delete tag input schema
const deleteTagInput = z.object({
	id: z.string().uuid(),
});

export const tagsRouter = router({
	// List all tags (available to all authenticated users for dropdown)
	list: protectedProcedure.input(listTagsInput).query(async ({ input }) => {
		try {
			const { search, page, limit } = input;

			const conditions = [];

			// Search filter
			if (search) {
				conditions.push(ilike(crmTags.name, `%${search}%`));
			}

			// Get total count for pagination
			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(crmTags)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			const total = Number(countResult?.count || 0);

			// Get paginated results
			const offset = (page - 1) * limit;
			const results = await db
				.select({
					tag: crmTags,
					createdByName: user.name,
				})
				.from(crmTags)
				.leftJoin(user, eq(crmTags.createdBy, user.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(crmTags.createdAt))
				.limit(limit)
				.offset(offset);

			return {
				tags: results.map((r) => ({
					...selectCrmTagSchema.parse(r.tag),
					createdByName: r.createdByName || "Unknown",
				})),
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error) {
			console.error("❌ Tags list error:", error);
			throw error;
		}
	}),

	// Get a single tag by ID
	get: protectedProcedure.input(getTagInput).query(async ({ input }) => {
		const { id } = input;

		const [result] = await db
			.select({
				tag: crmTags,
				createdByName: user.name,
			})
			.from(crmTags)
			.leftJoin(user, eq(crmTags.createdBy, user.id))
			.where(eq(crmTags.id, id))
			.limit(1);

		if (!result) {
			throw new Error("Tag not found");
		}

		return {
			...selectCrmTagSchema.parse(result.tag),
			createdByName: result.createdByName || "Unknown",
		};
	}),

	// Create a new tag (admin only)
	create: adminProcedure.input(createTagInput).mutation(async ({ input, ctx }) => {
		const adminId = ctx.session.user.id;

		// Check if tag with same name already exists
		const [existing] = await db
			.select()
			.from(crmTags)
			.where(eq(crmTags.name, input.name))
			.limit(1);

		if (existing) {
			throw new Error("Tag with this name already exists");
		}

		const [created] = await db
			.insert(crmTags)
			.values({ ...input, createdBy: adminId })
			.returning();

		return selectCrmTagSchema.parse(created);
	}),

	// Update an existing tag (admin only)
	update: adminProcedure.input(updateTagInput).mutation(async ({ input, ctx }) => {
		const { id, ...updateData } = input;

		const [existing] = await db
			.select()
			.from(crmTags)
			.where(eq(crmTags.id, id))
			.limit(1);

		if (!existing) {
			throw new Error("Tag not found");
		}

		// If name is being updated, check for duplicates
		if (updateData.name && updateData.name !== existing.name) {
			const [duplicate] = await db
				.select()
				.from(crmTags)
				.where(eq(crmTags.name, updateData.name))
				.limit(1);

			if (duplicate) {
				throw new Error("Tag with this name already exists");
			}
		}

		const [updated] = await db
			.update(crmTags)
			.set({ ...updateData, updatedAt: new Date() })
			.where(eq(crmTags.id, id))
			.returning();

		return selectCrmTagSchema.parse(updated);
	}),

	// Delete a tag (admin only)
	delete: adminProcedure.input(deleteTagInput).mutation(async ({ input, ctx }) => {
		const { id } = input;

		const [existing] = await db
			.select()
			.from(crmTags)
			.where(eq(crmTags.id, id))
			.limit(1);

		if (!existing) {
			throw new Error("Tag not found");
		}

		// Delete tag (cascade will remove all prospect_tags relationships)
		await db.delete(crmTags).where(eq(crmTags.id, id));

		return { success: true, id };
	}),
});
