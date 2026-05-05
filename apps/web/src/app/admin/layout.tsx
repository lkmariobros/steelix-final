"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { authClient } from "@/lib/auth-client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);
	const admin = useRequireAdmin();

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;
	if (admin.isChecking) return <LoadingScreen text="Checking access..." />;
	if (!admin.isAdmin) return <LoadingScreen text="Redirecting..." />;

	return children;
}

