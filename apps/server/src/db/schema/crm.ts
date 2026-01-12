import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

// Prospect type enum
export const prospectTypeEnum = pgEnum("prospect_type", ["tenant", "owner"]);

// Property type enum
export const propertyTypeEnum = pgEnum("property_type", [
	"property_developer",
	"secondary_market_owner",
]);

// Prospect status enum
export const prospectStatusEnum = pgEnum("prospect_status", [
	"active",
	"inactive",
	"pending",
]);

// Prospects table
export const prospects = pgTable(
	"prospects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		phone: text("phone").notNull(),
		source: text("source").notNull(), // e.g., "Website", "Social Media", "Referral"
		type: prospectTypeEnum("type").notNull(),
		property: propertyTypeEnum("property").notNull(),
		status: prospectStatusEnum("status").notNull(),
		lastContact: timestamp("last_contact"),
		nextContact: timestamp("next_contact"),
		// Track which agent created/manages this prospect
		agentId: text("agent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		agentIdIdx: index("idx_prospects_agent_id").on(table.agentId),
		emailIdx: index("idx_prospects_email").on(table.email),
		statusIdx: index("idx_prospects_status").on(table.status),
		typeIdx: index("idx_prospects_type").on(table.type),
		propertyIdx: index("idx_prospects_property").on(table.property),
	}),
);

// Zod schemas for validation
export const prospectTypeSchema = z.enum(["tenant", "owner"]);
export const propertyTypeSchema = z.enum([
	"property_developer",
	"secondary_market_owner",
]);
export const prospectStatusSchema = z.enum(["active", "inactive", "pending"]);

export const insertProspectSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Please enter a valid email address"),
	phone: z
		.string()
		.min(8, "Phone number must be at least 8 characters")
		.regex(/^[\d\s\+\-\(\)]+$/, "Please enter a valid phone number"),
	source: z.string().min(1, "Please select a source"),
	type: prospectTypeSchema,
	property: propertyTypeSchema,
	status: prospectStatusSchema,
	lastContact: z.date().optional(),
	nextContact: z.date().optional(),
});

export const selectProspectSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	phone: z.string(),
	source: z.string(),
	type: prospectTypeSchema,
	property: propertyTypeSchema,
	status: prospectStatusSchema,
	lastContact: z.date().nullable(),
	nextContact: z.date().nullable(),
	agentId: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateProspectSchema = insertProspectSchema.partial().extend({
	id: z.string(),
});

// TypeScript types
export type ProspectType = z.infer<typeof prospectTypeSchema>;
export type PropertyType = z.infer<typeof propertyTypeSchema>;
export type ProspectStatus = z.infer<typeof prospectStatusSchema>;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type SelectProspect = z.infer<typeof selectProspectSchema>;
export type UpdateProspect = z.infer<typeof updateProspectSchema>;
