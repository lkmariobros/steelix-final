"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { useUserRole } from "@/hooks/use-user-role";
import { useEffect } from "react";

export default function PostLoginPage() {
	const { session, role, isChecking, isSessionPending } = useUserRole();

	useEffect(() => {
		if (isSessionPending) return;
		if (!session) {
			window.location.href = "/login";
			return;
		}
		if (isChecking) return;

		window.location.href = role === "admin" ? "/admin" : "/dashboard";
	}, [isSessionPending, session, isChecking, role]);

	return <LoadingScreen text="Signing you in..." />;
}

