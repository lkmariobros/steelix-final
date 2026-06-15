export type AppRole = "super_admin" | "admin" | "agent" | "team_lead";

const APP_ROLES: AppRole[] = ["super_admin", "admin", "agent", "team_lead"];

export function isAppRole(value: string | null | undefined): value is AppRole {
	return !!value && APP_ROLES.includes(value as AppRole);
}

export function roleFromSessionUser(
	user: { role?: string | null } | undefined,
): AppRole | undefined {
	const r = user?.role;
	return isAppRole(r) ? r : undefined;
}

/** Admin portal access (super admin + admin). */
export function isAdministrator(role: AppRole | undefined): boolean {
	return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: AppRole | undefined): boolean {
	return role === "super_admin";
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

export function formatAccountRole(role: string | null | undefined): string {
	switch (role) {
		case "super_admin":
			return "Super Admin";
		case "admin":
			return "Admin";
		case "team_lead":
			return "Team Lead";
		case "agent":
			return "Agent";
		default:
			return role ?? "Unknown";
	}
}

export function accountRoleBadgeClass(role: string | null | undefined): string {
	switch (role) {
		case "super_admin":
			return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
		case "admin":
			return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
		case "team_lead":
			return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
		default:
			return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
	}
}
