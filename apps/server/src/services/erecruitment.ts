import { hashPassword } from "../utils/password";
import { and, desc, eq, sql } from "drizzle-orm";
import { account, user } from "../models/auth";
import {
	erecruitmentApplications,
	erecruitmentLinks,
	type ERecruitmentDocumentFile,
	type ERecruitmentDocuments,
} from "../models/erecruitment";
import { getNextAgentCode } from "./sequential-codes";
import { db } from "../utils/db";
import { supabaseAdmin } from "../utils/supabase";

const LINK_VALID_DAYS = 30;

function generateToken(): string {
	return crypto.randomUUID().replace(/-/g, "");
}

const RECRUITMENT_DOCS_BUCKET = "transaction-documents";

function extractRecruitmentStoragePath(url: string | undefined): string | null {
	if (!url) return null;
	const marker = `/${RECRUITMENT_DOCS_BUCKET}/`;
	const idx = url.indexOf(marker);
	if (idx === -1) return null;
	const path = url.slice(idx + marker.length).split("?")[0];
	return path ? decodeURIComponent(path) : null;
}

async function resolveDocumentUrl(
	file: ERecruitmentDocumentFile | undefined,
): Promise<ERecruitmentDocumentFile | undefined> {
	if (!file) return undefined;
	if (file.dataUrl) return file;

	const storagePath =
		file.storagePath || extractRecruitmentStoragePath(file.url);
	if (storagePath && supabaseAdmin) {
		const { data, error } = await supabaseAdmin.storage
			.from(RECRUITMENT_DOCS_BUCKET)
			.createSignedUrl(storagePath, 3600);
		if (!error && data?.signedUrl) {
			return { ...file, storagePath, url: data.signedUrl };
		}
	}

	return file.url ? file : undefined;
}

async function enrichRecruitmentDocuments(
	docs: ERecruitmentDocuments | null | undefined,
): Promise<ERecruitmentDocuments> {
	if (!docs) return {};
	const [icFront, icBack, registrationFeeReceipt] = await Promise.all([
		resolveDocumentUrl(docs.icFront),
		resolveDocumentUrl(docs.icBack),
		resolveDocumentUrl(docs.registrationFeeReceipt),
	]);
	return {
		...(icFront ? { icFront } : {}),
		...(icBack ? { icBack } : {}),
		...(registrationFeeReceipt ? { registrationFeeReceipt } : {}),
	};
}

const ONBOARDING_DOC_CATEGORIES = [
	"icFront",
	"icBack",
	"registrationFeeReceipt",
] as const;

/** Persist stable document refs onto the agent (prefer storagePath; drop short-lived signed URLs). */
export function normalizeOnboardingDocuments(
	docs: ERecruitmentDocuments | null | undefined,
): ERecruitmentDocuments | null {
	if (!docs) return null;

	const stored: ERecruitmentDocuments = {};
	for (const category of ONBOARDING_DOC_CATEGORIES) {
		const file = docs[category];
		if (!file?.fileName || !file.fileType) continue;
		if (!file.storagePath && !file.dataUrl && !file.url) continue;

		const uploadedAt = file.uploadedAt || new Date().toISOString();
		const storagePath =
			file.storagePath || extractRecruitmentStoragePath(file.url);
		if (storagePath) {
			stored[category] = {
				fileName: file.fileName,
				fileType: file.fileType,
				storagePath,
				uploadedAt,
			};
			continue;
		}
		if (file.dataUrl) {
			stored[category] = {
				fileName: file.fileName,
				fileType: file.fileType,
				dataUrl: file.dataUrl,
				uploadedAt,
			};
			continue;
		}
		stored[category] = {
			fileName: file.fileName,
			fileType: file.fileType,
			url: file.url,
			uploadedAt,
		};
	}

	return Object.keys(stored).length > 0 ? stored : null;
}

type RecruitmentApplicationRow = typeof erecruitmentApplications.$inferSelect;

