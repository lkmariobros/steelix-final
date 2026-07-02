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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalRequestQueueTransaction } from "@/features/approvals/approval-request-queue-item";
import {
	formatStatusLabel,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { formatRequestItemLabel } from "@/features/transactions/request-items";
import { trpc } from "@/utils/trpc";
import {
	RiCheckLine,
	RiCloseLine,
	RiDashboardLine,
	RiFileList3Line,
	RiLoader4Line,
	RiRefreshLine,
	RiSearchLine,
} from "@remixicon/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RequestSegment = "new-project" | "subsale" | "rental";

const SEGMENT_TABS: {
	value: RequestSegment;
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

interface RequestDialogState {
	isOpen: boolean;
	transaction: ApprovalRequestQueueTransaction | null;
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

function formatDate(date: Date | string | null | undefined) {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-MY", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatCashLoan(method?: string | null) {
	if (!method) return "—";
	return method === "cash" ? "Cash" : method === "loan" ? "Loan" : method;
}

function AgentCell({
	name,
	code,
}: {
	name?: string | null;
	code?: string | null;
}) {
	if (!name && !code) return <span className="text-muted-foreground">—</span>;
	return (
		<div className="min-w-0">
			<p className="truncate">{name ?? "—"}</p>
			{code ? (
				<p className="truncate font-mono text-muted-foreground text-xs">
					{code}
				</p>
			) : null}
		</div>
	);
}

function AgentsCell({ row }: { row: ApprovalRequestQueueTransaction }) {
	return (
		<div className="min-w-0 space-y-1">
			<AgentCell name={row.agentName} code={row.agentCode} />
			{row.isCoBroking ? (
				<AgentCell name={row.coAgentName} code={row.coAgentCode} />
			) : null}
		</div>
	);
}

function RequestActions({
	row,
	onApprove,
	onReject,
}: {
	row: ApprovalRequestQueueTransaction;
	onApprove: (tx: ApprovalRequestQueueTransaction) => void;
	onReject: (tx: ApprovalRequestQueueTransaction) => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-end gap-1">
			<Button size="sm" variant="secondary" asChild className="h-8 px-2 text-xs">
				<Link href={`/admin/transactions/case/${row.id}`}>
					<RiFileList3Line className="mr-1 size-3.5" />
					View
				</Link>
			</Button>
			<Button
				size="sm"
				variant="outline"
				className="h-8 px-2 text-green-600 text-xs hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
				onClick={() => onApprove(row)}
			>
				<RiCheckLine className="mr-1 size-3.5" />
				Approve
			</Button>
			<Button
				size="sm"
				variant="outline"
				className="h-8 px-2 text-red-600 text-xs hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
				onClick={() => onReject(row)}
			>
				<RiCloseLine className="mr-1 size-3.5" />
				Reject
			</Button>
		</div>
	);
}

function RequestTable({
	segment,
	rows,
	onApprove,
	onReject,
}: {
	segment: RequestSegment;
	rows: ApprovalRequestQueueTransaction[];
	onApprove: (tx: ApprovalRequestQueueTransaction) => void;
	onReject: (tx: ApprovalRequestQueueTransaction) => void;
}) {
	return (
		<div className="w-full overflow-hidden rounded-md border">
			<table className="w-full table-fixed text-xs sm:text-sm">
				<thead className="border-b bg-muted/30 text-left">
					{segment === "new-project" ? (
						<tr>
							<th className="px-2 py-2 font-medium">Case No</th>
							<th className="px-2 py-2 font-medium">Booking Date</th>
							<th className="hidden px-2 py-2 font-medium md:table-cell">
								Project
							</th>
							<th className="hidden px-2 py-2 font-medium lg:table-cell">
								Unit No
							</th>
							<th className="hidden px-2 py-2 font-medium xl:table-cell">
								SPA Price
							</th>
							<th className="px-2 py-2 font-medium">Nett Price</th>
							<th className="hidden px-2 py-2 font-medium lg:table-cell">
								Cash/Loan
							</th>
							<th className="hidden px-2 py-2 font-medium md:table-cell">
								Commission
							</th>
							<th className="px-2 py-2 font-medium">Request Item</th>
							<th className="px-2 py-2 font-medium">Status</th>
							<th className="hidden px-2 py-2 font-medium sm:table-cell">
								Agent
							</th>
							<th className="px-2 py-2 text-right font-medium">Actions</th>
						</tr>
					) : (
						<tr>
							<th className="px-2 py-2 font-medium">Case No</th>
							<th className="px-2 py-2 font-medium">Request Date</th>
							<th className="px-2 py-2 font-medium">Address</th>
							<th className="hidden px-2 py-2 font-medium sm:table-cell">
								Commission
							</th>
							<th className="px-2 py-2 font-medium">Request Item</th>
							<th className="px-2 py-2 font-medium">Status</th>
							<th className="hidden px-2 py-2 font-medium md:table-cell">
								Agent
							</th>
							<th className="px-2 py-2 text-right font-medium">Actions</th>
						</tr>
					)}
				</thead>
				<tbody>
					{rows.map((row) => {
						const prop = row.propertyData;
						const spa = prop?.spaPrice ?? prop?.price;
						const nett = prop?.nettPrice ?? prop?.price;
						const requestDate = row.requestSubmittedAt ?? row.transactionDate;

						if (segment === "new-project") {
							return (
								<tr
									key={row.id}
									className="border-b last:border-b-0 hover:bg-muted/40"
								>
									<td className="truncate px-2 py-2 font-mono text-xs">
										{row.caseNo ?? "—"}
									</td>
									<td className="truncate px-2 py-2">
										{formatDate(row.bookingDate ?? row.transactionDate)}
									</td>
									<td className="hidden truncate px-2 py-2 md:table-cell">
										{row.projectName?.trim() || "—"}
									</td>
									<td className="hidden truncate px-2 py-2 lg:table-cell">
										{row.unitNo?.trim() || "—"}
									</td>
									<td className="hidden truncate px-2 py-2 xl:table-cell">
										{formatRm(spa)}
									</td>
									<td className="truncate px-2 py-2">{formatRm(nett)}</td>
									<td className="hidden truncate px-2 py-2 lg:table-cell">
										{formatCashLoan(prop?.purchasingMethod)}
									</td>
									<td className="hidden truncate px-2 py-2 md:table-cell">
										{formatRm(row.commissionAmount)}
									</td>
									<td className="truncate px-2 py-2" title={formatRequestItemLabel(row.requestItem)}>
										{formatRequestItemLabel(row.requestItem)}
									</td>
									<td className="px-2 py-2">
										<span
											className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(row.status)}`}
										>
											{formatStatusLabel(row.status)}
										</span>
									</td>
									<td className="hidden px-2 py-2 sm:table-cell">
										<AgentsCell row={row} />
									</td>
									<td className="px-2 py-2">
										<RequestActions
											row={row}
											onApprove={onApprove}
											onReject={onReject}
										/>
									</td>
								</tr>
							);
						}

						return (
							<tr
								key={row.id}
								className="border-b last:border-b-0 hover:bg-muted/40"
							>
								<td className="truncate px-2 py-2 font-mono text-xs">
									{row.caseNo ?? "—"}
								</td>
								<td className="truncate px-2 py-2">{formatDate(requestDate)}</td>
								<td
									className="truncate px-2 py-2"
									title={prop?.address?.trim() || undefined}
								>
									{prop?.address?.trim() || "—"}
								</td>
								<td className="hidden truncate px-2 py-2 sm:table-cell">
									{formatRm(row.commissionAmount)}
								</td>
								<td
									className="truncate px-2 py-2"
									title={formatRequestItemLabel(row.requestItem)}
								>
									{formatRequestItemLabel(row.requestItem)}
								</td>
								<td className="px-2 py-2">
									<span
										className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(row.status)}`}
									>
										{formatStatusLabel(row.status)}
									</span>
								</td>
								<td className="hidden px-2 py-2 md:table-cell">
									<AgentsCell row={row} />
								</td>
								<td className="px-2 py-2">
									<RequestActions
										row={row}
										onApprove={onApprove}
										onReject={onReject}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

export default function AdminApprovalRequestsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(0);
	const [search, setSearch] = useState("");
	const pageSize = 20;

	const segmentParam = searchParams.get("segment") as RequestSegment | null;
	const segment: RequestSegment =
		segmentParam && SEGMENT_TABS.some((t) => t.value === segmentParam)
			? segmentParam
			: "new-project";

	const segmentConfig = SEGMENT_TABS.find((t) => t.value === segment)!;

	const [dialogState, setDialogState] = useState<RequestDialogState>({
		isOpen: false,
		transaction: null,
		action: null,
		reviewNotes: "",
		isSubmitting: false,
	});

	useEffect(() => {
		if (!segmentParam || !SEGMENT_TABS.some((t) => t.value === segmentParam)) {
			router.replace("/admin/approvals/requests?segment=new-project");
		}
	}, [segmentParam, router]);

	useEffect(() => {
		setPage(0);
	}, [segment]);

	const queryInput = useMemo(
		() => ({
			limit: pageSize,
			offset: page * pageSize,
			search: search.trim() || undefined,
			editRequestsOnly: true,
			marketType: segmentConfig.marketType,
			transactionType: segmentConfig.transactionType,
		}),
		[page, search, segmentConfig],
	);

	const { data, isLoading, refetch } = trpc.transactions.adminList.useQuery(
		queryInput,
		{ staleTime: 60_000 },
	);

	const processRequestMutation = trpc.admin.processEditRequest.useMutation({
		onSuccess: (_data, variables) => {
			const actionText =
				variables.action === "approve" ? "approved" : "rejected";
			toast.success(`Edit request ${actionText}`);
			queryClient.invalidateQueries({
				queryKey: [["transactions", "adminList"]],
			});
			closeDialog();
		},
		onError: (error, variables) => {
			toast.error(
				`Failed to ${variables.action} request: ${error.message}`,
			);
			setDialogState((prev) => ({ ...prev, isSubmitting: false }));
		},
	});

	const handleSegmentChange = (value: string) => {
		router.replace(`/admin/approvals/requests?segment=${value}`);
	};

	const handleRequestAction = (
		transaction: ApprovalRequestQueueTransaction,
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

	const submitRequestDecision = () => {
		if (!dialogState.transaction || !dialogState.action) return;
		const notes = dialogState.reviewNotes.trim();
		if (!notes) {
			toast.error("Review notes are required");
			return;
		}
		setDialogState((prev) => ({ ...prev, isSubmitting: true }));
		processRequestMutation.mutate({
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

	const pendingCount = data?.total ?? 0;
	const rows = (data?.transactions ?? []) as ApprovalRequestQueueTransaction[];

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
								<BreadcrumbPage className="flex items-center gap-2">
									<RiFileList3Line size={20} aria-hidden="true" />
									Requests
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
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<h1 className="flex items-center gap-2 font-semibold text-2xl">
							<RiFileList3Line className="size-6" />
							Requests
						</h1>
						<p className="text-muted-foreground text-sm">
							Agent change requests awaiting your review — only pending
							requests are shown.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative w-full sm:w-64">
							<RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="h-9 pl-8"
								placeholder="Search case, unit, agent…"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(0);
								}}
							/>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void refetch()}
						>
							<RiRefreshLine className="size-4" />
						</Button>
					</div>
				</div>

				{isLoading ? (
					<Card className="max-w-sm">
						<CardHeader className="pb-2">
							<Skeleton className="h-3.5 w-28" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16" />
						</CardContent>
					</Card>
				) : (
					<Card className="max-w-sm">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">
								Pending Requests
							</CardTitle>
							<RiFileList3Line className="h-4 w-4 text-muted-foreground" />
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
						<CardTitle>{segmentConfig.label} Requests</CardTitle>
						<CardDescription>
							{segment === "new-project"
								? "Booking date, project, unit, pricing, commission, and request item"
								: "Request date, address, commission, and request item"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-48 w-full rounded-md" />
						) : rows.length > 0 ? (
							<div className="space-y-4">
								<RequestTable
									segment={segment}
									rows={rows}
									onApprove={(tx) => handleRequestAction(tx, "approve")}
									onReject={(tx) => handleRequestAction(tx, "reject")}
								/>

								{(pendingCount > pageSize || page > 0) && (
									<div className="flex items-center justify-between border-t pt-4">
										<p className="text-muted-foreground text-sm">
											Showing {page * pageSize + 1} to{" "}
											{Math.min((page + 1) * pageSize, pendingCount)} of{" "}
											{pendingCount}
										</p>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												disabled={page === 0}
												onClick={() => setPage((p) => Math.max(0, p - 1))}
											>
												Previous
											</Button>
											<Button
												variant="outline"
												size="sm"
												disabled={!data?.hasMore}
												onClick={() => setPage((p) => p + 1)}
											>
												Next
											</Button>
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="py-8 text-center">
								<RiFileList3Line
									size={48}
									className="mx-auto mb-4 text-muted-foreground"
								/>
								<h3 className="mb-2 font-semibold text-lg">
									No Pending Requests
								</h3>
								<p className="mb-4 text-muted-foreground">
									No {segmentConfig.label.toLowerCase()} change requests are
									waiting for approval.
								</p>
								<Button variant="outline" asChild>
									<Link href="/admin/approvals?segment=new-project">
										View transaction approvals
									</Link>
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
							{dialogState.action === "approve" ? "Approve" : "Reject"} Request
						</DialogTitle>
						<DialogDescription asChild>
							<div className="space-y-1 text-sm">
								{dialogState.transaction ? (
									<>
										<p>
											{dialogState.action === "approve" ? "Approve" : "Reject"}{" "}
											<strong>
												{formatRequestItemLabel(
													dialogState.transaction.requestItem,
												)}
											</strong>{" "}
											for case{" "}
											<strong>
												{dialogState.transaction.caseNo ?? "—"}
											</strong>
											.
										</p>
										<p>
											Commission:{" "}
											<strong>
												{formatRm(dialogState.transaction.commissionAmount)}
											</strong>
										</p>
										{dialogState.action === "approve" ? (
											<p className="text-muted-foreground">
												The case will reopen for the agent to edit.
											</p>
										) : null}
									</>
								) : null}
							</div>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<label
								htmlFor="request-review-notes"
								className="font-medium text-sm"
							>
								Review notes <span className="text-red-500">*</span>
							</label>
							<Textarea
								id="request-review-notes"
								placeholder={
									dialogState.action === "approve"
										? "Required: e.g. approved — please update unit details…"
										: "Required: reason for rejection (agent will see this)…"
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
							onClick={submitRequestDecision}
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
