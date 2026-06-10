import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { transactions } from "./transactions";

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

export const insertTransactionMessageSchema = z.object({
	transactionId: z.string().uuid(),
	body: z.string().min(1).max(5000),
	messageType: transactionMessageTypeSchema.default("remark"),
});

export type TransactionMessageType = z.infer<typeof transactionMessageTypeSchema>;
