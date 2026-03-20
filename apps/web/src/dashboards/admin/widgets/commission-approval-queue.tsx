"use client";

import { Badge } from "@/components/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	type CommissionApprovalItem,
	useAdminDashboard,
} from "@/contexts/admin-dashboard-context";
import {
	invalidateAdminQueries,
	optimisticUpdateTransaction,
} from "@/lib/query-invalidation";
import { trpc } from "@/utils/trpc";
import { RiCheckLine, RiCloseLine, RiTimeLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

// CommissionApproval from admin-schema uses agentId:string (non-null) which
// conflicts with the actual DB shape. We use CommissionApprovalItem from the
// context (agentId: string | null) everywhere in this component.
import {
	formatCurrency,
	formatDateTime,
	getRelativeTime,
	getStatusColor,
} from "../admin-schema";

interface CommissionApprovalQueueProps {
	className?: string;
}

interface ApprovalDialogState {
	isOpen: boolean;
	transaction: CommissionApprovalItem | null;
	action: "approve" | "reject" | null;
	reviewNotes: string;
	isSubmitting: boolean;
}

const PAGE_SIZE = 10;

export function CommissionApprovalQueue({
	className,
}: CommissionApprovalQueueProps) {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(0);
	const [dialogState, setDialogState] = useState<ApprovalDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	// Page 0 comes from the shared context (already batched on mount).
	// Subsequent pages use their own query (user interaction).
	const { commissionQueue: contextQueueData, isLoading: contextLoading } =
		useAdminDashboard();

	const paginatedQuery = trpc.admin.getCommissionApprovalQueue.useQuery(
		{ limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: "submitted" },
		{
			enabled: page > 0, // only run when user navigates beyond page 0
			staleTime: 30_000,
		},
	);

	const queueData = page === 0 ? contextQueueData : paginatedQuery.data;
	const isLoading = page === 0 ? contextLoading : paginatedQuery.isLoading;
	const error = page === 0 ? null : paginatedQuery.error;

	// ── Mutation ──────────────────────────────────────────────────────────────

	const processApprovalMutation =
		trpc.admin.processCommissionApproval.useMutation({
			onMutate: async (variables) => {
				optimisticUpdateTransaction(queryClient, variables.transactionId, {
					status: variables.action === "approve" ? "approved" : "rejected",
					reviewNotes: variables.reviewNotes,
				});
			},
			onSuccess: (_, variables) => {
				const label = variables.action === "approve" ? "approved" : "rejected";
				toast.success(`Transaction ${label} successfully`);
				invalidateAdminQueries(queryClient);
				closeDialog();
			},
			onError: (err, variables) => {
				console.error("Commission approval error:", err);
				toast.error(`Failed to ${variables.action} transaction`);
				invalidateAdminQueries(queryClient);
				setDialogState((prev) => ({ ...prev, isSubmitting: false }));
			},
		});

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handleApprovalAction = (
		transaction: CommissionApprovalItem,
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
		setDialogState((prev) => ({ ...prev, isSubmitting: true }));
		processApprovalMutation.mutate({
			transactionId: dialogState.transaction.id,
			action: dialogState.action,
			reviewNotes: dialogState.reviewNotes || undefined,
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

	// ── Render ────────────────────────────────────────────────────────────────

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiTimeLine size={20} />
						Commission Approval Queue
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{["sk-ca-1", "sk-ca-2", "sk-ca-3", "sk-ca-4", "sk-ca-5"].map(
							(id) => (
								<div
									key={id}
									className="flex items-center justify-between rounded-lg border p-4"
								>
									<div className="space-y-2">
										<Skeleton className="h-4 w-48" />
										<Skeleton className="h-3 w-32" />
									</div>
									<div className="flex gap-2">
										<Skeleton className="h-8 w-20" />
										<Skeleton className="h-8 w-20" />
									</div>
								</div>
							),
						)}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<RiTimeLine size={20} />
						Commission Approval Queue
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<p className="text-muted-foreground text-sm">
							Failed to load approval queue.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const transactions = (queueData?.transactions || []).map((t) => ({
		...t,
		status: (t.status || "submitted") as
			| "submitted"
			| "under_review"
			| "approved"
			| "rejected",
	}));

	return (
		<>
			<Card className={className}>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<RiTimeLine size={20} />
							Commission Approval Queue
						</CardTitle>
						<Badge variant="secondary">
							{queueData?.totalCount || 0} pending
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					{transactions.length === 0 ? (
						<div className="flex items-center justify-center py-8">
							<p className="text-muted-foreground text-sm">
								No transactions pending approval.
							</p>
						</div>
					) : (
						<>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Agent & Client</TableHead>
											<TableHead>Property</TableHead>
											<TableHead>Commission</TableHead>
											<TableHead>Submitted</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{transactions.map((transaction) => (
											<TableRow key={transaction.id}>
												<TableCell>
													<div className="space-y-1">
														<div className="font-medium">
															{transaction.agentName || "Unknown Agent"}
														</div>
														<div className="text-muted-foreground text-sm">
															{transaction.clientData?.name || "Unknown Client"}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="max-w-48 truncate">
														{transaction.propertyData?.address ||
															"Unknown Property"}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<div className="font-medium">
															{formatCurrency(transaction.commissionAmount)}
														</div>
														<div className="text-muted-foreground text-xs">
															{transaction.transactionType}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<div className="text-sm">
															{formatDateTime(transaction.submittedAt)}
														</div>
														<div className="text-muted-foreground text-xs">
															{getRelativeTime(transaction.submittedAt)}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<Badge className={getStatusColor(transaction.status)}>
														{transaction.status.replace("_", " ")}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																handleApprovalAction(transaction, "approve")
															}
															className="h-8 gap-1 text-green-600 hover:text-green-700"
														>
															<RiCheckLine size={14} />
															Approve
														</Button>
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																handleApprovalAction(transaction, "reject")
															}
															className="h-8 gap-1 text-red-600 hover:text-red-700"
														>
															<RiCloseLine size={14} />
															Reject
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{/* Pagination */}
							{(queueData?.totalCount || 0) > PAGE_SIZE && (
								<div className="mt-4 flex items-center justify-between">
									<p className="text-muted-foreground text-sm">
										Showing {page * PAGE_SIZE + 1} to{" "}
										{Math.min(
											(page + 1) * PAGE_SIZE,
											queueData?.totalCount || 0,
										)}{" "}
										of {queueData?.totalCount || 0} transactions
									</p>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => setPage((p) => Math.max(0, p - 1))}
											disabled={page === 0}
										>
											Previous
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() => setPage((p) => p + 1)}
											disabled={!queueData?.hasMore}
										>
											Next
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>

			{/* Approval Dialog */}
			<Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
							Commission
						</DialogTitle>
						<DialogDescription>
							{dialogState.transaction && (
								<>
									{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
									commission for{" "}
									<strong>
										{dialogState.transaction.clientData?.name ||
											"Unknown Client"}
									</strong>{" "}
									by <strong>{dialogState.transaction.agentName}</strong>
									<br />
									Commission Amount:{" "}
									<strong>
										{formatCurrency(dialogState.transaction.commissionAmount)}
									</strong>
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
								(dialogState.action === "reject" &&
									!dialogState.reviewNotes.trim())
							}
							className={
								dialogState.action === "approve"
									? "bg-green-600 hover:bg-green-700"
									: "bg-red-600 hover:bg-red-700"
							}
						>
							{dialogState.isSubmitting
								? "Processing…"
								: dialogState.action === "approve"
									? "Approve"
									: "Reject"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
