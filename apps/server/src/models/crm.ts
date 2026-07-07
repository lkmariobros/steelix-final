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

// CRM projects table (admin-managed developer projects)
export const crmProjects = pgTable(
	"crm_projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull().unique(),
		// Who created the project (admin)
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		nameIdx: index("idx_crm_projects_name").on(table.name),
		createdByIdx: index("idx_crm_projects_created_by").on(table.createdBy),
	}),
);

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

// Pipeline stage enum (for Kanban board) — active + legacy values kept for DB compat
export const pipelineStageEnum = pgEnum("pipeline_stage", [
	"new_lead",
	"first_follow_up",
	"second_follow_up",
	"third_follow_up",
	"fourth_follow_up",
	"potential_lead",
	"appointment_made",
	"need_consider",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
	// Retired (migrated via pipeline-stage-feedback-setup.sql)
	"follow_up_in_progress",
	"no_pick_reply",
	"can_recycle",
	"follow_up_for_appointment",
	"consider_seen",
	// Legacy
	"contacted",
	"appointment_set",
	"converted",
]);

// Lead type enum (company vs personal)
export const leadTypeEnum = pgEnum("lead_type", ["personal", "company"]);

// Prospects table
export const prospects = pgTable(
	"prospects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		email: text("email"),
		phone: text("phone").notNull(),
		source: text("source").notNull(), // e.g., "Website", "Social Media", "Referral"
		type: prospectTypeEnum("type").notNull(),
		property: text("property").notNull(), // Free text field - users can enter any property name
		// Optional admin-managed project association (developer projects)
		projectId: uuid("project_id").references(() => crmProjects.id, {
			onDelete: "set null",
		}),
		status: prospectStatusEnum("status").notNull(), // Keep for backward compatibility
		// Pipeline stage for Kanban board
		stage: pipelineStageEnum("stage").default("new_lead").notNull(),
		// Lead type: personal (agent's own) or company (can be claimed)
		leadType: leadTypeEnum("lead_type").default("personal").notNull(),
		// Free-form notes (interest, buyer type, remarks)
		notes: text("notes"),
		// Legacy free-text categories — prefer prospect_tags + crm_tags junction
		tags: text("tags"),
		lastContact: timestamp("last_contact"),
		nextContact: timestamp("next_contact"),
		// Track which agent created/manages this prospect
		// If leadType is "company" and agentId is null, it's an unclaimed company lead
		agentId: text("agent_id").references(() => user.id, {
			onDelete: "cascade",
		}),
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
		projectIdIdx: index("idx_prospects_project_id").on(table.projectId),
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

// Master lead categories (admin-managed; assigned to leads via prospect_tags)
export const crmTags = pgTable(
	"crm_tags",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull().unique(), // e.g. "Breeze Hill Lead", "Weekend Inquiry"
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

// Agents who follow a lead (e.g. sales leaders monitoring team leads)
export const prospectFollowers = pgTable(
	"prospect_followers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		prospectId: uuid("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		prospectIdIdx: index("idx_prospect_followers_prospect_id").on(
			table.prospectId,
		),
		userIdIdx: index("idx_prospect_followers_user_id").on(table.userId),
		uniqueProspectFollower: index("idx_prospect_followers_unique").on(
			table.prospectId,
			table.userId,
		),
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
export const propertyTypeSchema = z
	.string()
	.min(1, "Property name is required"); // Free text validation
export const prospectStatusSchema = z.enum(["active", "inactive", "pending"]);
/** Active pipeline stages only (client CRM spec). */
export const pipelineStageSchema = z.enum([
	"new_lead",
	"first_follow_up",
	"second_follow_up",
	"third_follow_up",
	"fourth_follow_up",
	"potential_lead",
	"appointment_made",
	"need_consider",
	"reject_project",
	"booking_made",
	"spam_fake_lead",
]);

/** Maps retired DB enum values to the nearest active stage. */
export const LEGACY_PIPELINE_STAGE_MAP: Record<string, PipelineStage> = {
	contacted: "first_follow_up",
	appointment_set: "appointment_made",
	converted: "booking_made",
	follow_up_in_progress: "first_follow_up",
	no_pick_reply: "second_follow_up",
	can_recycle: "fourth_follow_up",
	follow_up_for_appointment: "third_follow_up",
	consider_seen: "need_consider",
};

export function normalisePipelineStage(
	stage: string | null | undefined,
): PipelineStage {
	if (!stage) return "new_lead";
	if (LEGACY_PIPELINE_STAGE_MAP[stage]) {
		return LEGACY_PIPELINE_STAGE_MAP[stage];
	}
	const parsed = pipelineStageSchema.safeParse(stage);
	return parsed.success ? parsed.data : "new_lead";
}
export const leadTypeSchema = z.enum(["personal", "company"]);

export const insertProspectSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z
		.union([z.string().email("Please enter a valid email address"), z.literal("")])
		.optional()
		.transform((v) => {
			const t = typeof v === "string" ? v.trim() : "";
			return t === "" ? null : t;
		}),
	phone: z
		.string()
		.min(8, "Phone number must be at least 8 digits")
		.regex(
			/^\+60\d{8,11}$/,
			"Phone must be in Malaysian format (e.g. +60123456789)",
		),
	source: z.string().min(1, "Please select a source"),
	type: prospectTypeSchema,
	property: propertyTypeSchema,
	projectId: z.string().uuid().optional(),
	status: prospectStatusSchema,
	stage: pipelineStageSchema.default("new_lead").optional(),
	leadType: leadTypeSchema.default("personal").optional(),
	notes: z.string().max(20000).optional().nullable(),
	tags: z.string().optional(), // Comma-separated tags
	lastContact: z.date().optional(),
	nextContact: z.date().optional(),
});

export const selectProspectSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string().nullable(),
	phone: z.string(),
	source: z.string(),
	type: prospectTypeSchema,
	property: propertyTypeSchema,
	projectId: z.string().uuid().nullable(),
	status: prospectStatusSchema,
	stage: pipelineStageSchema,
	leadType: leadTypeSchema,
	notes: z.string().nullable().optional(),
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

// CRM projects schemas
export const insertCrmProjectSchema = z.object({
	name: z.string().min(1, "Project name is required"),
});

export const selectCrmProjectSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	createdBy: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateCrmProjectSchema = insertCrmProjectSchema.partial().extend({
	id: z.string().uuid(),
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
export type InsertCrmProject = z.infer<typeof insertCrmProjectSchema>;
export type SelectCrmProject = z.infer<typeof selectCrmProjectSchema>;
export type UpdateCrmProject = z.infer<typeof updateCrmProjectSchema>;
export type InsertProspectNote = z.infer<typeof insertProspectNoteSchema>;
export type SelectProspectNote = z.infer<typeof selectProspectNoteSchema>;
export type InsertCrmTag = z.infer<typeof insertCrmTagSchema>;
export type SelectCrmTag = z.infer<typeof selectCrmTagSchema>;
export type UpdateCrmTag = z.infer<typeof updateCrmTagSchema>;
export type InsertProspectTag = z.infer<typeof insertProspectTagSchema>;
export type SelectProspectTag = z.infer<typeof selectProspectTagSchema>;
