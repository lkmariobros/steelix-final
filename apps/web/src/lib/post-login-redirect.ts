import {
	isAdministrator,
	PORTAL_PATHS,
	roleFromSessionUser,
	type AppRole,
} from "@/lib/user-role";
import type { AuthSessionData } from "@/lib/auth-client";

type SessionUser = { role?: string | null } | undefined;

/** Resolve portal from user role — no me-role fetch during login (saves ~1s). */
export function resolvePostLoginPath(sessionUser?: SessionUser): string {
	const sessionRole = roleFromSessionUser(sessionUser);
	if (isAdministrator(sessionRole)) return PORTAL_PATHS.admin;
	if (sessionRole) return PORTAL_PATHS.agent;
	// Role resolves via checkAdminRole after navigation; default to agent portal
	return PORTAL_PATHS.agent;
}

export function postLoginPathFromRole(role: AppRole | undefined): string {
	return isAdministrator(role) ? PORTAL_PATHS.admin : PORTAL_PATHS.agent;
}

/** Extract user (with role) from Better Auth sign-in/sign-up payload. */
export function userFromAuthResponse(data: unknown): SessionUser {
	if (!data || typeof data !== "object") return undefined;
	const payload = data as Record<string, unknown>;
	const user =
		(payload.user as SessionUser) ??
		((payload.session as { user?: SessionUser } | undefined)?.user);
	return user ?? undefined;
}

export function sessionFromAuthResponse(data: unknown): AuthSessionData | null {
	if (!data || typeof data !== "object") return null;
	const payload = data as Record<string, unknown>;
	const user =
		(payload.user as AuthSessionData["user"] | undefined) ??
		((payload.session as { user?: AuthSessionData["user"] } | undefined)?.user);
	if (!user) return null;
	return {
		user,
		session: (payload.session as AuthSessionData["session"]) ?? null,
	};
}
