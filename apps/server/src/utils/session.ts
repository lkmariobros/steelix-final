import { and, eq, gt } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { account, session as sessionTable, user } from "../models/auth";
import { db } from "./db";

export const SESSION_COOKIE = "steelix.session_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = Pick<
	InferSelectModel<typeof user>,
	| "id"
	| "email"
	| "name"
	| "image"
	| "emailVerified"
	| "createdAt"
	| "updatedAt"
	| "role"
	| "agentTier"
	| "companyCommissionSplit"
	| "agencyId"
	| "teamId"
	| "isActive"
	| "agentStatus"
>;

export type AuthSession = {
	user: SessionUser;
	session: {
		id: string;
		token: string;
		userId: string;
		expiresAt: Date;
		createdAt: Date;
		updatedAt: Date;
	};
};

function parseCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex <= 0) continue;
		const key = trimmed.slice(0, eqIndex);
		if (key === name || key === `__Secure-${name}`) {
			return decodeURIComponent(trimmed.slice(eqIndex + 1));
		}
	}
	return null;
}

export function readSessionToken(headers: Headers): string | null {
	return parseCookie(headers.get("cookie"), SESSION_COOKIE);
}

export async function getSession(headers: Headers): Promise<AuthSession | null> {
	const token = readSessionToken(headers);
	if (!token) return null;

	const [row] = await db
		.select({
			sessionId: sessionTable.id,
			token: sessionTable.token,
			userId: sessionTable.userId,
			expiresAt: sessionTable.expiresAt,
			sessionCreatedAt: sessionTable.createdAt,
			sessionUpdatedAt: sessionTable.updatedAt,
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			role: user.role,
			agentTier: user.agentTier,
			companyCommissionSplit: user.companyCommissionSplit,
			agencyId: user.agencyId,
			teamId: user.teamId,
			isActive: user.isActive,
			agentStatus: user.agentStatus,
		})
		.from(sessionTable)
		.innerJoin(user, eq(sessionTable.userId, user.id))
		.where(
			and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date())),
		)
		.limit(1);

	if (!row) return null;

	return {
		user: {
			id: row.id,
			email: row.email,
			name: row.name,
			image: row.image,
			emailVerified: row.emailVerified,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			role: row.role,
			agentTier: row.agentTier,
			companyCommissionSplit: row.companyCommissionSplit,
			agencyId: row.agencyId,
			teamId: row.teamId,
			isActive: row.isActive,
			agentStatus: row.agentStatus,
		},
		session: {
			id: row.sessionId,
			token: row.token,
			userId: row.userId,
			expiresAt: row.expiresAt,
			createdAt: row.sessionCreatedAt,
			updatedAt: row.sessionUpdatedAt,
		},
	};
}

export async function createSession(params: {
	userId: string;
	rememberMe: boolean;
	ipAddress?: string | null;
	userAgent?: string | null;
}): Promise<AuthSession["session"]> {
	const now = new Date();
	const maxAgeSeconds = params.rememberMe
		? SESSION_MAX_AGE_SECONDS
		: 60 * 60 * 24;
	const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000);
	const tokenBytes = new Uint8Array(32);
	crypto.getRandomValues(tokenBytes);
	const token = [...tokenBytes]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const [created] = await db
		.insert(sessionTable)
		.values({
			id: crypto.randomUUID(),
			token,
			userId: params.userId,
			expiresAt,
			createdAt: now,
			updatedAt: now,
			ipAddress: params.ipAddress ?? null,
			userAgent: params.userAgent ?? null,
		})
		.returning();

	if (!created) {
		throw new Error("Failed to create session");
	}
	return created;
}

export async function destroySession(token: string | null): Promise<void> {
	if (!token) return;
	await db.delete(sessionTable).where(eq(sessionTable.token, token));
}

export function sessionCookieOptions(rememberMe: boolean) {
	const isProd = (process.env.NODE_ENV || "development") === "production";
	return {
		httpOnly: true,
		secure: isProd,
		sameSite: "lax" as const,
		path: "/",
		maxAge: rememberMe ? SESSION_MAX_AGE_SECONDS : undefined,
	};
}

export async function findCredentialAccount(userId: string) {
	const [row] = await db
		.select({
			id: account.id,
			accountId: account.accountId,
			password: account.password,
		})
		.from(account)
		.where(
			and(eq(account.userId, userId), eq(account.providerId, "credential")),
		)
		.limit(1);
	return row ?? null;
}
