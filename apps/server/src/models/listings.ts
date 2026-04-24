import { boolean, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

export const listingTypeEnum = pgEnum("listing_type", ["sale", "rent"]);
export const listingStatusEnum = pgEnum("listing_status", [
	"draft",
	"active",
	"under_offer",
	"closed",
	"archived",
]);
export const propertyTypeEnum = pgEnum("listing_property_type", [
	"landed",
	"condo",
	"apartment",
	"commercial",
	"industrial",
	"other",
]);
export const referralShareTypeEnum = pgEnum("listing_referral_share_type", [
	"percentage",
	"fixed",
]);

export const listings = pgTable(
	"listings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerAgentId: text("owner_agent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		propertyType: propertyTypeEnum("property_type").notNull().default("other"),
		listingType: listingTypeEnum("listing_type").notNull(),
		price: numeric("price", { precision: 14, scale: 2 }).notNull(),
		city: text("city"),
		state: text("state"),
		addressLine1: text("address_line_1"),
		postcode: text("postcode"),
		bedrooms: integer("bedrooms"),
		bathrooms: integer("bathrooms"),
		builtUpSqft: integer("built_up_sqft"),
		status: listingStatusEnum("status").notNull().default("draft"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		archivedAt: timestamp("archived_at"),
	},
	(table) => ({
		ownerAgentIdIdx: index("idx_listings_owner_agent_id").on(table.ownerAgentId),
		statusIdx: index("idx_listings_status").on(table.status),
		listingTypeIdx: index("idx_listings_listing_type").on(table.listingType),
		titleIdx: index("idx_listings_title").on(table.title),
	})
);

export const listingReferralRules = pgTable(
	"listing_referral_rules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		listingId: uuid("listing_id")
			.notNull()
			.references(() => listings.id, { onDelete: "cascade" }),
		shareType: referralShareTypeEnum("share_type").notNull().default("percentage"),
		shareValue: numeric("share_value", { precision: 10, scale: 2 }).notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		listingIdIdx: index("idx_listing_referral_rules_listing_id").on(table.listingId),
	})
);

export const insertListingSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	propertyType: z.enum(["landed", "condo", "apartment", "commercial", "industrial", "other"]),
	listingType: z.enum(["sale", "rent"]),
	price: z.coerce.number().positive(),
	city: z.string().optional(),
	state: z.string().optional(),
	addressLine1: z.string().optional(),
	postcode: z.string().optional(),
	bedrooms: z.number().int().nonnegative().optional(),
	bathrooms: z.number().int().nonnegative().optional(),
	builtUpSqft: z.number().int().nonnegative().optional(),
	status: z.enum(["draft", "active", "under_offer", "closed", "archived"]).optional(),
});

export const updateListingSchema = insertListingSchema.partial().extend({
	id: z.string().uuid(),
});

export const listingReferralRuleSchema = z.object({
	listingId: z.string().uuid(),
	shareType: z.enum(["percentage", "fixed"]),
	shareValue: z.coerce.number().nonnegative(),
});

