import { TRPCError } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { approvalTemplates, approvalWorkflowHistory } from "../models/approvals";
import { commissionApprovals } from "../models/approvals";
import {
	AGENT_TIER_CONFIG,
	type AgentTier,
	agencies,
	agentActivities,
	agentGoals,
	agentTierHistory,
	account,
	commissionAuditLog,
	teams,
	user,
} from "../models/auth";
import { reports } from "../models/reports";
import { performanceMetrics } from "../models/reports";
import type { ERecruitmentDocuments } from "../models/erecruitment";
import { transactions } from "../models/transactions";
import { getNextAgentCode } from "../services/sequential-codes";
import { db } from "../utils/db";
import { invalidateUserCache } from "../utils/context";
import { hasSuperAdminAccess } from "../utils/user-roles";
import { supabaseAdmin } from "../utils/supabase";
import { adminProcedure, protectedProcedure, router, superAdminProcedure } from "../utils/trpc";

const onboardingDocumentFileSchema = z.object({
	fileName: z.string(),
	fileType: z.string(),
	url: z.string().optional(),
	storagePath: z.string().optional(),
	dataUrl: z.string().optional(),
	uploadedAt: z.string(),
});

async function persistOnboardingDocuments(
	userId: string,
	documents: ERecruitmentDocuments | undefined,
): Promise<ERecruitmentDocuments | null> {
	if (!documents) return null;

	const categories = ["icFront", "icBack", "registrationFeeReceipt"] as const;
	const stored: ERecruitmentDocuments = {};

	for (const category of categories) {
		const file = documents[category];
		if (!file) continue;

		if (file.storagePath || file.url) {
			stored[category] = file;
			continue;
		}

		if (!file.dataUrl) continue;

		const base64 = file.dataUrl.replace(/^data:[^;]+;base64,/, "");
		const fileBuffer = Buffer.from(base64, "base64");
		const uniqueFileName = `${Date.now()}-${file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
		const storagePath = `agent-onboarding/${userId}/${category}/${uniqueFileName}`;
		const uploadedAt = file.uploadedAt || new Date().toISOString();

		if (supabaseAdmin) {
			const { error } = await supabaseAdmin.storage
				.from("transaction-documents")
				.upload(storagePath, fileBuffer, {
					contentType: file.fileType,
					upsert: false,
				});

			if (error) {
				throw new Error(`Upload failed for ${category}: ${error.message}`);
			}

			const { data: urlData } = supabaseAdmin.storage
				.from("transaction-documents")
				.getPublicUrl(storagePath);

			stored[category] = {
				fileName: file.fileName,
				fileType: file.fileType,
				url: urlData.publicUrl,
				storagePath,
				uploadedAt,
			};
			continue;
		}

		stored[category] = {
			fileName: file.fileName,
			fileType: file.fileType,
			dataUrl: file.dataUrl,
			uploadedAt,
		};
	}

	return Object.keys(stored).length > 0 ? stored : null;
}

async function enrichOnboardingDocuments(
	docs: ERecruitmentDocuments | null | undefined,
): Promise<ERecruitmentDocuments> {
	if (!docs) return {};

	const resolve = async (
		file: ERecruitmentDocuments[keyof ERecruitmentDocuments],
	) => {
		if (!file) return undefined;
		if (file.dataUrl || file.url) return file;
		if (file.storagePath && supabaseAdmin) {
			const { data, error } = await supabaseAdmin.storage
				.from("transaction-documents")
				.createSignedUrl(file.storagePath, 3600);
			if (!error && data?.signedUrl) {
				return { ...file, url: data.signedUrl };
			}
		}
		return file.url ? file : undefined;
	};

	const [icFront, icBack, registrationFeeReceipt] = await Promise.all([
		resolve(docs.icFront),
		resolve(docs.icBack),
		resolve(docs.registrationFeeReceipt),
	]);

	return {
		...(icFront ? { icFront } : {}),
		...(icBack ? { icBack } : {}),
		...(registrationFeeReceipt ? { registrationFeeReceipt } : {}),
	};
}

// Input schemas
const listAgentsInput = z.object({
	limit: z.number().min(1).max(100).default(20),
	offset: z.number().min(0).default(0),
	role: z.enum(["agent", "team_lead", "admin", "super_admin"]).optional(),
	agentTier: z
		.enum([
			"advisor",
			"sales_leader",
			"team_leader",
			"group_leader",
			"supreme_leader",
		])
		.optional(),
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	searchQuery: z.string().optional(),
	isActive: z.boolean().optional(),
	agentStatus: z
		.enum([
			"active",
			"inactive",
			"suspended",
			"pending_approval",
			"terminated",
		])
		.optional(),
	sortBy: z
		.enum(["name", "email", "createdAt", "agentTier", "agentCode"])
		.default("agentCode"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const agentIdInput = z.object({
	id: z.string(),
});

const updateAgentInput = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	nickName: z.string().optional(),
	nric: z.string().optional(),
	email: z.string().email().optional(),
	phone: z
		.string()
		.regex(/^\+60\d{8,11}$/, "Phone must be in Malaysian format (+60...)")
		.optional(),
	address: z.string().optional(),
	maritalStatus: z.string().optional(),
	emergencyName: z.string().optional(),
	emergencyContactNo: z.string().optional(),
	emergencyRelationship: z.string().optional(),
	bankName: z.string().optional(),
	bankAccountNo: z.string().optional(),
	bankAccountName: z.string().optional(),
	incomeTaxNo: z.string().optional(),
	registrationFee: z.string().optional(),
	paymentMethod: z.string().optional(),
	branch: z.string().min(1).max(120).optional(),
	agentTier: z
		.enum([
			"advisor",
			"sales_leader",
			"team_leader",
			"group_leader",
			"supreme_leader",
		])
		.optional(),
	companyCommissionSplit: z.number().min(0).max(100).optional(),
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	permissions: z.string().optional(),
	agentCode: z.string().min(1).max(32).optional(),
	recruitedBy: z.string().nullable().optional(),
	joinedDate: z.coerce.date().optional(),
	documents: z
		.object({
			icFront: onboardingDocumentFileSchema.optional(),
			icBack: onboardingDocumentFileSchema.optional(),
			registrationFeeReceipt: onboardingDocumentFileSchema.optional(),
		})
		.optional(),
});

const createAgentInput = z.object({
	fullName: z.string().min(1).max(200),
	nickName: z.string().optional(),
	nric: z.string().min(1).max(32),
	email: z.string().email(),
	registrationFee: z.string().optional(),
	paymentMethod: z.string().optional(),
	address: z.string().optional(),
	contactNo: z
		.string()
		.regex(/^\+60\d{8,11}$/, "Contact no. must be in Malaysian format (+60...)"),
	maritalStatus: z.string().optional(),
	emergencyName: z.string().optional(),
	emergencyContactNo: z.string().optional(),
	emergencyRelationship: z.string().optional(),
	bankName: z.string().optional(),
	bankAccountNo: z.string().optional(),
	bankAccountName: z.string().optional(),
	incomeTaxNo: z.string().optional(),
	documents: z
		.object({
			icFront: onboardingDocumentFileSchema,
			icBack: onboardingDocumentFileSchema,
			registrationFeeReceipt: onboardingDocumentFileSchema,
		})
		.optional(),
	acceptedCompanyPolicy: z.literal(true),
	acceptedNda: z.literal(true),
	password: z.string().min(8),
	branch: z.string().min(1).max(120).optional(),
	teamId: z.string().uuid().optional(),
	agencyId: z.string().uuid().optional(),
	role: z.enum(["agent", "team_lead", "admin"]).default("agent"),
});

const updateUserRoleInput = z.object({
	userId: z.string(),
	role: z.enum(["agent", "team_lead", "admin"]),
});

const resetAgentPasswordInput = z.object({
	agentId: z.string(),
	newPassword: z.string().min(8),
});

const setAgentActiveInput = z.object({
	agentId: z.string(),
	isActive: z.boolean(),
});

const approveAgentInput = z.object({
	agentId: z.string(),
	agentCode: z.string().min(1).max(32).optional(),
});

const deleteAgentInput = z.object({
	agentId: z.string(),
});

const agentPerformanceInput = z.object({
	agentId: z.string(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	periodType: z
		.enum(["daily", "weekly", "monthly", "quarterly", "yearly"])
		.default("monthly"),
});

/** Profile avatar: http(s) URL or small base64 data URL from client compression */
const profileImageInput = z
	.string()
	.max(480000, "Image data is too large")
	.refine(
		(s) => {
			if (/^data:image\/(jpeg|jpg|png|webp);base64,/.test(s)) return true;
			try {
				const u = new URL(s);
				return u.protocol === "https:" || u.protocol === "http:";
			} catch {
				return false;
			}
		},
		{ message: "Invalid image: use a valid URL or a JPEG/PNG/WebP upload" },
	);

const createGoalInput = z.object({
	agentId: z.string(),
	title: z.string().min(1),
	description: z.string().optional(),
	goalType: z.enum(["sales", "commission", "clients", "custom"]),
	targetValue: z.number().positive(),
	unit: z.string().min(1),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
});

const bulkAgentActionInput = z.object({
	agentIds: z.array(z.string()).min(1).max(50),
	action: z.enum(["activate", "deactivate", "change_tier", "assign_team"]),
	actionData: z
		.object({
			agentTier: z
				.enum([
					"advisor",
					"sales_leader",
					"team_leader",
					"group_leader",
					"supreme_leader",
				])
				.optional(),
			teamId: z.string().uuid().optional(),
			reason: z.string().optional(),
		})
		.optional(),
});

export const agentsRouter = router({
	previewNextAgentCode: adminProcedure.query(async () => {
		return { agentCode: await getNextAgentCode() };
	}),

	// List all agents (admin only)
	list: adminProcedure.input(listAgentsInput).query(async ({ input }) => {
		const conditions = [];

		if (input.role) {
			conditions.push(eq(user.role, input.role));
		}
		if (input.agentTier) {
			conditions.push(eq(user.agentTier, input.agentTier));
		}
		if (input.teamId) {
			conditions.push(eq(user.teamId, input.teamId));
		}
		if (input.agencyId) {
			conditions.push(eq(user.agencyId, input.agencyId));
		}
		if (input.searchQuery) {
			conditions.push(
				sql`(${user.name} ILIKE ${`%${input.searchQuery}%`} OR ${user.nickName} ILIKE ${`%${input.searchQuery}%`} OR ${user.email} ILIKE ${`%${input.searchQuery}%`} OR ${user.agentCode} ILIKE ${`%${input.searchQuery}%`})`,
			);
		}
		if (input.isActive !== undefined) {
			conditions.push(eq(user.isActive, input.isActive));
		}
		if (input.agentStatus) {
			conditions.push(eq(user.agentStatus, input.agentStatus));
		}

		// Build order by clause
		const orderByColumn =
			input.sortBy === "name"
				? user.name
				: input.sortBy === "email"
					? user.email
					: input.sortBy === "createdAt"
						? user.createdAt
						: input.sortBy === "agentCode"
							? sql`coalesce(
                  CASE
                    WHEN ${user.agentCode} ~ '^DT[0-9]+$'
                    THEN cast(SUBSTRING(${user.agentCode} FROM 3) AS integer)
                    WHEN ${user.agentCode} ~ '^[0-9]+$' THEN cast(${user.agentCode} AS integer)
                    ELSE NULL
                  END,
                  0
                )`
							: user.agentTier;

		const orderByClause =
			input.sortOrder === "asc" ? orderByColumn : desc(orderByColumn);

		// Get agents with team and agency details
		const agentsList = await db
			.select({
				agent: user,
				team: {
					id: teams.id,
					name: teams.name,
					slug: teams.slug,
				},
				agency: {
					id: agencies.id,
					name: agencies.name,
					slug: agencies.slug,
				},
			})
			.from(user)
			.leftJoin(teams, eq(user.teamId, teams.id))
			.leftJoin(agencies, eq(user.agencyId, agencies.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(orderByClause)
			.limit(input.limit)
			.offset(input.offset);

		// Get total count
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(user)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		// Get performance metrics for each agent
		const agentIds = agentsList.map((a) => a.agent.id);
		const performanceData =
			agentIds.length > 0
				? await db
						.select({
							agentId: performanceMetrics.agentId,
							totalTransactions: performanceMetrics.totalTransactions,
							totalCommission: performanceMetrics.totalCommission,
							averageCommission: performanceMetrics.averageCommission,
							conversionRate: performanceMetrics.conversionRate,
						})
						.from(performanceMetrics)
						.where(
							and(
								inArray(performanceMetrics.agentId, agentIds),
								eq(performanceMetrics.periodType, "monthly"),
							),
						)
				: [];

		// Combine agent data with performance metrics
		const agentsWithPerformance = agentsList.map((agentData) => {
			const performance = performanceData.find(
				(p) => p.agentId === agentData.agent.id,
			);
			return {
				...agentData,
				performance: performance || {
					totalTransactions: 0,
					totalCommission: "0",
					averageCommission: "0",
					conversionRate: "0",
				},
			};
		});

		return {
			agents: agentsWithPerformance,
			total: count,
			hasMore: input.offset + input.limit < count,
		};
	}),

	/** Search active agents for co-broking (agent-facing). */
	searchForCoBroking: protectedProcedure
		.input(
			z.object({
				search: z.string().optional(),
				limit: z.number().min(1).max(50).default(20),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(user.role, "agent"),
				eq(user.isActive, true),
				sql`${user.id} != ${ctx.session.user.id}`,
			];
			if (input.search?.trim()) {
				const q = `%${input.search.trim()}%`;
				conditions.push(
					sql`(${user.name} ILIKE ${q} OR ${user.nickName} ILIKE ${q} OR ${user.email} ILIKE ${q} OR ${user.agentCode} ILIKE ${q})`,
				);
			}
			const rows = await db
				.select({
					id: user.id,
					name: user.name,
					nickName: user.nickName,
					email: user.email,
					phone: user.phone,
					branch: user.branch,
					agentCode: user.agentCode,
				})
				.from(user)
				.where(and(...conditions))
				.orderBy(user.name)
				.limit(input.limit);
			return rows;
		}),

	// Get agent details (admin only)
	getById: adminProcedure.input(agentIdInput).query(async ({ input }) => {
		const [agentData] = await db
			.select({
				agent: user,
				team: teams,
				agency: agencies,
			})
			.from(user)
			.leftJoin(teams, eq(user.teamId, teams.id))
			.leftJoin(agencies, eq(user.agencyId, agencies.id))
			.where(eq(user.id, input.id))
			.limit(1);

		if (!agentData) {
			throw new Error("Agent not found");
		}

		let recruiter: { id: string; name: string } | null = null;
		if (agentData.agent.recruitedBy) {
			const [row] = await db
				.select({ id: user.id, name: user.name })
				.from(user)
				.where(eq(user.id, agentData.agent.recruitedBy))
				.limit(1);
			recruiter = row ?? null;
		}

		const onboardingDocuments = await enrichOnboardingDocuments(
			agentData.agent.onboardingDocuments,
		);

		// Get tier history
		const tierHistory = await db
			.select({
				history: agentTierHistory,
				promotedByUser: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(agentTierHistory)
			.leftJoin(user, eq(agentTierHistory.promotedBy, user.id))
			.where(eq(agentTierHistory.agentId, input.id))
			.orderBy(desc(agentTierHistory.createdAt))
			.limit(10);

		// Get recent activities
		const recentActivities = await db
			.select()
			.from(agentActivities)
			.where(eq(agentActivities.agentId, input.id))
			.orderBy(desc(agentActivities.timestamp))
			.limit(20);

		// Get current goals
		const currentGoals = await db
			.select()
			.from(agentGoals)
			.where(
				and(eq(agentGoals.agentId, input.id), eq(agentGoals.isActive, true)),
			)
			.orderBy(desc(agentGoals.createdAt));

		// Get performance metrics for last 6 months
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const performanceHistory = await db
			.select()
			.from(performanceMetrics)
			.where(
				and(
					eq(performanceMetrics.agentId, input.id),
					gte(performanceMetrics.periodStart, sixMonthsAgo),
				),
			)
			.orderBy(desc(performanceMetrics.periodStart));

		return {
			...agentData,
			agent: {
				...agentData.agent,
				onboardingDocuments,
			},
			recruiter,
			tierHistory,
			recentActivities,
			currentGoals,
			performanceHistory,
		};
	}),

	// Update agent details (admin only)
	update: adminProcedure
		.input(updateAgentInput)
		.mutation(async ({ ctx, input }) => {
			const { id, documents, joinedDate, recruitedBy, ...updateData } = input;

			// Get current agent data for tier change tracking
			const [currentAgent] = await db
				.select()
				.from(user)
				.where(eq(user.id, id))
				.limit(1);

			if (!currentAgent) {
				throw new Error("Agent not found");
			}

			if (recruitedBy !== undefined && recruitedBy !== null) {
				if (recruitedBy === id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "An agent cannot recruit themselves",
					});
				}
				const [recruiter] = await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.id, recruitedBy))
					.limit(1);
				if (!recruiter) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Recruiter not found",
					});
				}
			}

			if (updateData.agentCode) {
				const [duplicate] = await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.agentCode, updateData.agentCode))
					.limit(1);
				if (duplicate && duplicate.id !== id) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Agent code is already in use",
					});
				}
			}

			let onboardingDocuments = currentAgent.onboardingDocuments;
			if (documents) {
				const uploaded = await persistOnboardingDocuments(id, documents);
				if (uploaded) {
					onboardingDocuments = {
						...(onboardingDocuments ?? {}),
						...uploaded,
					};
				}
			}

			// Update agent
			const [updatedAgent] = await db
				.update(user)
				.set({
					...updateData,
					...(recruitedBy !== undefined ? { recruitedBy } : {}),
					...(joinedDate !== undefined ? { createdAt: joinedDate } : {}),
					...(documents ? { onboardingDocuments } : {}),
					updatedAt: new Date(),
				})
				.where(eq(user.id, id))
				.returning();

			// If agent tier changed, log it
			if (
				updateData.agentTier &&
				updateData.agentTier !== currentAgent.agentTier
			) {
				await db.insert(agentTierHistory).values({
					agentId: id,
					previousTier: currentAgent.agentTier,
					newTier: updateData.agentTier,
					promotedBy: ctx.session.user.id,
					reason: "Admin tier change",
					effectiveDate: new Date(),
				});
			}

			return updatedAgent;
		}),

	// Change account role (super admin only — not tier/commission)
	updateRole: superAdminProcedure
		.input(updateUserRoleInput)
		.mutation(async ({ ctx, input }) => {
			if (input.userId === ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You cannot change your own role",
				});
			}

			const [target] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, input.userId))
				.limit(1);

			if (!target) {
				throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
			}

			if (target.role === "super_admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Super admin accounts can only be changed directly in the database",
				});
			}

			const [updated] = await db
				.update(user)
				.set({ role: input.role, updatedAt: new Date() })
				.where(eq(user.id, input.userId))
				.returning();

			return updated;
		}),

	// Create new agent/admin account (admin only; role elevation requires super admin)
	create: adminProcedure.input(createAgentInput).mutation(async ({ ctx, input }) => {
		const requestedRole = input.role ?? "agent";
		const actorIsSuperAdmin = hasSuperAdminAccess(
			ctx.session.user as { role?: string | null },
		);

		if (requestedRole !== "agent" && !actorIsSuperAdmin) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Only super admins can create admin or team lead accounts",
			});
		}

		const now = new Date();
		const userId = crypto.randomUUID();
		const passwordHash = await hashPassword(input.password);
		const agentCode = await getNextAgentCode();
		const onboardingDocuments = await persistOnboardingDocuments(
			userId,
			input.documents,
		);

		const [createdUser] = await db
			.insert(user)
			.values({
				id: userId,
				name: input.fullName,
				email: input.email.toLowerCase(),
				phone: input.contactNo,
				nickName: input.nickName?.trim() || null,
				nric: input.nric.trim(),
				registrationFee: input.registrationFee?.trim() || null,
				paymentMethod: input.paymentMethod || null,
				address: input.address?.trim() || null,
				maritalStatus: input.maritalStatus || null,
				emergencyName: input.emergencyName?.trim() || null,
				emergencyContactNo: input.emergencyContactNo?.trim() || null,
				emergencyRelationship: input.emergencyRelationship?.trim() || null,
				bankName: input.bankName?.trim() || null,
				bankAccountNo: input.bankAccountNo?.trim() || null,
				bankAccountName: input.bankAccountName?.trim() || null,
				incomeTaxNo: input.incomeTaxNo?.trim() || null,
				onboardingDocuments,
				branch: input.branch,
				emailVerified: false,
				image: null,
				isActive: true,
				deactivatedAt: null,
				agencyId: input.agencyId,
				teamId: input.teamId,
				role: requestedRole,
				permissions: null,
				agentTier: "advisor",
				companyCommissionSplit: 70,
				tierEffectiveDate: now,
				tierPromotedBy: ctx.session.user.id,
				recruitedBy: null,
				recruitedAt: null,
				agentCode,
				agentStatus: "active",
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		await db.insert(account).values({
			id: crypto.randomUUID(),
			accountId: input.email.toLowerCase(),
			providerId: "credential",
			userId,
			accessToken: null,
			refreshToken: null,
			idToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
			scope: null,
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		});

		return createdUser;
	}),

	// Soft deactivate / activate agent (admin only)
	setActive: adminProcedure
		.input(setAgentActiveInput)
		.mutation(async ({ input }) => {
			const now = new Date();
			const [updated] = await db
				.update(user)
				.set({
					isActive: input.isActive,
					deactivatedAt: input.isActive ? null : now,
					agentStatus: input.isActive ? "active" : "inactive",
					updatedAt: now,
				})
				.where(eq(user.id, input.agentId))
				.returning();
			if (!updated) throw new Error("Agent not found");
			invalidateUserCache(input.agentId);
			return updated;
		}),

	// Approve pending agent (admin only)
	approve: adminProcedure
		.input(approveAgentInput)
		.mutation(async ({ input }) => {
			const [existing] = await db
				.select({
					id: user.id,
					agentStatus: user.agentStatus,
					agentCode: user.agentCode,
				})
				.from(user)
				.where(eq(user.id, input.agentId))
				.limit(1);

			if (!existing) throw new Error("Agent not found");

			const status = existing.agentStatus ?? "pending_approval";
			if (status !== "pending_approval") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only pending agents can be approved",
				});
			}

			const agentCode =
				input.agentCode?.trim() ||
				existing.agentCode?.trim() ||
				(await getNextAgentCode());

			if (!existing.agentCode?.trim() || input.agentCode?.trim()) {
				const [duplicate] = await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.agentCode, agentCode))
					.limit(1);
				if (duplicate && duplicate.id !== input.agentId) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Agent code is already in use",
					});
				}
			}

			const now = new Date();
			const [updated] = await db
				.update(user)
				.set({
					agentStatus: "active",
					agentCode,
					isActive: true,
					deactivatedAt: null,
					updatedAt: now,
				})
				.where(eq(user.id, input.agentId))
				.returning();
			if (!updated) throw new Error("Agent not found");
			invalidateUserCache(input.agentId);
			return updated;
		}),
	resetPassword: adminProcedure
		.input(resetAgentPasswordInput)
		.mutation(async ({ input }) => {
			const now = new Date();
			const passwordHash = await hashPassword(input.newPassword);

			const [updated] = await db
				.update(account)
				.set({ password: passwordHash, updatedAt: now })
				.where(
					and(
						eq(account.userId, input.agentId),
						eq(account.providerId, "credential"),
					),
				)
				.returning();

			if (!updated) throw new Error("Credential account not found");
			return { ok: true };
		}),

	// Permanently delete an agent and related auth records (admin + super admin)
	delete: adminProcedure
		.input(deleteAgentInput)
		.mutation(async ({ ctx, input }) => {
			if (input.agentId === ctx.session.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You cannot delete your own account",
				});
			}

			const [target] = await db
				.select({ id: user.id, role: user.role, email: user.email })
				.from(user)
				.where(eq(user.id, input.agentId))
				.limit(1);

			if (!target) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
			}

			if (target.role === "super_admin") {
				// Super admin delete is allowed only if at least one super admin remains.
				// (Self-delete is already blocked above.)
				if (ctx.userRole !== "super_admin") {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Only super admins can delete super admin accounts",
					});
				}

				const [{ count: superAdminCount }] = await db
					.select({ count: sql<number>`count(*)` })
					.from(user)
					.where(eq(user.role, "super_admin"));

				if (Number(superAdminCount ?? 0) <= 1) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Cannot delete the last super admin account",
					});
				}
			}

			// Admins can delete agent/team_lead only. Only super_admin can delete admin accounts.
			if (ctx.userRole !== "super_admin" && target.role === "admin") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only super admins can delete admin accounts",
				});
			}

			await db.transaction(async (tx) => {
				// Remove audit / report records that have restrictive FKs to user.id.
				await tx.delete(reports).where(eq(reports.generatedBy, input.agentId));
				await tx
					.delete(approvalWorkflowHistory)
					.where(eq(approvalWorkflowHistory.actionBy, input.agentId));
				await tx
					.delete(approvalTemplates)
					.where(eq(approvalTemplates.createdBy, input.agentId));
				await tx
					.delete(commissionAuditLog)
					.where(eq(commissionAuditLog.changedBy, input.agentId));

				// Null-out optional references (avoid FK constraint blocks).
				await tx
					.update(commissionApprovals)
					.set({ reviewedBy: null })
					.where(eq(commissionApprovals.reviewedBy, input.agentId));

				await tx
					.update(transactions)
					.set({ teamLeaderAgentId: null })
					.where(eq(transactions.teamLeaderAgentId, input.agentId));

				// Auth-core tables mostly cascade on user delete, but we delete explicitly for clarity.
				await tx.delete(user).where(eq(user.id, input.agentId));
			});

			invalidateUserCache(input.agentId);
			return { ok: true, deletedId: input.agentId, deletedEmail: target.email };
		}),

	// Get agent performance metrics
	getPerformance: adminProcedure
		.input(agentPerformanceInput)
		.query(async ({ input }) => {
			const conditions = [eq(performanceMetrics.agentId, input.agentId)];

			if (input.startDate) {
				conditions.push(gte(performanceMetrics.periodStart, input.startDate));
			}
			if (input.endDate) {
				conditions.push(lte(performanceMetrics.periodEnd, input.endDate));
			}
			if (input.periodType) {
				conditions.push(eq(performanceMetrics.periodType, input.periodType));
			}

			const metrics = await db
				.select()
				.from(performanceMetrics)
				.where(and(...conditions))
				.orderBy(desc(performanceMetrics.periodStart));

			// Get transaction summary
			const transactionConditions = [eq(transactions.agentId, input.agentId)];
			if (input.startDate) {
				transactionConditions.push(
					gte(transactions.createdAt, input.startDate),
				);
			}
			if (input.endDate) {
				transactionConditions.push(lte(transactions.createdAt, input.endDate));
			}

			const [transactionSummary] = await db
				.select({
					totalTransactions: sql<number>`count(*)`,
					completedTransactions: sql<number>`count(*) filter (where status = 'completed')`,
					pendingTransactions: sql<number>`count(*) filter (where status in ('draft', 'submitted', 'under_review'))`,
					totalCommissionAmount: sql<number>`sum(cast(commission_amount as decimal))`,
					averageCommissionAmount: sql<number>`avg(cast(commission_amount as decimal))`,
				})
				.from(transactions)
				.where(and(...transactionConditions));

			return {
				metrics,
				transactionSummary,
			};
		}),

	// Create goal for agent (admin only)
	createGoal: adminProcedure
		.input(createGoalInput)
		.mutation(async ({ ctx, input }) => {
			const [goal] = await db
				.insert(agentGoals)
				.values({
					...input,
					targetValue: input.targetValue.toString(),
					createdBy: ctx.session.user.id,
				})
				.returning();

			return goal;
		}),

	// Bulk actions on agents (admin only)
	bulkAction: adminProcedure
		.input(bulkAgentActionInput)
		.mutation(async ({ ctx, input }) => {
			const { agentIds, action, actionData } = input;

			// Verify agents exist
			const agents = await db
				.select()
				.from(user)
				.where(inArray(user.id, agentIds));

			if (agents.length !== agentIds.length) {
				throw new Error("Some agents not found");
			}

			const updateData: Record<string, unknown> & {
				updatedAt: Date;
				agentTier?: AgentTier;
				companyCommissionSplit?: number;
			} = { updatedAt: new Date() };
			let tierHistoryEntries: Array<{
				agentId: string;
				previousTier: AgentTier | null;
				newTier: AgentTier;
				promotedBy: string;
				reason: string;
				effectiveDate: Date;
			}> = [];

			switch (action) {
				case "change_tier":
					if (!actionData?.agentTier) {
						throw new Error("Agent tier is required for tier change");
					}
					updateData.agentTier = actionData.agentTier as AgentTier;

					// Create tier history entries
					tierHistoryEntries = agents
						.filter((agent) => agent.agentTier !== actionData.agentTier)
						.map((agent) => ({
							agentId: agent.id,
							previousTier: agent.agentTier,
							newTier: actionData.agentTier as AgentTier,
							promotedBy: ctx.session.user.id,
							reason: actionData.reason || "Bulk tier change",
							effectiveDate: new Date(),
						}));
					break;

				case "assign_team":
					if (!actionData?.teamId) {
						throw new Error("Team ID is required for team assignment");
					}
					updateData.teamId = actionData.teamId;
					break;

				default:
					throw new Error("Invalid bulk action");
			}

			// Update agents
			const updatedAgents = await db
				.update(user)
				.set(updateData)
				.where(inArray(user.id, agentIds))
				.returning();

			// Insert tier history if applicable
			if (tierHistoryEntries.length > 0) {
				await db.insert(agentTierHistory).values(tierHistoryEntries);
			}

			return {
				updatedCount: updatedAgents.length,
				agents: updatedAgents,
			};
		}),

	// Get agent statistics (admin only)
	getStats: adminProcedure.query(async () => {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfYear = new Date(now.getFullYear(), 0, 1);

		// Overall agent stats
		const [agentStats] = await db
			.select({
				totalAgents: sql<number>`count(*)`,
				activeAgents: sql<number>`count(*) filter (where role = 'agent' and is_active = true)`,
				teamLeads: sql<number>`count(*) filter (where role = 'team_lead')`,
				admins: sql<number>`count(*) filter (where role = 'admin')`,
				superAdmins: sql<number>`count(*) filter (where role = 'super_admin')`,
				monthlyAgents: sql<number>`count(*) filter (where role in ('agent', 'team_lead') and created_at >= ${startOfMonth})`,
				yearlyAgents: sql<number>`count(*) filter (where role in ('agent', 'team_lead') and created_at >= ${startOfYear})`,
				pendingApprovals: sql<number>`count(*) filter (where agent_status = 'pending_approval')`,
				gentingAgents: sql<number>`count(*) filter (where role = 'agent' and branch = 'GENTING')`,
				puchongAgents: sql<number>`count(*) filter (where role = 'agent' and branch = 'PUCHONG')`,
			})
			.from(user);

		// Tier distribution
		const tierDistribution = await db
			.select({
				tier: user.agentTier,
				count: sql<number>`count(*)`,
			})
			.from(user)
			.where(eq(user.role, "agent"))
			.groupBy(user.agentTier);

		// Team distribution
		const teamDistribution = await db
			.select({
				teamId: user.teamId,
				teamName: teams.name,
				agentCount: sql<number>`count(*)`,
			})
			.from(user)
			.leftJoin(teams, eq(user.teamId, teams.id))
			.where(eq(user.role, "agent"))
			.groupBy(user.teamId, teams.name);

		return {
			...agentStats,
			tierDistribution,
			teamDistribution,
			tierConfig: AGENT_TIER_CONFIG,
		};
	}),

	// Get my profile (for any authenticated user)
	getMyProfile: protectedProcedure.query(async ({ ctx }) => {
		const [profileData] = await db
			.select({
				agent: user,
				team: teams,
				agency: agencies,
			})
			.from(user)
			.leftJoin(teams, eq(user.teamId, teams.id))
			.leftJoin(agencies, eq(user.agencyId, agencies.id))
			.where(eq(user.id, ctx.session.user.id))
			.limit(1);

		if (!profileData) {
			throw new Error("Profile not found");
		}

		// Get my goals
		const myGoals = await db
			.select()
			.from(agentGoals)
			.where(
				and(
					eq(agentGoals.agentId, ctx.session.user.id),
					eq(agentGoals.isActive, true),
				),
			)
			.orderBy(desc(agentGoals.createdAt));

		// Get my recent performance
		const [recentPerformance] = await db
			.select()
			.from(performanceMetrics)
			.where(
				and(
					eq(performanceMetrics.agentId, ctx.session.user.id),
					eq(performanceMetrics.periodType, "monthly"),
				),
			)
			.orderBy(desc(performanceMetrics.periodStart))
			.limit(1);

		return {
			...profileData,
			goals: myGoals,
			recentPerformance,
		};
	}),

	// Update my profile (for any authenticated user)
	updateMyProfile: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(200).optional(),
				image: z.union([profileImageInput, z.literal(""), z.null()]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const patch: {
				name?: string;
				image?: string | null;
				updatedAt: Date;
			} = { updatedAt: new Date() };
			if (input.name !== undefined) patch.name = input.name;
			if (input.image !== undefined) {
				patch.image = input.image === "" ? null : input.image;
			}

			const [updatedUser] = await db
				.update(user)
				.set(patch)
				.where(eq(user.id, ctx.session.user.id))
				.returning();

			if (!updatedUser) {
				throw new Error("Failed to update profile");
			}

			return updatedUser;
		}),
});
