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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiCheckboxCircleLine,
	RiCloseLine,
	RiDashboardLine,
	RiLoader4Line,
	RiRefreshLine,
	RiShieldUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Type for transaction from the queue
interface QueueTransaction {
	id: string;
	agentId: string | null;
	clientData: { name?: string; email?: string; phone?: string } | null;
	propertyData: { address?: string; price?: number } | null;
	transactionType: string;
	commissionAmount: string | null;
	commissionValue: string | null;
	status: string | null;
	submittedAt: Date | string | null;
	createdAt: Date | string;
	agentName: string | null;
	agentEmail: string | null;
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
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();
	const [statusFilter, setStatusFilter] = useState<string>("submitted");
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

	// Admin role checking
	const { data: roleData, isLoading: isRoleLoading } =
		trpc.admin.checkAdminRole.useQuery(undefined, {
			enabled: !!session,
			retry: false,
		}) as {
			data: { hasAdminAccess: boolean; role: string } | undefined;
			isLoading: boolean;
		};

	// Fetch approvals data from transactions table (like dashboard widget)
	const {
		data: approvalsData,
		isLoading: isLoadingApprovals,
		refetch: refetchApprovals
	} = trpc.admin.getCommissionApprovalQueue.useQuery({
		limit: pageSize,
		offset: page * pageSize,
		status: statusFilter === "all" ? undefined : statusFilter as "submitted" | "under_review",
	}, {
		enabled: !!session && !!roleData?.hasAdminAccess,
		refetchOnWindowFocus: false,
		staleTime: 30000,
	});

	// Get dashboard stats for the summary cards
	const { data: dashboardStats, isLoading: isLoadingStats } = trpc.admin.getDashboardSummary.useQuery({}, {
		enabled: !!session && !!roleData?.hasAdminAccess,
	});

	// Mutation for approving/rejecting commissions
	const processApprovalMutation = trpc.admin.processCommissionApproval.useMutation({
		onSuccess: (data, variables) => {
			const actionText = variables.action === "approve" ? "approved" : "rejected";
			toast.success(`Transaction ${actionText} successfully`);

			// Invalidate relevant queries
			queryClient.invalidateQueries({ queryKey: [["admin", "getCommissionApprovalQueue"]] });
			queryClient.invalidateQueries({ queryKey: [["admin", "getDashboardSummary"]] });

			closeDialog();
		},
		onError: (error, variables) => {
			const actionText = variables.action === "approve" ? "approve" : "reject";
			toast.error(`Failed to ${actionText} transaction: ${error.message}`);
			setDialogState((prev) => ({ ...prev, isSubmitting: false }));
		},
	});

	// Get utils for invalidation after mutations
	const utils = trpc.useUtils();

	// Handle redirect for unauthenticated users
	useEffect(() => {
		if (!isPending && !session) {
			router.push("/login");
		}
	}, [isPending, session, router]);

