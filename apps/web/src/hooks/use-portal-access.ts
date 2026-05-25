"use client";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

function getSessionRoles(session: ReturnType<typeof authClient.useSession>["data"]) {
	const user = session?.user as { roles?: string[]; role?: string } | undefined;
	return user?.roles ?? [user?.role ?? "agent"];
}

function getEffectiveRoles(
	session: ReturnType<typeof authClient.useSession>["data"],
	apiRoles?: string[],
) {
	const merged = new Set<string>(apiRoles ?? getSessionRoles(session));
	const legacyRole = (session?.user as { role?: string } | undefined)?.role;
	if (legacyRole) merged.add(legacyRole);
	return [...merged];
}

export function usePortalAccess() {
	const { data: session } = authClient.useSession();
	const { data: roleCheck, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		});

	const effectiveRoles = getEffectiveRoles(session, roleCheck?.roles);
	const canAdmin =
		roleCheck?.hasAdminAccess ?? effectiveRoles.includes("admin");

	return {
		canAdmin,
		effectiveRoles,
		isRoleLoading: !!session && isRoleLoading,
	};
}
