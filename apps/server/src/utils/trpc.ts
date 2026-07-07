import { TRPCError, initTRPC } from "@trpc/server";
import type { Context } from "./context";
import { evaluateAccountSignInAccess } from "./account-access";
import {
	getEffectiveRoles,
	getPrimaryRole,
	hasAdminAccess,
	hasAgentAccess,
	hasSuperAdminAccess,
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
	const agentStatus = (ctx.session.user as { agentStatus?: string | null })
		?.agentStatus;
	const access = evaluateAccountSignInAccess({
		role: (ctx.session.user as { role?: string | null }).role ?? "agent",
		agentStatus:
			(agentStatus as
				| "active"
				| "inactive"
				| "suspended"
				| "pending_approval"
				| "terminated"
				| null) ?? "pending_approval",
		isActive: isActive ?? true,
	});
	if (!access.allowed) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: access.message,
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

export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
	const user = ctx.session.user as {
		roles?: string[] | null;
		role?: string | null;
	};
	const roles = getEffectiveRoles(user);
	if (!hasSuperAdminAccess(user)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Super admin access required",
		});
	}
	const userRole = getPrimaryRole(user);
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
