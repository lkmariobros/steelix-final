"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/dialog";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiCheckboxCircleLine,
	RiCloseLine,
	RiDashboardLine,
	RiFileList3Line,
	RiLoader4Line,
	RiRefreshLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

// Type for transaction from the queue (matches getCommissionApprovalQueue select)
interface QueueTransaction {
	id: string;
	agentId: string | null;
	clientData: {
		name?: string;
		email?: string;
		phone?: string;
		icNo?: string;
		address?: string;
		type?: string;
	} | null;
	propertyData: {
		address?: string;
		propertyType?: string;
		price?: number;
		listingTitle?: string;
		spaPrice?: number;
		nettPrice?: number;
	} | null;
	transactionType: string;
	marketType?: string | null;
	transactionDate?: Date | string | null;
	commissionAmount: string | null;
	commissionValue: string | null;
	commissionBreakdown?: Record<string, unknown> | null;
	status: string | null;
	submittedAt: Date | string | null;
	createdAt: Date | string;
	agentName: string | null;
	agentEmail: string | null;
	caseNo?: string | null;
	bookingDate?: Date | string | null;
	projectName?: string | null;
	unitNo?: string | null;
	blockListingId?: string | null;
	notes?: string | null;
}

function formatRm(amount: string | number | null | undefined) {
	if (amount === null || amount === undefined || amount === "") return "—";
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (Number.isNaN(num)) return "—";
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(num);
}

function queueStatusBadgeClass(status: string | null | undefined) {
	const s = status ?? "";
	if (s === "pending" || s === "submitted")
		return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
	if (s === "verified" || s === "under_review")
		return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
	return "bg-muted text-muted-foreground";
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: string | number | null | undefined;
}) {
	const display =
		value === null || value === undefined || value === "" ? "—" : String(value);
	return (
		<div className="min-w-0">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="break-words text-sm">{display}</div>
		</div>
	);
}

