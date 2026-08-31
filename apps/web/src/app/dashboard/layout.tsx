"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
} from "@/components/sidebar";
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
	useRedirectUnauthenticated(session?.user.id, isSessionPending);

	if (isSessionPending || isChecking) {
		return <LoadingScreen text="Loading..." />;
	}
	if (!session) return <LoadingScreen text="Redirecting..." />;

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AppSidebar />
			<SidebarInset className="h-svh min-h-0 overflow-y-auto overscroll-y-contain bg-background px-4 md:px-6 lg:px-8">
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
