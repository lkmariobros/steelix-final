"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

const DEFAULT_IDLE_MINUTES = 60;

/** Pass stable user id string — not session object references. */
export function useInactivityLogout(userId: string | null) {
	const idleMs = useMemo(() => {
		const env =
			typeof window !== "undefined"
				? process.env.NEXT_PUBLIC_IDLE_LOGOUT_MINUTES
				: undefined;
		const minutes = env ? Number(env) : DEFAULT_IDLE_MINUTES;
		return (
			(Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_IDLE_MINUTES) *
			60_000
		);
	}, []);

	const timeoutIdRef = useRef<number | null>(null);
	const lastActivityRef = useRef<number>(Date.now());

	useEffect(() => {
		if (!userId) return;

		const clear = () => {
			if (timeoutIdRef.current) window.clearTimeout(timeoutIdRef.current);
			timeoutIdRef.current = null;
		};

		const arm = () => {
			clear();
			timeoutIdRef.current = window.setTimeout(async () => {
				const idleFor = Date.now() - lastActivityRef.current;
				if (idleFor < idleMs) {
					arm();
					return;
				}
				const { authClient } = await import("@/lib/auth-client");
				await authClient.signOut({
					fetchOptions: {
						onSuccess: () => {
							toast.info("You've been signed out due to inactivity.");
							window.location.href = "/login";
						},
					},
				});
			}, idleMs);
		};

		const onActivity = () => {
			lastActivityRef.current = Date.now();
			arm();
		};

		const events: Array<keyof WindowEventMap> = [
			"mousemove",
			"mousedown",
			"keydown",
			"touchstart",
			"scroll",
		];
		for (const e of events)
			window.addEventListener(e, onActivity, { passive: true });

		arm();

		return () => {
			for (const e of events) window.removeEventListener(e, onActivity);
			clear();
		};
	}, [idleMs, userId]);
}
