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
export const prospectTypeEnum = pgEnum("prospect_type", ["tenant", "buyer"]);

// Property type - changed from enum to free text field
// Removed propertyTypeEnum - now using text field for flexibility

// Prospect status enum (keeping for backward compatibility)
export const prospectStatusEnum = pgEnum("prospect_status", [
	"active",
	"inactive",
	"pending",
]);

// Pipeline stage enum (for Kanban board) - Updated to match client's CRM system
export const pipelineStageEnum = pgEnum("pipeline_stage", [
	"new_lead",
	"follow_up_in_progress",
	"no_pick_reply",
	"follow_up_for_appointment",
	"potential_lead",
	"consider_seen",
	"appointment_made",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
]);

// Lead type enum (company vs personal)
export const leadTypeEnum = pgEnum("lead_type", [
	"personal",
	"company",
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
		property: text("property").notNull(), // Free text field - users can enter any property name
		status: prospectStatusEnum("status").notNull(), // Keep for backward compatibility
		// Pipeline stage for Kanban board
		stage: pipelineStageEnum("stage").default("new_lead").notNull(),
		// Lead type: personal (agent's own) or company (can be claimed)
		leadType: leadTypeEnum("lead_type").default("personal").notNull(),
		// Tags for categorization (stored as comma-separated string for simplicity)
		tags: text("tags"), // e.g., "VIP,Investor,Buyer"
		lastContact: timestamp("last_contact"),
		nextContact: timestamp("next_contact"),
		// Track which agent created/manages this prospect
		// If leadType is "company" and agentId is null, it's an unclaimed company lead
		agentId: text("agent_id").references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		agentIdIdx: index("idx_prospects_agent_id").on(table.agentId),
		emailIdx: index("idx_prospects_email").on(table.email),
		statusIdx: index("idx_prospects_status").on(table.status),
		stageIdx: index("idx_prospects_stage").on(table.stage),
		typeIdx: index("idx_prospects_type").on(table.type),
		propertyIdx: index("idx_prospects_property").on(table.property),
		leadTypeIdx: index("idx_prospects_lead_type").on(table.leadType),
	}),
);

// Prospect notes table (for timeline/notes with timestamps)
export const prospectNotes = pgTable(
	"prospect_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		prospectId: uuid("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		// Agent who created the note
		agentId: text("agent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		prospectIdIdx: index("idx_prospect_notes_prospect_id").on(table.prospectId),
		agentIdIdx: index("idx_prospect_notes_agent_id").on(table.agentId),
		createdAtIdx: index("idx_prospect_notes_created_at").on(table.createdAt),
	}),
);

// Master tags table (admin-managed)
export const crmTags = pgTable(
	"crm_tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull().unique(), // Tag name, e.g., "[ads lead] breeze hill"
		// Admin who created the tag
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		nameIdx: index("idx_crm_tags_name").on(table.name),
		createdByIdx: index("idx_crm_tags_created_by").on(table.createdBy),
	}),
);

// Junction table for many-to-many relationship between prospects and tags
export const prospectTags = pgTable(
	"prospect_tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		prospectId: uuid("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => crmTags.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		prospectIdIdx: index("idx_prospect_tags_prospect_id").on(table.prospectId),
		tagIdIdx: index("idx_prospect_tags_tag_id").on(table.tagId),
		// Unique constraint: a prospect can only have a tag once
		uniqueProspectTag: index("idx_prospect_tags_unique").on(
			table.prospectId,
			table.tagId,
		),
	}),
);

// Zod schemas for validation
export const prospectTypeSchema = z.enum(["tenant", "buyer"]);
export const propertyTypeSchema = z.string().min(1, "Property name is required"); // Free text validation
export const prospectStatusSchema = z.enum(["active", "inactive", "pending"]);
export const pipelineStageSchema = z.enum([
	"new_lead",
	"follow_up_in_progress",
	"no_pick_reply",
	"follow_up_for_appointment",
	"potential_lead",
	"consider_seen",
	"appointment_made",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
]);
export const leadTypeSchema = z.enum(["personal", "company"]);

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
	stage: pipelineStageSchema.default("new_lead").optional(),
	leadType: leadTypeSchema.default("personal").optional(),
	tags: z.string().optional(), // Comma-separated tags
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
	stage: pipelineStageSchema,
	leadType: leadTypeSchema,
	tags: z.string().nullable(),
	lastContact: z.date().nullable(),
	nextContact: z.date().nullable(),
	agentId: z.string().nullable(), // Can be null for unclaimed company leads
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateProspectSchema = insertProspectSchema.partial().extend({
	id: z.string(),
});

// Prospect notes schemas
export const insertProspectNoteSchema = z.object({
	prospectId: z.string().uuid(),
	content: z.string().min(1, "Note content is required"),
});

export const selectProspectNoteSchema = insertProspectNoteSchema.extend({
	id: z.string().uuid(),
	agentId: z.string(),
	createdAt: z.date(),
});

// Master tags schemas
export const insertCrmTagSchema = z.object({
	name: z.string().min(1, "Tag name is required"),
});

export const selectCrmTagSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	createdBy: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateCrmTagSchema = insertCrmTagSchema.partial().extend({
	id: z.string().uuid(),
});

// Prospect tags junction schemas
export const insertProspectTagSchema = z.object({
	prospectId: z.string().uuid(),
	tagId: z.string().uuid(),
});

export const selectProspectTagSchema = insertProspectTagSchema.extend({
	id: z.string().uuid(),
	createdAt: z.date(),
});

// TypeScript types
export type ProspectType = z.infer<typeof prospectTypeSchema>;
export type PropertyType = string; // Property is now free text
export type ProspectStatus = z.infer<typeof prospectStatusSchema>;
export type PipelineStage = z.infer<typeof pipelineStageSchema>;
export type LeadType = z.infer<typeof leadTypeSchema>;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type SelectProspect = z.infer<typeof selectProspectSchema>;
export type UpdateProspect = z.infer<typeof updateProspectSchema>;
export type InsertProspectNote = z.infer<typeof insertProspectNoteSchema>;
export type SelectProspectNote = z.infer<typeof selectProspectNoteSchema>;
export type InsertCrmTag = z.infer<typeof insertCrmTagSchema>;
export type SelectCrmTag = z.infer<typeof selectCrmTagSchema>;
export type UpdateCrmTag = z.infer<typeof updateCrmTagSchema>;
export type InsertProspectTag = z.infer<typeof insertProspectTagSchema>;
export type SelectProspectTag = z.infer<typeof selectProspectTagSchema>;