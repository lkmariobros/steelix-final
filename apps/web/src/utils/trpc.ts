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
			// Data considered fresh for 30 seconds - no refetch during this time
			staleTime: 30 * 1000,
			// Keep unused data in cache for 5 minutes before garbage collection
			gcTime: 5 * 60 * 1000,
			// Don't refetch when window regains focus (reduces unnecessary calls)
			refetchOnWindowFocus: false,
			// Don't refetch when reconnecting (let user trigger manually if needed)
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
			toast.error(error.message, {
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
			url: typeof window !== 'undefined' ? '/api/trpc' : `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080'}/trpc`,
			headers() {
				return {
					'Content-Type': 'application/json',
				};
			},
		}),
	],
});


