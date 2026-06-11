"use client";

import { LoadingScreen } from "@/components/ui/loading-spinner";
import { authClient } from "@/lib/auth-client";
import { redirectAfterAuth } from "@/lib/redirect-after-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REDIRECT_TIMEOUT_MS = 10_000;

export default function PostLoginPage() {
	const router = useRouter();
	const redirected = useRef(false);

	useEffect(() => {
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
				const { data } = await authClient.getSession();
				if (cancelled) return;

				if (!data?.user) {
					window.clearTimeout(timeout);
					router.replace("/login");
					return;
				}

				redirectAfterAuth(
					router.replace,
					data.user as { role?: string | null },
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
	}, [router]);

	return <LoadingScreen text="Signing you in..." />;
}
