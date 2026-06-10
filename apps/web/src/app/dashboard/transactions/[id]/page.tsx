"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import { TransactionDetailView } from "@/features/transactions/transaction-detail-view";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftLine,
	RiDashboardLine,
	RiEditLine,
	RiFileTextLine,
} from "@remixicon/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function AgentTransactionDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const transactionId = params.id;
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);
	const { openEditModal } = useTransactionModalActions();

	const { data: tx, isLoading, error } = trpc.transactions.getById.useQuery(
		{ id: transactionId },
		{ enabled: !!session && !!transactionId },
	);

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const canEdit = tx?.status === "draft";

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbLink href="/dashboard/transactions">
										Transactions
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileTextLine size={18} />
										{tx?.caseNo ?? "Transaction detail"}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>

				<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" asChild>
								<Link href="/dashboard/transactions">
									<RiArrowLeftLine className="mr-1 size-4" />
									Back to transactions
								</Link>
							</Button>
						</div>
						{canEdit && tx ? (
							<Button
								size="sm"
								onClick={() => openEditModal(tx.id)}
							>
								<RiEditLine className="mr-1 size-4" />
								Edit draft
							</Button>
						) : null}
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Transaction details</CardTitle>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="space-y-4">
									<Skeleton className="h-6 w-48" />
									<Skeleton className="h-32 w-full" />
									<Skeleton className="h-32 w-full" />
								</div>
							) : error ? (
								<div className="space-y-3">
									<p className="text-destructive text-sm">{error.message}</p>
									<Button
										variant="outline"
										onClick={() => router.push("/dashboard/transactions")}
									>
										Return to list
									</Button>
								</div>
							) : tx ? (
								<TransactionDetailView tx={tx} />
							) : null}
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
