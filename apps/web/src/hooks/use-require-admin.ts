"use client";

import { authClient } from "@/lib/auth-client";
import { usePortalAccess } from "@/hooks/use-portal-access";
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

	const { canAdmin, isRoleLoading } = usePortalAccess();

	useEffect(() => {
		if (isPending) return;
		if (!session) return;
		if (isRoleLoading) return;
		if (!canAdmin) {
			router.replace("/dashboard");
		}
	}, [isPending, session, isRoleLoading, canAdmin, router]);

	const isChecking = isPending || (!!session && isRoleLoading);
	const isAdmin = !!session && canAdmin;

	return {
		session,
		isChecking,
		isAdmin,
	};
}

