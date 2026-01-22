import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
	type InsertProspect,
	type InsertProspectNote,
	type SelectProspect,
	type SelectProspectNote,
	type UpdateProspect,
	insertProspectSchema,
	insertProspectNoteSchema,
	prospectNotes,
	prospects,
	prospectTags,
	crmTags,
	selectProspectSchema,
	selectProspectNoteSchema,
	updateProspectSchema,
	pipelineStageSchema,
	leadTypeSchema,
} from "../db/schema/crm";
import { user } from "../db/schema/auth";
import { protectedProcedure, router } from "../lib/trpc";

// List prospects input schema
const listProspectsInput = z.object({
	search: z.string().optional(),
	type: z.enum(["tenant", "buyer"]).optional(),
	property: z.string().optional(), // Free text search for property name
	status: z.enum(["active", "inactive", "pending"]).optional(),
	stage: pipelineStageSchema.optional(), // Filter by pipeline stage
	leadType: leadTypeSchema.optional(), // Filter by lead type
	includeCompanyLeads: z.boolean().default(false), // Include unclaimed company leads
	page: z.number().min(1).default(1),
	limit: z.number().min(1).max(1000).default(10),
});

// Get prospect by ID input schema
const getProspectInput = z.object({
	id: z.string().uuid(),
});

// Create prospect input schema (extend to include tagIds)
const createProspectInput = insertProspectSchema.extend({
	tagIds: z.array(z.string().uuid()).optional(), // Array of tag IDs to associate
});

// Update prospect input schema (extend to include tagIds)
const updateProspectInput = updateProspectSchema.extend({
	tagIds: z.array(z.string().uuid()).optional(), // Array of tag IDs to associate
});

// Delete prospect input schema
const deleteProspectInput = z.object({
	id: z.string().uuid(),
});

