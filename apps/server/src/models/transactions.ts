import {
	bigint,
	boolean,
	decimal,
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

// Enums for transaction types
export const marketTypeEnum = pgEnum("market_type", ["primary", "secondary"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
	"sale",
	"lease",
	"rental",
]);
export const clientTypeEnum = pgEnum("client_type", [
	"buyer",
	"seller",
	"tenant",
	"landlord",
]);
export const commissionTypeEnum = pgEnum("commission_type", [
	"percentage",
	"fixed",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
	"draft",
	"submitted",
	"under_review",
	"pending",
	"verified",
	"approved",
	"commission_released",
	"completed",
	"cancelled",
	"rejected",
	"converted",
	"revoke",
]);

// Document category enum for file uploads
export const documentCategoryEnum = pgEnum("document_category", [
	"contract",
	"identification",
	"financial",
	"miscellaneous",
	"ic_passport",
	"sales_form",
	"bank_letter",
	"payment_proof",
	"other",
]);

// Main transactions table
export const transactions = pgTable("transactions", {
	id: uuid("id").primaryKey().defaultRandom(),
	/** Client-facing sequential case number e.g. P000711 */
	caseNo: text("case_no").unique(),
	agentId: text("agent_id").notNull(), // Will be linked to user ID from auth
	/** Optional team leader receiving override commission line (Prompt 06) */
	teamLeaderAgentId: text("team_leader_agent_id").references(() => user.id),

	// Step 1: Initiation
	marketType: marketTypeEnum("market_type").notNull(),
	transactionType: transactionTypeEnum("transaction_type").notNull(),
	transactionDate: timestamp("transaction_date").notNull(),

	// Prompt 05: booking + unit identifiers (stored denormalized for fast filtering/reporting)
	bookingDate: timestamp("booking_date"),
	projectName: text("project_name"),
	unitNo: text("unit_no"),
	/** Reuse listings as "block" reference (commission schemes already link to this) */
	blockListingId: uuid("block_listing_id"),

	// Step 2: Property
	propertyData: jsonb("property_data").$type<{
		address?: string;
		propertyType?: string;
		listingId?: string;
		listingTitle?: string;
		schemeId?: string;
		salesPackage?: string;
		rebateAmount?: number;
		purchasingMethod?: "cash" | "loan";
		sstPayBy?: "landlord" | "agent";
		listingReferralShareType?: "percentage" | "fixed";
		listingReferralShareValue?: number;
		bedrooms?: number;
		bathrooms?: number;
		area?: number;
		price: number;
		spaPrice?: number;
		nettPrice?: number;
		description?: string;
	}>(),

	// Step 3: Client / purchaser
	clientData: jsonb("client_data").$type<{
		name: string;
		icNo?: string;
		email?: string;
		phone: string;
		address?: string;
		race?: string;
		nationality?: string;
		gender?: string;
		emergencyName?: string;
		emergencyContact?: string;
		coBuyerName?: string;
		coBuyerIc?: string;
		type?: "buyer" | "seller" | "tenant" | "landlord";
		source?: string;
		notes?: string;
	}>(),

	// Step 4: Co-Broking
	representationType: text("representation_type").default("direct"),
	isCoBroking: boolean("is_co_broking").default(false),
	coBrokingData: jsonb("co_broking_data").$type<{
		internalAgentId?: string;
		agentName?: string;
		agencyName?: string;
		commissionSplit?: number;
		contactInfo?: string;
		agentEmail?: string;
		agentPhone?: string;
	}>(),

	// Step 5: Commission
	commissionType: commissionTypeEnum("commission_type").notNull(),
	commissionValue: decimal("commission_value", {
		precision: 10,
		scale: 2,
	}).notNull(),
	commissionAmount: decimal("commission_amount", {
		precision: 10,
		scale: 2,
	}).notNull(),

	/**
	 * Commission scheme snapshot (locked at submission/approval time).
	 * Stored for audit + ensures scheme edits don't retroactively change historical transactions.
	 */
	commissionSchemeSnapshot: jsonb("commission_scheme_snapshot").$type<{
		schemeId: string;
		schemeName: string;
		shortform: string;
		projectName: string;
		blockListingId: string | null;
		blockListingTitle: string | null;
		tierId: string;
		tierName: string;
		commissionPercent: number;
		overridePercent: number;
		incSst: boolean;
		sstPercent: number;
		sstBorneBy: "client" | "agent";
		lockedAt: string;
	}>(),
	commissionBreakdown: jsonb("commission_breakdown").$type<{
		spaPrice: number;
		nettPrice: number;
		commissionRatePercent: number;
		baseCommission: number;
		grossCommission: number;
		sstPercent: number;
		sstAmount: number;
		agentNetCommission: number;
	}>(),
	/** Admin override to agent net commission (optional) */
	commissionOverrideAgentNet: decimal("commission_override_agent_net", {
		precision: 12,
		scale: 2,
	}),

	// Step 6: Documents
	documents:
		jsonb("documents").$type<
			Array<{
				id: string;
				name: string;
				type: string;
				url: string;
				uploadedAt: string;
			}>
		>(),
	notes: text("notes"),

	// Status and metadata
	status: transactionStatusEnum("status").default("draft"),
	/** When true, agent may edit while status is pending (admin reopened case). */
	agentEditAllowed: boolean("agent_edit_allowed").default(false),
	/** Agent-submitted change request awaiting admin review (locked cases). */
	pendingEditRequest: boolean("pending_edit_request").default(false),
	requestItem: text("request_item"),
	requestSubmittedAt: timestamp("request_submitted_at"),
	submittedAt: timestamp("submitted_at"),
	reviewedAt: timestamp("reviewed_at"),
	reviewedBy: text("reviewed_by"),
	reviewNotes: text("review_notes"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transaction documents table for file metadata
export const transactionDocuments = pgTable(
	"transaction_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => transactions.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(), // References auth.users(id)
		fileName: text("file_name").notNull(),
		fileType: text("file_type").notNull(),
		fileSize: bigint("file_size", { mode: "number" }).notNull(),
		storagePath: text("storage_path").notNull(),
		publicUrl: text("public_url"),
		documentCategory: documentCategoryEnum("document_category").notNull(),
		uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		metadata: jsonb("metadata")
			.$type<{
				originalName?: string;
				uploadedFrom?: string;
				[key: string]: unknown;
			}>()
			.default({}),
	},
	(table) => ({
		transactionIdIdx: index("idx_transaction_documents_transaction_id").on(
			table.transactionId,
		),
		userIdIdx: index("idx_transaction_documents_user_id").on(table.userId),
		categoryIdx: index("idx_transaction_documents_category").on(
			table.documentCategory,
		),
	}),
);

// Zod schemas for validation
export const insertTransactionSchema = z.object({
	caseNo: z.string().optional(),
	agentId: z.string(),
	teamLeaderAgentId: z.string().optional(),
	marketType: z.enum(["primary", "secondary"]),
	transactionType: z.enum(["sale", "lease", "rental"]),
	transactionDate: z.coerce.date(),
	bookingDate: z.coerce.date().optional(),
	projectName: z.string().optional(),
	unitNo: z.string().optional(),
	blockListingId: z.string().uuid().optional(),
	propertyData: z
		.object({
			address: z.string().min(1, "Address is required"),
			propertyType: z.string().min(1, "Property type is required"),
			listingId: z.string().uuid().optional(),
			listingTitle: z.string().optional(),
			listingReferralShareType: z.enum(["percentage", "fixed"]).optional(),
			listingReferralShareValue: z.number().nonnegative().optional(),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number().positive("Price must be positive"),
			spaPrice: z.number().positive().optional(),
			nettPrice: z.number().positive().optional(),
			description: z.string().optional(),
		})
		.optional(),
	clientData: z
		.object({
			name: z.string().min(1, "Client name is required"),
			icNo: z.string().optional(),
			email: z
				.string()
				.email("Valid email is required")
				.optional()
				.or(z.literal("")),
			phone: z.string().min(1, "Phone number is required"),
			address: z.string().optional(),
			coBuyerName: z.string().optional(),
			coBuyerIc: z.string().optional(),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string().min(1, "Client source is required"),
			notes: z.string().optional(),
		})
		.optional(),
	isCoBroking: z.boolean().default(false),
	coBrokingData: z
		.object({
			agentName: z.string().optional(),
			agencyName: z.string().optional(),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%")
				.optional(),
			contactInfo: z.string().optional(),
			agentEmail: z.string().email().optional().or(z.literal("")),
			agentPhone: z.string().optional(),
		})
		.optional(),
	commissionType: z.enum(["percentage", "fixed"]),
	commissionValue: z.coerce.number().positive(),
	commissionAmount: z.coerce.number().positive(),
	commissionOverrideAgentNet: z.coerce.number().optional(),
	documents: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				url: z.string(),
				uploadedAt: z.string(),
			}),
		)
		.optional(),
	notes: z.string().optional(),
	status: z
		.enum([
			"draft",
			"submitted",
			"under_review",
			"pending",
			"verified",
			"approved",
			"commission_released",
			"rejected",
			"completed",
			"cancelled",
		])
		.default("draft"),
});

