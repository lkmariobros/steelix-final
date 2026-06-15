"use client";

import { authClient, type AuthSessionData } from "@/lib/auth-client";
import {
	isAdministrator,
	isAppRole,
	isSuperAdmin,
	roleFromSessionUser,
	type AppRole,
} from "@/lib/user-role";
import { trpc } from "@/utils/trpc";
import { usePathname } from "next/navigation";
import {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
} from "react";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";

const AUTH_PATHS = new Set(["/login", "/post-login", "/reset-password"]);

type SessionUser = AuthSessionData["user"];

export type UserRoleContextValue = {
	session: AuthSessionData | null;
	isSessionPending: boolean;
	role: AppRole | undefined;
	hasAdminAccess: boolean;
	isSuperAdmin: boolean;
	isAdmin: boolean;
	isAgentPortalUser: boolean;
	isChecking: boolean;
	isRoleLoading: boolean;
};

const GUEST_VALUE: UserRoleContextValue = {
	session: null,
	isSessionPending: false,
	role: undefined,
	hasAdminAccess: false,
	isSuperAdmin: false,
	isAdmin: false,
	isAgentPortalUser: true,
	isChecking: false,
	isRoleLoading: false,
};

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

/** Plain copy — never call methods on Better Auth proxy objects. */
function plainSessionUser(user: unknown): SessionUser | undefined {
	if (!user || typeof user !== "object") return undefined;
	const record = user as Record<string, unknown>;
	const id = typeof record.id === "string" ? record.id : undefined;
	const email = typeof record.email === "string" ? record.email : undefined;
	if (!id && !email) return undefined;

	let roles: string[] | undefined;
	const rawRoles = record.roles;
	if (Array.isArray(rawRoles)) {
		roles = [];
		for (const entry of rawRoles) {
			if (typeof entry === "string") roles.push(entry);
		}
		if (roles.length === 0) roles = undefined;
	}

	return {
		id,
		email,
		name: typeof record.name === "string" ? record.name : undefined,
		role:
			typeof record.role === "string"
				? record.role
				: record.role === null
					? null
					: undefined,
		roles,
	};
}

function sessionUserFromRaw(rawSession: unknown): SessionUser | undefined {
	if (!rawSession || typeof rawSession !== "object") return undefined;
	return plainSessionUser((rawSession as { user?: unknown }).user);
}

function GuestUserRoleProvider({ children }: { children: ReactNode }) {
	return (
		<UserRoleContext.Provider value={GUEST_VALUE}>
			{children}
		</UserRoleContext.Provider>
	);
}

function ActiveUserRoleProvider({ children }: { children: ReactNode }) {
	const { data: rawSession, isPending } = authClient.useSession();

	// Memoize on primitive fields — rawSession proxy reference changes every render
	const rawUser =
		rawSession && typeof rawSession === "object"
			? (rawSession as { user?: unknown }).user
			: undefined;
	const userRecord =
		rawUser && typeof rawUser === "object"
			? (rawUser as Record<string, unknown>)
			: null;
	const rolesKey = (() => {
		const rawRoles = userRecord?.roles;
		if (!Array.isArray(rawRoles)) return "";
		let key = "";
		for (const entry of rawRoles) {
			if (typeof entry === "string") key += `${entry}\0`;
		}
		return key;
	})();

	const sessionUser = useMemo(
		() => sessionUserFromRaw(rawSession),
		[
			typeof userRecord?.id === "string" ? userRecord.id : undefined,
			typeof userRecord?.email === "string" ? userRecord.email : undefined,
			typeof userRecord?.name === "string" ? userRecord.name : undefined,
			typeof userRecord?.role === "string" || userRecord?.role === null
				? userRecord.role
				: undefined,
			rolesKey,
		],
	);

	const session: AuthSessionData | null = useMemo(
		() => (sessionUser ? { user: sessionUser, session: null } : null),
		[sessionUser],
	);
	const userId = sessionUser?.id;
	const isSessionPending = isPending && !userId;

	const sessionRole = roleFromSessionUser(session?.user);
	const sessionHasAdminRole =
		(sessionUser?.roles?.some(
			(r) => r === "admin" || r === "super_admin",
		) ??
			false) ||
		isAdministrator(sessionRole);

	const { data: roleCheck, isLoading: isRoleQueryLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!userId,
			retry: false,
			staleTime: 10 * 60 * 1000,
			gcTime: 15 * 60 * 1000,
		});

	const serverRole = isAppRole(roleCheck?.role) ? roleCheck.role : undefined;
	const role: AppRole | undefined = serverRole ?? sessionRole;
	const hasAdminAccess =
		roleCheck?.hasAdminAccess === true ||
		isAdministrator(role) ||
		sessionHasAdminRole;
	const isSuperAdminUser =
		roleCheck?.hasSuperAdminAccess === true || isSuperAdmin(role);

	useInactivityLogout(userId ?? null);

	const value = useMemo<UserRoleContextValue>(
		() => ({
			session,
			isSessionPending,
			role,
			hasAdminAccess,
			isSuperAdmin: isSuperAdminUser,
			isAdmin: hasAdminAccess,
			isAgentPortalUser: !hasAdminAccess,
			isChecking: isSessionPending,
			isRoleLoading: !!userId && isRoleQueryLoading,
		}),
		[
			session,
			isSessionPending,
			role,
			hasAdminAccess,
			isSuperAdminUser,
			userId,
			isRoleQueryLoading,
		],
	);

	return (
		<UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>
	);
}

/**
 * Auth pages: static guest context (no session hooks).
 * App pages: single useSession + role check.
 */
export function UserRoleProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	if (AUTH_PATHS.has(pathname)) {
		return <GuestUserRoleProvider>{children}</GuestUserRoleProvider>;
	}
	return <ActiveUserRoleProvider>{children}</ActiveUserRoleProvider>;
}

export function useUserRole(): UserRoleContextValue {
	const ctx = useContext(UserRoleContext);
	if (!ctx) {
		throw new Error("useUserRole must be used within UserRoleProvider");
	}
	return ctx;
}

export function useOptionalUserRole(): UserRoleContextValue | null {
	return useContext(UserRoleContext);
}

export function useAuthSession() {
	const { session, isSessionPending } = useUserRole();
	return { data: session, isPending: isSessionPending };
}
