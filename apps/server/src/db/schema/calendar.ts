import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	boolean,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

// Event type enum
export const eventTypeEnum = pgEnum("event_type", [
	"meeting",
	"training",
	"announcement",
	"holiday",
	"deadline",
	"other",
]);

// Priority level enum
export const priorityEnum = pgEnum("priority_level", [
	"low",
	"normal",
	"high",
	"urgent",
]);

// Calendar events table
export const calendarEvents = pgTable(
	"calendar_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		description: text("description"),
		eventType: eventTypeEnum("event_type").notNull().default("meeting"),
		startDate: timestamp("start_date").notNull(),
		endDate: timestamp("end_date"),
		location: text("location"), // e.g., "Conference Room A", "Online"
		priority: priorityEnum("priority").default("normal"),
		isAllDay: boolean("is_all_day").default(false).notNull(),
		// Who created/manages this event (typically admin)
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Optional: assign to specific agents or teams
		assignedToAgentId: text("assigned_to_agent_id").references(
			() => user.id,
			{ onDelete: "set null" }
		), // null = all agents see it
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		startDateIdx: index("idx_calendar_events_start_date").on(
			table.startDate
		),
		createdByIdx: index("idx_calendar_events_created_by").on(
			table.createdBy
		),
		assignedToAgentIdIdx: index("idx_calendar_events_assigned_to").on(
			table.assignedToAgentId
		),
		isActiveIdx: index("idx_calendar_events_is_active").on(table.isActive),
	})
);

// Announcements table (for general office updates without specific dates)
export const announcements = pgTable(
	"announcements",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		content: text("content").notNull(),
		priority: priorityEnum("priority").default("normal"),
		// Who created this announcement (typically admin)
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Expiration date (announcement hides after this date)
		expiresAt: timestamp("expires_at"),
		isActive: boolean("is_active").default(true).notNull(),
		// Pin to top of announcement board
		isPinned: boolean("is_pinned").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		createdByIdx: index("idx_announcements_created_by").on(table.createdBy),
		isActiveIdx: index("idx_announcements_is_active").on(table.isActive),
		isPinnedIdx: index("idx_announcements_is_pinned").on(table.isPinned),
		expiresAtIdx: index("idx_announcements_expires_at").on(table.expiresAt),
	})
);

// Zod schemas for validation
export const eventTypeSchema = z.enum([
	"meeting",
	"training",
	"announcement",
	"holiday",
	"deadline",
	"other",
]);

export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const insertCalendarEventSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	eventType: eventTypeSchema.default("meeting"),
	startDate: z.coerce.date(),
	endDate: z.coerce.date().optional(),
	location: z.string().optional(),
	priority: prioritySchema.default("normal"),
	isAllDay: z.boolean().default(false),
	assignedToAgentId: z.string().uuid().optional().nullable(),
});

export const updateCalendarEventSchema = insertCalendarEventSchema
	.partial()
	.extend({
		id: z.string().uuid(),
		isActive: z.boolean().optional(),
	});

export const insertAnnouncementSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().min(1, "Content is required"),
	priority: prioritySchema.default("normal"),
	expiresAt: z.coerce.date().optional().nullable(),
	isPinned: z.boolean().default(false),
});

export const updateAnnouncementSchema = insertAnnouncementSchema
	.partial()
	.extend({
		id: z.string().uuid(),
		isActive: z.boolean().optional(),
	});

// TypeScript types
export type EventType = z.infer<typeof eventTypeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type UpdateCalendarEvent = z.infer<typeof updateCalendarEventSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type UpdateAnnouncement = z.infer<typeof updateAnnouncementSchema>;