export const selectTransactionSchema = z.object({
	id: z.string(),
	caseNo: z.string().nullable().optional(),
	agentId: z.string(),
	teamLeaderAgentId: z.string().nullable().optional(),
	marketType: z.enum(["primary", "secondary"]),
	transactionType: z.enum(["sale", "lease", "rental"]),
	transactionDate: z.date(),
	bookingDate: z.date().nullable().optional(),
	projectName: z.string().nullable().optional(),
	unitNo: z.string().nullable().optional(),
	blockListingId: z.string().nullable().optional(),
	propertyData: z
		.object({
			address: z.string(),
			propertyType: z.string(),
			listingId: z.string().optional(),
			listingTitle: z.string().optional(),
			listingReferralShareType: z.enum(["percentage", "fixed"]).optional(),
			listingReferralShareValue: z.number().optional(),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number(),
			spaPrice: z.number().optional(),
			nettPrice: z.number().optional(),
			description: z.string().optional(),
		})
		.nullable(),
	clientData: z
		.object({
			name: z.string(),
			icNo: z.string().optional(),
			email: z.string(),
			phone: z.string(),
			address: z.string().optional(),
			coBuyerName: z.string().optional(),
			coBuyerIc: z.string().optional(),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string(),
			notes: z.string().optional(),
		})
		.nullable(),
	isCoBroking: z.boolean(),
	coBrokingData: z
		.object({
			agentName: z.string(),
			agencyName: z.string(),
			commissionSplit: z.number(),
			contactInfo: z.string(),
		})
		.nullable(),
	commissionType: z.enum(["percentage", "fixed"]),
	commissionValue: z.string(), // Decimal fields come as strings from DB
	commissionAmount: z.string(), // Decimal fields come as strings from DB
	commissionSchemeSnapshot: z
		.object({
			schemeId: z.string(),
			schemeName: z.string(),
			shortform: z.string(),
			projectName: z.string(),
			blockListingId: z.string().nullable(),
			blockListingTitle: z.string().nullable(),
			tierId: z.string(),
			tierName: z.string(),
			commissionPercent: z.number(),
			overridePercent: z.number(),
			incSst: z.boolean(),
			sstPercent: z.number(),
			sstBorneBy: z.enum(["client", "agent"]),
			lockedAt: z.string(),
		})
		.nullable()
		.optional(),
	commissionBreakdown: z
		.object({
			spaPrice: z.number(),
			nettPrice: z.number(),
			commissionRatePercent: z.number(),
			baseCommission: z.number(),
			grossCommission: z.number(),
			sstPercent: z.number(),
			sstAmount: z.number(),
			agentNetCommission: z.number(),
		})
		.nullable()
		.optional(),
	commissionOverrideAgentNet: z.string().nullable().optional(),
	documents: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				url: z.string(),
				uploadedAt: z.string(),
			}),
		)
		.nullable(),
	notes: z.string().nullable(),
	status: z.enum([
		"draft",
		"submitted",
		"under_review",
		"pending",
		"verified",
		"approved",
		"commission_released",
		"rejected",
		"completed",
		"cancelled",
	]),
	submittedAt: z.date().nullable(),
	reviewedAt: z.date().nullable(),
	reviewedBy: z.string().nullable(),
	reviewNotes: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Document schemas
