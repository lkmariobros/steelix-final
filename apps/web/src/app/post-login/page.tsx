"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { redirectAfterAuth } from "@/lib/redirect-after-auth";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REDIRECT_TIMEOUT_MS = 10_000;

export default function PostLoginPage() {
	const router = useRouter();
	const { data: session, isPending: isSessionPending } = authClient.useSession();
	const redirected = useRef(false);

	useEffect(() => {
		if (isSessionPending) return;

		if (!session?.user) {
			router.replace("/login");
			return;
		}

		if (redirected.current) return;
		redirected.current = true;

		let cancelled = false;

		const timeout = window.setTimeout(() => {
			if (!cancelled) {
				router.replace("/dashboard");
			}
		}, REDIRECT_TIMEOUT_MS);

		void (async () => {
			try {
				await redirectAfterAuth(
					router.replace,
					session.user as { role?: string | null },
				);
				if (!cancelled) {
					window.clearTimeout(timeout);
				}
			} catch {
				if (!cancelled) {
					window.clearTimeout(timeout);
					router.replace("/dashboard");
				}
			}
		})();

		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [isSessionPending, session, router]);

	return <LoadingScreen text="Signing you in..." />;
}
