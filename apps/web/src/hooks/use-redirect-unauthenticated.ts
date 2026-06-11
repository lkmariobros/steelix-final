"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Redirects to login when session is resolved and missing.
 * Pass stable userId — not session object references.
 */
export function useRedirectUnauthenticated(
	userId: string | undefined,
	isPending: boolean,
	loginPath = "/login",
) {
	const router = useRouter();
	const redirected = useRef(false);

	useEffect(() => {
		if (isPending || userId || redirected.current) return;
		redirected.current = true;
		router.replace(loginPath);
	}, [isPending, userId, router, loginPath]);
}
