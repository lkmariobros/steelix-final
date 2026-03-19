import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { Context as HonoContext } from "hono";
import { user } from "../models/auth";
import { auth } from "./auth";
import { db } from "./db";

type UserWithTier = Pick<
	InferSelectModel<typeof user>,
	"agentTier" | "companyCommissionSplit" | "agencyId" | "teamId" | "role"
>;

export type CreateContextOptions = {
	context: HonoContext;
};

// ─── In-memory cache for user profile data ───────────────────────────────────
// Avoids a DB query on every tRPC request for the same user.
// TTL: 2 minutes — short enough to reflect tier/role changes quickly.

const USER_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const userCache = new Map<string, { data: UserWithTier; expiresAt: number }>();

function getCachedUser(userId: string): UserWithTier | null {
	const entry = userCache.get(userId);
	if (entry && Date.now() < entry.expiresAt) return entry.data;
	userCache.delete(userId); // remove stale entry
	return null;
}

function setCachedUser(userId: string, data: UserWithTier) {
	userCache.set(userId, { data, expiresAt: Date.now() + USER_CACHE_TTL });
}

/** Call this when user role/tier changes so the cache is immediately fresh. */
export function invalidateUserCache(userId: string) {
	userCache.delete(userId);
}

// ─── Context factory ─────────────────────────────────────────────────────────

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	if (session?.user) {
		// Try cache first to avoid a DB round-trip on every request
		const cached = getCachedUser(session.user.id);

		if (cached) {
			const u = session.user as typeof session.user & UserWithTier;
			u.agentTier = cached.agentTier;
			u.companyCommissionSplit = cached.companyCommissionSplit;
			u.agencyId = cached.agencyId;
			u.teamId = cached.teamId;
			u.role = cached.role;
		} else {
			// Fetch from DB with a reasonable timeout and retry
			await fetchAndCacheUser(session);
		}
	}

	return { session, db };
}

async function fetchAndCacheUser(
	session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>,
) {
	const MAX_RETRIES = 2;
	const TIMEOUT_MS = 5_000; // 5 seconds (was 30 — major latency source!)

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			const queryPromise = db
				.select({
					agentTier: user.agentTier,
					companyCommissionSplit: user.companyCommissionSplit,
					agencyId: user.agencyId,
					teamId: user.teamId,
					role: user.role,
				})
				.from(user)
				.where(eq(user.id, session.user.id))
				.limit(1);

			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("DB timeout")), TIMEOUT_MS),
			);

			const [userData] = (await Promise.race([
				queryPromise,
				timeoutPromise,
			])) as [UserWithTier | undefined];

			if (userData) {
				// Merge into session object
				const u = session.user as typeof session.user & UserWithTier;
				u.agentTier = userData.agentTier;
				u.companyCommissionSplit = userData.companyCommissionSplit;
				u.agencyId = userData.agencyId;
				u.teamId = userData.teamId;
				u.role = userData.role;

				// Store in cache so subsequent requests skip the DB
				setCachedUser(session.user.id, userData);
			}
			return; // success
		} catch (error: unknown) {
			const err = error as { message?: string; code?: string };
			const isRetryable =
				err?.message?.includes("timeout") ||
				err?.message?.includes("Connection terminated") ||
				err?.message?.includes("MaxClientsInSessionMode") ||
				err?.code === "XX000" ||
				err?.code === "57P01";

			if (isRetryable && attempt < MAX_RETRIES) {
				const wait = 150 * 2 ** attempt; // 150ms, 300ms
				await new Promise((r) => setTimeout(r, wait));
				continue;
			}

			// Non-retryable or out of retries — log and continue without tier info
			console.error("❌ Failed to fetch user profile for context:", {
				error: err?.message ?? String(error),
				userId: session.user.id,
				attempt: attempt + 1,
			});
			return;
		}
	}
}

export type Context = Awaited<ReturnType<typeof createContext>>;
