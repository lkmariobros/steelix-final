import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type InsertCalendarEvent,
	type InsertAnnouncement,
	type UpdateCalendarEvent,
	type UpdateAnnouncement,
	calendarEvents,
	announcements,
	insertCalendarEventSchema,
	updateCalendarEventSchema,
	insertAnnouncementSchema,
	updateAnnouncementSchema,
} from "../db/schema/calendar";
import { user } from "../db/schema/auth";
import { protectedProcedure, router } from "../lib/trpc";

// List calendar events input schema
const listEventsInput = z.object({
	startDate: z.date().optional(), // Filter events from this date
	endDate: z.date().optional(), // Filter events until this date
	eventType: z.enum(["meeting", "training", "announcement", "holiday", "deadline", "other"]).optional(),
	includeInactive: z.boolean().default(false),
});

// Get event by ID input
const getEventInput = z.object({
	id: z.string().uuid(),
});

// Create event input
const createEventInput = insertCalendarEventSchema;

// Update event input
const updateEventInput = updateCalendarEventSchema;

// Delete event input
const deleteEventInput = z.object({
	id: z.string().uuid(),
});

// List announcements input
const listAnnouncementsInput = z.object({
	includeExpired: z.boolean().default(false),
	includeInactive: z.boolean().default(false),
});

// Get announcement by ID input
const getAnnouncementInput = z.object({
	id: z.string().uuid(),
});

// Create announcement input
const createAnnouncementInput = insertAnnouncementSchema;

// Update announcement input
const updateAnnouncementInput = updateAnnouncementSchema;

// Delete announcement input
const deleteAnnouncementInput = z.object({
	id: z.string().uuid(),
});

