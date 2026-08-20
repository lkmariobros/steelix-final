"use client";

import { Avatar, AvatarFallback } from "@/components/avatar";
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
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiCloseLine,
	RiEyeLine,
	RiSearchLine,
	RiTimeLine,
} from "@remixicon/react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { formatCurrency } from "../admin-schema";
import {
	formatStatusLabel,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { TablePagination } from "./table-pagination";

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

const PAGE_SIZE = 5;

export function CommissionApprovalQueue({
	className,
}: CommissionApprovalQueueProps) {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(0);
	const [search, setSearch] = useState("");
	const [dialogState, setDialogState] = useState<ApprovalDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	const { commissionQueue: queueData, queueLoading: isLoading } =
		useAdminDashboard();

	const processApprovalMutation =
		trpc.admin.processCommissionApproval.useMutation({
			onMutate: async (variables) => {
				optimisticUpdateTransaction(queryClient, variables.transactionId, {
					status: variables.action === "approve" ? "verified" : "cancelled",
					reviewNotes: variables.reviewNotes,
				});
			},
			onSuccess: (_, variables) => {
				const label = variables.action === "approve" ? "verified" : "cancelled";
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
		const notes = dialogState.reviewNotes.trim();
		if (!notes) return;
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

	const allTransactions = useMemo(() => {
		return (queueData?.transactions || []).map((t) => ({
			...t,
			status: (t.status || "submitted") as
				| "submitted"
				| "under_review"
				| "approved"
				| "rejected",
		}));
	}, [queueData?.transactions]);

	const filteredTransactions = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return allTransactions;
		return allTransactions.filter((t) => {
			const haystack = [
				t.agentName,
				t.clientData?.name,
				t.propertyData?.address,
				t.transactionType,
				String(t.commissionAmount ?? ""),
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(q);
		});
	}, [allTransactions, search]);

	const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
	const safePage = Math.min(page, pageCount - 1);
	const pageTransactions = filteredTransactions.slice(
		safePage * PAGE_SIZE,
		(safePage + 1) * PAGE_SIZE,
	);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		setPage(0);
	};

	if (isLoading) {
		return (
			<Card className={cn("flex h-full flex-col", className)}>
				<CardHeader className="pb-2">
					<CardTitle className="flex items-center gap-2.5 text-base">
						<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<RiTimeLine size={18} />
						</span>
						Commission Approval Queue
					</CardTitle>
				</CardHeader>
				<CardContent className="flex-1 space-y-3 pt-2">
					<Skeleton className="h-9 w-full max-w-xs rounded-xl" />
					{["sk-ca-1", "sk-ca-2", "sk-ca-3", "sk-ca-4", "sk-ca-5"].map((id) => (
						<div
							key={id}
							className="flex items-center justify-between rounded-xl bg-muted/40 p-4"
						>
							<div className="flex items-center gap-3">
								<Skeleton className="size-8 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-24" />
								</div>
							</div>
							<Skeleton className="h-8 w-40 rounded-lg" />
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className={cn("flex h-full flex-col", className)}>
				<CardHeader className="pb-3">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2.5">
							<CardTitle className="flex items-center gap-2.5 text-base">
								<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<RiTimeLine size={18} />
								</span>
								Commission Approval Queue
							</CardTitle>
							<Badge
								variant="secondary"
								className="rounded-full bg-primary/12 text-primary"
							>
								{queueData?.totalCount || allTransactions.length} pending
							</Badge>
						</div>
						<div className="relative w-full sm:max-w-[220px]">
							<RiSearchLine
								size={16}
								className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground"
							/>
							<Input
								value={search}
								onChange={(e) => handleSearchChange(e.target.value)}
								placeholder="Search"
								className="h-9 rounded-xl border-border/70 bg-muted/30 pl-9"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col pt-0">
					{allTransactions.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
							<div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
								<RiCheckLine size={22} />
							</div>
							<p className="font-medium text-sm">Queue is clear</p>
							<p className="mt-1 text-muted-foreground text-sm">
								No transactions pending approval.
							</p>
						</div>
					) : filteredTransactions.length === 0 ? (
						<div className="flex flex-1 items-center justify-center py-10">
							<p className="text-muted-foreground text-sm">
								No matches for “{search.trim()}”.
							</p>
						</div>
					) : (
						<>
							<div className="min-h-0 flex-1 overflow-x-auto rounded-xl border border-border/60">
								<Table className="w-full table-fixed min-w-[720px]">
									<TableHeader>
										<TableRow className="border-border/50 hover:bg-transparent">
											<TableHead className="h-11 w-[22%] bg-muted/50 font-semibold text-foreground text-xs">
												Agent & Client
											</TableHead>
											<TableHead className="h-11 w-[16%] bg-muted/50 font-semibold text-foreground text-xs">
												Property
											</TableHead>
											<TableHead className="h-11 w-[12%] bg-muted/50 font-semibold text-foreground text-xs">
												Commission
											</TableHead>
											<TableHead className="h-11 w-[14%] bg-muted/50 font-semibold text-foreground text-xs">
												Submitted
											</TableHead>
											<TableHead className="h-11 w-[10%] bg-muted/50 font-semibold text-foreground text-xs">
												Status
											</TableHead>
											<TableHead className="h-11 w-[26%] bg-muted/50 text-right font-semibold text-foreground text-xs">
												Actions
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{pageTransactions.map((transaction) => {
											const agentName =
												transaction.agentName || "Unknown Agent";
											const initials = agentName
												.split(/\s+/)
												.filter(Boolean)
												.map((p) => p[0])
												.join("")
												.slice(0, 2)
												.toUpperCase();
											const submitted = transaction.submittedAt
												? new Date(transaction.submittedAt)
												: null;
											const clientName = (
												transaction.clientData?.name || "Unknown Client"
											).toLowerCase();

											return (
												<TableRow
													key={transaction.id}
													className="border-border/40 hover:bg-muted/20"
												>
													<TableCell className="max-w-0 py-3">
														<div className="flex min-w-0 items-center gap-2">
															<Avatar className="size-8 shrink-0 border border-border/60">
																<AvatarFallback className="bg-primary/10 font-semibold text-primary text-[10px]">
																	{initials || "?"}
																</AvatarFallback>
															</Avatar>
															<div className="min-w-0 flex-1 overflow-hidden">
																<p
																	className="truncate font-medium text-foreground text-sm leading-snug"
																	title={agentName}
																>
																	{agentName}
																</p>
																<p
																	className="mt-0.5 truncate text-muted-foreground text-xs capitalize leading-snug"
																	title={clientName}
																>
																	{clientName}
																</p>
															</div>
														</div>
													</TableCell>
													<TableCell className="max-w-0 py-3">
														<p
															className="truncate text-muted-foreground text-sm"
															title={
																transaction.propertyData?.address ||
																"Unknown Property"
															}
														>
															{transaction.propertyData?.address ||
																"Unknown Property"}
														</p>
													</TableCell>
													<TableCell className="py-3">
														<p className="truncate font-semibold tabular-nums text-foreground text-sm">
															{formatCurrency(transaction.commissionAmount)}
														</p>
														<p className="mt-0.5 truncate text-muted-foreground text-xs capitalize">
															{transaction.transactionType}
														</p>
													</TableCell>
													<TableCell className="py-3">
														{submitted ? (
															<>
																<p className="truncate text-foreground text-sm">
																	{format(submitted, "MMM d, yyyy")}
																</p>
																<p className="mt-0.5 truncate text-muted-foreground text-xs">
																	{format(submitted, "h:mm a")}
																</p>
															</>
														) : (
															<span className="text-muted-foreground text-sm">
																—
															</span>
														)}
													</TableCell>
													<TableCell className="py-3">
														<Badge
															className={cn(
																"rounded-full border-0 px-2 py-0.5 font-medium text-[11px]",
																transaction.status === "submitted" ||
																	transaction.status === "under_review"
																	? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
																	: getStatusBadgeClass(transaction.status),
															)}
														>
															{formatStatusLabel(transaction.status)}
														</Badge>
													</TableCell>
													<TableCell className="py-3 text-right">
														<div className="flex flex-nowrap items-center justify-end gap-1">
															<Button
																size="sm"
																variant="secondary"
																asChild
																className="h-7 shrink-0 gap-1 rounded-lg border-0 bg-sky-500/15 px-2 text-sky-700 text-xs hover:bg-sky-500/25 dark:text-sky-300"
															>
																<Link
																	href={`/admin/transactions/case/${transaction.id}`}
																>
																	<RiEyeLine size={13} />
																	View
																</Link>
															</Button>
															<Button
																size="sm"
																variant="secondary"
																onClick={() =>
																	handleApprovalAction(transaction, "approve")
																}
																className="h-7 shrink-0 gap-1 rounded-lg border-0 bg-emerald-500/15 px-2 text-emerald-700 text-xs hover:bg-emerald-500/25 dark:text-emerald-300"
															>
																<RiCheckLine size={13} />
																Approve
															</Button>
															<Button
																size="sm"
																variant="secondary"
																onClick={() =>
																	handleApprovalAction(transaction, "reject")
																}
																className="h-7 shrink-0 gap-1 rounded-lg border-0 bg-rose-500/15 px-2 text-rose-700 text-xs hover:bg-rose-500/25 dark:text-rose-300"
															>
																<RiCloseLine size={13} />
																Reject
															</Button>
														</div>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							<TablePagination
								className="mt-auto pt-4"
								page={safePage}
								pageSize={PAGE_SIZE}
								total={filteredTransactions.length}
								onPageChange={setPage}
							/>
						</>
					)}
				</CardContent>
			</Card>

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
								Review notes <span className="text-red-500">*</span>
							</label>
							<Textarea
								id="review-notes"
								placeholder={
									dialogState.action === "approve"
										? "Required: e.g. verified booking docs, pricing checked…"
										: "Required: reason for rejection (shown to the agent)…"
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
								dialogState.isSubmitting || !dialogState.reviewNotes.trim()
							}
							className={
								dialogState.action === "approve"
									? "bg-primary hover:bg-primary/90"
									: "bg-rose-600 hover:bg-rose-700"
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
