import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

// ✅ PERFORMANCE OPTIMIZED: Admin procedure with cached role validation
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	// Check if role is already cached in session context
	let userRole = (ctx.session.user as { role?: string })?.role;

	// Only query database if role is not in session
	if (!userRole) {
		const { db } = await import("../db");
		const { user } = await import("../db/schema/auth");
		const { eq } = await import("drizzle-orm");

		const [userRecord] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, ctx.session.user.id))
			.limit(1);

		userRole = userRecord?.role;

		// ✅ PERFORMANCE: Cache role in session for subsequent requests
		if (userRole && ctx.session.user) {
			(ctx.session.user as { role?: string }).role = userRole;
		}
	}

	if (!userRole || !["admin", "team_lead"].includes(userRole)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
			cause: `User role '${userRole}' is not authorized for admin operations`,
		});
	}

	return next({
		ctx: {
			...ctx,
			session: ctx.session,
			userRole,
		},
	});
});
