"use client";

import { useUserRole } from "@/hooks/use-user-role";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
/**
 * Guard for Admin-only pages.
 * - Redirects non-admin authenticated users to /dashboard
 * - Leaves unauthenticated redirects to `useRedirectUnauthenticated`
 */
export function useRequireAdmin() {
	const router = useRouter();
	const redirected = useRef(false);
	const { session, hasAdminAccess, isSessionPending, isRoleLoading } = useUserRole();

	// Redirect non-admins once after role resolves
	useEffect(() => {
		const id = session?.user.id;
		if (isSessionPending || !id || isRoleLoading || redirected.current) return;
		if (!hasAdminAccess) {
			redirected.current = true;
			router.replace("/dashboard");
		}
	}, [isSessionPending, session?.user.id, isRoleLoading, hasAdminAccess, router]);

	return {
		session,
		isChecking: isSessionPending,
		isSessionPending,
		isAdmin: !!session && hasAdminAccess,
	};
}
