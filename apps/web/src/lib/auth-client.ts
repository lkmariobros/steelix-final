import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
	fetchOptions: {
		credentials: "include", // Include cookies in cross-origin requests
	},
});
