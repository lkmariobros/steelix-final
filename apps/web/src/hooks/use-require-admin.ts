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
export function useRequireAdmin() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	const { data: roleCheck, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		});

	useEffect(() => {
		if (isPending) return;
		if (!session) return;
		if (isRoleLoading) return;
		if (roleCheck && !roleCheck.hasAdminAccess) {
			router.replace("/dashboard");
		}
	}, [isPending, session, isRoleLoading, roleCheck, router]);

	const isChecking = isPending || (!!session && isRoleLoading);
	const isAdmin = !!session && !!roleCheck?.hasAdminAccess;

	return {
		session,
		isChecking,
		isAdmin,
	};
}

