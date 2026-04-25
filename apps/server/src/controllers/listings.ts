import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import {
	insertListingSchema,
	listingReferralRuleSchema,
	listingReferralRules,
	listings,
	updateListingSchema,
} from "../models/listings";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import { protectedProcedure, router } from "../utils/trpc";
import { sql } from "drizzle-orm";

const listInput = z.object({
	search: z.string().optional(),
	status: z.enum(["draft", "active", "under_offer", "closed", "archived", "all"]).default("active"),
	listingType: z.enum(["sale", "rent", "all"]).default("all"),
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(100).default(20),
});

const getByIdInput = z.object({ id: z.string().uuid() });
const archiveInput = z.object({ id: z.string().uuid(), archived: z.boolean().default(true) });
const linkTransactionInput = z.object({
	listingId: z.string().uuid(),
	transactionId: z.string().uuid(),
});
const linkedTransactionsInput = z.object({ listingId: z.string().uuid() });

function isListingSchemaOutdatedError(error: unknown): boolean {
	const e = error as { message?: string };
	const message = e?.message ?? String(error);
	const lower = message.toLowerCase();

	return (
		lower.includes('relation "listings" does not exist') ||
		lower.includes('relation "listing_referral_rules" does not exist') ||
		lower.includes("column") ||
		lower.includes("does not exist") ||
		lower.includes("invalid input value for enum listing_status")
	);
}

function mapListingDbError(error: unknown): never {
	if (isListingSchemaOutdatedError(error)) {
		throw new Error(
			"Listings database schema is not deployed yet. Run server database migration/push to create listings tables and enums, then refresh."
		);
	}
	throw error;
}

