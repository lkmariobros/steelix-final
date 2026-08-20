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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import { useTransactionModalActions } from "@/contexts/transaction-modal-context";
import type { AdminTransactionSegmentConfig } from "@/features/admin-transactions/segment-config";
import { getSegmentPageUrl } from "@/features/admin-transactions/segment-config";
import { stashTransactionPrefillOnce } from "@/features/sales-entry/prefill-stash";
import {
	formatPaymentMethodField,
	paymentMethodColumnLabel,
} from "@/features/transactions/payment-method-utils";
import {
	formatRm,
	formatStatusLabel,
	formatTransactionAging,
	formatTransactionDate,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiDashboardLine,
	RiFileList3Line,
	RiSearchLine,
	RiUserLine,
} from "@remixicon/react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

const PAGE_SIZE = 25;

type AdminTxRow = {
	id: string;
	caseNo: string | null;
	bookingDate: Date | string | null;
	transactionDate: Date | string;
	transactionType?: string | null;
	projectName: string | null;
	unitNo: string | null;
	status: string | null;
	convertedAt?: Date | string | null;
	reviewedAt?: Date | string | null;
	commissionAmount: string | null;
	isCoBroking?: boolean | null;
	agentName?: string | null;
	agentCode?: string | null;
	coAgentName?: string | null;
	coAgentCode?: string | null;
	propertyData?: {
		address?: string;
		price?: number;
		spaPrice?: number;
		nettPrice?: number;
		purchasingMethod?: "cash" | "loan";
		sstPayBy?: "landlord" | "agent";
	} | null;
};

function AgentCell({
	name,
	code,
}: {
	name?: string | null;
	code?: string | null;
}) {
	if (!name && !code) {
		return <span className="text-muted-foreground text-sm">—</span>;
	}
	const initials = (name ?? "?")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");

	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary text-[11px]">
				{initials || <RiUserLine size={14} />}
			</span>
			<div className="min-w-0">
				<p className="truncate font-medium text-foreground text-sm leading-snug">
					{name ?? "—"}
				</p>
				{code ? (
					<p className="truncate font-mono text-muted-foreground text-[11px]">
						Code {code}
					</p>
				) : null}
			</div>
		</div>
	);
}

function AgentsCell({ row }: { row: AdminTxRow }) {
	const isCo = row.isCoBroking;
	return (
		<div className="flex min-w-[160px] flex-col gap-2.5 py-0.5">
			<AgentCell name={row.agentName} code={row.agentCode} />
			{isCo ? (
				<AgentCell name={row.coAgentName} code={row.coAgentCode} />
			) : null}
		</div>
	);
}

const thClass =
	"h-11 whitespace-nowrap border-b border-border/60 bg-muted px-4 text-left font-semibold text-foreground/80 text-xs tracking-wide";
const tdClass =
	"border-b border-border/50 px-4 py-3.5 align-middle text-sm text-foreground/90";

