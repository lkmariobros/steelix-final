"use client";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Guard for Admin-only pages.
 * - Redirects non-admin authenticated users to /dashboard
 * - Leaves unauthenticated redirects to `useRedirectUnauthenticated`
 */
function sessionRoleFromClient(session: {
	user?: unknown;
} | null): string | undefined {
	const r = (session?.user as { role?: string | null } | undefined)?.role;
	return r && r.length > 0 ? r : undefined;
}

export function useRequireAdmin() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	const sessionRole = session ? sessionRoleFromClient(session) : undefined;
	const needsRoleQuery =
		!!session &&
		sessionRole !== "admin" &&
		sessionRole !== "agent" &&
		sessionRole !== "team_lead";

	const { data: roleCheck, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: needsRoleQuery,
			retry: false,
			staleTime: 5 * 60 * 1000,
		});

	useEffect(() => {
		if (isPending) return;
		if (!session) return;
		if (needsRoleQuery && isRoleLoading) return;

		const hasAdmin =
			sessionRole === "admin" || roleCheck?.hasAdminAccess === true;
		if (!hasAdmin) {
			router.replace("/dashboard");
		}
	}, [
		isPending,
		session,
		needsRoleQuery,
		isRoleLoading,
		sessionRole,
		roleCheck,
		router,
	]);

	const isChecking =
		isPending || (!!session && needsRoleQuery && isRoleLoading);
	const isAdmin =
		!!session &&
		(sessionRole === "admin" || roleCheck?.hasAdminAccess === true);

	return {
		session,
		isChecking,
		isAdmin,
	};
}

