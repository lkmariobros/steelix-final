import {
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
import { transactions } from "./transactions";

// Approval status enum
export const approvalStatusEnum = pgEnum("approval_status", [
	"pending",
	"approved",
	"rejected",
	"requires_revision",
]);

// Approval priority enum
export const approvalPriorityEnum = pgEnum("approval_priority", [
	"low",
	"normal",
	"high",
	"urgent",
]);

// Commission approvals table
export const commissionApprovals = pgTable("commission_approvals", {
	id: uuid("id").primaryKey().defaultRandom(),
	transactionId: uuid("transaction_id")
		.notNull()
		.references(() => transactions.id, { onDelete: "cascade" }),
	agentId: text("agent_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	
	// Approval details
	requestedAmount: decimal("requested_amount", { precision: 10, scale: 2 }).notNull(),
	approvedAmount: decimal("approved_amount", { precision: 10, scale: 2 }),
	commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }),
	
	// Status and workflow
	status: approvalStatusEnum("status").default("pending").notNull(),
	priority: approvalPriorityEnum("priority").default("normal").notNull(),
	
	// Review information
	reviewedBy: text("reviewed_by").references(() => user.id),
	reviewedAt: timestamp("reviewed_at"),
	reviewNotes: text("review_notes"),
	
	// Additional data
	supportingDocuments: jsonb("supporting_documents").$type<Array<{
		id: string;
		name: string;
		url: string;
		type: string;
		uploadedAt: string;
	}>>(),
	
	metadata: jsonb("metadata").$type<{
		submissionNotes?: string;
		clientFeedback?: string;
		internalNotes?: string;
		escalationReason?: string;
		[key: string]: any;
	}>(),
	
	// Timestamps
	submittedAt: timestamp("submitted_at").defaultNow().notNull(),
	dueDate: timestamp("due_date"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	agentIdIdx: index("idx_commission_approvals_agent_id").on(table.agentId),
	statusIdx: index("idx_commission_approvals_status").on(table.status),
	priorityIdx: index("idx_commission_approvals_priority").on(table.priority),
	reviewedByIdx: index("idx_commission_approvals_reviewed_by").on(table.reviewedBy),
	submittedAtIdx: index("idx_commission_approvals_submitted_at").on(table.submittedAt),
}));

// Approval workflow history for audit trail
export const approvalWorkflowHistory = pgTable("approval_workflow_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	approvalId: uuid("approval_id")
		.notNull()
		.references(() => commissionApprovals.id, { onDelete: "cascade" }),
	
	// Workflow step details
	fromStatus: approvalStatusEnum("from_status"),
	toStatus: approvalStatusEnum("to_status").notNull(),
	actionBy: text("action_by")
		.notNull()
		.references(() => user.id),
	
	// Action details
	actionType: text("action_type").notNull(), // 'submit', 'approve', 'reject', 'revise', 'escalate'
	actionNotes: text("action_notes"),
	
	// System information
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
	approvalIdIdx: index("idx_approval_workflow_history_approval_id").on(table.approvalId),
	actionByIdx: index("idx_approval_workflow_history_action_by").on(table.actionBy),
	timestampIdx: index("idx_approval_workflow_history_timestamp").on(table.timestamp),
}));

// Approval templates for common scenarios
export const approvalTemplates = pgTable("approval_templates", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: text("description"),
	
	// Template configuration
	criteria: jsonb("criteria").$type<{
		minAmount?: number;
		maxAmount?: number;
		transactionTypes?: string[];
		agentTiers?: string[];
		autoApprove?: boolean;
		requiresDocuments?: string[];
	}>(),
	
	// Approval rules
	approvalRules: jsonb("approval_rules").$type<{
		requiredApprovers: number;
		approverRoles: string[];
		escalationRules?: {
			timeLimit: number; // hours
			escalateTo: string[];
		};
		notifications?: {
			onSubmit: boolean;
			onApprove: boolean;
			onReject: boolean;
			recipients: string[];
		};
	}>(),
	
	// Status
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: text("created_by")
		.notNull()
		.references(() => user.id),
	
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
	nameIdx: index("idx_approval_templates_name").on(table.name),
	isActiveIdx: index("idx_approval_templates_is_active").on(table.isActive),
}));

