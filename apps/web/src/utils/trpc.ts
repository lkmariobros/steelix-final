import { QueryCache, QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { toast } from "sonner";
import type { AppRouter } from "../../../server/src/routers";

// ✅ PERFORMANCE: Configure QueryClient with smart caching defaults
// This prevents unnecessary API calls on page navigation
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Keep tab data warm — avoid refetch on every sidebar click
			staleTime: 3 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			// Retry failed requests once with exponential backoff
			retry: 1,
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
		},
		mutations: {
			// Mutations don't retry by default (user should be notified of failures)
			retry: false,
		},
	},
	queryCache: new QueryCache({
		onError: (error) => {
			const message =
				error.message === "Unexpected end of JSON input"
					? "Session cookies are stale/oversized. Please sign in again or use Reset session cookies on login."
					: error.message;
			toast.error(message, {
				action: {
					label: "retry",
					onClick: () => {
						queryClient.invalidateQueries();
					},
				},
			});
		},
	}),
});

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
	links: [
		httpBatchLink({
			// Use local proxy to avoid cross-origin cookie issues on mobile
			// Use 127.0.0.1 instead of localhost for better Windows compatibility
			url:
				typeof window !== "undefined"
					? "/api/trpc"
					: `${process.env.NEXT_PUBLIC_SERVER_URL || "http://127.0.0.1:8080"}/trpc`,
			headers() {
				return {
					"Content-Type": "application/json",
				};
			},
		}),
	],
});
