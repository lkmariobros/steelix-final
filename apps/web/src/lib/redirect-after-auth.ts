import {
	resolvePostLoginPath,
	userFromAuthResponse,
} from "@/lib/post-login-redirect";
import { seedSessionFromAuthResponse } from "@/lib/auth-client";

type SessionUser = { role?: string | null } | undefined;

/** Client-side post-auth redirect — synchronous path resolution, no me-role. */
export function redirectAfterAuth(
	navigate: (path: string) => void,
	sessionUser?: SessionUser,
) {
	navigate(resolvePostLoginPath(sessionUser));
}

/** Seed session atom from sign-in response, then redirect without extra get-session/me-role. */
export function redirectAfterFreshAuth(
	navigate: (path: string) => void,
	authResponse?: unknown,
) {
	seedSessionFromAuthResponse(authResponse);
	redirectAfterAuth(navigate, userFromAuthResponse(authResponse));
}