// Zod schemas for validation
export const insertCommissionApprovalSchema = z.object({
	transactionId: z.string().uuid(),
	agentId: z.string(),
	requestedAmount: z.coerce.number().positive(),
	commissionPercentage: z.coerce.number().min(0).max(100).optional(),
	priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
	supportingDocuments: z.array(z.object({
		id: z.string(),
		name: z.string(),
		url: z.string(),
		type: z.string(),
		uploadedAt: z.string(),
	})).optional(),
	metadata: z.object({
		submissionNotes: z.string().optional(),
		clientFeedback: z.string().optional(),
		internalNotes: z.string().optional(),
		escalationReason: z.string().optional(),
	}).optional(),
	dueDate: z.coerce.date().optional(),
});

export const selectCommissionApprovalSchema = z.object({
	id: z.string(),
	transactionId: z.string(),
	agentId: z.string(),
	requestedAmount: z.string(), // Decimal comes as string
	approvedAmount: z.string().nullable(),
	commissionPercentage: z.string().nullable(),
	status: z.enum(["pending", "approved", "rejected", "requires_revision"]),
	priority: z.enum(["low", "normal", "high", "urgent"]),
	reviewedBy: z.string().nullable(),
	reviewedAt: z.date().nullable(),
	reviewNotes: z.string().nullable(),
	supportingDocuments: z.array(z.object({
		id: z.string(),
		name: z.string(),
		url: z.string(),
		type: z.string(),
		uploadedAt: z.string(),
	})).nullable(),
	metadata: z.object({
		submissionNotes: z.string().optional(),
		clientFeedback: z.string().optional(),
		internalNotes: z.string().optional(),
		escalationReason: z.string().optional(),
	}).nullable(),
	submittedAt: z.date(),
	dueDate: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateApprovalStatusSchema = z.object({
	id: z.string().uuid(),
	status: z.enum(["approved", "rejected", "requires_revision"]),
	approvedAmount: z.coerce.number().positive().optional(),
	reviewNotes: z.string().optional(),
});

export const approvalWorkflowHistorySchema = z.object({
	id: z.string(),
	approvalId: z.string(),
	fromStatus: z.enum(["pending", "approved", "rejected", "requires_revision"]).nullable(),
	toStatus: z.enum(["pending", "approved", "rejected", "requires_revision"]),
	actionBy: z.string(),
	actionType: z.string(),
	actionNotes: z.string().nullable(),
	ipAddress: z.string().nullable(),
	userAgent: z.string().nullable(),
	timestamp: z.date(),
});

// Type exports
export type CommissionApproval = z.infer<typeof selectCommissionApprovalSchema>;
export type NewCommissionApproval = z.infer<typeof insertCommissionApprovalSchema>;
export type UpdateApprovalStatus = z.infer<typeof updateApprovalStatusSchema>;
export type ApprovalWorkflowHistory = z.infer<typeof approvalWorkflowHistorySchema>;
export type ApprovalStatus = CommissionApproval["status"];
export type ApprovalPriority = CommissionApproval["priority"];

// Constants for approval workflow
export const APPROVAL_WORKFLOW_ACTIONS = {
	SUBMIT: "submit",
	APPROVE: "approve",
	REJECT: "reject",
	REVISE: "revise",
	ESCALATE: "escalate",
	UPDATE: "update",
} as const;

export const APPROVAL_SLA_HOURS = {
	low: 72,      // 3 days
	normal: 48,   // 2 days
	high: 24,     // 1 day
	urgent: 4,    // 4 hours
} as const;