	// Show loading while checking authentication and role
	if (isPending || isRoleLoading) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Loading...</p>
				</div>
			</div>
		);
	}

	// Show loading while redirecting unauthenticated users
	if (!session) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
					<p className="mt-2 text-muted-foreground text-sm">Redirecting...</p>
				</div>
			</div>
		);
	}

	// Access denied if not admin
	if (!roleData || !roleData.hasAdminAccess) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<RiShieldUserLine
						size={48}
						className="mx-auto mb-4 text-muted-foreground"
					/>
					<h1 className="mb-2 font-semibold text-2xl">Access Denied</h1>
					<p className="mb-4 text-muted-foreground">
						You don&apos;t have permission to access commission approvals.
					</p>
					<p className="mb-4 text-muted-foreground text-sm">
						Current role: {roleData?.role || "Unknown"}
					</p>
					<button
						type="button"
						onClick={() => router.push("/dashboard")}
						className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					>
						Go to Agent Dashboard
					</button>
				</div>
			</div>
		);
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

		setDialogState((prev) => ({ ...prev, isSubmitting: true }));

		processApprovalMutation.mutate({
			transactionId: dialogState.transaction.id,
			action: dialogState.action,
			reviewNotes: dialogState.reviewNotes || undefined,
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
		const num = typeof amount === "string" ? parseFloat(amount) : amount;
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(num);
	};

	// Format date
	const formatDate = (date: Date | string | null) => {
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
						<UserDropdown />
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
							<Select value={statusFilter} onValueChange={(value) => {
								setStatusFilter(value);
								setPage(0); // Reset to first page when filter changes
							}}>
								<SelectTrigger className="w-40">
									<SelectValue placeholder="Filter by status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="submitted">Pending Review</SelectItem>
									<SelectItem value="under_review">Under Review</SelectItem>
									<SelectItem value="all">All Pending</SelectItem>
								</SelectContent>
							</Select>

							{/* Refresh Button */}
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RiRefreshLine className="size-4" />
							</Button>
						</div>
					</div>

					{/* Approval Summary Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Pending Approvals
								</CardTitle>
								<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-16 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{approvalsData?.totalCount || 0}
										</div>
										<p className="text-muted-foreground text-xs">
											Awaiting your review
										</p>
									</>
								)}
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
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-16 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{dashboardStats?.totalTransactions || 0}
										</div>
										<p className="text-muted-foreground text-xs">
											All time
										</p>
									</>
								)}
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
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-20 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{formatCurrency(dashboardStats?.totalCommission || 0)}
										</div>
										<p className="text-muted-foreground text-xs">
											All transactions
										</p>
									</>
								)}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<CardTitle className="font-medium text-sm">
									Active Agents
								</CardTitle>
								<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{isLoadingStats ? (
									<div className="space-y-2">
										<div className="h-8 w-20 bg-muted animate-pulse rounded" />
										<div className="h-3 w-24 bg-muted animate-pulse rounded" />
									</div>
								) : (
									<>
										<div className="font-bold text-2xl">
											{dashboardStats?.totalAgents || 0}
										</div>
										<p className="text-muted-foreground text-xs">In the system</p>
									</>
								)}
							</CardContent>
						</Card>
					</div>

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
								<div className="space-y-4">
									{Array.from({ length: 3 }).map((_, i) => (
										<div key={i} className="flex items-center justify-between p-4 border rounded-lg">
											<div className="space-y-2">
												<div className="h-4 w-32 bg-muted animate-pulse rounded" />
												<div className="h-3 w-48 bg-muted animate-pulse rounded" />
											</div>
											<div className="flex gap-2">
												<div className="h-8 w-20 bg-muted animate-pulse rounded" />
												<div className="h-8 w-20 bg-muted animate-pulse rounded" />
											</div>
										</div>
									))}
								</div>
							) : approvalsData?.transactions && approvalsData.transactions.length > 0 ? (
								<div className="space-y-4">
									{approvalsData.transactions.map((transaction) => (
										<div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-medium">
														{transaction.agentName || 'Unknown Agent'}
													</span>
													<span className={`px-2 py-1 text-xs rounded-full ${
														transaction.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
														transaction.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
														'bg-gray-100 text-gray-800'
													}`}>
														{transaction.status?.replace('_', ' ') || 'pending'}
													</span>
													<span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
														{transaction.transactionType}
													</span>
												</div>
												<p className="text-sm text-muted-foreground">
													{formatCurrency(transaction.commissionAmount)} commission
													{transaction.submittedAt && ` • ${formatDate(transaction.submittedAt)}`}
												</p>
												<p className="text-sm text-muted-foreground">
													Client: {transaction.clientData?.name || 'Unknown'} •
													Property: {transaction.propertyData?.address || 'N/A'}
												</p>
											</div>
											<div className="flex gap-2">
												<Button
													size="sm"
													variant="outline"
													className="text-green-600 hover:text-green-700 hover:bg-green-50"
													onClick={() => handleApprovalAction(transaction, "approve")}
												>
													<RiCheckLine className="mr-1 h-4 w-4" />
													Approve
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="text-red-600 hover:text-red-700 hover:bg-red-50"
													onClick={() => handleApprovalAction(transaction, "reject")}
												>
													<RiCloseLine className="mr-1 h-4 w-4" />
													Reject
												</Button>
											</div>
										</div>
									))}

									{/* Pagination Controls */}
									{(approvalsData.totalCount > pageSize || page > 0) && (
										<div className="flex items-center justify-between pt-4 border-t">
											<p className="text-sm text-muted-foreground">
												Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, approvalsData.totalCount)} of {approvalsData.totalCount} transactions
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
										All commission requests have been processed. New requests will appear here.
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
				<Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{dialogState.action === "approve" ? "Approve" : "Reject"} Commission
							</DialogTitle>
							<DialogDescription>
								{dialogState.transaction && (
									<>
										{dialogState.action === "approve" ? "Approve" : "Reject"} commission for{" "}
										<strong>{dialogState.transaction.clientData?.name || "Unknown Client"}</strong>{" "}
										by <strong>{dialogState.transaction.agentName || "Unknown Agent"}</strong>
										<br />
										Commission Amount: <strong>{formatCurrency(dialogState.transaction.commissionAmount)}</strong>
									</>
								)}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<div>
								<label htmlFor="review-notes" className="font-medium text-sm">
									Review Notes{" "}
									{dialogState.action === "reject" && (
										<span className="text-red-500">*</span>
									)}
								</label>
								<Textarea
									id="review-notes"
									placeholder={
										dialogState.action === "approve"
											? "Optional notes about the approval..."
											: "Please provide a reason for rejection..."
									}
									value={dialogState.reviewNotes}
									onChange={(e) =>
										setDialogState((prev) => ({
											...prev,
											reviewNotes: e.target.value,
										}))
									}
									className="mt-1"
									rows={3}
								/>
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
								onClick={submitApprovalDecision}
								disabled={
									dialogState.isSubmitting ||
									(dialogState.action === "reject" && !dialogState.reviewNotes.trim())
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
			</SidebarInset>
		</SidebarProvider>
	);
}
