import type { SQL } from "drizzle-orm";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { user } from "../models/auth";
import {
	type InsertProspect,
	type InsertProspectNote,
	type SelectProspect,
	type SelectProspectNote,
	type UpdateProspect,
	crmProjects,
	crmTags,
	insertCrmProjectSchema,
	insertProspectNoteSchema,
	insertProspectSchema,
	leadTypeSchema,
	normalisePipelineStage,
	pipelineStageSchema,
	prospectNotes,
	prospectTags,
	prospects,
	selectProspectNoteSchema,
	selectProspectSchema,
	updateCrmProjectSchema,
	updateProspectSchema,
} from "../models/crm";
import { getLeadActivityAdmin, importProspectsBulkForAgent, assignLeadAdmin, buildAgentPersonalLeadsCondition, canAgentAccessProspect, fetchFollowersByProspectIds, getAgentsWithLeads, getProspectFollowers, setProspectTagIds, agentLeadDisplayNameSql } from "../services/leads";
import { withPipelineStageSchemaRetry } from "../utils/pipeline-stage-schema";
import { db } from "../utils/db";
import { adminProcedure, protectedProcedure, router } from "../utils/trpc";

// List prospects input schema
const listProspectsInput = z.object({
	search: z.string().optional(),
	type: z.enum(["tenant", "buyer"]).optional(),
	property: z.string().optional(), // Free text search for property name
	source: z.string().optional(),
	tagId: z.string().uuid().optional(),
	createdFrom: z.coerce.date().optional(),
	createdTo: z.coerce.date().optional(),
	status: z.enum(["active", "inactive", "pending"]).optional(),
	overdueOnly: z.boolean().optional(),
	stage: pipelineStageSchema.optional(), // Filter by pipeline stage
	leadType: leadTypeSchema.optional(), // Filter by lead type
	includeCompanyLeads: z.boolean().default(false), // Company tab: unclaimed company pool only
	/** Filter by assigned agent (My Leads / team monitoring). Use __unassigned__ for unassigned. */
	filterAgentId: z
		.union([z.literal("__unassigned__"), z.string().min(1)])
		.optional(),
	page: z.number().min(1).default(1),
	/** Max 5000 when forExport; otherwise capped to 1000 in the handler. */
	limit: z.number().min(1).max(5000).default(10),
	/** When true, returns up to 5000 matching rows (offset 0) for CSV/Excel export. */
	forExport: z.boolean().optional(),
});

const crmImportCsvInput = z.object({
	rows: z.array(z.record(z.string())).max(2000),
	mode: z.enum(["personal_assigned", "company_unclaimed"]),
});

// Get prospect by ID input schema
const getProspectInput = z.object({
	id: z.string().uuid(),
});

// Agents cannot set lead categories — admin only (admin-leads router).
const createProspectInput = insertProspectSchema;
const updateProspectInput = updateProspectSchema;

