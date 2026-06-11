"use client";

import { queryClient, trpc } from "@/utils/trpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { UserRoleProvider } from "@/contexts/user-role-context";
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
					url: "/api/trpc",
					fetch(url, options) {
						return fetch(url, {
							...options,
							credentials: "include",
						});
					},
				}),
			],
		}),
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
						<UserRoleProvider>{children}</UserRoleProvider>
						<GlobalTransactionModal />
						<ReactQueryDevtools />
					</TransactionModalProvider>
				</QueryClientProvider>
			</trpc.Provider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
