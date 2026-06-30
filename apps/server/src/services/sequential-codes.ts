import { sql } from "drizzle-orm";
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