export const crmRouter = router({
	// Projects
	projectsList: protectedProcedure.query(async () => {
		const projects = await db
			.select()
			.from(crmProjects)
			.orderBy(desc(crmProjects.updatedAt));
		return projects;
	}),

	projectsCreate: adminProcedure
		.input(insertCrmProjectSchema)
		.mutation(async ({ input, ctx }) => {
			const [created] = await db
				.insert(crmProjects)
				.values({
					name: input.name,
					createdBy: ctx.session.user.id,
					updatedAt: new Date(),
				})
				.returning();
			return created;
		}),

	projectsUpdate: adminProcedure
		.input(updateCrmProjectSchema)
		.mutation(async ({ input }) => {
			const { id, ...update } = input;
			const [updated] = await db
				.update(crmProjects)
				.set({
					...update,
					updatedAt: new Date(),
				})
				.where(eq(crmProjects.id, id))
				.returning();
			return updated;
		}),

	// List all prospects with filters and pagination
	list: protectedProcedure
		.input(listProspectsInput)
		.query(async ({ input, ctx }) => {
			try {
				// Auto status: active -> inactive after 5 days no updates.
				// (reactivation is handled in note/stage mutations)
				try {
					const cutoff = new Date(Date.now() - 5 * 86_400_000);
					await db
						.update(prospects)
						.set({ status: "inactive", updatedAt: new Date() })
						.where(
							and(
								eq(prospects.status, "active"),
								sql`${prospects.updatedAt} <= ${cutoff}`,
							),
						);
				} catch {
					// never block list query
				}

				const {
					search,
					type,
					property,
					source,
					tagId,
					createdFrom,
					createdTo,
					status,
					overdueOnly,
					stage,
					leadType,
					includeCompanyLeads,
					filterAgentId,
					page,
					limit,
					forExport,
				} = input;
				const agentId = ctx.session.user.id;

				const exportAll = forExport === true;
				const effectiveLimit = exportAll ? 5000 : Math.min(limit, 1000);
				const effectiveOffset = exportAll ? 0 : (page - 1) * effectiveLimit;

				// Build where conditions
				const conditions: SQL[] = [];

				// Tab scope: "my" = assigned leads only; "company" = unclaimed company pool only
				if (includeCompanyLeads) {
					conditions.push(eq(prospects.leadType, "company"));
					conditions.push(isNull(prospects.agentId));
				} else {
					conditions.push(buildAgentPersonalLeadsCondition(agentId));
				}

				// Search filter (name, email, or phone)
				if (search) {
					const searchConditions = or(
						ilike(prospects.name, `%${search}%`),
						sql`coalesce(${prospects.email}, '') ilike ${`%${search}%`}`,
						ilike(prospects.phone, `%${search}%`),
					);
					if (searchConditions) {
						conditions.push(searchConditions);
					}
				}

				if (source?.trim()) {
					conditions.push(ilike(prospects.source, `%${source.trim()}%`));
				}

				if (tagId) {
					conditions.push(
						inArray(
							prospects.id,
							db
								.select({ id: prospectTags.prospectId })
								.from(prospectTags)
								.where(eq(prospectTags.tagId, tagId)),
						),
					);
				}

				if (createdFrom) {
					conditions.push(sql`${prospects.createdAt} >= ${createdFrom}`);
				}
				if (createdTo) {
					conditions.push(sql`${prospects.createdAt} <= ${createdTo}`);
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

				// Overdue follow-up filter:
				// nextContact is set and in the past, while lead is still active.
				if (overdueOnly) {
					conditions.push(eq(prospects.status, "active"));
					conditions.push(
						sql`${prospects.nextContact} is not null and ${prospects.nextContact} <= NOW()`,
					);
				}

				// Stage filter (for Kanban board)
				if (stage) {
					conditions.push(eq(prospects.stage, stage));
				}

				// Lead type filter
				if (leadType) {
					conditions.push(eq(prospects.leadType, leadType));
				}

				// Assigned agent filter (leaders monitoring team leads they follow)
				if (filterAgentId && !includeCompanyLeads) {
					if (filterAgentId === "__unassigned__") {
						conditions.push(isNull(prospects.agentId));
					} else {
						conditions.push(eq(prospects.agentId, filterAgentId));
					}
				}

				// Helper function to execute query with timeout and retry
				const executeQueryWithRetry = async <T>(
					queryFn: () => Promise<T>,
					queryName: string,
					maxRetries = 2,
				): Promise<T> => {
					for (let attempt = 0; attempt <= maxRetries; attempt++) {
						try {
							// Create timeout promise (25 seconds)
							const timeoutPromise = new Promise<never>((_, reject) => {
								setTimeout(
									() => reject(new Error(`Query timeout: ${queryName}`)),
									25000,
								);
							});

							// Race query against timeout
							return await Promise.race([queryFn(), timeoutPromise]);
						} catch (error: unknown) {
							const e = error as {
								message?: string;
								code?: string;
							};
							const isRetryable =
								e?.message?.includes("timeout") ||
								e?.message?.includes("Connection terminated") ||
								e?.message?.includes("MaxClientsInSessionMode") ||
								e?.code === "XX000" ||
								e?.code === "57P01";

							if (isRetryable && attempt < maxRetries) {
								const waitTime = 200 * (attempt + 1); // 200ms, 400ms
								console.warn(
									`⚠️ ${queryName} failed, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries + 1})`,
								);
								await new Promise((resolve) => setTimeout(resolve, waitTime));
								continue;
							}
							throw error;
						}
					}
					throw new Error(
						`${queryName} failed after ${maxRetries + 1} attempts`,
					);
				};

				// Get total count for pagination
				const [countResult] = await executeQueryWithRetry(
					() =>
						db
							.select({ count: sql<number>`count(*)` })
							.from(prospects)
							.where(and(...conditions)),
					"Count prospects query",
				);

				const total = Number(countResult?.count || 0);

				// Get paginated results with agent name
				const results = await executeQueryWithRetry(
					() =>
						db
							.select({
								prospect: prospects,
								agentName: agentLeadDisplayNameSql,
								agentEmail: user.email,
								projectName: crmProjects.name,
							})
							.from(prospects)
							.leftJoin(user, eq(prospects.agentId, user.id))
							.leftJoin(crmProjects, eq(prospects.projectId, crmProjects.id))
							.where(and(...conditions))
							.orderBy(desc(prospects.createdAt))
							.limit(effectiveLimit)
							.offset(effectiveOffset),
					"Fetch prospects query",
				);

				// Get all prospect IDs to fetch their tags
				const prospectIds = results.map((r) => r.prospect.id);
				let prospectTagsData: Array<{
					prospectId: string;
					tag: {
						id: string;
						name: string;
						createdBy: string;
						createdAt: Date;
						updatedAt: Date;
					};
				}> = [];

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
				const tagsByProspectId: Record<
					string,
					Array<{
						id: string;
						name: string;
						createdBy: string;
						createdAt: Date;
						updatedAt: Date;
					}>
				> = {};
				for (const item of prospectTagsData) {
					if (!tagsByProspectId[item.prospectId]) {
						tagsByProspectId[item.prospectId] = [];
					}
					tagsByProspectId[item.prospectId].push(item.tag);
				}

				const followersByProspectId =
					await fetchFollowersByProspectIds(prospectIds);

				const effectivePage = exportAll ? 1 : page;
				const effectiveTotalPages = exportAll
					? 1
					: Math.ceil(total / effectiveLimit);

				return {
					prospects: results.map((r) => {
						// Handle missing columns gracefully (for databases that haven't been migrated yet)
						// Also handle legacy "owner" type - convert to "buyer"
						const prospectType =
							(r.prospect.type as string) === "owner"
								? "buyer"
								: r.prospect.type;
						const prospect = {
							...r.prospect,
							type: prospectType as "tenant" | "buyer", // Migrate "owner" to "buyer"
							stage: normalisePipelineStage(r.prospect.stage),
							leadType: r.prospect.leadType || "personal",
							tags: r.prospect.tags || null, // Keep for backward compatibility
						};
						const parsed = selectProspectSchema.parse(prospect);
						// Add agentName and tags to the response
						return {
							...parsed,
							agentName: r.agentName || null,
							agentEmail: r.agentEmail || null,
							projectName: r.projectName || null,
							tagIds: tagsByProspectId[r.prospect.id]?.map((t) => t.id) || [],
							tagNames:
								tagsByProspectId[r.prospect.id]?.map((t) => t.name) || [],
							followerIds:
								followersByProspectId[r.prospect.id]?.ids ?? [],
							followerNames:
								followersByProspectId[r.prospect.id]?.names ?? [],
							isFollower:
								r.prospect.agentId !== agentId &&
								(followersByProspectId[r.prospect.id]?.ids ?? []).includes(
									agentId,
								),
						};
					}),
					pagination: {
						total,
						page: effectivePage,
						limit: exportAll ? results.length : effectiveLimit,
						totalPages: effectiveTotalPages,
					},
				};
			} catch (error: unknown) {
				const e = error as { message?: string; code?: string; stack?: string };
				console.error("❌ CRM list error:", error);
				const errorMessage = e?.message ?? String(error);
				console.error("❌ Error details:", errorMessage);
				console.error("❌ Error code:", e?.code);
				console.error("❌ Error stack:", e?.stack ?? "No stack");

				// Check if this is a missing column error
				if (
					errorMessage.includes("does not exist") ||
					errorMessage.includes("column") ||
					errorMessage.includes("unknown column")
				) {
					const helpfulError = new Error(
						`Database schema is out of date. Please run database migrations to add the new columns (stage, leadType, tags) to the prospects table. Original error: ${errorMessage}`,
					);
					(helpfulError as Error & { cause?: unknown }).cause = error;
					throw helpfulError;
				}

				// Provide more specific error messages for connection issues
				if (
					errorMessage.includes("timeout") ||
					errorMessage.includes("Query timeout") ||
					e?.code === "ETIMEDOUT"
				) {
					throw new Error(
						"Database query timed out. The database may be under heavy load. Please try again.",
					);
				}
				if (
					errorMessage.includes("Connection terminated") ||
					errorMessage.includes("Connection terminated unexpectedly") ||
					e?.code === "57P01"
				) {
					throw new Error("Database connection lost. Please try again.");
				}
				if (
					errorMessage.includes("MaxClientsInSessionMode") ||
					e?.code === "XX000"
				) {
					throw new Error(
						"Database connection pool exhausted. Please try again in a moment.",
					);
				}

				throw error;
			}
		}),

	/**
	 * Bulk import prospects from CSV (same columns as admin export).
	 * personal_assigned → your CRM (personal leads assigned to you).
	 * company_unclaimed → company pool (unclaimed company leads).
	 */
	importCsv: protectedProcedure
		.input(crmImportCsvInput)
		.mutation(async ({ input, ctx }) => {
			return await importProspectsBulkForAgent(
				input.rows,
				ctx.session.user.id,
				input.mode,
			);
		}),

	// Get a single prospect by ID (with notes)
	get: protectedProcedure
		.input(getProspectInput)
		.query(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			const allowed = await canAgentAccessProspect(id, agentId, {
				allowUnclaimedCompany: true,
			});
			if (!allowed) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Prospect not found",
				});
			}

			const [prospectRow] = await db
				.select({
					prospect: prospects,
					agentName: agentLeadDisplayNameSql,
				})
				.from(prospects)
				.leftJoin(user, eq(prospects.agentId, user.id))
				.where(eq(prospects.id, id))
				.limit(1);

			if (!prospectRow) {
				throw new Error("Prospect not found");
			}

			const prospect = prospectRow.prospect;

			const followers = await getProspectFollowers(id);

			// Get notes for this prospect with agent names
			const notes = await db
				.select({
					note: prospectNotes,
					agentName: agentLeadDisplayNameSql,
				})
				.from(prospectNotes)
				.leftJoin(user, eq(prospectNotes.agentId, user.id))
				.where(eq(prospectNotes.prospectId, id))
				.orderBy(desc(prospectNotes.createdAt));

			// Get tags for this prospect
			let prospectTagsData: Array<{
				tag: {
					id: string;
					name: string;
					createdBy: string;
					createdAt: Date;
					updatedAt: Date;
				};
			}> = [];
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
			const prospectType =
				(prospect.type as string) === "owner" ? "buyer" : prospect.type;
			const prospectForParse = {
				...prospect,
				type: prospectType as "tenant" | "buyer",
			};

			return {
				prospect: {
					...selectProspectSchema.parse(prospectForParse),
					agentName: prospectRow.agentName ?? null,
					tagIds: prospectTagsData.map((t) => t.tag.id),
					tagNames: prospectTagsData.map((t) => t.tag.name),
					followerIds: followers.ids,
					followerNames: followers.names,
					isFollower:
						prospect.agentId !== agentId && followers.ids.includes(agentId),
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

				// If it's a company lead, agentId can be null (unclaimed)
				// Otherwise, set agentId for personal leads
				const newProspect: InsertProspect & { agentId?: string | null } = {
					...input,
					agentId: input.leadType === "company" ? null : agentId,
				};

				const [created] = await db
					.insert(prospects)
					.values(newProspect)
					.returning();

				// Fetch categories for response (read-only for agents)
				let prospectTagsData: Array<{
					tag: {
						id: string;
						name: string;
						createdBy: string;
						createdAt: Date;
						updatedAt: Date;
					};
				}> = [];
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
				const createdType =
					(created.type as string) === "owner" ? "buyer" : created.type;
				const createdForParse = {
					...created,
					type: createdType as "tenant" | "buyer",
				};

				return {
					...selectProspectSchema.parse(createdForParse),
					tagIds: prospectTagsData.map((t) => t.tag.id),
					tagNames: prospectTagsData.map((t) => t.tag.name),
				};
			} catch (error: unknown) {
				const err = error as {
					message?: string;
					code?: string;
					cause?: { message?: string; code?: string };
					issues?: Array<{ path: (string | number)[]; message: string }>;
				};
				console.error("❌ CRM create error:", error);

				// Extract error message from error or its cause (Drizzle wraps PostgreSQL errors)
				const errorMessage =
					err?.message ?? err?.cause?.message ?? String(error);
				const errorCode = err?.code ?? err?.cause?.code;
				const fullErrorText = JSON.stringify(err?.cause ?? error, null, 2);

				console.error("❌ Error details:", errorMessage);
				console.error("❌ Error code:", errorCode);
				console.error("❌ Full error:", fullErrorText);

				// Check if this is a database enum mismatch error for prospect_type
				const isProspectTypeError =
					errorMessage.includes("invalid input value for enum prospect_type") ||
					(errorMessage.includes("invalid input value for enum") &&
						errorMessage.includes("buyer")) ||
					(errorMessage.includes("prospect_type") &&
						errorMessage.includes("buyer")) ||
					(errorCode === "22P02" &&
						(errorMessage.includes("prospect_type") ||
							fullErrorText.includes("prospect_type")));

				if (isProspectTypeError) {
					throw new Error(
						"Database schema mismatch: The prospect_type enum in the database still only has 'tenant' and 'owner' values, but the code is trying to insert 'buyer'. " +
							"Please run this SQL command: ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer'; " +
							"Or use the migration file: apps/server/src/db/migrations/0003_update_prospect_type_enum.sql",
					);
				}

				// Check if this is a property column enum error
				const isPropertyTypeError =
					errorMessage.includes("invalid input value for enum property_type") ||
					errorMessage.includes("property_type") ||
					(errorCode === "22P02" &&
						(errorMessage.includes("property_type") ||
							fullErrorText.includes("property_type")));

				if (isPropertyTypeError) {
					throw new Error(
						"Database schema mismatch: The property column is still an enum type in the database, but the code is trying to insert free text. " +
							"Please run this migration script: bun run apps/server/scripts/run-property-to-text-migration.ts " +
							"Or use the migration file: apps/server/src/db/migrations/0004_update_property_to_text.sql",
					);
				}

				// Check for validation errors
				if (err?.issues) {
					const validationErrors = err.issues
						.map((i) => `${i.path.join(".")}: ${i.message}`)
						.join(", ");
					throw new Error(`Validation error: ${validationErrors}`);
				}

				throw new Error(`Failed to create prospect: ${errorMessage}`);
			}
		}),

	// Update an existing prospect
	update: protectedProcedure
		.input(updateProspectInput)
		.mutation(async ({ input, ctx }) => {
			const { id, leadType: _leadType, ...updateData } = input;
			const agentId = ctx.session.user.id;

			const allowed = await canAgentAccessProspect(id, agentId, {
				allowUnclaimedCompany: true,
			});
			if (!allowed) {
				throw new Error("Prospect not found");
			}

			const [existing] = await db
				.select()
				.from(prospects)
				.where(eq(prospects.id, id))
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			// Automation rules:
			// 1) Meeting scheduled (nextContact set) -> move to appointment stage
			// 2) Activity contact update from new lead -> move to follow-up stage
			const effectiveUpdateData: typeof updateData = { ...updateData };
			if (
				effectiveUpdateData.nextContact !== undefined &&
				effectiveUpdateData.stage === undefined
			) {
				effectiveUpdateData.stage = "appointment_made";
			} else if (
				effectiveUpdateData.lastContact !== undefined &&
				effectiveUpdateData.stage === undefined &&
				existing.stage === "new_lead"
			) {
				effectiveUpdateData.stage = "first_follow_up";
			}

			const [updated] = await withPipelineStageSchemaRetry(() =>
				db
					.update(prospects)
					.set({
						...effectiveUpdateData,
						updatedAt: new Date(),
					})
					.where(eq(prospects.id, id))
					.returning(),
			);

			// Fetch categories for response (agents cannot change them)
			let prospectTagsData: Array<{
				tag: {
					id: string;
					name: string;
					createdBy: string;
					createdAt: Date;
					updatedAt: Date;
				};
			}> = [];
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
			const updatedType =
				(updated.type as string) === "owner" ? "buyer" : updated.type;
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

			const allowed = await canAgentAccessProspect(id, agentId);
			if (!allowed) {
				throw new Error("Prospect not found");
			}

			const [existing] = await db
				.select()
				.from(prospects)
				.where(eq(prospects.id, id))
				.limit(1);

			if (!existing) {
				throw new Error("Prospect not found");
			}

			const [updated] = await withPipelineStageSchemaRetry(() =>
				db
					.update(prospects)
					.set({
						stage,
						status: "active",
						updatedAt: new Date(),
					})
					.where(eq(prospects.id, id))
					.returning(),
			);

			// Handle legacy "owner" type - convert to "buyer"
			const updatedType =
				(updated.type as string) === "owner" ? "buyer" : updated.type;
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
			const claimedType =
				(claimed.type as string) === "owner" ? "buyer" : claimed.type;
			const claimedForParse = {
				...claimed,
				type: claimedType as "tenant" | "buyer",
			};
			return selectProspectSchema.parse(claimedForParse);
		}),

	// Notes CRUD
	// Add note to prospect
	addNote: protectedProcedure
		.input(insertProspectNoteSchema)
		.mutation(async ({ input, ctx }) => {
			const { prospectId, content } = input;
			const agentId = ctx.session.user.id;

			const allowed = await canAgentAccessProspect(prospectId, agentId, {
				allowUnclaimedCompany: true,
			});
			if (!allowed) {
				throw new Error("Prospect not found");
			}

			const [prospect] = await db
				.select()
				.from(prospects)
				.where(eq(prospects.id, prospectId))
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

			// Treat note creation as lead activity contact touchpoint.
			await withPipelineStageSchemaRetry(() =>
				db
					.update(prospects)
					.set({
						lastContact: new Date(),
						status: "active",
						stage:
							prospect.stage === "new_lead"
								? "first_follow_up"
								: prospect.stage,
						updatedAt: new Date(),
					})
					.where(eq(prospects.id, prospectId)),
			);

			return selectProspectNoteSchema.parse(note);
		}),

	// Get notes for a prospect
	getNotes: protectedProcedure
		.input(getProspectInput)
		.query(async ({ input, ctx }) => {
			const { id } = input;
			const agentId = ctx.session.user.id;

			const allowed = await canAgentAccessProspect(id, agentId, {
				allowUnclaimedCompany: true,
			});
			if (!allowed) {
				throw new Error("Prospect not found");
			}

			// Get notes with agent names
			const notes = await db
				.select({
					note: prospectNotes,
					agentName: agentLeadDisplayNameSql,
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

	getActivity: protectedProcedure
		.input(z.object({ leadId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const agentId = ctx.session.user.id;
			const allowed = await canAgentAccessProspect(input.leadId, agentId, {
				allowUnclaimedCompany: true,
			});

			if (!allowed) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only view activity on your own leads",
				});
			}

			return await getLeadActivityAdmin(input.leadId);
		}),

	agentsForFollowers: protectedProcedure.query(async () => {
		return await getAgentsWithLeads();
	}),

	// Reassign the lead to another agent (owner-only; followers cannot be edited by agents)
	setOwner: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				agentId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const currentAgentId = ctx.session.user.id;
			const [prospect] = await db
				.select({ agentId: prospects.agentId })
				.from(prospects)
				.where(eq(prospects.id, input.id))
				.limit(1);

			if (!prospect) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
			}
			if (prospect.agentId !== currentAgentId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the assigned agent can change the lead owner",
				});
			}

			const updated = await assignLeadAdmin(
				input.id,
				input.agentId,
				currentAgentId,
			);

			// Handle legacy "owner" type - convert to "buyer"
			const updatedType =
				(updated.type as string) === "owner" ? "buyer" : updated.type;
			return selectProspectSchema.parse({
				...updated,
				type: updatedType as "tenant" | "buyer",
			});
		}),

	setCategories: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				tagIds: z.array(z.string().uuid()).default([]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const agentId = ctx.session.user.id;
			const [prospect] = await db
				.select({ agentId: prospects.agentId })
				.from(prospects)
				.where(eq(prospects.id, input.id))
				.limit(1);

			if (!prospect) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
			}
			if (prospect.agentId !== agentId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the assigned agent can edit categories",
				});
			}

			return await setProspectTagIds(input.id, input.tagIds, agentId);
		}),
});