export const listingsRouter = router({
	list: protectedProcedure.input(listInput).query(async ({ input }) => {
		try {
			const { search, status, listingType, page, limit } = input;
			const offset = (page - 1) * limit;
			const conditions = [];
			if (search) {
				conditions.push(
					or(
						ilike(listings.title, `%${search}%`),
						ilike(listings.city, `%${search}%`),
						ilike(listings.state, `%${search}%`),
						ilike(listings.addressLine1, `%${search}%`)
					)
				);
			}
			if (status !== "all") conditions.push(eq(listings.status, status));
			if (listingType !== "all") conditions.push(eq(listings.listingType, listingType));

			const rows = await db
				.select()
				.from(listings)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(listings.updatedAt))
				.limit(limit)
				.offset(offset);

			return { listings: rows, pagination: { page, limit, total: rows.length } };
		} catch (error) {
			if (isListingSchemaOutdatedError(error)) {
				console.warn("Listings schema missing/outdated. Returning empty state for list query.");
				return { listings: [], pagination: { page: input.page, limit: input.limit, total: 0 } };
			}
			mapListingDbError(error);
		}
	}),

	getById: protectedProcedure.input(getByIdInput).query(async ({ input }) => {
		const [row] = await db.select().from(listings).where(eq(listings.id, input.id)).limit(1);
		if (!row) throw new Error("Listing not found");
		const [rule] = await db
			.select()
			.from(listingReferralRules)
			.where(and(eq(listingReferralRules.listingId, row.id), eq(listingReferralRules.isActive, true)))
			.limit(1);
		return { ...row, referralRule: rule ?? null };
	}),

	create: protectedProcedure.input(insertListingSchema).mutation(async ({ input, ctx }) => {
		const [created] = await db
			.insert(listings)
			.values({
				...input,
				status: input.status ?? "draft",
				ownerAgentId: ctx.session.user.id,
				price: String(input.price),
				updatedAt: new Date(),
			})
			.returning();
		return created;
	}),

	update: protectedProcedure.input(updateListingSchema).mutation(async ({ input, ctx }) => {
		const { id, ...patch } = input;
		const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
		if (!existing) throw new Error("Listing not found");
		if (existing.ownerAgentId !== ctx.session.user.id) throw new Error("Not allowed");

		const [updated] = await db
			.update(listings)
			.set({
				...patch,
				price: patch.price !== undefined ? String(patch.price) : undefined,
				updatedAt: new Date(),
			})
			.where(eq(listings.id, id))
			.returning();
		return updated;
	}),

	setReferralRule: protectedProcedure.input(listingReferralRuleSchema).mutation(async ({ input, ctx }) => {
		const [existing] = await db
			.select()
			.from(listings)
			.where(eq(listings.id, input.listingId))
			.limit(1);
		if (!existing) throw new Error("Listing not found");
		if (existing.ownerAgentId !== ctx.session.user.id) throw new Error("Not allowed");

		await db
			.update(listingReferralRules)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(listingReferralRules.listingId, input.listingId));

		const [rule] = await db
			.insert(listingReferralRules)
			.values({
				listingId: input.listingId,
				shareType: input.shareType,
				shareValue: String(input.shareValue),
				isActive: true,
				updatedAt: new Date(),
			})
			.returning();
		return rule;
	}),

	archive: protectedProcedure.input(archiveInput).mutation(async ({ input, ctx }) => {
		const [existing] = await db.select().from(listings).where(eq(listings.id, input.id)).limit(1);
		if (!existing) throw new Error("Listing not found");
		if (existing.ownerAgentId !== ctx.session.user.id) throw new Error("Not allowed");
		const [updated] = await db
			.update(listings)
			.set({
				status: input.archived ? "archived" : "active",
				archivedAt: input.archived ? new Date() : null,
				updatedAt: new Date(),
			})
			.where(eq(listings.id, input.id))
			.returning();
		return updated;
	}),

	linkToTransaction: protectedProcedure.input(linkTransactionInput).mutation(async ({ input, ctx }) => {
		const [listing] = await db.select().from(listings).where(eq(listings.id, input.listingId)).limit(1);
		if (!listing) throw new Error("Listing not found");
		if (listing.status === "archived") throw new Error("Cannot link archived listing");

		const [txn] = await db
			.select()
			.from(transactions)
			.where(and(eq(transactions.id, input.transactionId), eq(transactions.agentId, ctx.session.user.id)))
			.limit(1);
		if (!txn) throw new Error("Transaction not found");

		const currentProperty = txn.propertyData ?? {
			address: listing.addressLine1 || "",
			propertyType: listing.propertyType,
			price: Number(listing.price),
		};
		const [activeRule] = await db
			.select()
			.from(listingReferralRules)
			.where(and(eq(listingReferralRules.listingId, listing.id), eq(listingReferralRules.isActive, true)))
			.limit(1);

		const mergedProperty = {
			...currentProperty,
			address: currentProperty.address || listing.addressLine1 || "",
			propertyType: currentProperty.propertyType || listing.propertyType,
			price: currentProperty.price || Number(listing.price),
			listingId: listing.id,
			listingTitle: listing.title,
			...(activeRule && {
				listingReferralShareType: activeRule.shareType,
				listingReferralShareValue: Number(activeRule.shareValue),
			}),
		};

		await db
			.update(transactions)
			.set({
				propertyData: mergedProperty,
				updatedAt: new Date(),
			})
			.where(eq(transactions.id, input.transactionId));

		return { success: true };
	}),

	linkedTransactions: protectedProcedure
		.input(linkedTransactionsInput)
		.query(async ({ input, ctx }) => {
			try {
				const rows = await db
					.select({
						id: transactions.id,
						status: transactions.status,
						transactionDate: transactions.transactionDate,
						updatedAt: transactions.updatedAt,
						clientData: transactions.clientData,
						propertyData: transactions.propertyData,
					})
					.from(transactions)
					.where(
						and(
							eq(transactions.agentId, ctx.session.user.id),
							sql`${transactions.propertyData} ->> 'listingId' = ${input.listingId}`
						)
					)
					.orderBy(desc(transactions.updatedAt))
					.limit(20);

				return { transactions: rows };
			} catch (error) {
				mapListingDbError(error);
			}
		}),
});

