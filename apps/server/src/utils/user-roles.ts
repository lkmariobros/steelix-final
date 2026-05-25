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

export function hasAdminAccess(user: {
	role?: string | null;
	roles?: string[] | null;
}): boolean {
	return getEffectiveRoles(user).includes("admin");
}

export function hasAgentAccess(user: {
	role?: string | null;
	roles?: string[] | null;
}): boolean {
	const roles = getEffectiveRoles(user);
	return roles.includes("agent") || roles.includes("admin");
}

export function getPrimaryRole(user: {
	role?: string | null;
	roles?: string[] | null;
}): string {
	const roles = getEffectiveRoles(user);
	if (roles.includes("admin")) return "admin";
	if (roles.includes("team_lead")) return "team_lead";
	return "agent";
}
