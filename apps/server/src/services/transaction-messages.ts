import { asc, eq } from "drizzle-orm";
import { user } from "../models/auth";
import {
	type TransactionMessageAttachment,
	type TransactionMessageType,
	transactionMessages,
} from "../models/transaction-messages";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import { isTransactionsSchemaOutdatedError } from "../utils/transactions-schema-hint";
import { hasAdminAccess } from "../utils/user-roles";

const ATTACHMENTS_SQL_HINT =
	"Database is missing transaction_messages.attachments. Run: ALTER TABLE public.transaction_messages ADD COLUMN IF NOT EXISTS attachments jsonb;";

function isMissingAttachmentsColumn(err: unknown): boolean {
	if (!isTransactionsSchemaOutdatedError(err)) return false;
	const msg = err instanceof Error ? err.message : String(err);
	return /attachments/i.test(msg);
}

export async function listTransactionMessages(transactionId: string) {
	try {
		const rows = await db
			.select({
				id: transactionMessages.id,
				transactionId: transactionMessages.transactionId,
				authorId: transactionMessages.authorId,
				authorRole: transactionMessages.authorRole,
				messageType: transactionMessages.messageType,
				body: transactionMessages.body,
				attachments: transactionMessages.attachments,
				createdAt: transactionMessages.createdAt,
				authorName: user.name,
				authorEmail: user.email,
			})
			.from(transactionMessages)
			.leftJoin(user, eq(transactionMessages.authorId, user.id))
			.where(eq(transactionMessages.transactionId, transactionId))
			.orderBy(asc(transactionMessages.createdAt));

		return rows;
	} catch (err) {
		if (!isMissingAttachmentsColumn(err)) throw err;

		const rows = await db
			.select({
				id: transactionMessages.id,
				transactionId: transactionMessages.transactionId,
				authorId: transactionMessages.authorId,
				authorRole: transactionMessages.authorRole,
				messageType: transactionMessages.messageType,
				body: transactionMessages.body,
				createdAt: transactionMessages.createdAt,
				authorName: user.name,
				authorEmail: user.email,
			})
			.from(transactionMessages)
			.leftJoin(user, eq(transactionMessages.authorId, user.id))
			.where(eq(transactionMessages.transactionId, transactionId))
			.orderBy(asc(transactionMessages.createdAt));

		return rows.map((row) => ({ ...row, attachments: null }));
	}
}

export async function addTransactionMessage(opts: {
	transactionId: string;
	authorId: string;
	authorRole: "agent" | "admin";
	body: string;
	messageType?: TransactionMessageType;
	attachments?: TransactionMessageAttachment[];
}) {
	const base = {
		transactionId: opts.transactionId,
		authorId: opts.authorId,
		authorRole: opts.authorRole,
		messageType: opts.messageType ?? "remark",
		body: opts.body.trim(),
	};
	const attachments =
		opts.attachments && opts.attachments.length > 0
			? opts.attachments
			: null;

	try {
		const [row] = await db
			.insert(transactionMessages)
			.values({
				...base,
				attachments,
			})
			.returning();
		return row;
	} catch (err) {
		if (!isMissingAttachmentsColumn(err)) throw err;

		// Fallback: keep message + file names in body until SQL patch is applied
		const attachmentNote =
			attachments && attachments.length > 0
				? `\n\nAttached: ${attachments.map((a) => a.fileName).join(", ")}`
				: "";
		const [row] = await db
			.insert(transactionMessages)
			.values({
				...base,
				body: `${base.body}${attachmentNote}`,
			})
			.returning({
				id: transactionMessages.id,
				transactionId: transactionMessages.transactionId,
				authorId: transactionMessages.authorId,
				authorRole: transactionMessages.authorRole,
				messageType: transactionMessages.messageType,
				body: transactionMessages.body,
				createdAt: transactionMessages.createdAt,
			});

		if (attachments && attachments.length > 0) {
			console.warn(ATTACHMENTS_SQL_HINT);
		}

		return { ...row, attachments };
	}
}

export async function assertCanAccessTransactionMessages(
	transactionId: string,
	userId: string,
	userRole?: string | null,
	userRoles?: string[] | null,
) {
	const [tx] = await db
		.select({ agentId: transactions.agentId })
		.from(transactions)
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!tx) throw new Error("Transaction not found");

	const isAdmin = hasAdminAccess({ role: userRole, roles: userRoles ?? [] });
	if (!isAdmin && tx.agentId !== userId) {
		throw new Error("Access denied");
	}
}
