import { TRPCError } from "@trpc/server";
import { and, desc, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { user } from "../models/auth";
import { ensureAgentAccountSchema } from "../utils/agent-account-schema";
import { db, pool } from "../utils/db";

const ONE_ACTIVE_ACCOUNT_SETTING_KEY = "one_active_account_per_agent";

export function normalizeEmail(value: string | null | undefined): string {
	return (value ?? "").trim().toLowerCase();
}

/** NRIC compared without dashes/spaces so "900114-14-5624" matches "900114145624". */
export function normalizeNric(value: string | null | undefined): string {
	return (value ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export function normalizeAgentCode(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

/** Same format as the portal UI: "Full name (Nickname Code)". */
export function formatAccountLabel(input: {
	name?: string | null;
	nickName?: string | null;
	agentCode?: string | null;
	email?: string | null;
}): string {
	const name = input.name?.trim() || input.email?.trim() || "Agent";
	const parenParts = [input.nickName?.trim(), input.agentCode?.trim()]
		.filter(Boolean)
		.join(" ");
	return parenParts ? `${name} (${parenParts})` : name;
}

const normalizedNricSql = sql<string>`upper(regexp_replace(coalesce(${user.nric}, ''), '[^0-9A-Za-z]', '', 'g'))`;

export type MatchedAccount = {
	id: string;
	name: string;
	nickName: string | null;
	agentCode: string | null;
	email: string;
	role: string | null;
	isActive: boolean;
	agentStatus: string | null;
	createdAt: Date;
	normalizedNric: string;
	label: string;
	matchedByEmail: boolean;
	matchedByNric: boolean;
};

async function selectAccounts(where: SQL | undefined) {
	return db
		.select({
			id: user.id,
			name: user.name,
			nickName: user.nickName,
			agentCode: user.agentCode,
			email: user.email,
			role: user.role,
			isActive: user.isActive,
			agentStatus: user.agentStatus,
			createdAt: user.createdAt,
			normalizedNric: normalizedNricSql,
		})
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt));
}

/** Accounts that belong to the same person: same email or same NRIC. */
export async function findAccountsByEmailOrNric(opts: {
	email?: string | null;
	nric?: string | null;
	excludeUserId?: string;
}): Promise<MatchedAccount[]> {
	const email = normalizeEmail(opts.email);
	const nric = normalizeNric(opts.nric);
	const matchers: SQL[] = [];
	if (email) matchers.push(sql`lower(${user.email}) = ${email}`);
	if (nric) matchers.push(sql`${normalizedNricSql} = ${nric}`);
	if (matchers.length === 0) return [];

	const rows = await selectAccounts(
		and(
			or(...matchers),
			opts.excludeUserId ? ne(user.id, opts.excludeUserId) : undefined,
		),
	);

	return rows.map((row) => ({
		...row,
		isActive: row.isActive !== false,
		normalizedNric: row.normalizedNric ?? "",
		label: formatAccountLabel(row),
		matchedByEmail: Boolean(email) && normalizeEmail(row.email) === email,
		matchedByNric: Boolean(nric) && row.normalizedNric === nric,
	}));
}

/** Other accounts linked to each given account (same email or same NRIC). */
export async function findLinkedAccountsFor(
	accounts: Array<{ id: string; email: string; nric: string | null }>,
): Promise<Map<string, MatchedAccount[]>> {
	const result = new Map<string, MatchedAccount[]>();
	if (accounts.length === 0) return result;

	const emails = [
		...new Set(accounts.map((a) => normalizeEmail(a.email)).filter(Boolean)),
	];
	const nrics = [
		...new Set(accounts.map((a) => normalizeNric(a.nric)).filter(Boolean)),
	];
	const matchers: SQL[] = [];
	if (emails.length > 0) {
		matchers.push(inArray(sql`lower(${user.email})`, emails));
	}
	if (nrics.length > 0) {
		matchers.push(inArray(normalizedNricSql, nrics));
	}
	if (matchers.length === 0) return result;

	const candidates = await selectAccounts(or(...matchers));

	for (const account of accounts) {
		const email = normalizeEmail(account.email);
		const nric = normalizeNric(account.nric);
		const linked = candidates
			.filter((row) => row.id !== account.id)
			.map((row) => {
				const matchedByEmail =
					Boolean(email) && normalizeEmail(row.email) === email;
				const matchedByNric =
					Boolean(nric) && (row.normalizedNric ?? "") === nric;
				return {
					...row,
					isActive: row.isActive !== false,
					normalizedNric: row.normalizedNric ?? "",
					label: formatAccountLabel(row),
					matchedByEmail,
					matchedByNric,
				};
			})
			.filter((row) => row.matchedByEmail || row.matchedByNric);
		if (linked.length > 0) result.set(account.id, linked);
	}
	return result;
}

export async function findAccountByAgentCode(
	agentCode: string,
	excludeUserId?: string,
): Promise<MatchedAccount | null> {
	const code = normalizeAgentCode(agentCode);
	if (!code) return null;
	const [row] = await selectAccounts(
		and(
			sql`upper(trim(${user.agentCode})) = ${code}`,
			excludeUserId ? ne(user.id, excludeUserId) : undefined,
		),
	);
	if (!row) return null;
	return {
		...row,
		isActive: row.isActive !== false,
		normalizedNric: row.normalizedNric ?? "",
		label: formatAccountLabel(row),
		matchedByEmail: false,
		matchedByNric: false,
	};
}

export async function assertAgentCodeAvailable(
	agentCode: string,
	excludeUserId?: string,
): Promise<void> {
	const taken = await findAccountByAgentCode(agentCode, excludeUserId);
	if (taken) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `Agent ID ${normalizeAgentCode(agentCode)} is already used by ${taken.label}.`,
		});
	}
}

