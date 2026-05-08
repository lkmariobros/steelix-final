"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useEffect } from "react";

export default function PostLoginPage() {
	const { data: session, isPending } = authClient.useSession();

	const sessionRoleRaw = (session?.user as { role?: string | null })?.role ?? "";
	const hasKnownRole =
		sessionRoleRaw === "admin" ||
		sessionRoleRaw === "agent" ||
		sessionRoleRaw === "team_lead";

	const { data: roleCheck, isLoading } = trpc.admin.checkAdminRole.useQuery(
		undefined,
		{
			enabled: !!session && !hasKnownRole,
			retry: false,
			staleTime: 5 * 60 * 1000,
		},
	);

	useEffect(() => {
		if (isPending) return;
		if (!session) {
			window.location.href = "/login";
			return;
		}
		if (!hasKnownRole && isLoading) return;

		const role =
			hasKnownRole ? sessionRoleRaw : (roleCheck?.role ?? "agent");
		window.location.href = role === "admin" ? "/admin" : "/dashboard";
	}, [isPending, session, hasKnownRole, isLoading, roleCheck, sessionRoleRaw]);

	return <LoadingScreen text="Signing you in..." />;
}