function agentProfileFieldsFromApplication(application: RecruitmentApplicationRow) {
	return {
		name: application.fullName.trim(),
		phone: application.contactNo?.trim() || null,
		nickName: application.nickName?.trim() || null,
		nric: application.nric?.trim() || null,
		registrationFee: application.registrationFee?.trim() || null,
		paymentMethod: application.paymentMethod?.trim() || null,
		address: application.address?.trim() || null,
		maritalStatus: application.maritalStatus?.trim() || null,
		emergencyName: application.emergencyName?.trim() || null,
		emergencyContactNo: application.emergencyContactNo?.trim() || null,
		emergencyRelationship: application.emergencyRelationship?.trim() || null,
		bankName: application.bankName?.trim() || null,
		bankAccountNo: application.bankAccountNo?.trim() || null,
		bankAccountName: application.bankAccountName?.trim() || null,
		incomeTaxNo: application.incomeTaxNo?.trim() || null,
		onboardingDocuments: normalizeOnboardingDocuments(application.documents),
	};
}

function hasOnboardingDoc(
	docs: ERecruitmentDocuments | null | undefined,
	category: (typeof ONBOARDING_DOC_CATEGORIES)[number],
) {
	const file = docs?.[category];
	return Boolean(file?.storagePath || file?.dataUrl || file?.url);
}

/** Fill missing agent profile fields/docs from a linked approved eRecruitment application. */
export async function syncAgentProfileFromRecruitmentUserId(userId: string) {
	const [application] = await db
		.select()
		.from(erecruitmentApplications)
		.where(
			and(
				eq(erecruitmentApplications.createdUserId, userId),
				eq(erecruitmentApplications.status, "approved"),
			),
		)
		.orderBy(desc(erecruitmentApplications.reviewedAt))
		.limit(1);

	if (!application) return null;

	const [agent] = await db
		.select()
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!agent) return null;

	const fromApp = agentProfileFieldsFromApplication(application);
	const appDocs = fromApp.onboardingDocuments;
	const existingDocs = (agent.onboardingDocuments ?? {}) as ERecruitmentDocuments;
	const mergedDocs: ERecruitmentDocuments = {
		icFront: hasOnboardingDoc(existingDocs, "icFront")
			? existingDocs.icFront
			: appDocs?.icFront,
		icBack: hasOnboardingDoc(existingDocs, "icBack")
			? existingDocs.icBack
			: appDocs?.icBack,
		registrationFeeReceipt: hasOnboardingDoc(existingDocs, "registrationFeeReceipt")
			? existingDocs.registrationFeeReceipt
			: appDocs?.registrationFeeReceipt,
	};
	const onboardingDocuments = Object.values(mergedDocs).some(Boolean)
		? {
				...(mergedDocs.icFront ? { icFront: mergedDocs.icFront } : {}),
				...(mergedDocs.icBack ? { icBack: mergedDocs.icBack } : {}),
				...(mergedDocs.registrationFeeReceipt
					? { registrationFeeReceipt: mergedDocs.registrationFeeReceipt }
					: {}),
			}
		: agent.onboardingDocuments;

	const patch = {
		name: agent.name?.trim() ? agent.name : fromApp.name,
		phone: agent.phone?.trim() ? agent.phone : fromApp.phone,
		nickName: agent.nickName?.trim() ? agent.nickName : fromApp.nickName,
		nric: agent.nric?.trim() ? agent.nric : fromApp.nric,
		registrationFee: agent.registrationFee?.trim()
			? agent.registrationFee
			: fromApp.registrationFee,
		paymentMethod: agent.paymentMethod?.trim()
			? agent.paymentMethod
			: fromApp.paymentMethod,
		address: agent.address?.trim() ? agent.address : fromApp.address,
		maritalStatus: agent.maritalStatus?.trim()
			? agent.maritalStatus
			: fromApp.maritalStatus,
		emergencyName: agent.emergencyName?.trim()
			? agent.emergencyName
			: fromApp.emergencyName,
		emergencyContactNo: agent.emergencyContactNo?.trim()
			? agent.emergencyContactNo
			: fromApp.emergencyContactNo,
		emergencyRelationship: agent.emergencyRelationship?.trim()
			? agent.emergencyRelationship
			: fromApp.emergencyRelationship,
		bankName: agent.bankName?.trim() ? agent.bankName : fromApp.bankName,
		bankAccountNo: agent.bankAccountNo?.trim()
			? agent.bankAccountNo
			: fromApp.bankAccountNo,
		bankAccountName: agent.bankAccountName?.trim()
			? agent.bankAccountName
			: fromApp.bankAccountName,
		incomeTaxNo: agent.incomeTaxNo?.trim()
			? agent.incomeTaxNo
			: fromApp.incomeTaxNo,
		onboardingDocuments,
		updatedAt: new Date(),
	};

	const unchanged =
		patch.nickName === agent.nickName &&
		patch.nric === agent.nric &&
		patch.registrationFee === agent.registrationFee &&
		patch.paymentMethod === agent.paymentMethod &&
		patch.address === agent.address &&
		patch.maritalStatus === agent.maritalStatus &&
		patch.emergencyName === agent.emergencyName &&
		patch.emergencyContactNo === agent.emergencyContactNo &&
		patch.emergencyRelationship === agent.emergencyRelationship &&
		patch.bankAccountName === agent.bankAccountName &&
		patch.incomeTaxNo === agent.incomeTaxNo &&
		JSON.stringify(patch.onboardingDocuments ?? null) ===
			JSON.stringify(agent.onboardingDocuments ?? null) &&
		patch.phone === agent.phone &&
		patch.bankName === agent.bankName &&
		patch.bankAccountNo === agent.bankAccountNo;

	if (unchanged) return agent;

	const [updated] = await db
		.update(user)
		.set(patch)
		.where(eq(user.id, userId))
		.returning();

	return updated ?? null;
}

