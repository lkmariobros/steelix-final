"use client";

import { authClient } from "@/lib/auth-client";
import {
	isAdministrator,
	isAppRole,
	roleFromSessionUser,
	type AppRole,
} from "@/lib/user-role";
import { trpc } from "@/utils/trpc";

/**
 * Canonical client role resolution: server DB (checkAdminRole) + session fallback.
 * Admins must get hasAdminAccess=true before Portal Access is interactive.
 */
export function useUserRole() {
	const { data: session, isPending: isSessionPending } = authClient.useSession();

	const sessionUser = session?.user as
		| { role?: string | null; roles?: string[] | null }
		| undefined;
	const sessionRole = roleFromSessionUser(sessionUser);
	const sessionRoles = sessionUser?.roles ?? [];
	const sessionHasAdminRole =
		sessionRoles.includes("admin") || isAdministrator(sessionRole);

	const { data: roleCheck, isLoading: isRoleQueryLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
			staleTime: 5 * 60 * 1000,
		});

	const serverRole = isAppRole(roleCheck?.role) ? roleCheck.role : undefined;
	const role: AppRole | undefined = serverRole ?? sessionRole;
	const hasAdminAccess =
		roleCheck?.hasAdminAccess === true ||
		isAdministrator(role) ||
		sessionHasAdminRole;
	const isAdmin = hasAdminAccess;
	// Session resolution only — role query enriches UI but must not block navigation
	const isChecking = isSessionPending;
	const isRoleLoading = !!session && isRoleQueryLoading;

	return {
		session,
		role,
		hasAdminAccess,
		isAdmin,
		isAgentPortalUser: !hasAdminAccess,
		isChecking,
		isRoleLoading,
		isSessionPending,
	};
}
