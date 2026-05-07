"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);

	useEffect(() => {
		if (isPending) return;
		if (!session) return;
		const roles =
			(session.user as { roles?: string[]; role?: string })?.roles ??
			[((session.user as { role?: string })?.role ?? "agent") as string];
		// If user is admin-only (no agent role), send them to admin portal.
		if (roles.includes("admin") && !roles.includes("agent")) {
			window.location.href = "/admin";
		}
	}, [isPending, session]);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	return children;
}