export const crmRouter = router({
	// List all prospects with filters and pagination
	list: protectedProcedure.input(listProspectsInput).query(async ({ input, ctx }) => {
		try {
			const { search, type, property, status, stage, leadType, includeCompanyLeads, page, limit } = input;
			const agentId = ctx.session.user.id;

			// Build where conditions
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const conditions: any[] = [];
			
			// Show agent's personal leads OR unclaimed company leads (if includeCompanyLeads is true)
			if (includeCompanyLeads) {
				conditions.push(
					or(
						eq(prospects.agentId, agentId),
						and(eq(prospects.leadType, "company"), isNull(prospects.agentId)),
					)!,
				);
			} else {
				conditions.push(eq(prospects.agentId, agentId));
			}

			// Search filter (name, email, or phone)
			if (search) {
				const searchConditions = or(
					ilike(prospects.name, `%${search}%`),
					ilike(prospects.email, `%${search}%`),
					ilike(prospects.phone, `%${search}%`),
				);
				if (searchConditions) {
					conditions.push(searchConditions);
				}
			}

			// Type filter
			if (type) {
				conditions.push(eq(prospects.type, type));
			}

			// Property filter (text search)
			if (property) {
				conditions.push(ilike(prospects.property, `%${property}%`));
			}

			// Status filter
			if (status) {
				conditions.push(eq(prospects.status, status));
			}

			// Stage filter (for Kanban board)
			if (stage) {
				conditions.push(eq(prospects.stage, stage));
			}

			// Lead type filter
			if (leadType) {
				conditions.push(eq(prospects.leadType, leadType));
			}

			// Helper function to execute query with timeout and retry
			const executeQueryWithRetry = async <T>(
				queryFn: () => Promise<T>,
				queryName: string,
				maxRetries = 2
			): Promise<T> => {
				for (let attempt = 0; attempt <= maxRetries; attempt++) {
					try {
						// Create timeout promise (25 seconds)
						const timeoutPromise = new Promise<never>((_, reject) => {
							setTimeout(() => reject(new Error(`Query timeout: ${queryName}`)), 25000);
						});

						// Race query against timeout
						return await Promise.race([queryFn(), timeoutPromise]);
					} catch (error: any) {
						const isRetryable = 
							error?.message?.includes("timeout") ||
							error?.message?.includes("Connection terminated") ||
							error?.message?.includes("MaxClientsInSessionMode") ||
							error?.code === "XX000" ||
							error?.code === "57P01";

						if (isRetryable && attempt < maxRetries) {
							const waitTime = 200 * (attempt + 1); // 200ms, 400ms
							console.warn(`⚠️ ${queryName} failed, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
							await new Promise(resolve => setTimeout(resolve, waitTime));
							continue;
						}
						throw error;
					}
				}
				throw new Error(`${queryName} failed after ${maxRetries + 1} attempts`);
			};

			// Get total count for pagination
			const [countResult] = await executeQueryWithRetry(
				() => db
					.select({ count: sql<number>`count(*)` })
					.from(prospects)
					.where(and(...conditions)),
				"Count prospects query"
			);

			const total = Number(countResult?.count || 0);

			// Get paginated results with agent name
			const offset = (page - 1) * limit;
			const results = await executeQueryWithRetry(
				() => db
					.select({
						prospect: prospects,
						agentName: user.name,
					})
					.from(prospects)
					.leftJoin(user, eq(prospects.agentId, user.id))
					.where(and(...conditions))
					.orderBy(desc(prospects.createdAt))
					.limit(limit)
					.offset(offset),
				"Fetch prospects query"
			);

			// Get all prospect IDs to fetch their tags
			const prospectIds = results.map((r) => r.prospect.id);
			let prospectTagsData: Array<{ prospectId: string; tag: { id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date } }> = [];
			
			// Try to fetch tags (handle case where tables might not exist or no tags yet)
			try {
				if (prospectIds.length > 0) {
					prospectTagsData = await db
						.select({
							prospectId: prospectTags.prospectId,
							tag: crmTags,
						})
						.from(prospectTags)
						.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
						.where(inArray(prospectTags.prospectId, prospectIds));
				}
			} catch (error) {
				// If tags tables don't exist or query fails, just continue without tags
				console.warn("⚠️ Could not fetch prospect tags:", error);
				prospectTagsData = [];
			}

			// Group tags by prospect ID
			const tagsByProspectId: Record<string, Array<{ id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date }>> = {};
			for (const item of prospectTagsData) {
				if (!tagsByProspectId[item.prospectId]) {
					tagsByProspectId[item.prospectId] = [];
				}
				tagsByProspectId[item.prospectId].push(item.tag);
			}

			return {
				prospects: results.map((r) => {
					// Handle missing columns gracefully (for databases that haven't been migrated yet)
					// Also handle legacy "owner" type - convert to "buyer"
					const prospectType = (r.prospect.type as string) === "owner" ? "buyer" : r.prospect.type;
					const prospect = {
						...r.prospect,
						type: prospectType as "tenant" | "buyer", // Migrate "owner" to "buyer"
						stage: r.prospect.stage || "new_lead",
						leadType: r.prospect.leadType || "personal",
						tags: r.prospect.tags || null, // Keep for backward compatibility
					};
					const parsed = selectProspectSchema.parse(prospect);
					// Add agentName and tags to the response
					return {
						...parsed,
						agentName: r.agentName || null,
						tagIds: tagsByProspectId[r.prospect.id]?.map((t) => t.id) || [],
						tagNames: tagsByProspectId[r.prospect.id]?.map((t) => t.name) || [],
					};
				}),
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
				},
			};
		} catch (error: any) {
			console.error("❌ CRM list error:", error);
			const errorMessage = error?.message || String(error);
			console.error("❌ Error details:", errorMessage);
			console.error("❌ Error code:", error?.code);
			console.error("❌ Error stack:", error?.stack || "No stack");
			
			// Check if this is a missing column error
			if (errorMessage.includes("does not exist") || errorMessage.includes("column") || errorMessage.includes("unknown column")) {
				const helpfulError = new Error(
					"Database schema is out of date. Please run database migrations to add the new columns (stage, leadType, tags) to the prospects table. " +
					"Original error: " + errorMessage
				);
				helpfulError.cause = error;
				throw helpfulError;
			}

			// Provide more specific error messages for connection issues
			if (errorMessage.includes("timeout") || errorMessage.includes("Query timeout") || error?.code === "ETIMEDOUT") {
				throw new Error("Database query timed out. The database may be under heavy load. Please try again.");
			}
			if (errorMessage.includes("Connection terminated") || errorMessage.includes("Connection terminated unexpectedly") || error?.code === "57P01") {
				throw new Error("Database connection lost. Please try again.");
			}
			if (errorMessage.includes("MaxClientsInSessionMode") || error?.code === "XX000") {
				throw new Error("Database connection pool exhausted. Please try again in a moment.");
			}
			
			throw error;
		}
	}),

	// Get a single prospect by ID (with notes)
	get: protectedProcedure.input(getProspectInput).query(async ({ input, ctx }) => {
		const { id } = input;
		const agentId = ctx.session.user.id;

		// Get prospect (can be agent's own or unclaimed company lead)
		const [prospect] = await db
			.select()
			.from(prospects)
			.where(
				and(
					eq(prospects.id, id),
					or(
						eq(prospects.agentId, agentId),
						and(eq(prospects.leadType, "company"), isNull(prospects.agentId)),
					)!,
				),
			)
			.limit(1);

		if (!prospect) {
			throw new Error("Prospect not found");
		}

		// Get notes for this prospect with agent names
		const notes = await db
			.select({
				note: prospectNotes,
				agentName: user.name,
			})
			.from(prospectNotes)
			.leftJoin(user, eq(prospectNotes.agentId, user.id))
			.where(eq(prospectNotes.prospectId, id))
			.orderBy(desc(prospectNotes.createdAt));

		// Get tags for this prospect
		let prospectTagsData: Array<{ tag: { id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date } }> = [];
		try {
			prospectTagsData = await db
				.select({
					tag: crmTags,
				})
				.from(prospectTags)
				.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
				.where(eq(prospectTags.prospectId, id));
		} catch (error) {
			// If tags tables don't exist or query fails, just continue without tags
			console.warn("⚠️ Could not fetch prospect tags:", error);
		}

		// Handle legacy "owner" type - convert to "buyer"
		const prospectType = (prospect.type as string) === "owner" ? "buyer" : prospect.type;
		const prospectForParse = {
			...prospect,
			type: prospectType as "tenant" | "buyer",
		};

		return {
			prospect: {
				...selectProspectSchema.parse(prospectForParse),
				tagIds: prospectTagsData.map((t) => t.tag.id),
				tagNames: prospectTagsData.map((t) => t.tag.name),
			},
			notes: notes.map((n) => ({
				...selectProspectNoteSchema.parse(n.note),
				agentName: n.agentName || "Unknown",
			})),
		};
	}),

	// Create a new prospect
	create: protectedProcedure
		.input(createProspectInput)
		.mutation(async ({ input, ctx }) => {
			try {
				const agentId = ctx.session.user.id;
				const { tagIds, ...prospectData } = input;

				// If it's a company lead, agentId can be null (unclaimed)
				// Otherwise, set agentId for personal leads
				const newProspect: InsertProspect & { agentId?: string | null } = {
					...prospectData,
					agentId: prospectData.leadType === "company" ? null : agentId,
				};

				const [created] = await db
					.insert(prospects)
					.values(newProspect)
					.returning();

			// Associate tags if provided
			if (tagIds && tagIds.length > 0) {
				try {
					// Verify all tag IDs exist
					const existingTags = await db
						.select()
						.from(crmTags)
						.where(inArray(crmTags.id, tagIds));

					if (existingTags.length !== tagIds.length) {
						throw new Error("One or more tag IDs are invalid");
					}

					// Insert tag relationships
					await db.insert(prospectTags).values(
						tagIds.map((tagId) => ({
							prospectId: created.id,
							tagId,
						})),
					);
				} catch (error) {
					console.warn("⚠️ Could not associate tags with prospect:", error);
					// Continue without tags if association fails
				}
			}

			// Fetch tags for response
			let prospectTagsData: Array<{ tag: { id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date } }> = [];
			try {
				prospectTagsData = await db
					.select({
						tag: crmTags,
					})
					.from(prospectTags)
					.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
					.where(eq(prospectTags.prospectId, created.id));
			} catch (error) {
				console.warn("⚠️ Could not fetch prospect tags:", error);
			}

			// Handle legacy "owner" type - convert to "buyer"
			const createdType = (created.type as string) === "owner" ? "buyer" : created.type;
			const createdForParse = {
				...created,
				type: createdType as "tenant" | "buyer",
			};

				return {
					...selectProspectSchema.parse(createdForParse),
					tagIds: prospectTagsData.map((t) => t.tag.id),
					tagNames: prospectTagsData.map((t) => t.tag.name),
				};
			} catch (error: any) {
				console.error("❌ CRM create error:", error);
				
				// Extract error message from error or its cause (Drizzle wraps PostgreSQL errors)
				const errorMessage = error?.message || error?.cause?.message || String(error);
				const errorCode = error?.code || error?.cause?.code;
				const fullErrorText = JSON.stringify(error?.cause || error, null, 2);
				
				console.error("❌ Error details:", errorMessage);
				console.error("❌ Error code:", errorCode);
				console.error("❌ Full error:", fullErrorText);

				// Check if this is a database enum mismatch error for prospect_type
				const isProspectTypeError = 
					errorMessage.includes("invalid input value for enum prospect_type") || 
					(errorMessage.includes("invalid input value for enum") && errorMessage.includes("buyer")) ||
					errorMessage.includes("prospect_type") && errorMessage.includes("buyer") ||
					(errorCode === "22P02" && (errorMessage.includes("prospect_type") || fullErrorText.includes("prospect_type")));

				if (isProspectTypeError) {
					throw new Error(
						"Database schema mismatch: The prospect_type enum in the database still only has 'tenant' and 'owner' values, but the code is trying to insert 'buyer'. " +
						"Please run this SQL command: ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer'; " +
						"Or use the migration file: apps/server/src/db/migrations/0003_update_prospect_type_enum.sql"
					);
				}

				// Check if this is a property column enum error
				const isPropertyTypeError = 
					errorMessage.includes("invalid input value for enum property_type") || 
					errorMessage.includes("property_type") ||
					(errorCode === "22P02" && (errorMessage.includes("property_type") || fullErrorText.includes("property_type")));

				if (isPropertyTypeError) {
					throw new Error(
						"Database schema mismatch: The property column is still an enum type in the database, but the code is trying to insert free text. " +
						"Please run this migration script: bun run apps/server/scripts/run-property-to-text-migration.ts " +
						"Or use the migration file: apps/server/src/db/migrations/0004_update_property_to_text.sql"
					);
				}

				// Check for validation errors
				if (error?.issues) {
					const validationErrors = error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join(", ");
					throw new Error(`Validation error: ${validationErrors}`);
				}

				throw new Error(`Failed to create prospect: ${errorMessage}`);
			}
		}),

	// Update an existing prospect
	update: protectedProcedure
		.input(updateProspectInput)
		.mutation(async ({ input, ctx }) => {
			const { id, tagIds, ...updateData } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect belongs to the agent OR is an unclaimed company lead
			const [existing] = await db
				.select()
				.from(prospects)
				.where(
					and(
						eq(prospects.id, id),
						or(
							eq(prospects.agentId, agentId),
							and(eq(prospects.leadType, "company"), isNull(prospects.agentId)),
						)!,
					),
				)
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			const [updated] = await db
				.update(prospects)
				.set({
					...updateData,
					updatedAt: new Date(),
				})
				.where(eq(prospects.id, id))
				.returning();

			// Update tags if provided
			if (tagIds !== undefined) {
				// Delete existing tag relationships
				await db.delete(prospectTags).where(eq(prospectTags.prospectId, id));

				// Add new tag relationships if any
				if (tagIds.length > 0) {
					// Verify all tag IDs exist
					const existingTags = await db
						.select()
						.from(crmTags)
						.where(inArray(crmTags.id, tagIds));

					if (existingTags.length !== tagIds.length) {
						throw new Error("One or more tag IDs are invalid");
					}

					// Insert new tag relationships
					await db.insert(prospectTags).values(
						tagIds.map((tagId) => ({
							prospectId: id,
							tagId,
						})),
					);
				}
			}

			// Fetch tags for response
			let prospectTagsData: Array<{ tag: { id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date } }> = [];
			try {
				prospectTagsData = await db
					.select({
						tag: crmTags,
					})
					.from(prospectTags)
					.innerJoin(crmTags, eq(prospectTags.tagId, crmTags.id))
					.where(eq(prospectTags.prospectId, id));
			} catch (error) {
				console.warn("⚠️ Could not fetch prospect tags:", error);
			}

			// Handle legacy "owner" type - convert to "buyer"
			const updatedType = (updated.type as string) === "owner" ? "buyer" : updated.type;
			const updatedForParse = {
				...updated,
				type: updatedType as "tenant" | "buyer",
			};

			return {
				...selectProspectSchema.parse(updatedForParse),
				tagIds: prospectTagsData.map((t) => t.tag.id),
				tagNames: prospectTagsData.map((t) => t.tag.name),
			};
		}),

	// Update prospect stage (for Kanban board drag-and-drop)
	updateStage: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				stage: pipelineStageSchema,
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { id, stage } = input;
			const agentId = ctx.session.user.id;

		// Verify prospect belongs to the agent
		const [existing] = await db
			.select()
			.from(prospects)
			.where(and(eq(prospects.agentId, agentId), eq(prospects.id, id)))
			.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			const [updated] = await db
				.update(prospects)
				.set({
					stage,
					updatedAt: new Date(),
				})
				.where(eq(prospects.id, id))
				.returning();

			// Handle legacy "owner" type - convert to "buyer"
			const updatedType = (updated.type as string) === "owner" ? "buyer" : updated.type;
			const updatedForParse = {
				...updated,
				type: updatedType as "tenant" | "buyer",
			};
			return selectProspectSchema.parse(updatedForParse);
		}),

	// Claim a company lead
	claimLead: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			// Verify it's an unclaimed company lead
			const [existing] = await db
				.select()
				.from(prospects)
				.where(
					and(
						eq(prospects.id, id),
						eq(prospects.leadType, "company"),
						isNull(prospects.agentId),
					),
				)
				.limit(1);

			if (!existing) {
				throw new Error("Lead not available or already claimed");
			}

			// Claim the lead
			const [claimed] = await db
				.update(prospects)
				.set({
					agentId,
					updatedAt: new Date(),
				})
				.where(eq(prospects.id, id))
				.returning();

			// Handle legacy "owner" type - convert to "buyer"
		const claimedType = (claimed.type as string) === "owner" ? "buyer" : claimed.type;
		const claimedForParse = {
			...claimed,
			type: claimedType as "tenant" | "buyer",
		};
		return selectProspectSchema.parse(claimedForParse);
		}),

	// Delete a prospect
	delete: protectedProcedure
		.input(deleteProspectInput)
		.mutation(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect belongs to the agent
			const [existing] = await db
				.select()
				.from(prospects)
				.where(and(eq(prospects.id, id), eq(prospects.agentId, agentId)))
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			await db.delete(prospects).where(eq(prospects.id, id));

			return { success: true, id };
		}),

	// Notes CRUD
	// Add note to prospect
	addNote: protectedProcedure
		.input(insertProspectNoteSchema)
		.mutation(async ({ input, ctx }) => {
			const { prospectId, content } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect exists and agent has access
			const [prospect] = await db
				.select()
				.from(prospects)
				.where(
					and(
						eq(prospects.id, prospectId),
						or(
							eq(prospects.agentId, agentId),
							and(eq(prospects.leadType, "company"), isNull(prospects.agentId)),
						)!,
					),
				)
				.limit(1);

			if (!prospect) {
				throw new Error("Prospect not found");
			}

			const [note] = await db
				.insert(prospectNotes)
				.values({
					prospectId,
					content,
					agentId,
				})
				.returning();

			return selectProspectNoteSchema.parse(note);
		}),

	// Get notes for a prospect
	getNotes: protectedProcedure
		.input(getProspectInput)
		.query(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			// Verify prospect exists and agent has access
			const [prospect] = await db
				.select()
				.from(prospects)
				.where(
					and(
						eq(prospects.id, id),
						or(
							eq(prospects.agentId, agentId),
							and(eq(prospects.leadType, "company"), isNull(prospects.agentId)),
						)!,
					),
				)
				.limit(1);

			if (!prospect) {
				throw new Error("Prospect not found");
			}

			// Get notes with agent names
			const notes = await db
				.select({
					note: prospectNotes,
					agentName: user.name,
				})
				.from(prospectNotes)
				.leftJoin(user, eq(prospectNotes.agentId, user.id))
				.where(eq(prospectNotes.prospectId, id))
				.orderBy(desc(prospectNotes.createdAt));

			return notes.map((n) => ({
				...selectProspectNoteSchema.parse(n.note),
				agentName: n.agentName || "Unknown",
			}));
		}),
});