export const insertDocumentSchema = z.object({
	transactionId: z.string().uuid(),
	userId: z.string(),
	fileName: z.string().min(1).max(255),
	fileType: z.string(),
	fileSize: z.number().max(50 * 1024 * 1024), // 50MB limit
	storagePath: z.string(),
	publicUrl: z.string().optional(),
	documentCategory: z.enum([
		"contract",
		"identification",
		"financial",
		"miscellaneous",
	]),
	metadata: z.record(z.any()).optional(),
});

export const selectDocumentSchema = z.object({
	id: z.string(),
	transactionId: z.string(),
	userId: z.string(),
	fileName: z.string(),
	fileType: z.string(),
	fileSize: z.number(),
	storagePath: z.string(),
	publicUrl: z.string().nullable(),
	documentCategory: z.enum([
		"contract",
		"identification",
		"financial",
		"miscellaneous",
	]),
	uploadedAt: z.date(),
	updatedAt: z.date(),
	metadata: z.record(z.any()).nullable(),
});

// Type exports
export type Transaction = z.infer<typeof selectTransactionSchema>;
export type NewTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionDocument = z.infer<typeof selectDocumentSchema>;
export type NewTransactionDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentCategory = TransactionDocument["documentCategory"];
export type TransactionStatus = Transaction["status"];
export type MarketType = Transaction["marketType"];
export type TransactionType = Transaction["transactionType"];
export type ClientType = NonNullable<Transaction["clientData"]>["type"];
export type CommissionType = Transaction["commissionType"];
