"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects to login when session is resolved and missing.
 * Use instead of `router.push` during render (React will warn / error).
 */
export function useRedirectUnauthenticated(
	session: unknown,
	isPending: boolean,
	loginPath = "/login",
) {
	const router = useRouter();

	useEffect(() => {
		if (!isPending && !session) {
			router.replace(loginPath);
		}
	}, [isPending, session, router, loginPath]);
}