export async function getOneActiveAccountPerAgent(): Promise<boolean> {
	await ensureAgentAccountSchema();
	try {
		const result = await pool.query<{ value: unknown }>(
			"SELECT value FROM public.portal_settings WHERE key = $1",
			[ONE_ACTIVE_ACCOUNT_SETTING_KEY],
		);
		return result.rows[0]?.value === true;
	} catch (e) {
		console.warn(
			"⚠️ Could not read one-active-account setting:",
			e instanceof Error ? e.message : e,
		);
		return false;
	}
}

export async function setOneActiveAccountPerAgent(
	enabled: boolean,
	actorId: string,
): Promise<void> {
	await ensureAgentAccountSchema();
	await pool.query(
		`INSERT INTO public.portal_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
		[ONE_ACTIVE_ACCOUNT_SETTING_KEY, JSON.stringify(enabled), actorId],
	);
}

/**
 * When "one active account per agent" is on, block activating an account while
 * another account of the same person (same email or NRIC) is still active.
 */
export async function assertNoOtherActiveAccount(opts: {
	userId?: string;
	email?: string | null;
	nric?: string | null;
}): Promise<void> {
	if (!(await getOneActiveAccountPerAgent())) return;
	const activeOthers = (
		await findAccountsByEmailOrNric({
			email: opts.email,
			nric: opts.nric,
			excludeUserId: opts.userId,
		})
	).filter((account) => account.isActive);
	if (activeOthers.length === 0) return;

	throw new TRPCError({
		code: "CONFLICT",
		message: `This agent already has an active account: ${activeOthers
			.map((a) => a.label)
			.join(", ")}. "One active account per agent" is on, so deactivate that account first.`,
	});
}

/** Number of people (grouped by email or NRIC) who currently have more than one active account. */
export async function countAgentsWithMultipleActiveAccounts(): Promise<number> {
	const rows = await selectAccounts(sql`${user.isActive} = true`);
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		let root = id;
		while (parent.get(root) !== root) root = parent.get(root) ?? root;
		parent.set(id, root);
		return root;
	};
	const union = (a: string, b: string) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(ra, rb);
	};

	const firstByKey = new Map<string, string>();
	for (const row of rows) {
		parent.set(row.id, row.id);
	}
	for (const row of rows) {
		const keys = [
			`e:${normalizeEmail(row.email)}`,
			row.normalizedNric ? `n:${row.normalizedNric}` : null,
		].filter((k): k is string => Boolean(k));
		for (const key of keys) {
			const first = firstByKey.get(key);
			if (first) union(first, row.id);
			else firstByKey.set(key, row.id);
		}
	}

	const groupSizes = new Map<string, number>();
	for (const row of rows) {
		const root = find(row.id);
		groupSizes.set(root, (groupSizes.get(root) ?? 0) + 1);
	}
	return [...groupSizes.values()].filter((size) => size > 1).length;
}

/** Postgres error code/constraint, unwrapping Drizzle's "Failed query" wrapper. */
export function getPgErrorInfo(error: unknown): {
	code?: string;
	constraint?: string;
} {
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current; depth++) {
		if (typeof current === "object" && current !== null) {
			const record = current as {
				code?: unknown;
				constraint?: unknown;
				cause?: unknown;
			};
			if (typeof record.code === "string" && /^[0-9A-Z]{5}$/.test(record.code)) {
				return {
					code: record.code,
					constraint:
						typeof record.constraint === "string"
							? record.constraint
							: undefined,
				};
			}
			current = record.cause;
		} else {
			break;
		}
	}
	return {};
}
