import { asc, eq } from "drizzle-orm";
import { user } from "../models/auth";
import {
	type TransactionMessageType,
	transactionMessages,
} from "../models/transaction-messages";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";
import { hasAdminAccess } from "../utils/user-roles";

export async function listTransactionMessages(transactionId: string) {
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

	return rows;
}

export async function addTransactionMessage(opts: {
	transactionId: string;
	authorId: string;
	authorRole: "agent" | "admin";
	body: string;
	messageType?: TransactionMessageType;
}) {
	const [row] = await db
		.insert(transactionMessages)
		.values({
			transactionId: opts.transactionId,
			authorId: opts.authorId,
			authorRole: opts.authorRole,
			messageType: opts.messageType ?? "remark",
			body: opts.body.trim(),
		})
		.returning();

	return row;
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
