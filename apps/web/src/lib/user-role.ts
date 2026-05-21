export type AppRole = "admin" | "agent" | "team_lead";

const APP_ROLES: AppRole[] = ["admin", "agent", "team_lead"];

export function isAppRole(value: string | null | undefined): value is AppRole {
	return !!value && APP_ROLES.includes(value as AppRole);
}

export function roleFromSessionUser(
	user: { role?: string | null } | undefined,
): AppRole | undefined {
	const r = user?.role;
	return isAppRole(r) ? r : undefined;
}

export function isAdministrator(role: AppRole | undefined): boolean {
	return role === "admin";
}

/** Agents and team leads use the agent portal only (no admin UI). */
export function usesAgentPortal(role: AppRole | undefined): boolean {
	return role === "agent" || role === "team_lead" || role === undefined;
}

export const PORTAL_PATHS = {
	admin: "/admin",
	agent: "/dashboard",
} as const;

export function isAdminPortalPath(pathname: string): boolean {
	return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAgentPortalPath(pathname: string): boolean {
	return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}
