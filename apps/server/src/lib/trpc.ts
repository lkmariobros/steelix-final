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

// Admin procedure with role validation
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	// Get user role from database since Better Auth session might not include it
	const { db } = await import("../db");
	const { user } = await import("../db/schema/auth");
	const { eq } = await import("drizzle-orm");

	const [userRecord] = await db
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, ctx.session.user.id))
		.limit(1);

	const userRole = userRecord?.role;

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
