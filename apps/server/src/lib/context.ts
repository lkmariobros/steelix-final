import type { Context as HonoContext } from "hono";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "../db";
import { user } from "../db/schema/auth";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	// Debug: Log cookies for tRPC requests
	const cookies = context.req.header("cookie");
	const userAgent = context.req.header("user-agent") || "";
	const isMobile = /iPhone|iPad|Android|Mobile/i.test(userAgent);

	if (isMobile || !cookies) {
		console.log("🍪 tRPC Cookie Debug:", {
			hasCookies: !!cookies,
			cookieLength: cookies?.length || 0,
			isMobile,
			userAgent: userAgent.substring(0, 80),
			url: context.req.url,
		});
	}

	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	if (isMobile && !session) {
		console.log("📱 Mobile session issue: No session found despite login");
	}

	// ✅ CRITICAL: Enhance session with agent tier information for commission calculations
	if (session?.user) {
		const MAX_DB_RETRIES = 3;
		const INITIAL_RETRY_DELAY = 100; // ms
		
		for (let attempt = 0; attempt < MAX_DB_RETRIES; attempt++) {
			try {
				// Fetch latest tier and commission split from database with timeout
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

				// Add timeout wrapper (30 seconds)
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error("Database query timeout")), 30000);
				});

				const [userWithTier] = await Promise.race([queryPromise, timeoutPromise]) as any[];

				if (userWithTier) {
					// Enhance session user with tier information
					(session.user as any).agentTier = userWithTier.agentTier;
					(session.user as any).companyCommissionSplit = userWithTier.companyCommissionSplit;
					(session.user as any).agencyId = userWithTier.agencyId;
					(session.user as any).teamId = userWithTier.teamId;
					(session.user as any).role = userWithTier.role;
				}
				break; // Success, exit retry loop
			} catch (error: any) {
				const isRetryable = 
					error?.message?.includes("timeout") ||
					error?.message?.includes("Connection terminated") ||
					error?.message?.includes("MaxClientsInSessionMode") ||
					error?.code === "XX000" ||
					error?.code === "57P01"; // Admin shutdown

				if (isRetryable && attempt < MAX_DB_RETRIES - 1) {
					const waitTime = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
					console.warn(`⚠️ Database query failed, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${MAX_DB_RETRIES})`, {
						error: error?.message || error,
						code: error?.code,
					});
					await new Promise(resolve => setTimeout(resolve, waitTime));
				} else {
					// Log error but don't break authentication - use cached/default values
					console.error("❌ Error fetching agent tier information after retries:", {
						error: error?.message || error,
						code: error?.code,
						attempts: attempt + 1,
					});
					// Continue without tier info - session will still work
					break;
				}
			}
		}
	}

	return {
		session,
		db,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
