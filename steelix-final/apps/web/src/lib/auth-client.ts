import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL, // Backend URL where auth endpoints are hosted
	fetchOptions: {
		credentials: "include", // Include cookies in cross-origin requests
		onError: (context) => {
			// ✅ FIXED: Corrected Better Auth ErrorContext properties
			console.error("Better Auth Error:", {
				request: context.request,
				response: context.response,
				error: context.error,
			});
		},
		onSuccess: (context) => {
			// ✅ FIXED: Corrected Better Auth SuccessContext properties
			if (process.env.NODE_ENV === 'development') {
				console.log("Better Auth Success:", {
					request: context.request,
					response: context.response,
				});
			}
		},
	},
});
