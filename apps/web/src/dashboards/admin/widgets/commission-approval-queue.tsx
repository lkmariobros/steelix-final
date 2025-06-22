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
// import { trpc } from "@/utils/trpc"; // Temporarily disabled
// import { toast } from "sonner"; // Temporarily disabled
import {
	RiCheckLine,
	RiCloseLine,
	RiEyeLine,
	RiTimeLine,
} from "@remixicon/react";
import React, { useState } from "react";

// Import types and utilities
import type { CommissionApproval, DateRangeFilter } from "../admin-schema";
import {
	formatCurrency,
	formatDateTime,
	getDaysAgo,
	getStatusColor,
} from "../admin-schema";

interface CommissionApprovalQueueProps {
	dateRange?: DateRangeFilter;
	refreshKey?: number;
	className?: string;
}

interface ApprovalDialogState {
	isOpen: boolean;
	transaction: CommissionApproval | null;
	action: "approve" | "reject" | null;
	reviewNotes: string;
	isSubmitting: boolean;
}

export function CommissionApprovalQueue({
	dateRange,
	refreshKey,
	className,
}: CommissionApprovalQueueProps) {
	const [page, setPage] = useState(0);
	const [dialogState, setDialogState] = useState<ApprovalDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	const pageSize = 10;

	// TEMPORARILY DISABLED - Mock data for testing
	// const {
	// 	data: queueData,
	// 	isLoading,
	// 	error,
	// 	refetch
	// } = trpc.admin.getCommissionApprovalQueue.useQuery(
	// 	{
	// 		limit: pageSize,
	// 		offset: page * pageSize,
	// 		status: "submitted", // Only show submitted transactions
	// 	},
	// 	{
	// 		refetchOnWindowFocus: false,
	// 		staleTime: 30000, // 30 seconds
	// 	}
	// );

	// Mock data for testing
	const queueData = {
		transactions: [
			{
				id: "1",
				agentId: "agent1",
				agentName: "John Smith",
				agentEmail: "john@example.com",
				clientData: {
					name: "Alice Johnson",
					email: "alice@example.com",
					phone: "555-0123",
					type: "buyer" as const,
					source: "referral",
				},
				propertyData: {
					address: "123 Main St, City, State",
					propertyType: "Single Family",
					price: 450000,
				},
				transactionType: "sale" as const,
				commissionAmount: "22500",
				commissionValue: "5.0",
				status: "submitted" as const,
				submittedAt: "2024-01-15T10:30:00Z",
				createdAt: "2024-01-15T10:30:00Z",
			},
			{
				id: "2",
				agentId: "agent2",
				agentName: "Sarah Wilson",
				agentEmail: "sarah@example.com",
				clientData: {
					name: "Bob Martinez",
					email: "bob@example.com",
					phone: "555-0456",
					type: "seller" as const,
					source: "website",
				},
				propertyData: {
					address: "456 Oak Ave, City, State",
					propertyType: "Condo",
					price: 320000,
				},
				transactionType: "sale" as const,
				commissionAmount: "16000",
				commissionValue: "5.0",
				status: "submitted" as const,
				submittedAt: "2024-01-14T14:20:00Z",
				createdAt: "2024-01-14T14:20:00Z",
			},
		],
		totalCount: 12,
		hasMore: true,
	};
	const isLoading = false;
	const error = null;
	const refetch = () => {};

	// TEMPORARILY DISABLED - Mock mutation for testing
	// const processApprovalMutation = trpc.admin.processCommissionApproval.useMutation({
	// 	onSuccess: (updatedTransaction) => {
	// 		toast.success(
	// 			`Transaction ${dialogState.action === "approve" ? "approved" : "rejected"} successfully`
	// 		);
	// 		refetch(); // Refresh the queue
	// 		closeDialog();
	// 	},
	// 	onError: (error) => {
	// 		toast.error(`Failed to ${dialogState.action} transaction: ${error.message}`);
	// 		setDialogState(prev => ({ ...prev, isSubmitting: false }));
	// 	},
	// });

	// Mock mutation for testing
	const processApprovalMutation = {
		mutate: (data: {
			id?: string;
			action: string;
			notes?: string;
			transactionId?: string;
			reviewNotes?: string;
		}) => {
			// Simulate processing
			setTimeout(() => {
				console.log(
					`Transaction ${dialogState.action === "approve" ? "approved" : "rejected"} successfully`,
				);
				closeDialog();
			}, 1000);
		},
	};

	// Refetch when refreshKey changes
	React.useEffect(() => {
		if (refreshKey !== undefined) {
			refetch();
		}
	}, [refreshKey, refetch]);

	// Handle approval action
	const handleApprovalAction = (
		transaction: CommissionApproval,
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

	// Handle pagination
	const handlePreviousPage = () => {
		setPage((prev) => Math.max(0, prev - 1));
	};

	const handleNextPage = () => {
		if (queueData?.hasMore) {
			setPage((prev) => prev + 1);
		}
	};

	// Loading state
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
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								key={i}
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
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	// Error state
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
							Failed to load approval queue. Please try again.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const transactions = queueData?.transactions || [];

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
															{getDaysAgo(transaction.submittedAt)} days ago
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
							{(queueData?.totalCount || 0) > pageSize && (
								<div className="mt-4 flex items-center justify-between">
									<p className="text-muted-foreground text-sm">
										Showing {page * pageSize + 1} to{" "}
										{Math.min(
											(page + 1) * pageSize,
											queueData?.totalCount || 0,
										)}{" "}
										of {queueData?.totalCount || 0} transactions
									</p>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={handlePreviousPage}
											disabled={page === 0}
										>
											Previous
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={handleNextPage}
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
								? "Processing..."
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
