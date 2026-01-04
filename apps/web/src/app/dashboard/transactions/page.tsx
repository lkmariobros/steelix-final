"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import UserDropdown from "@/components/user-dropdown";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import {
	RiAddLine,
	RiBarChartLine,
	RiDashboardLine,
	RiDownloadLine,
	RiFileTextLine,
	RiRefreshLine,
	RiEyeLine,
	RiEditLine,
	RiCheckLine,
	RiTimeLine,
	RiAlertLine,
	RiLoader4Line,
} from "@remixicon/react";

// View modes for the transactions page
type ViewMode = "all" | "pipeline";

// Pipeline statuses (active deals not yet completed/rejected)
const PIPELINE_STATUSES = ["draft", "submitted", "under_review", "approved"] as const;

export default function TransactionsPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const { openCreateModal, openEditModal, openViewModal } = useTransactionModalActions();
	const [viewMode, setViewMode] = useState<ViewMode>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(0);
	const pageSize = 10;

	// Determine effective status filter based on view mode
	const effectiveStatusFilter = viewMode === "pipeline" && statusFilter === "all"
		? undefined // Pipeline view shows all active statuses
		: statusFilter === "all" ? undefined : statusFilter;

	// Fetch transactions with real tRPC
	const {
		data: transactionsData,
		isLoading: isLoadingTransactions,
		refetch: refetchTransactions
	} = trpc.transactions.list.useQuery({
		limit: pageSize,
		offset: currentPage * pageSize,
		status: effectiveStatusFilter as any,
	}, {
		enabled: !!session,
	});

	// Get pipeline metrics (for summary cards when in pipeline view)
	const { data: pipelineData, isLoading: isLoadingPipeline } = trpc.dashboard.getSalesPipeline.useQuery(
		undefined,
		{ enabled: !!session && viewMode === "pipeline" }
	);

	// Filter transactions for pipeline view (exclude completed/rejected)
	const displayTransactions = viewMode === "pipeline"
		? transactionsData?.transactions.filter(t =>
			t.status && PIPELINE_STATUSES.includes(t.status as any)
		) || []
		: transactionsData?.transactions || [];

	// Authentication check
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<LoadingSpinner size="lg" text="Loading..." />
			</div>
		);
	}

	if (!session) {
		router.push("/login");
		return null;
	}

	// Handle refresh
	const handleRefresh = () => {
		refetchTransactions();
	};

	// Get status badge variant
	const getStatusBadge = (status: string) => {
		switch (status) {
			case "completed":
				return <Badge variant="default" className="bg-green-100 text-green-800"><RiCheckLine className="mr-1 h-3 w-3" />Completed</Badge>;
			case "approved":
				return <Badge variant="default" className="bg-blue-100 text-blue-800"><RiCheckLine className="mr-1 h-3 w-3" />Approved</Badge>;
			case "under_review":
				return <Badge variant="secondary"><RiTimeLine className="mr-1 h-3 w-3" />Under Review</Badge>;
			case "submitted":
				return <Badge variant="outline"><RiTimeLine className="mr-1 h-3 w-3" />Submitted</Badge>;
			case "rejected":
				return <Badge variant="destructive"><RiAlertLine className="mr-1 h-3 w-3" />Rejected</Badge>;
			case "draft":
			default:
				return <Badge variant="secondary"><RiEditLine className="mr-1 h-3 w-3" />Draft</Badge>;
		}
	};

	// Format currency
	const formatCurrency = (amount: string | number) => {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(num);
	};

	// Format date with proper validation and debugging
	const formatDate = (date: Date | string | null | undefined) => {
		console.log('formatDate called with:', date, 'type:', typeof date);

		if (!date) {
			console.log('formatDate: No date provided, returning N/A');
			return 'N/A';
		}

		try {
			let dateObj: Date;

			if (typeof date === 'string') {
				console.log('formatDate: Converting string to Date:', date);
				dateObj = new Date(date);
			} else if (date instanceof Date) {
				console.log('formatDate: Already a Date object');
				dateObj = date;
			} else {
				console.warn('formatDate: Unexpected date type:', typeof date, date);
				return 'Invalid Date';
			}

			// Check if the date is valid
			if (isNaN(dateObj.getTime())) {
				console.warn('formatDate: Invalid date after parsing:', dateObj, 'from:', date);
				return 'Invalid Date';
			}

			const formatted = new Intl.DateTimeFormat('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			}).format(dateObj);

			console.log('formatDate: Successfully formatted:', formatted);
			return formatted;
		} catch (error) {
			console.error('Date formatting error:', error, 'for date:', date);
			return 'Invalid Date';
		}
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
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileTextLine size={18} />
										Transactions
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
					{/* Transactions Page Header */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1">
								<h1 className="flex items-center gap-2 font-semibold text-2xl">
									{viewMode === "pipeline" ? (
										<>
											<RiBarChartLine className="size-6" />
											Active Pipeline
										</>
									) : (
										<>
											<RiFileTextLine className="size-6" />
											Transactions
										</>
									)}
								</h1>
								<p className="text-muted-foreground text-sm">
									{viewMode === "pipeline"
										? "Track and manage your active deals in progress."
										: "View and manage all your real estate transactions, commissions, and deal history."
									}
								</p>
							</div>

							{/* Transaction Controls */}
							<div className="flex items-center gap-2">
								{/* Status Filter - only show in All view or specific filter */}
								{viewMode === "all" && (
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger className="w-40">
											<SelectValue placeholder="Filter by status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Transactions</SelectItem>
											<SelectItem value="draft">Draft</SelectItem>
											<SelectItem value="submitted">Submitted</SelectItem>
											<SelectItem value="under_review">Under Review</SelectItem>
											<SelectItem value="approved">Approved</SelectItem>
											<SelectItem value="rejected">Rejected</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
								)}

								{/* Refresh Button */}
								<Button variant="outline" size="sm" onClick={handleRefresh}>
									<RiRefreshLine className="size-4" />
								</Button>

								{/* New Transaction Button */}
								<Button size="sm" onClick={openCreateModal}>
									<RiAddLine className="mr-2 h-4 w-4" />
									New Transaction
								</Button>
							</div>
						</div>

						{/* View Mode Toggle */}
						<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
							<TabsList>
								<TabsTrigger value="all" className="flex items-center gap-2">
									<RiFileTextLine className="h-4 w-4" />
									All Transactions
								</TabsTrigger>
								<TabsTrigger value="pipeline" className="flex items-center gap-2">
									<RiBarChartLine className="h-4 w-4" />
									Active Pipeline
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					{/* Transactions Content */}
					<div className="grid gap-6">
						{/* Summary Cards - Different for Pipeline vs All view */}
						{viewMode === "pipeline" ? (
							// Pipeline View Cards
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Active Deals</CardTitle>
										<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingPipeline ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												pipelineData?.totalDeals || displayTransactions.length
											)}
										</div>
										<p className="text-muted-foreground text-xs">In progress</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Pipeline Value</CardTitle>
										<RiBarChartLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingPipeline ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												formatCurrency(pipelineData?.totalValue || 0)
											)}
										</div>
										<p className="text-muted-foreground text-xs">Total potential commission</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Under Review</CardTitle>
										<RiTimeLine className="h-4 w-4 text-yellow-600" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												displayTransactions.filter(t => t.status === "under_review").length
											)}
										</div>
										<p className="text-muted-foreground text-xs">Awaiting approval</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Approved</CardTitle>
										<RiCheckLine className="h-4 w-4 text-green-600" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												displayTransactions.filter(t => t.status === "approved").length
											)}
										</div>
										<p className="text-muted-foreground text-xs">Ready to close</p>
									</CardContent>
								</Card>
							</div>
						) : (
							// All Transactions View Cards
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Total Transactions</CardTitle>
										<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												transactionsData?.total || 0
											)}
										</div>
										<p className="text-muted-foreground text-xs">All time transactions</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Pending Approval</CardTitle>
										<RiTimeLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												transactionsData?.transactions.filter(t =>
													t.status && ['draft', 'submitted', 'under_review'].includes(t.status)
												).length || 0
											)}
										</div>
										<p className="text-muted-foreground text-xs">Awaiting review</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Total Commission</CardTitle>
										<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												formatCurrency(
													transactionsData?.transactions.reduce((sum, t) =>
														sum + parseFloat(t.commissionAmount || '0'), 0
													) || 0
												)
											)}
										</div>
										<p className="text-muted-foreground text-xs">Total earned</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="font-medium text-sm">Avg Per Transaction</CardTitle>
										<RiFileTextLine className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="font-bold text-2xl">
											{isLoadingTransactions ? (
												<RiLoader4Line className="h-6 w-6 animate-spin" />
											) : (
												formatCurrency(
													transactionsData?.transactions.length ?
														transactionsData.transactions.reduce((sum, t) =>
															sum + parseFloat(t.commissionAmount || '0'), 0
														) / transactionsData.transactions.length : 0
												)
											)}
									</div>
									<p className="text-muted-foreground text-xs">Per transaction</p>
								</CardContent>
							</Card>
						</div>
						)}

						{/* Transaction List */}
						<Card>
							<CardHeader>
								<CardTitle>
									{viewMode === "pipeline" ? "Active Deals" : "Recent Transactions"}
								</CardTitle>
								<CardDescription>
									{viewMode === "pipeline"
										? "Your deals in progress - click to view or edit"
										: "Your latest real estate transactions and their current status"
									}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoadingTransactions ? (
									<div className="py-8 text-center">
										<LoadingSpinner size="lg" text="Loading transactions..." />
									</div>
								) : displayTransactions.length === 0 ? (
									<div className="py-8 text-center">
										{viewMode === "pipeline" ? (
											<RiBarChartLine size={48} className="mx-auto mb-4 text-muted-foreground" />
										) : (
											<RiFileTextLine size={48} className="mx-auto mb-4 text-muted-foreground" />
										)}
										<h3 className="mb-2 font-semibold text-lg">
											{viewMode === "pipeline" ? "No Active Deals" : "No Transactions Yet"}
										</h3>
										<p className="mb-4 text-muted-foreground">
											{viewMode === "pipeline"
												? "Create a new transaction to start your pipeline"
												: "Start by creating your first transaction"
											}
										</p>
										<Button onClick={openCreateModal}>
											<RiAddLine className="mr-2 h-4 w-4" />
											Add Transaction
										</Button>
									</div>
								) : (
									<div className="space-y-4">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Property</TableHead>
													<TableHead>Client</TableHead>
													<TableHead>Type</TableHead>
													<TableHead>Commission</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>Date</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{displayTransactions.map((transaction) => (
													<TableRow key={transaction.id} className="cursor-pointer hover:bg-muted/50">
														<TableCell>
															<div className="font-medium">
																{transaction.propertyData?.address || 'N/A'}
															</div>
															<div className="text-muted-foreground text-sm">
																{transaction.propertyData?.propertyType}
															</div>
														</TableCell>
														<TableCell>
															<div className="font-medium">
																{transaction.clientData?.name || 'N/A'}
															</div>
															<div className="text-muted-foreground text-sm">
																{transaction.clientData?.type}
															</div>
														</TableCell>
														<TableCell>
															<div className="capitalize">
																{transaction.transactionType}
															</div>
															<div className="text-muted-foreground text-sm">
																{transaction.marketType}
															</div>
														</TableCell>
														<TableCell>
															<div className="font-medium">
																{formatCurrency(transaction.commissionAmount)}
															</div>
															<div className="text-muted-foreground text-sm">
																{transaction.commissionType}
															</div>
														</TableCell>
														<TableCell>
															{getStatusBadge(transaction.status || 'draft')}
														</TableCell>
														<TableCell>
															{formatDate(transaction.createdAt)}
														</TableCell>
														<TableCell className="text-right">
															<div className="flex justify-end gap-1">
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => openViewModal(transaction.id)}
																	title="View details"
																>
																	<RiEyeLine className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => openEditModal(transaction.id)}
																	title="Edit transaction"
																>
																	<RiEditLine className="h-4 w-4" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>

										{/* Pagination */}
										{transactionsData && transactionsData.hasMore && (
											<div className="flex justify-center pt-4">
												<Button
													variant="outline"
													onClick={() => setCurrentPage(prev => prev + 1)}
												>
													Load More
												</Button>
											</div>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Footer */}
					<div className="mt-8 border-t pt-6">
						<div className="flex items-center justify-between">
							<div className="text-muted-foreground text-sm">
								{viewMode === "pipeline" ? (
									`${displayTransactions.length} active deal${displayTransactions.length !== 1 ? 's' : ''} in pipeline`
								) : (
									transactionsData?.total
										? `Showing ${displayTransactions.length} of ${transactionsData.total} transactions`
										: "No transactions found"
								)}
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm">
									<RiDownloadLine className="mr-2 h-4 w-4" />
									Export Report
								</Button>
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
