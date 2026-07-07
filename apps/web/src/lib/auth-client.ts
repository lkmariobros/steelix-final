import { createAuthClient } from "better-auth/react";

const getBaseURL = () => {
	if (typeof window !== "undefined") {
		return "";
	}
	return process.env.NEXT_PUBLIC_SERVER_URL || "";
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	basePath: "/api/auth",
	fetchOptions: {
		credentials: "include",
	},
});

/** Shape stored in Better Auth's session atom (matches get-session response). */
export type AuthSessionData = {
	user: {
		id?: string;
		email?: string;
		name?: string;
		role?: string | null;
		roles?: string[] | null;
		[key: string]: unknown;
	};
	session?: Record<string, unknown> | null;
};

/** Write sign-in/sign-up response into the session atom so post-login skips get-session. */
export function seedSessionFromAuthResponse(authResponse: unknown): boolean {
	if (!authResponse || typeof authResponse !== "object") return false;

	const payload = authResponse as Record<string, unknown>;
	const rawUser =
		payload.user ??
		(payload.session as { user?: Record<string, unknown> } | undefined)?.user;

	if (!rawUser || typeof rawUser !== "object") return false;

	const userRecord = rawUser as Record<string, unknown>;
	if (!userRecord.id && !userRecord.email) return false;

	// Plain copy — never store Better Auth proxy objects in the atom
	const user: AuthSessionData["user"] = {
		id: typeof userRecord.id === "string" ? userRecord.id : undefined,
		email: typeof userRecord.email === "string" ? userRecord.email : undefined,
		name: typeof userRecord.name === "string" ? userRecord.name : undefined,
		role:
			typeof userRecord.role === "string"
				? userRecord.role
				: userRecord.role === null
					? null
					: undefined,
		roles: Array.isArray(userRecord.roles)
			? userRecord.roles.filter((r): r is string => typeof r === "string")
			: undefined,
	};

	const sessionData: AuthSessionData = {
		user,
		session:
			payload.session && typeof payload.session === "object"
				? { ...(payload.session as Record<string, unknown>) }
				: null,
	};

	const atom = authClient.$store.atoms.session;
	const current = atom.get();
	atom.set({
		data: sessionData,
		error: null,
		isPending: false,
		isRefetching: false,
		refetch: current.refetch,
	});

	return true;
}
