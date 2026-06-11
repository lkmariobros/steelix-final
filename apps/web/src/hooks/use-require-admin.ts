"use client";

import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Guard for Admin-only pages.
 * - Redirects non-admin authenticated users to /dashboard
 * - Leaves unauthenticated redirects to `useRedirectUnauthenticated`
 */
export function useRequireAdmin() {
	const router = useRouter();
	const { session, hasAdminAccess, isChecking, isSessionPending } = useUserRole();

	useEffect(() => {
		if (isSessionPending) return;
		if (!session) return;
		if (isChecking) return;
		if (!hasAdminAccess) {
			router.replace("/dashboard");
		}
	}, [isSessionPending, session, isChecking, hasAdminAccess, router]);

	return {
		session,
		isChecking: isSessionPending || isChecking,
		isSessionPending,
		isAdmin: !!session && hasAdminAccess,
	};
}
