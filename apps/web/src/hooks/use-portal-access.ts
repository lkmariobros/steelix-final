"use client";

import { useUserRole } from "@/hooks/use-user-role";

/** @deprecated Prefer `useUserRole` — kept for existing imports. */
export function usePortalAccess() {
	const { hasAdminAccess, isChecking, session, role } = useUserRole();

	return {
		canAdmin: hasAdminAccess,
		effectiveRoles: role ? [role] : [],
		isRoleLoading: isChecking,
		session,
	};
}
