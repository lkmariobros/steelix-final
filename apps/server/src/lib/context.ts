import type { Context as HonoContext } from "hono";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "../db";
import { user } from "../db/schema/auth";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	// ✅ CRITICAL: Enhance session with agent tier information for commission calculations
	if (session?.user) {
		try {
			// Fetch latest tier and commission split from database
			const [userWithTier] = await db
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

			if (userWithTier) {
				// Enhance session user with tier information
				(session.user as any).agentTier = userWithTier.agentTier;
				(session.user as any).companyCommissionSplit = userWithTier.companyCommissionSplit;
				(session.user as any).agencyId = userWithTier.agencyId;
				(session.user as any).teamId = userWithTier.teamId;
				(session.user as any).role = userWithTier.role;
			}
		} catch (error) {
			// Log error but don't break authentication
			console.error("❌ Error fetching agent tier information:", error);
		}
	}

	return {
		session,
		db,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
