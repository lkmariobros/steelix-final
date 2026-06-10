"use client";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/sidebar";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailView } from "@/features/transactions/transaction-detail-view";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftLine,
	RiDashboardLine,
	RiFileTextLine,
} from "@remixicon/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function AdminTransactionDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const transactionId = params.id;

	const { data: tx, isLoading, error } =
		trpc.transactions.adminGetById.useQuery(
			{ id: transactionId },
			{ enabled: !!transactionId },
		);

	const { data: agentData } = trpc.agents.getById.useQuery(
		{ id: tx?.agentId ?? "" },
		{ enabled: !!tx?.agentId },
	);

	return (
		<>
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
								<BreadcrumbLink href="/admin">
									<RiDashboardLine size={22} aria-hidden="true" />
									<span className="sr-only">Admin</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbLink href="/admin/approvals">
									Approvals
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
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href="/admin/approvals">
							<RiArrowLeftLine className="mr-1 size-4" />
							Back to approvals
						</Link>
					</Button>
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
									onClick={() => router.push("/admin/approvals")}
								>
									Return to approvals
								</Button>
							</div>
						) : tx ? (
							<TransactionDetailView
								tx={tx}
								agentName={agentData?.agent?.name}
								agentEmail={agentData?.agent?.email}
							/>
						) : null}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
