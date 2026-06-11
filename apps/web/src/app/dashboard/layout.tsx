"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { useUserRole } from "@/hooks/use-user-role";

/**
 * Agent portal layout — admins may also use /dashboard (dual portal access).
 * Admin-only UI lives under /admin and is blocked by middleware + useRequireAdmin.
 */
export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { session, isSessionPending, isChecking } = useUserRole();
	useRedirectUnauthenticated(session, isSessionPending);

	if (isSessionPending || isChecking) {
		return <LoadingScreen text="Loading..." />;
	}
	if (!session) return <LoadingScreen text="Redirecting..." />;

	return children;
}
