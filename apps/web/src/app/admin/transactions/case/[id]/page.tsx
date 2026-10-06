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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import {
	AdminDeleteCaseDialog,
	adminCanDeleteCase,
} from "@/features/admin-transactions/admin-delete-case-dialog";
import { TransactionDetailView } from "@/features/transactions/transaction-detail-view";
import { AdminTransactionStatusPanel } from "@/features/transactions/admin-transaction-status-panel";
import { TransactionMessagesPanel } from "@/features/transactions/transaction-messages-panel";
import {
	formatStatusLabel,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiFileTextLine,
} from "@remixicon/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

function segmentListUrl(tx: {
	marketType?: string | null;
	transactionType?: string | null;
}): string {
	if (tx.marketType === "primary") return "/admin/transactions/new-project/sold-units";
	if (tx.transactionType === "sale") return "/admin/transactions/subsale/units";
	return "/admin/transactions/rental/units";
}

export default function AdminTransactionDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const transactionId = params.id;
	const { openEditModal } = useTransactionModalActions();
	const [deleteOpen, setDeleteOpen] = useState(false);

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
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href="/admin/approvals">
								<RiArrowLeftLine className="mr-1 size-4" />
								Back to approvals
							</Link>
						</Button>
						<Button variant="outline" size="sm" asChild>
							<Link href="/admin/transactions/new-project/sold-units">
								All transactions
							</Link>
						</Button>
					</div>
					{tx ? (
						<div className="flex flex-wrap items-center gap-2">
							{adminCanDeleteCase(tx.status) ? (
								<Button
									size="sm"
									variant="outline"
									className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
									onClick={() => setDeleteOpen(true)}
								>
									<RiDeleteBinLine className="mr-1 size-4" />
									Delete case
								</Button>
							) : null}
							<Button size="sm" onClick={() => openEditModal(tx.id)}>
								<RiEditLine className="mr-1 size-4" />
								Edit case
							</Button>
						</div>
					) : null}
				</div>

				<AdminDeleteCaseDialog
					open={deleteOpen}
					onOpenChange={setDeleteOpen}
					transaction={
						tx ? { id: tx.id, caseNo: tx.caseNo, status: tx.status } : null
					}
					onDeleted={() => {
						if (tx) router.replace(segmentListUrl(tx));
					}}
				/>

				{tx && !isLoading && !error ? (
					<AdminTransactionStatusPanel
						transactionId={tx.id}
						currentStatus={tx.status}
						caseNo={tx.caseNo}
						agentEditAllowed={
							(tx as { agentEditAllowed?: boolean }).agentEditAllowed
						}
					/>
				) : null}

				<Card>
					<CardHeader className="flex flex-row items-center justify-between gap-2">
						<CardTitle>{tx?.caseNo ?? "Transaction"}</CardTitle>
						{tx?.status ? (
							<Badge className={getStatusBadgeClass(tx.status)}>
								{formatStatusLabel(tx.status)}
							</Badge>
						) : null}
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
							<Tabs defaultValue="details">
								<TabsList>
									<TabsTrigger value="details">Details</TabsTrigger>
									<TabsTrigger value="messages">
										Messages / Requests
									</TabsTrigger>
								</TabsList>
								<TabsContent value="details" className="mt-4">
									<TransactionDetailView
										tx={tx}
										agentName={agentData?.agent?.name}
										agentEmail={agentData?.agent?.email}
										allowDocumentUpload
									/>
								</TabsContent>
								<TabsContent value="messages" className="mt-4">
									<TransactionMessagesPanel
										transactionId={tx.id}
										isAdmin
									/>
								</TabsContent>
							</Tabs>
						) : null}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
