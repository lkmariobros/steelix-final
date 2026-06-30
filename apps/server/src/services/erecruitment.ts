import { hashPassword } from "better-auth/crypto";
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

async function resolveDocumentUrl(
	file: ERecruitmentDocumentFile | undefined,
): Promise<ERecruitmentDocumentFile | undefined> {
	if (!file) return undefined;
	if (file.dataUrl) return file;

	if (file.storagePath && supabaseAdmin) {
		const { data, error } = await supabaseAdmin.storage
			.from("transaction-documents")
			.createSignedUrl(file.storagePath, 3600);
		if (!error && data?.signedUrl) {
			return { ...file, url: data.signedUrl };
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
			.from("transaction-documents")
			.upload(storagePath, fileBuffer, {
				contentType: opts.fileType,
				upsert: false,
			});

		if (error) {
			throw new Error(`Upload failed: ${error.message}`);
		}

		const { data: urlData } = supabaseAdmin.storage
			.from("transaction-documents")
			.getPublicUrl(storagePath);

		return {
			fileName: opts.fileName,
			fileType: opts.fileType,
			url: urlData.publicUrl,
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

	const [createdUser] = await db
		.insert(user)
		.values({
			id: userId,
			name: application.fullName,
			email: application.email,
			phone: application.contactNo,
			bankName: application.bankName,
			bankAccountNo: application.bankAccountNo,
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
