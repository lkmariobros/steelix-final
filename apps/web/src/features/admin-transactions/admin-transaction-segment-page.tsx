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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
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
	formatRm,
	formatStatusLabel,
	formatTransactionDate,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { trpc } from "@/utils/trpc";
import { RiAddLine, RiDashboardLine, RiFileList3Line } from "@remixicon/react";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

const PAGE_SIZE = 25;

type AdminTxRow = {
	id: string;
	caseNo: string | null;
	bookingDate: Date | string | null;
	transactionDate: Date | string;
	projectName: string | null;
	unitNo: string | null;
	status: string | null;
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
	} | null;
};

function formatAging(date: Date | string | null | undefined) {
	if (!date) return "—";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "—";
	const days = differenceInCalendarDays(new Date(), d);
	if (days < 0) return "0d";
	return `${days}d`;
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
		<div className="text-sm">
			<p>{name ?? "—"}</p>
			{code ? (
				<p className="font-mono text-muted-foreground text-xs">Code {code}</p>
			) : null}
		</div>
	);
}

function AgentsCell({ row }: { row: AdminTxRow }) {
	const isCo = row.isCoBroking;
	return (
		<div className="space-y-2">
			<AgentCell name={row.agentName} code={row.agentCode} />
			{isCo ? (
				<AgentCell name={row.coAgentName} code={row.coAgentCode} />
			) : null}
		</div>
	);
}

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
	const isPrimaryUnits = config.segment === "new-project" && config.view === "units";

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
				<div className="ml-auto flex gap-3">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-4 py-4 lg:gap-6 lg:py-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="font-semibold text-2xl">{config.title}</h1>
						<p className="text-muted-foreground text-sm">{config.description}</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Input
							className="w-full sm:w-56"
							placeholder="Search case, unit, agent…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(0);
							}}
						/>
						{config.showNewTransaction ? (
							<Button
								className="bg-green-600 hover:bg-green-700"
								onClick={handleNewTransaction}
							>
								<RiAddLine className="mr-1.5 size-4" />
								New Transaction
							</Button>
						) : null}
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							{total} case{total === 1 ? "" : "s"}
						</CardTitle>
					</CardHeader>
					<CardContent className="overflow-x-auto">
						{isLoading ? (
							<Skeleton className="h-40 w-full" />
						) : rows.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No cases match this view.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Case No</TableHead>
										<TableHead>
											{isPrimaryUnits ? "Booking Date" : "Offer Date"}
										</TableHead>
										{isPrimaryUnits ? (
											<>
												<TableHead>Project</TableHead>
												<TableHead>Unit No</TableHead>
											</>
										) : (
											<TableHead>Address</TableHead>
										)}
										<TableHead>Status</TableHead>
										{isPrimaryUnits ? <TableHead>Aging</TableHead> : null}
										{isPrimaryUnits ? (
											<>
												<TableHead>SPA Price</TableHead>
												<TableHead>Nett Price</TableHead>
											</>
										) : config.segment === "rental" ? (
											<>
												<TableHead>Rental Amount</TableHead>
												<TableHead>Case Commission</TableHead>
											</>
										) : (
											<>
												<TableHead>Nett Price</TableHead>
												<TableHead>Commission Amount</TableHead>
											</>
										)}
										<TableHead>Cash/Loan</TableHead>
										<TableHead>Agent(s)</TableHead>
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
											<TableRow key={row.id}>
												<TableCell>
													<Link
														href={`/admin/transactions/case/${row.id}`}
														className="font-medium font-mono text-primary hover:underline"
													>
														{row.caseNo ?? row.id.slice(0, 8)}
													</Link>
												</TableCell>
												<TableCell>
													{formatTransactionDate(offerOrBooking)}
												</TableCell>
												{isPrimaryUnits ? (
													<>
														<TableCell>{row.projectName ?? "—"}</TableCell>
														<TableCell>{row.unitNo ?? "—"}</TableCell>
													</>
												) : (
													<TableCell className="max-w-[200px] truncate">
														{prop?.address ?? "—"}
													</TableCell>
												)}
												<TableCell>
													<Badge className={getStatusBadgeClass(row.status)}>
														{formatStatusLabel(row.status)}
													</Badge>
												</TableCell>
												{isPrimaryUnits ? (
													<TableCell>{formatAging(offerOrBooking)}</TableCell>
												) : null}
												{isPrimaryUnits ? (
													<>
														<TableCell>{formatRm(spa)}</TableCell>
														<TableCell>{formatRm(nett)}</TableCell>
													</>
												) : config.segment === "rental" ? (
													<>
														<TableCell>{formatRm(prop?.price)}</TableCell>
														<TableCell>
															{formatRm(row.commissionAmount)}
														</TableCell>
													</>
												) : (
													<>
														<TableCell>{formatRm(nett)}</TableCell>
														<TableCell>
															{formatRm(row.commissionAmount)}
														</TableCell>
													</>
												)}
												<TableCell>
													{formatCashLoan(prop?.purchasingMethod)}
												</TableCell>
												<TableCell>
													<AgentsCell row={row} />
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}

						{total > PAGE_SIZE ? (
							<div className="mt-4 flex items-center justify-between">
								<p className="text-muted-foreground text-sm">
									Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
								</p>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={page === 0}
										onClick={() => setPage((p) => p - 1)}
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
						) : null}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
