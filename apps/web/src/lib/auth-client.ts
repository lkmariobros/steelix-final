"use client";

import { useCallback, useEffect, useState } from "react";

export type AuthSessionData = {
	user: {
		id?: string;
		email?: string;
		name?: string;
		image?: string | null;
		role?: string | null;
		roles?: string[] | null;
	};
	session?: Record<string, unknown> | null;
};

type SessionStore = {
	data: AuthSessionData | null;
	error: Error | null;
	isPending: boolean;
	isRefetching: boolean;
};

const listeners = new Set<() => void>();
let store: SessionStore = {
	data: null,
	error: null,
	isPending: true,
	isRefetching: false,
};

function emit() {
	for (const listener of listeners) listener();
}

function setStore(next: Partial<SessionStore>) {
	store = { ...store, ...next };
	emit();
}

async function parseJson(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return { message: text };
	}
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
	return fetch(`/api/auth/${path.replace(/^\//, "")}`, {
		credentials: "include",
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
}

type AuthCallbacks = {
	onSuccess?: (ctx: { data: unknown }) => void;
	onError?: (ctx: { error: { message?: string }; status?: number }) => void;
};

async function postJson(
	path: string,
	body: Record<string, unknown>,
	callbacks?: AuthCallbacks,
) {
	const response = await authFetch(path, {
		method: "POST",
		body: JSON.stringify(body),
	});
	const data = await parseJson(response);
	if (!response.ok) {
		const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
		const message =
			(typeof record.message === "string" && record.message) ||
			"Request failed";
		callbacks?.onError?.({
			error: { message },
			status: response.status,
		});
		if (callbacks?.onError) {
			return { data: null, error: { message } };
		}
		const error = new Error(message) as Error & {
			status?: number;
			error?: { message: string };
		};
		error.status = response.status;
		error.error = { message };
		throw error;
	}
	callbacks?.onSuccess?.({ data });
	return { data, error: null };
}

export async function fetchSession(): Promise<AuthSessionData | null> {
	setStore({ isRefetching: true });
	try {
		const response = await authFetch("get-session", { method: "GET" });
		const data = await parseJson(response);
		if (!response.ok || !data || typeof data !== "object") {
			setStore({ data: null, error: null, isPending: false, isRefetching: false });
			return null;
		}
		const payload = data as AuthSessionData;
		if (!payload.user) {
			setStore({ data: null, error: null, isPending: false, isRefetching: false });
			return null;
		}
		setStore({ data: payload, error: null, isPending: false, isRefetching: false });
		return payload;
	} catch (error) {
		setStore({
			data: null,
			error: error instanceof Error ? error : new Error(String(error)),
			isPending: false,
			isRefetching: false,
		});
		return null;
	}
}

export function seedSessionFromAuthResponse(authResponse: unknown): boolean {
	if (!authResponse || typeof authResponse !== "object") return false;
	const payload = authResponse as Record<string, unknown>;
	const rawUser =
		payload.user ??
		(payload.session as { user?: Record<string, unknown> } | undefined)?.user;
	if (!rawUser || typeof rawUser !== "object") return false;
	const userRecord = rawUser as Record<string, unknown>;
	if (!userRecord.id && !userRecord.email) return false;

	const user: AuthSessionData["user"] = {
		id: typeof userRecord.id === "string" ? userRecord.id : undefined,
		email: typeof userRecord.email === "string" ? userRecord.email : undefined,
		name: typeof userRecord.name === "string" ? userRecord.name : undefined,
		image:
			typeof userRecord.image === "string" ? userRecord.image : undefined,
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

	setStore({
		data: {
			user,
			session:
				payload.session && typeof payload.session === "object"
					? { ...(payload.session as Record<string, unknown>) }
					: null,
		},
		error: null,
		isPending: false,
		isRefetching: false,
	});
	return true;
}

export const authClient = {
	signIn: {
		email: async (
			body: { email: string; password: string; rememberMe?: boolean },
			callbacks?: AuthCallbacks,
		) => postJson("sign-in/email", body, callbacks),
	},
	signUp: {
		email: async (
			body: { email: string; password: string; name?: string },
			callbacks?: AuthCallbacks,
		) => postJson("sign-up/email", body, callbacks),
	},
	signOut: async (options?: {
		fetchOptions?: {
			onSuccess?: () => void;
			onError?: () => void;
		};
	}) => {
		try {
			await authFetch("sign-out", { method: "POST", body: "{}" });
			setStore({ data: null, error: null, isPending: false, isRefetching: false });
			options?.fetchOptions?.onSuccess?.();
		} catch {
			options?.fetchOptions?.onError?.();
		}
	},
	getSession: async () => {
		const data = await fetchSession();
		return { data };
	},
	forgetPassword: async (body: { email: string; redirectTo?: string }) => {
		await postJson("forget-password", body);
	},
	resetPassword: async (body: { token: string; newPassword: string }) => {
		await postJson("reset-password", body);
	},
	useSession: () => {
		const [snapshot, setSnapshot] = useState(store);

		useEffect(() => {
			const listener = () => setSnapshot({ ...store });
			listeners.add(listener);
			if (store.isPending && !store.data) {
				void fetchSession();
			}
			return () => {
				listeners.delete(listener);
			};
		}, []);

		const refetch = useCallback(() => fetchSession(), []);
		return { ...snapshot, refetch };
	},
};
