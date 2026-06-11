import { authClient } from "@/lib/auth-client";
import { resolvePostLoginPath } from "@/lib/post-login-redirect";

type SessionUser = { role?: string | null } | undefined;

/** Client-side post-auth redirect — avoids full page reload and duplicate get-session calls. */
export async function redirectAfterAuth(
	navigate: (path: string) => void,
	sessionUser?: SessionUser,
) {
	const path = await resolvePostLoginPath(sessionUser);
	navigate(path);
}

/** Extract user from Better Auth sign-in/sign-up success payload when present. */
export function userFromAuthResponse(data: unknown): SessionUser {
	if (!data || typeof data !== "object") return undefined;
	const user = (data as { user?: SessionUser }).user;
	return user ?? undefined;
}

/**
 * After sign-in/sign-up, Better Auth triggers a single get-session refetch.
 * Wait for that in-flight result instead of hard-navigating to /post-login.
 */
export function waitForSessionUser(timeoutMs = 8_000): Promise<SessionUser> {
	return new Promise((resolve) => {
		const sessionAtom = authClient.$store.atoms.session;
		let settled = false;
		let unsubscribe = () => {};
		let timeoutId = 0;

		const finish = (user: SessionUser) => {
			if (settled) return;
			settled = true;
			unsubscribe();
			window.clearTimeout(timeoutId);
			resolve(user);
		};

		const existing = sessionAtom.get();
		if (existing.data?.user) {
			finish(existing.data.user as SessionUser);
			return;
		}

		timeoutId = window.setTimeout(() => finish(undefined), timeoutMs);
		unsubscribe = sessionAtom.subscribe((value) => {
			if (value.data?.user) {
				finish(value.data.user as SessionUser);
				return;
			}
			if (!value.isPending && !value.isRefetching) {
				finish(undefined);
			}
		});
	});
}

/** Redirect after fresh sign-in/sign-up using response user or the pending session refetch. */
export async function redirectAfterFreshAuth(
	navigate: (path: string) => void,
	authResponse?: unknown,
) {
	const responseUser = userFromAuthResponse(authResponse);
	const sessionUser = responseUser ?? (await waitForSessionUser());
	await redirectAfterAuth(navigate, sessionUser);
}
