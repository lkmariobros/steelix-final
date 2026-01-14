import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type InsertAutoReplyRule,
	type SelectAutoReplyRule,
	type UpdateAutoReplyRule,
	autoReplyRules,
	insertAutoReplyRuleSchema,
	selectAutoReplyRuleSchema,
	updateAutoReplyRuleSchema,
} from "../db/schema/auto-reply";
import { protectedProcedure, router } from "../lib/trpc";

// List auto-reply rules input schema
const listAutoReplyRulesInput = z.object({
	search: z.string().optional(),
	status: z.enum(["tenant", "owner"]).optional(),
	sortBy: z.enum(["status", "owner"]).default("status"),
});

// Get auto-reply rule by ID input schema
const getAutoReplyRuleInput = z.object({
	id: z.string().uuid(),
});

// Create auto-reply rule input schema
const createAutoReplyRuleInput = insertAutoReplyRuleSchema;

// Update auto-reply rule input schema
const updateAutoReplyRuleInput = updateAutoReplyRuleSchema;

// Delete auto-reply rule input schema
const deleteAutoReplyRuleInput = z.object({
	id: z.string().uuid(),
});

export const autoReplyRouter = router({
	// List all auto-reply rules with filters and sorting
	list: protectedProcedure
		.input(listAutoReplyRulesInput)
		.query(async ({ input, ctx }) => {
			try {
				const { search, status, sortBy } = input;
				const agentId = ctx.session.user.id;

				// Build where conditions
				const conditions = [eq(autoReplyRules.agentId, agentId)];

				// Status filter
				if (status) {
					conditions.push(eq(autoReplyRules.status, status));
				}

				// Search filter (response, keywords, or messageOwner)
				if (search) {
					const searchConditions = or(
						ilike(autoReplyRules.response, `%${search}%`),
						ilike(autoReplyRules.messageOwner, `%${search}%`),
						// Note: JSONB search for keywords would require a different approach
						// For now, we'll search in response and messageOwner
					);
					if (searchConditions) {
						conditions.push(searchConditions);
					}
				}

				// Get all results first (for client-side sorting by keywords)
				const allResults = await db
					.select()
					.from(autoReplyRules)
					.where(and(...conditions));

				// Client-side filtering for keywords (since JSONB search is complex)
				let filteredResults = allResults;
				if (search) {
					filteredResults = allResults.filter((rule) => {
						const trigger = rule.trigger as {
							type: string;
							keywords: string[];
						};
						return trigger.keywords.some((keyword) =>
							keyword.toLowerCase().includes(search.toLowerCase()),
						);
					});
				}

				// Client-side sorting
				const sortedResults = [...filteredResults].sort((a, b) => {
					if (sortBy === "status") {
						// Sort by status: owner first, then tenant
						if (a.status === b.status) {
							return a.messageOwner.localeCompare(b.messageOwner);
						}
						return a.status === "owner" ? -1 : 1;
					}
					if (sortBy === "owner") {
						return a.messageOwner.localeCompare(b.messageOwner);
					}
					return 0;
				});

				// Calculate summary stats
				const totalRules = sortedResults.length;
				const ownerRules = sortedResults.filter((r) => r.status === "owner").length;
				const tenantRules = sortedResults.filter((r) => r.status === "tenant").length;

				return {
					rules: sortedResults.map((r) => selectAutoReplyRuleSchema.parse(r)),
					summary: {
						total: totalRules,
						owner: ownerRules,
						tenant: tenantRules,
					},
				};
			} catch (error) {
				console.error("❌ Auto-reply list error:", error);
				throw error;
			}
		}),

	// Get a single auto-reply rule by ID
	get: protectedProcedure
		.input(getAutoReplyRuleInput)
		.query(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			const [rule] = await db
				.select()
				.from(autoReplyRules)
				.where(and(eq(autoReplyRules.id, id), eq(autoReplyRules.agentId, agentId)))
				.limit(1);

			if (!rule) {
				throw new Error("Auto-reply rule not found");
			}

			return selectAutoReplyRuleSchema.parse(rule);
		}),

	// Create a new auto-reply rule
	create: protectedProcedure
		.input(createAutoReplyRuleInput)
		.mutation(async ({ input, ctx }) => {
			try {
				const agentId = ctx.session.user.id;

				const newRule: InsertAutoReplyRule & { agentId: string } = {
					...input,
					agentId,
				};

				const [created] = await db
					.insert(autoReplyRules)
					.values(newRule)
					.returning();

				return selectAutoReplyRuleSchema.parse(created);
			} catch (error) {
				console.error("❌ Auto-reply create error:", error);
				throw error;
			}
		}),

	// Update an existing auto-reply rule
	update: protectedProcedure
		.input(updateAutoReplyRuleInput)
		.mutation(async ({ input, ctx }) => {
			const { id, ...updateData } = input;
			const agentId = ctx.session.user.id;

			// Verify rule belongs to the agent
			const [existing] = await db
				.select()
				.from(autoReplyRules)
				.where(and(eq(autoReplyRules.id, id), eq(autoReplyRules.agentId, agentId)))
				.limit(1);

			if (!existing) {
				throw new Error("Auto-reply rule not found");
			}

			const [updated] = await db
				.update(autoReplyRules)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(autoReplyRules.id, id))
				.returning();

			return selectAutoReplyRuleSchema.parse(updated);
		}),

	// Delete an auto-reply rule
	delete: protectedProcedure
		.input(deleteAutoReplyRuleInput)
		.mutation(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			// Verify rule belongs to the agent
			const [existing] = await db
				.select()
				.from(autoReplyRules)
				.where(and(eq(autoReplyRules.id, id), eq(autoReplyRules.agentId, agentId)))
				.limit(1);

			if (!existing) {
				throw new Error("Auto-reply rule not found");
			}

			await db.delete(autoReplyRules).where(eq(autoReplyRules.id, id));

			return { success: true, id };
		}),
});
