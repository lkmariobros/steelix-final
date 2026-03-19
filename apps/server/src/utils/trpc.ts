import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

// ─── Protected procedure — requires authenticated session ─────────────────────

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
	}
	return next({ ctx: { ...ctx, session: ctx.session } });
});

// ─── Admin procedure — all authenticated users have admin access ───────────────
// Role-based access control is removed per product requirements.
// All logged-in users may access admin features.

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	const userRole = (ctx.session.user as { role?: string })?.role ?? "user";
	return next({ ctx: { ...ctx, session: ctx.session, userRole } });
});
