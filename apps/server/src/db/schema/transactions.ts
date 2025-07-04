import {
	boolean,
	decimal,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

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
	"approved",
	"rejected",
	"completed",
]);

// Main transactions table
export const transactions = pgTable("transactions", {
	id: uuid("id").primaryKey().defaultRandom(),
	agentId: text("agent_id").notNull(), // Will be linked to user ID from auth

	// Step 1: Initiation
	marketType: marketTypeEnum("market_type").notNull(),
	transactionType: transactionTypeEnum("transaction_type").notNull(),
	transactionDate: timestamp("transaction_date").notNull(),

	// Step 2: Property
	propertyData: jsonb("property_data").$type<{
		address: string;
		propertyType: string;
		bedrooms?: number;
		bathrooms?: number;
		area?: number;
		price: number;
		description?: string;
	}>(),

	// Step 3: Client
	clientData: jsonb("client_data").$type<{
		name: string;
		email: string;
		phone: string;
		type: "buyer" | "seller" | "tenant" | "landlord";
		source: string;
		notes?: string;
	}>(),

	// Step 4: Co-Broking
	isCoBroking: boolean("is_co_broking").default(false),
	coBrokingData: jsonb("co_broking_data").$type<{
		agentName: string;
		agencyName: string;
		commissionSplit: number;
		contactInfo: string;
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
	submittedAt: timestamp("submitted_at"),
	reviewedAt: timestamp("reviewed_at"),
	reviewedBy: text("reviewed_by"),
	reviewNotes: text("review_notes"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertTransactionSchema = z.object({
	agentId: z.string(),
	marketType: z.enum(["primary", "secondary"]),
	transactionType: z.enum(["sale", "lease", "rental"]),
	transactionDate: z.coerce.date(),
	propertyData: z
		.object({
			address: z.string().min(1, "Address is required"),
			propertyType: z.string().min(1, "Property type is required"),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number().positive("Price must be positive"),
			description: z.string().optional(),
		})
		.optional(),
	clientData: z
		.object({
			name: z.string().min(1, "Client name is required"),
			email: z.string().email("Valid email is required"),
			phone: z.string().min(1, "Phone number is required"),
			type: z.enum(["buyer", "seller", "tenant", "landlord"]),
			source: z.string().min(1, "Client source is required"),
			notes: z.string().optional(),
		})
		.optional(),
	isCoBroking: z.boolean().default(false),
	coBrokingData: z
		.object({
			agentName: z.string().min(1, "Agent name is required"),
			agencyName: z.string().min(1, "Agency name is required"),
			commissionSplit: z
				.number()
				.min(0)
				.max(100, "Commission split must be between 0-100%"),
			contactInfo: z.string().min(1, "Contact info is required"),
		})
		.optional(),
	commissionType: z.enum(["percentage", "fixed"]),
	commissionValue: z.coerce.number().positive(),
	commissionAmount: z.coerce.number().positive(),
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
			"approved",
			"rejected",
			"completed",
		])
		.default("draft"),
});

export const selectTransactionSchema = z.object({
	id: z.string(),
	agentId: z.string(),
	marketType: z.enum(["primary", "secondary"]),
	transactionType: z.enum(["sale", "lease", "rental"]),
	transactionDate: z.date(),
	propertyData: z
		.object({
			address: z.string(),
			propertyType: z.string(),
			bedrooms: z.number().optional(),
			bathrooms: z.number().optional(),
			area: z.number().optional(),
			price: z.number(),
			description: z.string().optional(),
		})
		.nullable(),
	clientData: z
		.object({
			name: z.string(),
			email: z.string(),
			phone: z.string(),
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
		"approved",
		"rejected",
		"completed",
	]),
	submittedAt: z.date().nullable(),
	reviewedAt: z.date().nullable(),
	reviewedBy: z.string().nullable(),
	reviewNotes: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Type exports
export type Transaction = z.infer<typeof selectTransactionSchema>;
export type NewTransaction = z.infer<typeof insertTransactionSchema>;
export type TransactionStatus = Transaction["status"];
export type MarketType = Transaction["marketType"];
export type TransactionType = Transaction["transactionType"];
export type ClientType = NonNullable<Transaction["clientData"]>["type"];
export type CommissionType = Transaction["commissionType"];
