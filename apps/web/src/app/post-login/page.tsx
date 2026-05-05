"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useEffect } from "react";

export default function PostLoginPage() {
	const { data: session, isPending } = authClient.useSession();

	const { data: roleCheck, isLoading } = trpc.admin.checkAdminRole.useQuery(undefined, {
		enabled: !!session,
		retry: false,
	});

	useEffect(() => {
		if (isPending) return;
		if (!session) {
			window.location.href = "/login";
			return;
		}
		if (isLoading) return;

		const role = roleCheck?.role ?? (session.user as { role?: string })?.role ?? "agent";
		window.location.href = role === "admin" ? "/admin" : "/dashboard";
	}, [isPending, session, isLoading, roleCheck]);

	return <LoadingScreen text="Signing you in..." />;
}

