import { createAuthClient } from "better-auth/react";

// Use relative URL for same-origin requests (fixes mobile browser cookie issues)
// The /api/auth proxy forwards requests to the backend server
const getBaseURL = () => {
	// On client-side, use relative URL to go through Next.js proxy
	if (typeof window !== 'undefined') {
		return ''; // Empty string means relative to current origin
	}
	// On server-side (SSR), use the full backend URL
	return process.env.NEXT_PUBLIC_SERVER_URL || '';
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	basePath: "/api/auth", // This will be proxied to the backend
	fetchOptions: {
		credentials: "include", // Include cookies (now same-origin, so this always works)
		onError: (context) => {
			console.error("Better Auth Error:", {
				request: context.request,
				response: context.response,
				error: context.error,
			});
		},
		onSuccess: (context) => {
			if (process.env.NODE_ENV === 'development') {
				console.log("Better Auth Success:", {
					request: context.request,
					response: context.response,
				});
			}
		},
	},
});
