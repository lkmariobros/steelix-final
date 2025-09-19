"use client";

import { queryClient, trpc } from "@/utils/trpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TransactionModalProvider } from "@/contexts/transaction-modal-context";
import { GlobalTransactionModal } from "./global-transaction-modal";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";

export default function Providers({
	children,
}: {
	children: React.ReactNode;
}) {
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: `${process.env.NEXT_PUBLIC_SERVER_URL}/trpc`,
					fetch(url, options) {
						return fetch(url, {
							...options,
							credentials: "include", // Better Auth cookies
						});
					},
				}),
			],
		})
	);

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="dark"
			forcedTheme="dark"
			enableSystem={false}
			disableTransitionOnChange
		>
			<trpc.Provider client={trpcClient} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<TransactionModalProvider>
						{children}
						<GlobalTransactionModal />
						<ReactQueryDevtools />
					</TransactionModalProvider>
				</QueryClientProvider>
			</trpc.Provider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