/** Backfill all approved eRecruitment agents that are missing copied profile/docs. */
export async function backfillApprovedAgentProfiles() {
	const rows = await db
		.select({
			id: erecruitmentApplications.id,
			createdUserId: erecruitmentApplications.createdUserId,
		})
		.from(erecruitmentApplications)
		.where(
			and(
				eq(erecruitmentApplications.status, "approved"),
				sql`${erecruitmentApplications.createdUserId} IS NOT NULL`,
			),
		);

	let synced = 0;
	for (const row of rows) {
		if (!row.createdUserId) continue;
		const updated = await syncAgentProfileFromRecruitmentUserId(row.createdUserId);
		if (updated) synced += 1;
	}

	return { total: rows.length, synced };
}

async function assertAgentCodeAvailable(
	agentCode: string,
	excludeUserId?: string,
) {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.agentCode, agentCode))
		.limit(1);
	if (existing && existing.id !== excludeUserId) {
		throw new Error("Agent code is already in use");
	}
}

export async function resolveRecruitmentLink(token: string) {
	const [link] = await db
		.select()
		.from(erecruitmentLinks)
		.where(eq(erecruitmentLinks.token, token))
		.limit(1);

	if (!link) return null;
	if (link.isUsed) return { ...link, expired: true, reason: "used" as const };
	if (link.expiresAt < new Date())
		return { ...link, expired: true, reason: "expired" as const };

	const [existingApp] = await db
		.select({ id: erecruitmentApplications.id })
		.from(erecruitmentApplications)
		.where(eq(erecruitmentApplications.linkId, link.id))
		.limit(1);

	if (existingApp) return { ...link, expired: true, reason: "submitted" as const };

	return { ...link, expired: false, reason: null };
}

export async function createRecruitmentLink(opts: {
	recruiterId: string;
	recruiterName: string;
	inviteeName?: string;
	inviteeEmail?: string;
}) {
	const token = generateToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + LINK_VALID_DAYS);

	const [link] = await db
		.insert(erecruitmentLinks)
		.values({
			token,
			recruiterId: opts.recruiterId,
			recruiterName: opts.recruiterName,
			inviteeName: opts.inviteeName?.trim() || null,
			inviteeEmail: opts.inviteeEmail?.trim().toLowerCase() || null,
			expiresAt,
		})
		.returning();

	return link;
}

