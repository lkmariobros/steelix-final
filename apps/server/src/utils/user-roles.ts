/** Normalise stored `user.role` for comparisons (defaults to agent). */
export function normaliseUserRole(role: string | null | undefined): string {
	return (role ?? "agent").trim().toLowerCase();
}

/** Whether a user account can receive lead assignments (agents and team leads). */
export function isAssignableLeadAgentRole(role: string | null | undefined): boolean {
	const normalised = normaliseUserRole(role);
	return normalised === "agent" || normalised === "team_lead";
}

/** Merge legacy `role` with `roles[]` for permission checks. */
export function getEffectiveRoles(user: {
	role?: string | null;
	roles?: string[] | null;
}): string[] {
	const merged = new Set<string>(user.roles ?? []);
	if (user.role) merged.add(user.role);
	if (merged.size === 0) merged.add("agent");
	return [...merged];
}

export function hasSuperAdminAccess(user: {
	role?: string | null;
	roles?: string[] | null;
}): boolean {
	return getEffectiveRoles(user).includes("super_admin");
}

export function hasAdminAccess(user: {
	role?: string | null;
	roles?: string[] | null;
}): boolean {
	const roles = getEffectiveRoles(user);
	return roles.includes("admin") || roles.includes("super_admin");
}

export function hasAgentAccess(user: {
	role?: string | null;
	roles?: string[] | null;
}): boolean {
	const roles = getEffectiveRoles(user);
	return roles.includes("agent") || roles.includes("admin") || roles.includes("super_admin");
}

export function getPrimaryRole(user: {
	role?: string | null;
	roles?: string[] | null;
}): string {
	const roles = getEffectiveRoles(user);
	if (roles.includes("super_admin")) return "super_admin";
	if (roles.includes("admin")) return "admin";
	if (roles.includes("team_lead")) return "team_lead";
	return "agent";
}