export function AdminTransactionSegmentPage({
	config,
}: {
	config: AdminTransactionSegmentConfig;
}) {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(0);
	const { openCreateModal } = useTransactionModalActions();

	const queryInput = useMemo(
		() => ({
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
			search: search.trim() || undefined,
			marketType: config.marketType,
			transactionType: config.transactionType,
			pendingApprovalOnly: config.view === "approval",
			editRequestsOnly: config.view === "requests",
		}),
		[config, page, search],
	);

	const { data, isLoading } = trpc.transactions.adminList.useQuery(queryInput);
	const rows = (data?.transactions ?? []) as AdminTxRow[];
	const total = data?.total ?? 0;
	const isPrimaryUnits =
		config.segment === "new-project" && config.view === "units";
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const handleNewTransaction = () => {
		stashTransactionPrefillOnce({
			marketType: config.marketType ?? "secondary",
			transactionType:
				config.transactionType === "rental" ? "lease" : config.transactionType,
		});
		openCreateModal();
	};

	return (
		<>
			<header className="sticky top-0 z-30 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
				<div className="flex flex-1 items-center gap-2 px-1 sm:px-0">
					<SidebarTrigger className="-ms-1 rounded-xl" />
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
							{config.breadcrumb.map((crumb, i) => (
								<Fragment key={crumb}>
									<BreadcrumbSeparator className="hidden md:block" />
									<BreadcrumbItem>
										{i === config.breadcrumb.length - 1 ? (
											<BreadcrumbPage className="flex items-center gap-2">
												{i === 0 ? (
													<RiFileList3Line size={18} aria-hidden="true" />
												) : null}
												{crumb}
											</BreadcrumbPage>
										) : (
											<BreadcrumbLink href={getSegmentPageUrl(config)}>
												{crumb}
											</BreadcrumbLink>
										)}
									</BreadcrumbItem>
								</Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h1 className="font-bold text-2xl tracking-tight">{config.title}</h1>
						<p className="mt-0.5 text-muted-foreground text-sm">
							{config.description}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2.5">
						<div className="relative w-full sm:w-64">
							<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
							<Input
								className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
								placeholder="Search case, unit, agent…"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setPage(0);
								}}
							/>
						</div>
						{config.showNewTransaction ? (
							<Button
								size="lg"
								className="h-10 gap-1.5"
								onClick={handleNewTransaction}
							>
								<RiAddLine className="size-4" />
								New Transaction
							</Button>
						) : null}
					</div>
				</div>

				<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
					<CardHeader className="border-border/60 border-b bg-card px-5 py-4">
						<CardTitle className="font-semibold text-base">
							{total} case{total === 1 ? "" : "s"}
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{isLoading ? (
							<div className="space-y-3 p-5">
								{[1, 2, 3, 4, 5].map((i) => (
									<Skeleton key={i} className="h-12 w-full rounded-xl" />
								))}
							</div>
						) : rows.length === 0 ? (
							<p className="py-14 text-center text-muted-foreground text-sm">
								No cases match this view.
							</p>
						) : (
							<div className="w-full overflow-x-auto">
								<div className="max-h-[min(70vh,720px)] overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
									<table className="w-full min-w-[960px] caption-bottom border-collapse text-sm">
										<TableHeader>
											<TableRow className="border-0 hover:bg-transparent">
												<TableHead className={thClass}>Case No</TableHead>
												<TableHead className={thClass}>
													{isPrimaryUnits ? "Booking Date" : "Offer Date"}
												</TableHead>
												{isPrimaryUnits ? (
													<>
														<TableHead className={thClass}>Project</TableHead>
														<TableHead className={thClass}>Unit No</TableHead>
													</>
												) : (
													<TableHead className={thClass}>Address</TableHead>
												)}
												<TableHead className={thClass}>Status</TableHead>
												{isPrimaryUnits ? (
													<TableHead className={thClass}>Aging</TableHead>
												) : null}
												{isPrimaryUnits ? (
													<>
														<TableHead className={thClass}>SPA Price</TableHead>
														<TableHead className={thClass}>Nett Price</TableHead>
													</>
												) : config.segment === "rental" ? (
													<>
														<TableHead className={thClass}>
															Rental Amount
														</TableHead>
														<TableHead className={thClass}>
															Case Commission
														</TableHead>
													</>
												) : (
													<>
														<TableHead className={thClass}>Nett Price</TableHead>
														<TableHead className={thClass}>
															Commission Amount
														</TableHead>
													</>
												)}
												<TableHead className={thClass}>
													{paymentMethodColumnLabel(undefined, config.segment)}
												</TableHead>
												<TableHead className={cn(thClass, "pr-5")}>
													Agent(s)
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{rows.map((row) => {
												const prop = row.propertyData;
												const offerOrBooking =
													row.bookingDate ?? row.transactionDate;
												const spa = prop?.spaPrice ?? prop?.price;
												const nett = prop?.nettPrice ?? prop?.price;
												return (
													<TableRow
														key={row.id}
														className="border-border/50 transition-colors hover:bg-muted/35"
													>
														<TableCell className={tdClass}>
															<Link
																href={`/admin/transactions/case/${row.id}`}
																className="font-medium font-mono text-primary hover:underline"
															>
																{row.caseNo ?? row.id.slice(0, 8)}
															</Link>
														</TableCell>
														<TableCell
															className={cn(tdClass, "whitespace-nowrap text-muted-foreground")}
														>
															{formatTransactionDate(offerOrBooking)}
														</TableCell>
														{isPrimaryUnits ? (
															<>
																<TableCell className={tdClass}>
																	<span className="line-clamp-2 max-w-[180px]">
																		{row.projectName ?? "—"}
																	</span>
																</TableCell>
																<TableCell className={tdClass}>
																	{row.unitNo ?? "—"}
																</TableCell>
															</>
														) : (
															<TableCell className={tdClass}>
																<span className="line-clamp-2 max-w-[220px]">
																	{prop?.address ?? "—"}
																</span>
															</TableCell>
														)}
														<TableCell className={tdClass}>
															<span
																className={cn(
																	"inline-flex w-fit items-center",
																	getStatusBadgeClass(row.status),
																)}
															>
																{formatStatusLabel(row.status)}
															</span>
														</TableCell>
														{isPrimaryUnits ? (
															<TableCell
																className={cn(
																	tdClass,
																	"tabular-nums text-muted-foreground",
																)}
															>
																{formatTransactionAging(
																	offerOrBooking,
																	row.status,
																	row.convertedAt,
																	row.reviewedAt,
																)}
															</TableCell>
														) : null}
														{isPrimaryUnits ? (
															<>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(spa)}
																</TableCell>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(nett)}
																</TableCell>
															</>
														) : config.segment === "rental" ? (
															<>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(prop?.price)}
																</TableCell>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(row.commissionAmount)}
																</TableCell>
															</>
														) : (
															<>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(nett)}
																</TableCell>
																<TableCell
																	className={cn(tdClass, "font-medium tabular-nums")}
																>
																	{formatRm(row.commissionAmount)}
																</TableCell>
															</>
														)}
														<TableCell className={tdClass}>
															<span className="whitespace-nowrap">
																{formatPaymentMethodField(
																	row.transactionType,
																	prop,
																)}
															</span>
														</TableCell>
														<TableCell className={cn(tdClass, "pr-5")}>
															<AgentsCell row={row} />
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</table>
								</div>
							</div>
						)}

						{total > 0 ? (
							<div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-t bg-muted/20 px-5 py-3.5">
								<p className="text-muted-foreground text-xs">
									Showing{" "}
									<span className="font-medium text-foreground">
										{page * PAGE_SIZE + 1}
									</span>{" "}
									to{" "}
									<span className="font-medium text-foreground">
										{Math.min((page + 1) * PAGE_SIZE, total)}
									</span>{" "}
									of{" "}
									<span className="font-medium text-foreground">{total}</span>{" "}
									entries
								</p>
								{total > PAGE_SIZE ? (
									<div className="flex items-center gap-1.5">
										<Button
											variant="outline"
											size="sm"
											className="h-8 rounded-lg"
											disabled={page === 0}
											onClick={() => setPage((p) => p - 1)}
										>
											Previous
										</Button>
										<span className="px-2 text-muted-foreground text-xs tabular-nums">
											{page + 1} / {totalPages}
										</span>
										<Button
											variant="outline"
											size="sm"
											className="h-8 rounded-lg"
											disabled={!data?.hasMore}
											onClick={() => setPage((p) => p + 1)}
										>
											Next
										</Button>
									</div>
								) : null}
							</div>
						) : null}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
