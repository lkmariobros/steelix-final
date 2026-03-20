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
import { prospects } from "./crm";

// Activity event type enum
export const activityEventTypeEnum = pgEnum("activity_event_type", [
	"note_added",
	"stage_changed",
	"lead_assigned",
	"lead_updated",
	"call_logged",
	"email_sent",
]);

// Prospect activity log table — one row per touchpoint/event
export const prospectActivityLog = pgTable(
	"prospect_activity_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		prospectId: uuid("prospect_id")
			.notNull()
			.references(() => prospects.id, { onDelete: "cascade" }),
		eventType: activityEventTypeEnum("event_type").notNull(),
		// Who performed the action (admin or agent)
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Human-readable description / note content
		content: text("content"),
		// JSON string for structured data (e.g. old→new stage, old→new agent)
		metadata: text("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		prospectIdIdx: index("idx_prospect_activity_log_prospect_id").on(
			table.prospectId,
		),
		actorIdIdx: index("idx_prospect_activity_log_actor_id").on(table.actorId),
		createdAtIdx: index("idx_prospect_activity_log_created_at").on(
			table.createdAt,
		),
		eventTypeIdx: index("idx_prospect_activity_log_event_type").on(
			table.eventType,
		),
	}),
);

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

export const activityEventTypeSchema = z.enum([
	"note_added",
	"stage_changed",
	"lead_assigned",
	"lead_updated",
	"call_logged",
	"email_sent",
]);

export const insertActivityLogSchema = z.object({
	prospectId: z.string().uuid(),
	eventType: activityEventTypeSchema,
	actorId: z.string(),
	content: z.string().optional(),
	metadata: z.string().optional(), // JSON string
});

export const selectActivityLogSchema = z.object({
	id: z.string().uuid(),
	prospectId: z.string().uuid(),
	eventType: activityEventTypeSchema,
	actorId: z.string(),
	content: z.string().nullable(),
	metadata: z.string().nullable(),
	createdAt: z.date(),
});

// ─── TypeScript Types ──────────────────────────────────────────────────────────

export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type SelectActivityLog = z.infer<typeof selectActivityLogSchema>;

/** Enriched activity entry returned to the frontend */
export interface ActivityEntry {
	id: string;
	prospectId: string;
	eventType: ActivityEventType;
	actorId: string;
	actorName: string;
	content: string | null;
	/** Parsed metadata object — shape depends on eventType */
	metadata: Record<string, string> | null;
	createdAt: Date;
}