function TransactionReadOnlyDetail({
	tx,
	formatDate,
}: {
	tx: {
		id: string;
		caseNo?: string | null;
		bookingDate?: Date | string | null;
		projectName?: string | null;
		unitNo?: string | null;
		blockListingId?: string | null;
		transactionDate?: Date | string | null;
		marketType?: string | null;
		transactionType?: string | null;
		status?: string | null;
		commissionAmount?: string | null;
		commissionValue?: string | null;
		commissionType?: string | null;
		notes?: string | null;
		propertyData?: QueueTransaction["propertyData"] | null;
		clientData?: QueueTransaction["clientData"] | null;
		commissionBreakdown?: Record<string, unknown> | null;
		isCoBroking?: boolean | null;
		coBrokingData?: Record<string, unknown> | null;
		documents?: { name?: string; type?: string }[] | null;
	};
	formatDate: (d: Date | string | null | undefined) => string;
}) {
	const prop = tx.propertyData;
	const client = tx.clientData;
	const bd = tx.commissionBreakdown;
	const spa = prop?.spaPrice ?? prop?.price;
	const nett = prop?.nettPrice ?? prop?.price;

	return (
		<div className="space-y-6 pr-3">
			<section className="space-y-2">
				<h4 className="font-semibold text-foreground text-sm">
					Deal &amp; property
				</h4>
				<div className="grid gap-3 sm:grid-cols-2">
					<DetailRow label="Case no." value={tx.caseNo ?? undefined} />
					<DetailRow label="Status" value={tx.status ?? undefined} />
					<DetailRow
						label="Booking date"
						value={formatDate(tx.bookingDate ?? tx.transactionDate)}
					/>
					<DetailRow label="Project" value={tx.projectName ?? undefined} />
					<DetailRow label="Block / listing" value={prop?.listingTitle} />
					<DetailRow label="Unit no." value={tx.unitNo ?? undefined} />
					<DetailRow
						label="SPA price (RM)"
						value={spa !== undefined ? formatRm(spa) : undefined}
					/>
					<DetailRow
						label="Nett price (RM)"
						value={nett !== undefined ? formatRm(nett) : undefined}
					/>
					<DetailRow label="Property address" value={prop?.address} />
					<DetailRow label="Property type" value={prop?.propertyType} />
					<DetailRow label="Market" value={tx.marketType ?? undefined} />
					<DetailRow label="Transaction type" value={tx.transactionType} />
				</div>
			</section>

			<section className="space-y-2">
				<h4 className="font-semibold text-foreground text-sm">Buyer / client</h4>
				<div className="grid gap-3 sm:grid-cols-2">
					<DetailRow label="Name" value={client?.name} />
					<DetailRow label="IC No." value={client?.icNo} />
					<DetailRow label="Phone" value={client?.phone} />
					<DetailRow label="Email" value={client?.email} />
					<DetailRow label="Type" value={client?.type} />
					<DetailRow label="Address" value={client?.address} />
				</div>
			</section>

			<section className="space-y-2">
				<h4 className="font-semibold text-foreground text-sm">Commission</h4>
				<div className="grid gap-3 sm:grid-cols-2">
					<DetailRow label="Commission type" value={tx.commissionType} />
					<DetailRow label="Rate / value" value={tx.commissionValue} />
					<DetailRow label="Commission amount" value={tx.commissionAmount} />
				</div>
				{bd && Object.keys(bd).length > 0 ? (
					<div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
						<div className="mb-1 font-medium text-xs">Breakdown snapshot</div>
						<div className="grid gap-2 sm:grid-cols-2">
							{typeof bd.spaPrice === "number" ? (
								<DetailRow label="SPA" value={formatRm(bd.spaPrice)} />
							) : null}
							{typeof bd.nettPrice === "number" ? (
								<DetailRow label="Nett" value={formatRm(bd.nettPrice)} />
							) : null}
							{typeof bd.commissionRatePercent === "number" ? (
								<DetailRow
									label="Rate %"
									value={`${bd.commissionRatePercent}%`}
								/>
							) : null}
							{typeof bd.grossCommission === "number" ? (
								<DetailRow
									label="Gross"
									value={formatRm(bd.grossCommission)}
								/>
							) : null}
							{typeof bd.sstAmount === "number" ? (
								<DetailRow label="SST" value={formatRm(bd.sstAmount)} />
							) : null}
							{typeof bd.agentNetCommission === "number" ? (
								<DetailRow
									label="Net to agent"
									value={formatRm(bd.agentNetCommission)}
								/>
							) : null}
						</div>
					</div>
				) : null}
			</section>

			{tx.isCoBroking && tx.coBrokingData ? (
				<section className="space-y-2">
					<h4 className="font-semibold text-foreground text-sm">Co-broking</h4>
					<pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
						{JSON.stringify(tx.coBrokingData, null, 2)}
					</pre>
				</section>
			) : null}

			{tx.notes?.trim() ? (
				<section className="space-y-2">
					<h4 className="font-semibold text-foreground text-sm">Notes</h4>
					<p className="whitespace-pre-wrap text-muted-foreground text-sm">
						{tx.notes}
					</p>
				</section>
			) : null}

			{tx.documents && tx.documents.length > 0 ? (
				<section className="space-y-2">
					<h4 className="font-semibold text-foreground text-sm">Documents</h4>
					<ul className="list-inside list-disc text-sm">
						{tx.documents.map((d, i) => (
							<li key={`${d.name ?? "doc"}-${i}`}>
								{d.name ?? "File"} {d.type ? `(${d.type})` : ""}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

// Dialog state type
interface ApprovalDialogState {
	isOpen: boolean;
	transaction: QueueTransaction | null;
	action: "approve" | "reject" | null;
	reviewNotes: string;
	isSubmitting: boolean;
}

export default function AdminApprovalsPage() {
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session, isPending);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [page, setPage] = useState(0);
	const pageSize = 20;

	// Dialog state for approve/reject confirmation
	const [dialogState, setDialogState] = useState<ApprovalDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	const [detailTransactionId, setDetailTransactionId] = useState<string | null>(
		null,
	);

	const detailQuery = trpc.transactions.adminGetById.useQuery(
		{ id: detailTransactionId ?? "" },
		{ enabled: Boolean(detailTransactionId) },
	);

	// Fetch approvals data from transactions table (like dashboard widget)
	const {
		data: approvalsData,
		isLoading: isLoadingApprovals,
		refetch: refetchApprovals,
	} = trpc.admin.getCommissionApprovalQueue.useQuery(
		{
			limit: pageSize,
			offset: page * pageSize,
			status:
				statusFilter === "all"
					? undefined
					: (statusFilter as
							| "submitted"
							| "under_review"
							| "pending"
							| "verified"),
		},
		{
			enabled: !!session,
			refetchOnWindowFocus: false,
			staleTime: 30000,
		},
	);

	// Get dashboard stats for the summary cards
	const { data: dashboardStats, isLoading: isLoadingStats } =
		trpc.admin.getDashboardSummary.useQuery(
			{},
			{
				enabled: !!session,
			},
		);

	// Mutation for approving/rejecting commissions
	const processApprovalMutation =
		trpc.admin.processCommissionApproval.useMutation({
			onSuccess: (data, variables) => {
				const actionText =
					variables.action === "approve" ? "approved" : "rejected";
				toast.success(`Transaction ${actionText} successfully`);

				// Invalidate relevant queries
				queryClient.invalidateQueries({
					queryKey: [["admin", "getCommissionApprovalQueue"]],
				});
				queryClient.invalidateQueries({
					queryKey: [["admin", "getDashboardSummary"]],
				});
				queryClient.invalidateQueries({
					queryKey: [["commissionPayouts"]],
				});

				closeDialog();
			},
			onError: (error, variables) => {
				const actionText =
					variables.action === "approve" ? "approve" : "reject";
				toast.error(`Failed to ${actionText} transaction: ${error.message}`);
				setDialogState((prev) => ({ ...prev, isSubmitting: false }));
			},
		});

	// Get utils for invalidation after mutations
	const utils = trpc.useUtils();

	// Show loading while checking authentication
	if (isPending) {
		return <LoadingScreen text="Loading..." />;
	}

	if (!session) {
		return <LoadingScreen text="Redirecting..." />;
	}

	// Handle refresh
	const handleRefresh = async () => {
		await Promise.all([
			refetchApprovals(),
			utils.admin.getDashboardSummary.invalidate(),
		]);
	};

	// Handle approval action - opens dialog
	const handleApprovalAction = (
		transaction: QueueTransaction,
		action: "approve" | "reject",
	) => {
		setDialogState({
			isOpen: true,
			transaction,
			action,
			reviewNotes: "",
			isSubmitting: false,
		});
	};

	// Submit approval decision
	const submitApprovalDecision = async () => {
		if (!dialogState.transaction || !dialogState.action) return;
		const notes = dialogState.reviewNotes.trim();
		if (!notes) {
			toast.error("Review notes are required");
			return;
		}

		setDialogState((prev) => ({ ...prev, isSubmitting: true }));

		processApprovalMutation.mutate({
			transactionId: dialogState.transaction.id,
			action: dialogState.action,
			reviewNotes: notes,
		});
	};

	// Close dialog
	const closeDialog = () => {
		setDialogState({
			isOpen: false,
			transaction: null,
			action: null,
			reviewNotes: "",
			isSubmitting: false,
		});
	};

	// Pagination handlers
	const handlePreviousPage = () => {
		setPage((prev) => Math.max(0, prev - 1));
	};

	const handleNextPage = () => {
		if (approvalsData?.hasMore) {
			setPage((prev) => prev + 1);
		}
	};

	// Format currency
	const formatCurrency = (amount: string | number | null) => {
		if (!amount) return "$0.00";
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(num);
	};

	// Format date
	const formatDate = (date: Date | string | null | undefined) => {
		if (!date) return "N/A";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

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
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Admin Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiCheckboxCircleLine size={20} aria-hidden="true" />
										Commission Approvals
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
					{/* Approvals Page Header */}
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<h1 className="flex items-center gap-2 font-semibold text-2xl">
								<RiCheckboxCircleLine className="size-6" />
								Commission Approvals
							</h1>
							<p className="text-muted-foreground text-sm">
								Review and approve agent commission requests and transaction
								submissions.
							</p>
						</div>

						{/* Approval Controls */}
						<div className="flex items-center gap-2">
							{/* Status Filter */}
							<Select
								value={statusFilter}
								onValueChange={(value) => {
									setStatusFilter(value);
									setPage(0); // Reset to first page when filter changes
								}}
							>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All pending (queue)</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
									<SelectItem value="verified">Verified</SelectItem>
									<SelectItem value="submitted">Submitted (legacy)</SelectItem>
									<SelectItem value="under_review">Under review (legacy)</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</div>

					{/* Approval Summary Cards */}
					{isLoadingStats ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{["sk-a1", "sk-a2", "sk-a3", "sk-a4"].map((id) => (
								<Card key={id} className="overflow-hidden">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<Skeleton className="h-3.5 w-28" />
										<Skeleton className="h-4 w-4 rounded" />
									</CardHeader>
									<CardContent className="space-y-2">
										<Skeleton className="h-8 w-16" />
										<Skeleton className="h-3 w-28" />
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Pending Approvals
									</CardTitle>
									<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{approvalsData?.totalCount || 0}
									</div>
									<p className="text-muted-foreground text-xs">
										Awaiting your review
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Transactions
									</CardTitle>
									<RiCheckLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{dashboardStats?.totalTransactions || 0}
									</div>
									<p className="text-muted-foreground text-xs">All time</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Total Commission
									</CardTitle>
									<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{formatCurrency(
											Number(dashboardStats?.totalCommissionValue) || 0,
										)}
									</div>
									<p className="text-muted-foreground text-xs">
										All transactions
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="font-medium text-sm">
										Approved
									</CardTitle>
									<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="font-bold text-2xl">
										{dashboardStats?.approvedTransactions || 0}
									</div>
									<p className="text-muted-foreground text-xs">
										Transactions approved
									</p>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Approval Queue */}
					<Card>
						<CardHeader>
							<CardTitle>Approval Queue</CardTitle>
							<CardDescription>
								Commission requests and transactions awaiting your approval
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingApprovals ? (
								<div className="space-y-3">
									{["sk-b1", "sk-b2", "sk-b3", "sk-b4"].map((id) => (
										<div
											key={id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													<Skeleton className="h-4 w-32" />
													<Skeleton className="h-5 w-20 rounded-full" />
													<Skeleton className="h-5 w-16 rounded-full" />
												</div>
												<Skeleton className="h-3 w-56" />
												<Skeleton className="h-3 w-72" />
											</div>
											<div className="flex gap-2">
												<Skeleton className="h-8 w-20 rounded-md" />
												<Skeleton className="h-8 w-16 rounded-md" />
											</div>
										</div>
									))}
								</div>
							) : approvalsData?.transactions &&
								approvalsData.transactions.length > 0 ? (
								<div className="space-y-4">
									{approvalsData.transactions.map((transaction) => {
										const prop = transaction.propertyData;
										const spa =
											prop?.spaPrice ?? prop?.price ?? undefined;
										const nett = prop?.nettPrice ?? prop?.price ?? undefined;
										const blockLabel =
											prop?.listingTitle?.trim() || "—";
										return (
											<div
												key={transaction.id}
												className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 lg:flex-row lg:items-start lg:justify-between"
											>
												<div className="min-w-0 flex-1 space-y-2">
													<div className="flex flex-wrap items-center gap-2">
														<span className="font-medium">
															{transaction.agentName || "Unknown Agent"}
														</span>
														{transaction.caseNo ? (
															<span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
																{transaction.caseNo}
															</span>
														) : null}
														<span
															className={`rounded-full px-2 py-1 text-xs ${queueStatusBadgeClass(transaction.status)}`}
														>
															{transaction.status?.replace(/_/g, " ") ||
																"pending"}
														</span>
														<span className="rounded-full bg-violet-500/15 px-2 py-1 text-violet-800 text-xs dark:text-violet-300">
															{transaction.transactionType} ·{" "}
															{transaction.marketType ?? "—"}
														</span>
													</div>
													<div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
														<p>
															<span className="text-muted-foreground">
																Booking date:{" "}
															</span>
															{formatDate(
																transaction.bookingDate ??
																	transaction.transactionDate,
															)}
														</p>
														<p>
															<span className="text-muted-foreground">
																Project:{" "}
															</span>
															{transaction.projectName?.trim() || "—"}
														</p>
														<p>
															<span className="text-muted-foreground">
																Block:{" "}
															</span>
															{blockLabel}
														</p>
														<p>
															<span className="text-muted-foreground">
																Unit:{" "}
															</span>
															{transaction.unitNo?.trim() || "—"}
														</p>
														<p>
															<span className="text-muted-foreground">
																SPA (nett):{" "}
															</span>
															{formatRm(spa)} / {formatRm(nett)}
														</p>
														<p>
															<span className="text-muted-foreground">
																Commission:{" "}
															</span>
															{formatCurrency(transaction.commissionAmount)}
															{transaction.submittedAt
																? ` · submitted ${formatDate(transaction.submittedAt)}`
																: null}
														</p>
													</div>
													<p className="text-muted-foreground text-sm">
														<span className="text-foreground">Buyer: </span>
														{transaction.clientData?.name || "Unknown"}
														{transaction.clientData?.phone
															? ` · ${transaction.clientData.phone}`
															: ""}
														<span className="text-foreground"> · </span>
														{prop?.address || "No property address"}
													</p>
													{transaction.notes?.trim() ? (
														<p className="border-s-2 border-muted ps-3 text-muted-foreground text-sm italic">
															Agent notes: {transaction.notes}
														</p>
													) : null}
												</div>
												<div className="flex shrink-0 flex-wrap gap-2">
													<Button
														size="sm"
														variant="secondary"
														onClick={() =>
															setDetailTransactionId(transaction.id)
														}
													>
														<RiFileList3Line className="mr-1 h-4 w-4" />
														View details
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
														onClick={() =>
															handleApprovalAction(transaction, "approve")
														}
													>
														<RiCheckLine className="mr-1 h-4 w-4" />
														Approve
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
														onClick={() =>
															handleApprovalAction(transaction, "reject")
														}
													>
														<RiCloseLine className="mr-1 h-4 w-4" />
														Reject
													</Button>
												</div>
											</div>
										);
									})}

									{/* Pagination Controls */}
									{(approvalsData.totalCount > pageSize || page > 0) && (
										<div className="flex items-center justify-between border-t pt-4">
											<p className="text-muted-foreground text-sm">
												Showing {page * pageSize + 1} to{" "}
												{Math.min(
													(page + 1) * pageSize,
													approvalsData.totalCount,
												)}{" "}
												of {approvalsData.totalCount} transactions
											</p>
											<div className="flex gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={handlePreviousPage}
													disabled={page === 0}
												>
													Previous
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={handleNextPage}
													disabled={!approvalsData.hasMore}
												>
													Next
												</Button>
											</div>
										</div>
									)}
								</div>
							) : (
								<div className="py-8 text-center">
									<RiCheckboxCircleLine
										size={48}
										className="mx-auto mb-4 text-muted-foreground"
									/>
									<h3 className="mb-2 font-semibold text-lg">
										No Pending Approvals
									</h3>
									<p className="mb-4 text-muted-foreground">
										All commission requests have been processed. New requests
										will appear here.
									</p>
									<Button variant="outline" onClick={handleRefresh}>
										<RiRefreshLine className="mr-2 h-4 w-4" />
										Refresh Queue
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Approval Confirmation Dialog */}
				<Dialog
					open={dialogState.isOpen}
					onOpenChange={(open) => {
						if (!open) closeDialog();
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
								Commission
							</DialogTitle>
							<DialogDescription asChild>
								<div className="space-y-1 text-sm">
									{dialogState.transaction ? (
										<>
											<p>
												{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
												commission for{" "}
												<strong>
													{dialogState.transaction.clientData?.name ||
														"Unknown Client"}
												</strong>{" "}
												(submitted by{" "}
												<strong>
													{dialogState.transaction.agentName || "Unknown Agent"}
												</strong>
												).
											</p>
											{dialogState.transaction.caseNo ? (
												<p>
													Case{" "}
													<span className="font-mono">
														{dialogState.transaction.caseNo}
													</span>
													{dialogState.transaction.projectName
														? ` · ${dialogState.transaction.projectName}`
														: ""}
												</p>
											) : null}
											<p>
												Commission:{" "}
												<strong>
													{formatCurrency(
														dialogState.transaction.commissionAmount,
													)}
												</strong>
											</p>
										</>
									) : null}
								</div>
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<div>
								<label htmlFor="review-notes" className="font-medium text-sm">
									Review notes <span className="text-red-500">*</span>
								</label>
								<Textarea
									id="review-notes"
									placeholder={
										dialogState.action === "approve"
											? "Required: e.g. verified booking, SPA & nett price checked…"
											: "Required: rejection reason (agent will see this)…"
									}
									value={dialogState.reviewNotes}
									onChange={(e) =>
										setDialogState((prev) => ({
											...prev,
											reviewNotes: e.target.value,
										}))
									}
									className="mt-1"
									rows={4}
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Notes are stored on the transaction for audit and agent
									visibility.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={closeDialog}
								disabled={dialogState.isSubmitting}
							>
								Cancel
							</Button>
							<Button
								onClick={() => void submitApprovalDecision()}
								disabled={
									dialogState.isSubmitting || !dialogState.reviewNotes.trim()
								}
								className={
									dialogState.action === "approve"
										? "bg-green-600 hover:bg-green-700"
										: "bg-red-600 hover:bg-red-700"
								}
							>
								{dialogState.isSubmitting ? (
									<>
										<RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
										Processing...
									</>
								) : dialogState.action === "approve" ? (
									"Approve"
								) : (
									"Reject"
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Full transaction read-only detail (admin) */}
				<Dialog
					open={detailTransactionId !== null}
					onOpenChange={(open) => {
						if (!open) setDetailTransactionId(null);
					}}
				>
					<DialogContent className="max-h-[90vh] max-w-2xl gap-0 p-0">
						<DialogHeader className="p-6 pb-2">
							<DialogTitle>Transaction details</DialogTitle>
							<DialogDescription>
								Read-only view for review. Use Approve / Reject from the queue.
							</DialogDescription>
						</DialogHeader>
						<ScrollArea className="max-h-[65vh] px-6 pb-6">
							{detailQuery.isLoading ? (
								<div className="flex justify-center py-12">
									<RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : detailQuery.error ? (
								<p className="text-destructive text-sm">
									{detailQuery.error.message}
								</p>
							) : detailQuery.data ? (
								<TransactionReadOnlyDetail tx={detailQuery.data} formatDate={formatDate} />
							) : null}
						</ScrollArea>
					</DialogContent>
				</Dialog>
			</SidebarInset>
		</SidebarProvider>
	);
}
