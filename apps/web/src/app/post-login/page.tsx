"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { authClient } from "@/lib/auth-client";
import { resolvePostLoginPath } from "@/lib/post-login-redirect";
import { useEffect, useRef } from "react";

const REDIRECT_TIMEOUT_MS = 10_000;

export default function PostLoginPage() {
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const redirected = useRef(false);

	useEffect(() => {
		if (isSessionPending) return;

		if (!session?.user) {
			window.location.href = "/login";
			return;
		}

		if (redirected.current) return;
		redirected.current = true;

		let cancelled = false;

		const timeout = window.setTimeout(() => {
			if (!cancelled) {
				window.location.href = "/dashboard";
			}
		}, REDIRECT_TIMEOUT_MS);

		void (async () => {
			try {
				const path = await resolvePostLoginPath(
					session.user as { role?: string | null },
				);
				if (!cancelled) {
					window.clearTimeout(timeout);
					window.location.href = path;
				}
			} catch {
				if (!cancelled) {
					window.clearTimeout(timeout);
					window.location.href = "/dashboard";
				}
			}
		})();

		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [isSessionPending, session]);

	return <LoadingScreen text="Signing you in..." />;
}