export const calendarRouter = router({
	// List calendar events
	listEvents: protectedProcedure.input(listEventsInput).query(async ({ input, ctx }) => {
		const { startDate, endDate, eventType, includeInactive } = input;
		const agentId = ctx.session.user.id;

		const conditions = [];

		// Show active events only (unless admin wants to see all)
		if (!includeInactive) {
			conditions.push(eq(calendarEvents.isActive, true));
		}

		// Filter by date range
		if (startDate) {
			conditions.push(gte(calendarEvents.startDate, startDate));
		}
		if (endDate) {
			conditions.push(lte(calendarEvents.startDate, endDate));
		}

		// Filter by event type
		if (eventType) {
			conditions.push(eq(calendarEvents.eventType, eventType));
		}

		// Show events assigned to this agent OR events assigned to all agents (null)
		conditions.push(
			or(
				eq(calendarEvents.assignedToAgentId, agentId),
				isNull(calendarEvents.assignedToAgentId)
			)!
		);

		const events = await db
			.select({
				event: calendarEvents,
				createdByName: user.name,
			})
			.from(calendarEvents)
			.leftJoin(user, eq(calendarEvents.createdBy, user.id))
			.where(and(...conditions))
			.orderBy(calendarEvents.startDate);

		return {
			events: events.map((e) => ({
				...e.event,
				createdByName: e.createdByName || "Unknown",
			})),
		};
	}),

	// Get upcoming events (next 7 days by default)
	upcomingEvents: protectedProcedure
		.input(z.object({ days: z.number().default(7) }))
		.query(async ({ input, ctx }) => {
			const { days } = input;
			const agentId = ctx.session.user.id;
			const now = new Date();
			const futureDate = new Date();
			futureDate.setDate(now.getDate() + days);

			const events = await db
				.select({
					event: calendarEvents,
					createdByName: user.name,
				})
				.from(calendarEvents)
				.leftJoin(user, eq(calendarEvents.createdBy, user.id))
				.where(
					and(
						eq(calendarEvents.isActive, true),
						gte(calendarEvents.startDate, now),
						lte(calendarEvents.startDate, futureDate),
						or(
							eq(calendarEvents.assignedToAgentId, agentId),
							isNull(calendarEvents.assignedToAgentId)
						)!
					)
				)
				.orderBy(calendarEvents.startDate)
				.limit(10);

			return {
				events: events.map((e) => ({
					...e.event,
					createdByName: e.createdByName || "Unknown",
				})),
			};
		}),

	// Get single event
	getEvent: protectedProcedure.input(getEventInput).query(async ({ input, ctx }) => {
		const { id } = input;
		const agentId = ctx.session.user.id;

		const [result] = await db
			.select({
				event: calendarEvents,
				createdByName: user.name,
			})
			.from(calendarEvents)
			.leftJoin(user, eq(calendarEvents.createdBy, user.id))
			.where(
				and(
					eq(calendarEvents.id, id),
					or(
						eq(calendarEvents.assignedToAgentId, agentId),
						isNull(calendarEvents.assignedToAgentId)
					)!
				)
			)
			.limit(1);

		if (!result) {
			throw new Error("Event not found");
		}

		return {
			...result.event,
			createdByName: result.createdByName || "Unknown",
		};
	}),

	// Create event (admin only)
	createEvent: protectedProcedure
		.input(createEventInput)
		.mutation(async ({ input, ctx }) => {
			try {
				// Check if user is admin
				const [currentUser] = await db
					.select()
					.from(user)
					.where(eq(user.id, ctx.session.user.id))
					.limit(1);

				if (currentUser?.role !== "admin") {
					throw new Error("Only admins can create calendar events");
				}

				// Clean up input - convert empty strings to undefined/null
				const cleanedInput = {
					...input,
					description: input.description?.trim() || undefined,
					location: input.location?.trim() || undefined,
					assignedToAgentId: input.assignedToAgentId || null,
				};

				const [created] = await db
					.insert(calendarEvents)
					.values({
						...cleanedInput,
						createdBy: ctx.session.user.id,
					})
					.returning();

				return created;
			} catch (error: any) {
				console.error("❌ Error creating calendar event:", error);
				console.error("❌ Input received:", JSON.stringify(input, null, 2));
				const errorMessage = error?.message || error?.cause?.message || String(error);
				
				// Check for validation errors
				if (error?.issues) {
					const validationErrors = error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ");
					throw new Error(`Validation error: ${validationErrors}`);
				}
				
				throw new Error(errorMessage || "Failed to create calendar event");
			}
		}),

	// Update event (admin only)
	updateEvent: protectedProcedure
		.input(updateEventInput)
		.mutation(async ({ input, ctx }) => {
			const { id, ...updateData } = input;

			// Check if user is admin
			const [currentUser] = await db
				.select()
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (currentUser?.role !== "admin") {
				throw new Error("Only admins can update calendar events");
			}

			const [updated] = await db
				.update(calendarEvents)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(calendarEvents.id, id))
				.returning();

			if (!updated) {
				throw new Error("Event not found");
			}

			return updated;
		}),

	// Delete event (admin only)
	deleteEvent: protectedProcedure
		.input(deleteEventInput)
		.mutation(async ({ input, ctx }) => {
			const { id } = input;

			// Check if user is admin
			const [currentUser] = await db
				.select()
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (currentUser?.role !== "admin") {
				throw new Error("Only admins can delete calendar events");
			}

			await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

			return { success: true };
		}),

	// List announcements
	listAnnouncements: protectedProcedure
		.input(listAnnouncementsInput)
		.query(async ({ input }) => {
			const { includeExpired, includeInactive } = input;
			const now = new Date();

			const conditions = [];

			if (!includeInactive) {
				conditions.push(eq(announcements.isActive, true));
			}

			if (!includeExpired) {
				conditions.push(
					or(
						isNull(announcements.expiresAt),
						gte(announcements.expiresAt, now)
					)!
				);
			}

			const results = await db
				.select({
					announcement: announcements,
					createdByName: user.name,
				})
				.from(announcements)
				.leftJoin(user, eq(announcements.createdBy, user.id))
				.where(and(...conditions))
				.orderBy(desc(announcements.isPinned), desc(announcements.createdAt));

			return {
				announcements: results.map((r) => ({
					...r.announcement,
					createdByName: r.createdByName || "Unknown",
				})),
			};
		}),

	// Get single announcement
	getAnnouncement: protectedProcedure
		.input(getAnnouncementInput)
		.query(async ({ input }) => {
			const { id } = input;

			const [result] = await db
				.select({
					announcement: announcements,
					createdByName: user.name,
				})
				.from(announcements)
				.leftJoin(user, eq(announcements.createdBy, user.id))
				.where(eq(announcements.id, id))
				.limit(1);

			if (!result) {
				throw new Error("Announcement not found");
			}

			return {
				...result.announcement,
				createdByName: result.createdByName || "Unknown",
			};
		}),

	// Create announcement (admin only)
	createAnnouncement: protectedProcedure
		.input(createAnnouncementInput)
		.mutation(async ({ input, ctx }) => {
			// Check if user is admin
			const [currentUser] = await db
				.select()
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (currentUser?.role !== "admin") {
				throw new Error("Only admins can create announcements");
			}

			const [created] = await db
				.insert(announcements)
				.values({
					...input,
					createdBy: ctx.session.user.id,
				})
				.returning();

			return created;
		}),

	// Update announcement (admin only)
	updateAnnouncement: protectedProcedure
		.input(updateAnnouncementInput)
		.mutation(async ({ input, ctx }) => {
			const { id, ...updateData } = input;

			// Check if user is admin
			const [currentUser] = await db
				.select()
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (currentUser?.role !== "admin") {
				throw new Error("Only admins can update announcements");
			}

			const [updated] = await db
				.update(announcements)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(announcements.id, id))
				.returning();

			if (!updated) {
				throw new Error("Announcement not found");
			}

			return updated;
		}),

	// Delete announcement (admin only)
	deleteAnnouncement: protectedProcedure
		.input(deleteAnnouncementInput)
		.mutation(async ({ input, ctx }) => {
			const { id } = input;

			// Check if user is admin
			const [currentUser] = await db
				.select()
				.from(user)
				.where(eq(user.id, ctx.session.user.id))
				.limit(1);

			if (currentUser?.role !== "admin") {
				throw new Error("Only admins can delete announcements");
			}

			await db.delete(announcements).where(eq(announcements.id, id));

			return { success: true };
		}),
});
