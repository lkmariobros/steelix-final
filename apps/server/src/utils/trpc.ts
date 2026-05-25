import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";
import {
	getEffectiveRoles,
	getPrimaryRole,
	hasAdminAccess,
	hasAgentAccess,
} from "./user-roles";

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
	const isActive = (ctx.session.user as { isActive?: boolean | null })?.isActive;
	if (isActive === false) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Your account has been deactivated. Please contact an admin.",
		});
	}
	return next({ ctx: { ...ctx, session: ctx.session } });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	const user = ctx.session.user as {
		roles?: string[] | null;
		role?: string | null;
	};
	const roles = getEffectiveRoles(user);
	const hasAdmin = hasAdminAccess(user);
	const userRole = getPrimaryRole(user);
	if (!hasAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
		});
	}
	return next({ ctx: { ...ctx, session: ctx.session, userRole, userRoles: roles } });
});

export const agentProcedure = protectedProcedure.use(({ ctx, next }) => {
	const user = ctx.session.user as {
		roles?: string[] | null;
		role?: string | null;
	};
	const roles = getEffectiveRoles(user);
	const hasAgent = hasAgentAccess(user);
	const userRole = getPrimaryRole(user);
	if (!hasAgent) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Agent access required",
		});
	}
	return next({ ctx: { ...ctx, session: ctx.session, userRole } });
});
