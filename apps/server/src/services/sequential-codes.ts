import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { user } from "../models/auth";
import { transactions } from "../models/transactions";
import { db } from "../utils/db";

const AGENT_CODE_PREFIX = "DT";
const AGENT_CODE_PAD = 5;
const AGENT_CODE_START = 1;

const CASE_NUMBER_PAD = 6;
const CASE_NUMBER_START = 1001;

export type CaseNumberPrefix = "P" | "S" | "R";

export async function getNextAgentCode(): Promise<string> {
	const [row] = await db
		.select({
			maxNum: sql<number | null>`max(
        CASE
          WHEN ${user.agentCode} ~ '^DT[0-9]+$'
          THEN CAST(SUBSTRING(${user.agentCode} FROM 3) AS integer)
          WHEN ${user.agentCode} ~ '^[0-9]+$'
          THEN CAST(${user.agentCode} AS integer)
          ELSE NULL
        END
      )`,
		})
		.from(user);

	const next = Math.max(AGENT_CODE_START, Number(row?.maxNum ?? 0) + 1);
	return `${AGENT_CODE_PREFIX}${String(next).padStart(AGENT_CODE_PAD, "0")}`;
}

export function resolveCaseNumberPrefix(
	marketType: string,
	transactionType: string,
): CaseNumberPrefix {
	if (transactionType === "rental" || transactionType === "lease") {
		return "R";
	}
	if (marketType === "primary") {
		return "P";
	}
	return "S";
}

export async function getNextCaseNumber(
	prefix: CaseNumberPrefix,
): Promise<string> {
	const pattern = `^${prefix}[0-9]{6}$`;
	const [row] = await db
		.select({
			maxNum: sql<number | null>`max(
        CASE
          WHEN ${transactions.caseNo} ~ ${pattern}
          THEN CAST(SUBSTRING(${transactions.caseNo} FROM 2) AS integer)
          ELSE NULL
        END
      )`,
		})
		.from(transactions);

	const next = Math.max(CASE_NUMBER_START, Number(row?.maxNum ?? 0) + 1);
	return `${prefix}${String(next).padStart(CASE_NUMBER_PAD, "0")}`;
}

const SYSTEM_CASE_NUMBER = /^[PSR][0-9]{6}$/;

/**
 * Whether a draft needs a (new) system case number: none yet, or a system number whose
 * prefix no longer matches the deal type. Manually keyed numbers are never replaced.
 */
export function draftNeedsCaseNumber(
	currentCaseNo: string | null | undefined,
	prefix: CaseNumberPrefix,
): boolean {
	const current = currentCaseNo?.trim();
	if (!current) return true;
	return SYSTEM_CASE_NUMBER.test(current) && !current.startsWith(prefix);
}

function isCaseNumberConflict(err: unknown): boolean {
	for (let e: unknown = err, depth = 0; e && depth < 4; depth++) {
		if (typeof e !== "object") break;
		const { code, constraint, message, detail } = e as {
			code?: unknown;
			constraint?: unknown;
			message?: unknown;
			detail?: unknown;
		};
		if (String(code) === "23505") {
			const text = `${constraint ?? ""} ${message ?? ""} ${detail ?? ""}`;
			return text.includes("case_no");
		}
		e = (e as { cause?: unknown }).cause;
	}
	return false;
}

/**
 * Runs `write` with the next case number, retrying when a concurrent save
 * takes the same number first (unique index on case_no).
 */
export async function withNextCaseNumber<T>(
	prefix: CaseNumberPrefix,
	write: (caseNo: string) => Promise<T>,
	attempts = 5,
): Promise<T> {
	for (let i = 1; ; i++) {
		const caseNo = await getNextCaseNumber(prefix);
		try {
			return await write(caseNo);
		} catch (e) {
			if (i >= attempts || !isCaseNumberConflict(e)) throw e;
		}
	}
}

/** Gives existing drafts without a case number their running number (oldest first). */
export async function backfillDraftCaseNumbers(): Promise<number> {
	const drafts = await db
		.select({
			id: transactions.id,
			marketType: transactions.marketType,
			transactionType: transactions.transactionType,
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.status, "draft"),
				or(isNull(transactions.caseNo), eq(sql`trim(${transactions.caseNo})`, "")),
			),
		)
		.orderBy(asc(transactions.createdAt));

	let assigned = 0;
	for (const draft of drafts) {
		const prefix = resolveCaseNumberPrefix(
			draft.marketType ?? "secondary",
			draft.transactionType ?? "sale",
		);
		const rows = await withNextCaseNumber(prefix, (caseNo) =>
			db
				.update(transactions)
				.set({ caseNo })
				.where(
					and(
						eq(transactions.id, draft.id),
						or(isNull(transactions.caseNo), eq(sql`trim(${transactions.caseNo})`, "")),
					),
				)
				.returning({ id: transactions.id }),
		);
		assigned += rows.length;
	}
	return assigned;
}
