import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { user } from "../models/auth";
import type { Context } from "./context";
import { db } from "./db";
import { hasAdminAccess, hasSuperAdminAccess } from "./user-roles";

export type AppRole = "super_admin" | "admin" | "agent" | "team_lead";

const APP_ROLES: readonly AppRole[] = [
	"super_admin",
	"admin",
	"agent",
	"team_lead",
];

export function isAppRole(value: string | null | undefined): value is AppRole {
	return !!value && APP_ROLES.includes(value as AppRole);
}

/**
 * Resolve role from session (merged from DB in createContext) with DB fallback.
 * Never trusts client-only hints — session role comes from Better Auth + context merge.
 */
export async function resolveUserRole(ctx: Context): Promise<AppRole> {
	if (!ctx.session?.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
	}

	const fromSession = (ctx.session.user as { role?: string | null }).role;
	if (isAppRole(fromSession)) {
		return fromSession;
	}

	const [record] = await db
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, ctx.session.user.id))
		.limit(1);

	const fromDb = record?.role;
	return isAppRole(fromDb) ? fromDb : "agent";
}

export function assertAdminRole(role: AppRole): void {
	if (!hasAdminAccess({ role })) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin access required",
		});
	}
}

export function assertSuperAdminRole(role: AppRole): void {
	if (!hasSuperAdminAccess({ role })) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Super admin access required",
		});
	}
}

export async function requireAdminRole(ctx: Context): Promise<AppRole> {
	const role = await resolveUserRole(ctx);
	assertAdminRole(role);
	return role;
}

export async function requireSuperAdminRole(ctx: Context): Promise<AppRole> {
	const role = await resolveUserRole(ctx);
	assertSuperAdminRole(role);
	return role;
}
