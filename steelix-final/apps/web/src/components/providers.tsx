"use client";

import { queryClient } from "@/utils/trpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TransactionModalProvider } from "@/contexts/transaction-modal-context";
import { GlobalTransactionModal } from "./global-transaction-modal";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

export default function Providers({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="dark"
			forcedTheme="dark"
			enableSystem={false}
			disableTransitionOnChange
		>
			<QueryClientProvider client={queryClient}>
				<TransactionModalProvider>
					{children}
					<GlobalTransactionModal />
					<ReactQueryDevtools />
				</TransactionModalProvider>
			</QueryClientProvider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
