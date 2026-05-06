import {
	decimal,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";
import { transactions } from "./transactions";

export const commissionPayoutStatusEnum = pgEnum("commission_payout_status", [
	"pending_approval",
	"approved",
	"released",
	"paid",
	"on_hold",
	"voided",
]);

export const commissionPayoutTypeEnum = pgEnum("commission_payout_type", [
	"negotiator",
	"override",
]);

export const payoutPaymentMethodEnum = pgEnum("payout_payment_method", [
	"bank_transfer",
	"cheque",
	"cash",
]);

export type PayoutAuditEntry = {
	at: string;
	byUserId: string;
	byName?: string;
	action: string;
	notes?: string;
};

export const commissionPayouts = pgTable(
	"commission_payouts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => transactions.id, { onDelete: "cascade" }),
		payeeAgentId: text("payee_agent_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		payoutType: commissionPayoutTypeEnum("payout_type")
			.notNull()
			.default("negotiator"),
		status: commissionPayoutStatusEnum("status")
			.notNull()
			.default("pending_approval"),

		caseNo: text("case_no"),
		projectName: text("project_name"),
		blockLabel: text("block_label"),
		unitNo: text("unit_no"),
		bookingDate: timestamp("booking_date"),

		spaPrice: decimal("spa_price", { precision: 14, scale: 2 }),
		nettPrice: decimal("nett_price", { precision: 14, scale: 2 }).notNull(),
		commissionPercent: decimal("commission_percent", {
			precision: 7,
			scale: 4,
		}).notNull(),
		grossCommission: decimal("gross_commission", {
			precision: 14,
			scale: 2,
		}).notNull(),
		sstAmount: decimal("sst_amount", { precision: 14, scale: 2 })
			.notNull()
			.default("0"),
		netCommission: decimal("net_commission", { precision: 14, scale: 2 }).notNull(),

		commissionSchemeSnapshot: jsonb("commission_scheme_snapshot"),
		claimStageLabel: text("claim_stage_label"),
		claimStagePercent: decimal("claim_stage_percent", {
			precision: 7,
			scale: 4,
		}),

		paymentMethod: payoutPaymentMethodEnum("payment_method"),
		paymentBankName: text("payment_bank_name"),
		paymentBankAccountNo: text("payment_bank_account_no"),
		paymentDate: timestamp("payment_date"),
		paymentReferenceNo: text("payment_reference_no"),
		paymentReceiptUrl: text("payment_receipt_url"),

		internalNote: text("internal_note"),
		auditLog: jsonb("audit_log").$type<PayoutAuditEntry[]>(),

		payoutApprovedBy: text("payout_approved_by").references(() => user.id),
		payoutApprovedAt: timestamp("payout_approved_at"),
		releasedBy: text("released_by").references(() => user.id),
		releasedAt: timestamp("released_at"),
		paidConfirmedBy: text("paid_confirmed_by").references(() => user.id),
		paidConfirmedAt: timestamp("paid_confirmed_at"),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		txIdx: index("idx_commission_payouts_transaction_id").on(t.transactionId),
		payeeIdx: index("idx_commission_payouts_payee").on(t.payeeAgentId),
		statusIdx: index("idx_commission_payouts_status").on(t.status),
		projectIdx: index("idx_commission_payouts_project").on(t.projectName),
		caseIdx: index("idx_commission_payouts_case_no").on(t.caseNo),
	}),
);

export const projectClaimSchedules = pgTable(
	"project_claim_schedules",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectName: text("project_name").notNull(),
		claimStage: text("claim_stage").notNull(),
		percentPayable: decimal("percent_payable", {
			precision: 7,
			scale: 4,
		}).notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => ({
		projectIdx: index("idx_project_claim_schedules_project").on(t.projectName),
	}),
);

export const releasePayoutInputSchema = z.object({
	id: z.string().uuid(),
	paymentMethod: z.enum(["bank_transfer", "cheque", "cash"]),
	paymentDate: z.coerce.date(),
	paymentReferenceNo: z.string().min(1),
	paymentReceiptUrl: z.string().optional(),
	internalNote: z.string().optional(),
});
