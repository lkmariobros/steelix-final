import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { transactions } from "./transactions";

export type TransactionMessageAttachment = {
	id: string;
	fileName: string;
	fileType: string;
	fileSize?: number;
};

export const transactionMessages = pgTable(
	"transaction_messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		transactionId: uuid("transaction_id")
			.notNull()
			.references(() => transactions.id, { onDelete: "cascade" }),
		authorId: text("author_id").notNull(),
		authorRole: text("author_role").notNull(), // agent | admin
		messageType: text("message_type").notNull().default("remark"),
		body: text("body").notNull(),
		attachments: jsonb("attachments").$type<TransactionMessageAttachment[]>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		transactionIdx: index("idx_transaction_messages_transaction_id").on(
			table.transactionId,
		),
	}),
);

export const transactionMessageTypeSchema = z.enum([
	"remark",
	"edit_request",
	"status_note",
	"admin_reply",
]);

export const transactionMessageAttachmentSchema = z.object({
	id: z.string().uuid(),
	fileName: z.string().min(1).max(255),
	fileType: z.string().min(1),
	fileSize: z.number().nonnegative().optional(),
});

export const insertTransactionMessageSchema = z.object({
	transactionId: z.string().uuid(),
	body: z.string().min(1).max(5000),
	messageType: transactionMessageTypeSchema.default("remark"),
	attachments: z.array(transactionMessageAttachmentSchema).max(10).optional(),
});

export type TransactionMessageType = z.infer<typeof transactionMessageTypeSchema>;