export async function uploadRecruitmentDocument(opts: {
	token: string;
	category: "icFront" | "icBack" | "registrationFeeReceipt";
	fileName: string;
	fileType: string;
	fileSize: number;
	base64Data: string;
}) {
	const link = await resolveRecruitmentLink(opts.token);
	if (!link || link.expired) {
		throw new Error("This recruitment link is invalid or has expired");
	}

	if (opts.fileSize > 10 * 1024 * 1024) {
		throw new Error("File must be under 10MB");
	}

	const base64 = opts.base64Data.replace(/^data:[^;]+;base64,/, "");
	const fileBuffer = Buffer.from(base64, "base64");
	const uniqueFileName = `${Date.now()}-${opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
	const storagePath = `erecruitment/${opts.token}/${opts.category}/${uniqueFileName}`;
	const uploadedAt = new Date().toISOString();

	if (supabaseAdmin) {
		const { error } = await supabaseAdmin.storage
			.from(RECRUITMENT_DOCS_BUCKET)
			.upload(storagePath, fileBuffer, {
				contentType: opts.fileType,
				upsert: false,
			});

		if (error) {
			throw new Error(`Upload failed: ${error.message}`);
		}

		return {
			fileName: opts.fileName,
			fileType: opts.fileType,
			storagePath,
			uploadedAt,
		};
	}

	return {
		fileName: opts.fileName,
		fileType: opts.fileType,
		dataUrl: opts.base64Data.startsWith("data:")
			? opts.base64Data
			: `data:${opts.fileType};base64,${base64}`,
		uploadedAt,
	};
}

export async function submitRecruitmentApplication(
	input: {
		token: string;
		fullName: string;
		nickName?: string;
		nric: string;
		email: string;
		registrationFee?: string;
		paymentMethod?: string;
		address?: string;
		contactNo?: string;
		maritalStatus?: string;
		emergencyName?: string;
		emergencyContactNo?: string;
		emergencyRelationship?: string;
		bankName?: string;
		bankAccountNo?: string;
		bankAccountName?: string;
		incomeTaxNo?: string;
		documents?: ERecruitmentDocuments;
		acceptedCompanyPolicy: boolean;
		acceptedNda: boolean;
	},
) {
	const link = await resolveRecruitmentLink(input.token);
	if (!link || link.expired) {
		throw new Error("This recruitment link is invalid or has expired");
	}

	const now = new Date();
	const [application] = await db
		.insert(erecruitmentApplications)
		.values({
			linkId: link.id,
			recruiterId: link.recruiterId,
			recruiterName: link.recruiterName,
			status: "pending_review",
			fullName: input.fullName.trim(),
			nickName: input.nickName?.trim() || null,
			nric: input.nric.trim(),
			email: input.email.trim().toLowerCase(),
			registrationFee: input.registrationFee?.trim() || null,
			paymentMethod: input.paymentMethod?.trim() || null,
			address: input.address?.trim() || null,
			contactNo: input.contactNo?.trim() || null,
			maritalStatus: input.maritalStatus?.trim() || null,
			emergencyName: input.emergencyName?.trim() || null,
			emergencyContactNo: input.emergencyContactNo?.trim() || null,
			emergencyRelationship: input.emergencyRelationship?.trim() || null,
			bankName: input.bankName?.trim() || null,
			bankAccountNo: input.bankAccountNo?.trim() || null,
			bankAccountName: input.bankAccountName?.trim() || null,
			incomeTaxNo: input.incomeTaxNo?.trim() || null,
			documents: input.documents ?? {},
			acceptedCompanyPolicy: input.acceptedCompanyPolicy,
			acceptedNda: input.acceptedNda,
			updatedAt: now,
		})
		.returning();

	await db
		.update(erecruitmentLinks)
		.set({ isUsed: true })
		.where(eq(erecruitmentLinks.id, link.id));

	return application;
}

export async function listRecruitmentApplications(opts: {
	status?: "pending_review" | "approved" | "rejected";
	limit?: number;
	offset?: number;
}) {
	const conditions = [];
	if (opts.status) {
		conditions.push(eq(erecruitmentApplications.status, opts.status));
	}

	const rows = await db
		.select()
		.from(erecruitmentApplications)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(erecruitmentApplications.createdAt))
		.limit(opts.limit ?? 50)
		.offset(opts.offset ?? 0);

	return rows;
}

export async function getRecruitmentApplication(id: string) {
	const [row] = await db
		.select()
		.from(erecruitmentApplications)
		.where(eq(erecruitmentApplications.id, id))
		.limit(1);
	if (!row) return null;
	return {
		...row,
		documents: await enrichRecruitmentDocuments(row.documents),
	};
}

export async function approveRecruitmentApplication(opts: {
	applicationId: string;
	reviewerId: string;
	temporaryPassword?: string;
	agentCode?: string;
}) {
	const application = await getRecruitmentApplication(opts.applicationId);
	if (!application) throw new Error("Application not found");
	if (application.status !== "pending_review") {
		throw new Error("Application has already been reviewed");
	}

	const [existingEmail] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, application.email))
		.limit(1);
	if (existingEmail) {
		throw new Error("An account with this email already exists");
	}

	const tempPassword =
		opts.temporaryPassword?.trim() ||
		`Steelix${Math.random().toString(36).slice(2, 10)}!`;
	const passwordHash = await hashPassword(tempPassword);
	const now = new Date();
	const userId = crypto.randomUUID();
	const agentCode =
		opts.agentCode?.trim() || (await getNextAgentCode());
	await assertAgentCodeAvailable(agentCode);

	// Re-read raw row so document refs stay durable (not short-lived signed URLs)
	const [rawApplication] = await db
		.select()
		.from(erecruitmentApplications)
		.where(eq(erecruitmentApplications.id, application.id))
		.limit(1);
	if (!rawApplication) throw new Error("Application not found");

	const profile = agentProfileFieldsFromApplication(rawApplication);

	const [createdUser] = await db
		.insert(user)
		.values({
			id: userId,
			name: profile.name,
			email: application.email,
			phone: profile.phone,
			nickName: profile.nickName,
			nric: profile.nric,
			registrationFee: profile.registrationFee,
			paymentMethod: profile.paymentMethod,
			address: profile.address,
			maritalStatus: profile.maritalStatus,
			emergencyName: profile.emergencyName,
			emergencyContactNo: profile.emergencyContactNo,
			emergencyRelationship: profile.emergencyRelationship,
			bankName: profile.bankName,
			bankAccountNo: profile.bankAccountNo,
			bankAccountName: profile.bankAccountName,
			incomeTaxNo: profile.incomeTaxNo,
			onboardingDocuments: profile.onboardingDocuments,
			emailVerified: false,
			image: null,
			isActive: true,
			deactivatedAt: null,
			role: "agent",
			permissions: null,
			agentTier: "advisor",
			companyCommissionSplit: 70,
			tierEffectiveDate: now,
			tierPromotedBy: opts.reviewerId,
			recruitedBy: application.recruiterId,
			recruitedAt: now,
			agentCode,
			agentStatus: "active",
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	await db.insert(account).values({
		id: crypto.randomUUID(),
		accountId: application.email,
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

	const [updated] = await db
		.update(erecruitmentApplications)
		.set({
			status: "approved",
			reviewedBy: opts.reviewerId,
			reviewedAt: now,
			createdUserId: userId,
			updatedAt: now,
		})
		.where(eq(erecruitmentApplications.id, application.id))
		.returning();

	return {
		application: updated,
		user: createdUser,
		temporaryPassword: tempPassword,
	};
}

export async function rejectRecruitmentApplication(opts: {
	applicationId: string;
	reviewerId: string;
	reason?: string;
}) {
	const application = await getRecruitmentApplication(opts.applicationId);
	if (!application) throw new Error("Application not found");
	if (application.status !== "pending_review") {
		throw new Error("Application has already been reviewed");
	}

	const now = new Date();
	const [updated] = await db
		.update(erecruitmentApplications)
		.set({
			status: "rejected",
			reviewedBy: opts.reviewerId,
			reviewedAt: now,
			rejectionReason: opts.reason?.trim() || null,
			updatedAt: now,
		})
		.where(eq(erecruitmentApplications.id, application.id))
		.returning();

	return updated;
}

export async function listRecruitmentLinks(opts: {
	recruiterId?: string;
	limit?: number;
}) {
	const conditions = [];
	if (opts.recruiterId) {
		conditions.push(eq(erecruitmentLinks.recruiterId, opts.recruiterId));
	}

	return db
		.select()
		.from(erecruitmentLinks)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(erecruitmentLinks.createdAt))
		.limit(opts.limit ?? 20);
}
