"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Shows a toast once after `/api/clear-auth-session` redirects here with `?cleared=1`. */
export function LoginSessionToast() {
	const searchParams = useSearchParams();
	const shown = useRef(false);

	useEffect(() => {
		if (shown.current) return;
		if (searchParams.get("cleared") !== "1") return;
		shown.current = true;
		toast.message("Session reset", {
			description:
				"Old sign-in cookies were cleared. Try signing in again. If it still fails, clear site data for this domain in your browser.",
		});
	}, [searchParams]);

	return null;
}
