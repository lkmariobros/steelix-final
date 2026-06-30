"use client";

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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	ApprovalQueueItem,
	type ApprovalQueueTransaction,
} from "@/features/approvals/approval-queue-item";
import { trpc } from "@/utils/trpc";
import {
	RiCheckboxCircleLine,
	RiDashboardLine,
	RiLoader4Line,
	RiRefreshLine,
} from "@remixicon/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type ApprovalSegment = "new-project" | "subsale" | "rental";

const SEGMENT_TABS: {
	value: ApprovalSegment;
	label: string;
	marketType?: "primary" | "secondary";
	transactionType: "sale" | "rental";
}[] = [
	{
		value: "new-project",
		label: "New Project",
		marketType: "primary",
		transactionType: "sale",
	},
	{
		value: "subsale",
		label: "Subsale",
		marketType: "secondary",
		transactionType: "sale",
	},
	{
		value: "rental",
		label: "Rental",
		transactionType: "rental",
	},
];

interface ApprovalDialogState {
	isOpen: boolean;
	transaction: ApprovalQueueTransaction | null;
	action: "approve" | "reject" | null;
	reviewNotes: string;
	isSubmitting: boolean;
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

export default function AdminApprovalsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(0);
	const pageSize = 20;

	const segmentParam = searchParams.get("segment") as ApprovalSegment | null;
	const segment: ApprovalSegment =
		segmentParam && SEGMENT_TABS.some((t) => t.value === segmentParam)
			? segmentParam
			: "new-project";

	const segmentConfig = SEGMENT_TABS.find((t) => t.value === segment)!;

	useEffect(() => {
		if (!segmentParam || !SEGMENT_TABS.some((t) => t.value === segmentParam)) {
			router.replace("/admin/approvals?segment=new-project");
		}
	}, [segmentParam, router]);

	useEffect(() => {
		setPage(0);
	}, [segment]);

	const queryInput = useMemo(
		() => ({
			limit: pageSize,
			offset: page * pageSize,
			status: "pending" as const,
			marketType: segmentConfig.marketType,
			transactionType: segmentConfig.transactionType,
		}),
		[page, segmentConfig],
	);

	const [dialogState, setDialogState] = useState<ApprovalDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	const {
		data: approvalsData,
		isLoading: isLoadingApprovals,
		refetch: refetchApprovals,
	} = trpc.admin.getCommissionApprovalQueue.useQuery(queryInput, {
			refetchOnWindowFocus: false,
			staleTime: 3 * 60 * 1000,
	});

	const handleSegmentChange = (value: string) => {
		router.replace(`/admin/approvals?segment=${value}`);
	};

	const processApprovalMutation =
		trpc.admin.processCommissionApproval.useMutation({
			onSuccess: (_data, variables) => {
				const actionText =
					variables.action === "approve" ? "approved" : "rejected";
				toast.success(`Transaction ${actionText} successfully`);

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

	const handleRefresh = async () => {
		await refetchApprovals();
	};

	const handleApprovalAction = (
		transaction: ApprovalQueueTransaction,
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

	const submitApprovalDecision = () => {
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

	const closeDialog = () => {
		setDialogState({
			isOpen: false,
			transaction: null,
			action: null,
			reviewNotes: "",
			isSubmitting: false,
		});
	};

	const handlePreviousPage = () => {
		setPage((prev) => Math.max(0, prev - 1));
	};

	const handleNextPage = () => {
		if (approvalsData?.hasMore) {
			setPage((prev) => prev + 1);
		}
	};

	const pendingCount = approvalsData?.totalCount ?? 0;

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
									<span className="sr-only">Admin Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2">
									<RiCheckboxCircleLine size={20} aria-hidden="true" />
									Approval requests
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
				<div className="flex items-center justify-between gap-4">
					<div className="space-y-1">
						<h1 className="flex items-center gap-2 font-semibold text-2xl">
							<RiCheckboxCircleLine className="size-6" />
							Approval requests
						</h1>
						<p className="text-muted-foreground text-sm">
							Review and approve agent transaction submissions awaiting your
							decision. For agent <strong>change requests</strong> on locked
							cases, use{" "}
							<Link
								href="/admin/approvals/requests?segment=new-project"
								className="text-primary underline-offset-4 hover:underline"
							>
								edit requests
							</Link>
							.
						</p>
					</div>
					<Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
						<RiRefreshLine className="size-4" />
					</Button>
				</div>

				{isLoadingApprovals ? (
					<Card className="max-w-sm">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-3.5 w-28" />
							<Skeleton className="h-4 w-4 rounded" />
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-3 w-28" />
						</CardContent>
					</Card>
				) : (
					<Card className="max-w-sm">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Pending Approvals
							</CardTitle>
							<RiCheckboxCircleLine className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{pendingCount}</div>
							<p className="text-muted-foreground text-xs">
								Awaiting your review ({segmentConfig.label})
							</p>
						</CardContent>
					</Card>
				)}

				<Tabs value={segment} onValueChange={handleSegmentChange}>
					<TabsList>
						{SEGMENT_TABS.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				<Card>
					<CardHeader>
						<CardTitle>Approval Queue</CardTitle>
						<CardDescription>
							Transactions awaiting approval — new project, subsale, and rental
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
											</div>
											<Skeleton className="h-3 w-72" />
											<Skeleton className="h-3 w-56" />
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
								{approvalsData.transactions.map((transaction) => (
									<ApprovalQueueItem
										key={transaction.id}
										transaction={transaction as ApprovalQueueTransaction}
										onApprove={(tx) => handleApprovalAction(tx, "approve")}
										onReject={(tx) => handleApprovalAction(tx, "reject")}
									/>
								))}

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
									All transaction submissions have been processed. New requests
									will appear here.
								</p>
								<Button variant="outline" onClick={() => void handleRefresh()}>
									<RiRefreshLine className="mr-2 h-4 w-4" />
									Refresh Queue
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

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
							Transaction
						</DialogTitle>
						<DialogDescription asChild>
							<div className="space-y-1 text-sm">
								{dialogState.transaction ? (
									<>
										<p>
											{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
											submission for case{" "}
											<strong>
												{dialogState.transaction.caseNo ?? "—"}
											</strong>{" "}
											(submitted by{" "}
											<strong>
												{dialogState.transaction.agentName || "Unknown Agent"}
											</strong>
											).
										</p>
										<p>
											Commission:{" "}
											<strong>
												{formatRm(dialogState.transaction.commissionAmount)}
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
							onClick={submitApprovalDecision}
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
		</>
	);
}
