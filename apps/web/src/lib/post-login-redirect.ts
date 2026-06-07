import {
	isAdministrator,
	PORTAL_PATHS,
	roleFromSessionUser,
	type AppRole,
} from "@/lib/user-role";

type SessionUser = { role?: string | null } | undefined;

/** Resolve admin vs agent portal from session role, then DB-backed me-role. */
export async function resolvePostLoginPath(
	sessionUser?: SessionUser,
): Promise<string> {
	const sessionRole = roleFromSessionUser(sessionUser);
	if (isAdministrator(sessionRole)) return PORTAL_PATHS.admin;
	if (sessionRole) return PORTAL_PATHS.agent;

	try {
		const res = await fetch("/api/auth/me-role", {
			credentials: "include",
			cache: "no-store",
		});
		if (res.ok) {
			const data = (await res.json()) as {
				role?: string | null;
				hasAdminAccess?: boolean;
			};
			if (data.hasAdminAccess || data.role === "admin") {
				return PORTAL_PATHS.admin;
			}
			if (data.role === "agent" || data.role === "team_lead") {
				return PORTAL_PATHS.agent;
			}
		}
	} catch {
		// Fall through to agent portal
	}

	return PORTAL_PATHS.agent;
}

export function postLoginPathFromRole(role: AppRole | undefined): string {
	return isAdministrator(role) ? PORTAL_PATHS.admin : PORTAL_PATHS.agent;
}
