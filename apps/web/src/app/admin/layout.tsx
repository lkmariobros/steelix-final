"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
} from "@/components/sidebar";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useAdminPrefetch } from "@/hooks/use-admin-prefetch";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { useRequireAdmin } from "@/hooks/use-require-admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const admin = useRequireAdmin();
	useRedirectUnauthenticated(admin.session, admin.isSessionPending);
	useAdminPrefetch(!!admin.session && admin.isAdmin);

	if (admin.isSessionPending) return <LoadingScreen text="Loading..." />;
	if (!admin.session) return <LoadingScreen text="Redirecting..." />;
	if (admin.isChecking) return <LoadingScreen text="Checking access..." />;
	if (!admin.isAdmin) return <LoadingScreen text="Redirecting..." />;

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}

