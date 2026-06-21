import {
	boolean,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

export const erecruitmentApplicationStatusEnum = pgEnum(
	"erecruitment_application_status",
	["pending_review", "approved", "rejected"],
);

export const erecruitmentLinks = pgTable(
	"erecruitment_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		token: text("token").notNull().unique(),
		recruiterId: text("recruiter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recruiterName: text("recruiter_name").notNull(),
		inviteeName: text("invitee_name"),
		inviteeEmail: text("invitee_email"),
		isUsed: boolean("is_used").notNull().default(false),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => ({
		tokenIdx: index("idx_erecruitment_links_token").on(t.token),
		recruiterIdx: index("idx_erecruitment_links_recruiter_id").on(t.recruiterId),
	}),
);

export const erecruitmentApplications = pgTable(
	"erecruitment_applications",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		linkId: uuid("link_id")
			.notNull()
			.references(() => erecruitmentLinks.id, { onDelete: "cascade" }),
		recruiterId: text("recruiter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recruiterName: text("recruiter_name").notNull(),
		status: erecruitmentApplicationStatusEnum("status")
			.notNull()
			.default("pending_review"),

		fullName: text("full_name").notNull(),
		nickName: text("nick_name"),
		nric: text("nric").notNull(),
		email: text("email").notNull(),
		registrationFee: text("registration_fee"),
		paymentMethod: text("payment_method"),

		address: text("address"),
		contactNo: text("contact_no"),
		maritalStatus: text("marital_status"),

		emergencyName: text("emergency_name"),
		emergencyContactNo: text("emergency_contact_no"),
		emergencyRelationship: text("emergency_relationship"),

		bankName: text("bank_name"),
		bankAccountNo: text("bank_account_no"),
		bankAccountName: text("bank_account_name"),
		incomeTaxNo: text("income_tax_no"),

		documents: jsonb("documents").$type<ERecruitmentDocuments>(),
		acceptedCompanyPolicy: boolean("accepted_company_policy")
			.notNull()
			.default(false),
		acceptedNda: boolean("accepted_nda").notNull().default(false),

		reviewedBy: text("reviewed_by").references(() => user.id),
		reviewedAt: timestamp("reviewed_at"),
		rejectionReason: text("rejection_reason"),
		createdUserId: text("created_user_id").references(() => user.id),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		statusIdx: index("idx_erecruitment_applications_status").on(t.status),
		linkIdx: index("idx_erecruitment_applications_link_id").on(t.linkId),
		recruiterIdx: index("idx_erecruitment_applications_recruiter_id").on(
			t.recruiterId,
		),
	}),
);

export type ERecruitmentDocumentFile = {
	fileName: string;
	fileType: string;
	url?: string;
	storagePath?: string;
	dataUrl?: string;
	uploadedAt: string;
};

export type ERecruitmentDocuments = {
	icFront?: ERecruitmentDocumentFile;
	icBack?: ERecruitmentDocumentFile;
	registrationFeeReceipt?: ERecruitmentDocumentFile;
};

export const erecruitmentSubmitSchema = z.object({
	token: z.string().min(1),
	fullName: z.string().min(1),
	nickName: z.string().optional(),
	nric: z.string().min(1),
	email: z.string().email(),
	registrationFee: z.string().optional(),
	paymentMethod: z.string().optional(),
	address: z.string().optional(),
	contactNo: z.string().optional(),
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
			icFront: z
				.object({
					fileName: z.string(),
					fileType: z.string(),
					url: z.string().optional(),
					storagePath: z.string().optional(),
					dataUrl: z.string().optional(),
					uploadedAt: z.string(),
				})
				.optional(),
			icBack: z
				.object({
					fileName: z.string(),
					fileType: z.string(),
					url: z.string().optional(),
					storagePath: z.string().optional(),
					dataUrl: z.string().optional(),
					uploadedAt: z.string(),
				})
				.optional(),
			registrationFeeReceipt: z
				.object({
					fileName: z.string(),
					fileType: z.string(),
					url: z.string().optional(),
					storagePath: z.string().optional(),
					dataUrl: z.string().optional(),
					uploadedAt: z.string(),
				})
				.optional(),
		})
		.optional(),
	acceptedCompanyPolicy: z.literal(true),
	acceptedNda: z.literal(true),
});
