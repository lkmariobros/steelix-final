"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { useUserRole } from "@/hooks/use-user-role";
import { authClient } from "@/lib/auth-client";

/**
 * Agent portal layout — admins may also use /dashboard (dual portal access).
 * Admin-only UI lives under /admin and is blocked by middleware + useRequireAdmin.
 */
export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);
	const { isChecking } = useUserRole();

	if (isPending || isChecking) {
		return <LoadingScreen text="Loading..." />;
	}
	if (!session) return <LoadingScreen text="Redirecting..." />;

	return children;
}
