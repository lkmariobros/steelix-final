import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL, // Backend URL where auth endpoints are hosted
	fetchOptions: {
		credentials: "include", // Include cookies in cross-origin requests
		onError: (context) => {
			// Enhanced error handling for debugging
			console.error("Better Auth Error:", {
				url: context.url,
				method: context.method,
				status: context.response?.status,
				statusText: context.response?.statusText,
				error: context.error,
			});
		},
		onSuccess: (context) => {
			// Optional: Log successful auth operations for debugging
			if (process.env.NODE_ENV === 'development') {
				console.log("Better Auth Success:", {
					url: context.url,
					method: context.method,
					status: context.response?.status,
				});
			}
		},
	},
});
