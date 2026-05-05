import {
	boolean,
	date,
	decimal,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { listings } from "./listings";
import { user } from "./auth";

export const sstBorneByEnum = pgEnum("sst_borne_by", ["client", "agent"]);

export const commissionSchemes = pgTable(
	"commission_schemes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		schemeName: text("scheme_name").notNull(),
		shortform: text("shortform").notNull(),
		description: text("description").notNull(),
		/** Linked to a "block" / listing (optional, but required to be usable for auto-calc) */
		blockListingId: uuid("block_listing_id").references(() => listings.id, {
			onDelete: "set null",
		}),
		/** Convenience snapshot for search/filter even if listing is deleted/renamed */
		projectName: text("project_name").notNull(),
		isActive: boolean("is_active").notNull().default(true),

		incSst: boolean("inc_sst").notNull(),
		sstPercent: decimal("sst_percent", { precision: 5, scale: 2 }).notNull(),
		sstBorneBy: sstBorneByEnum("sst_borne_by").notNull(),

		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		updatedBy: text("updated_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		nameIdx: index("idx_commission_schemes_scheme_name").on(t.schemeName),
		shortformIdx: index("idx_commission_schemes_shortform").on(t.shortform),
		projectIdx: index("idx_commission_schemes_project").on(t.projectName),
		blockIdx: index("idx_commission_schemes_block_listing_id").on(t.blockListingId),
		activeIdx: index("idx_commission_schemes_is_active").on(t.isActive),
	}),
);

export const commissionSchemeTiers = pgTable(
	"commission_scheme_tiers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		schemeId: uuid("scheme_id")
			.notNull()
			.references(() => commissionSchemes.id, { onDelete: "cascade" }),
		tierName: text("tier_name").notNull(),
		commissionPercent: decimal("commission_percent", {
			precision: 6,
			scale: 3,
		}).notNull(),
		overridePercent: decimal("override_percent", {
			precision: 6,
			scale: 3,
		}).notNull().default("0.000"),
		effectiveFrom: date("effective_from").notNull(),
		effectiveTo: date("effective_to"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		schemeIdx: index("idx_commission_scheme_tiers_scheme_id").on(t.schemeId),
		activeIdx: index("idx_commission_scheme_tiers_is_active").on(t.isActive),
		effectiveFromIdx: index("idx_commission_scheme_tiers_effective_from").on(
			t.effectiveFrom,
		),
	}),
);

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const sstBorneBySchema = z.enum(["client", "agent"]);

export const commissionSchemeTierInputSchema = z.object({
	id: z.string().uuid().optional(),
	tierName: z.string().min(1),
	commissionPercent: z.coerce.number().min(0).max(100),
	overridePercent: z.coerce.number().min(0).max(100).default(0),
	effectiveFrom: z.coerce.date(),
	effectiveTo: z.coerce.date().optional().nullable(),
	isActive: z.boolean().default(true),
});

export const insertCommissionSchemeSchema = z.object({
	schemeName: z.string().min(1),
	shortform: z.string().min(1),
	description: z.string().min(1),
	projectName: z.string().min(1),
	blockListingId: z.string().uuid().optional().nullable(),
	isActive: z.boolean().default(true),
	incSst: z.boolean(),
	sstPercent: z.coerce.number().min(0).max(100).default(8),
	sstBorneBy: sstBorneBySchema,
	tiers: z.array(commissionSchemeTierInputSchema).min(1),
});

export const updateCommissionSchemeSchema = insertCommissionSchemeSchema.partial().extend({
	id: z.string().uuid(),
});

