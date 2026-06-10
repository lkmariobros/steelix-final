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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	CANONICAL_TRANSACTION_STATUSES,
	formatStatusLabel,
	formatTransactionDate,
	getStatusBadgeClass,
} from "@/features/transactions/transaction-detail-utils";
import { trpc } from "@/utils/trpc";
import { RiDashboardLine, RiFileList3Line } from "@remixicon/react";
import Link from "next/link";
import { useState } from "react";

const PAGE_SIZE = 20;

export default function AdminTransactionsListPage() {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [page, setPage] = useState(0);

	const { data, isLoading } = trpc.transactions.adminList.useQuery({
		limit: PAGE_SIZE,
		offset: page * PAGE_SIZE,
		search: search.trim() || undefined,
		status:
			statusFilter === "all"
				? undefined
				: (statusFilter as (typeof CANONICAL_TRANSACTION_STATUSES)[number]),
	});

	const rows = data?.transactions ?? [];
	const total = data?.total ?? 0;

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
									<RiFileList3Line size={18} />
									All transactions
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
					<div>
						<h1 className="font-semibold text-2xl">All transactions</h1>
						<p className="text-muted-foreground text-sm">
							Search and filter cases across all agents.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Input
							className="w-full sm:w-56"
							placeholder="Search case, unit, buyer…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(0);
							}}
						/>
						<Select
							value={statusFilter}
							onValueChange={(v) => {
								setStatusFilter(v);
								setPage(0);
							}}
						>
							<SelectTrigger className="w-40">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All statuses</SelectItem>
								{CANONICAL_TRANSACTION_STATUSES.map((s) => (
									<SelectItem key={s} value={s}>
										{formatStatusLabel(s)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							{total} transaction{total === 1 ? "" : "s"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{["sk-1", "sk-2", "sk-3"].map((id) => (
									<Skeleton key={id} className="h-16 w-full" />
								))}
							</div>
						) : rows.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								No transactions match your filters.
							</p>
						) : (
							<div className="space-y-2">
								{rows.map((row) => {
									const client = row.clientData as { name?: string } | null;
									return (
										<Link
											key={row.id}
											href={`/admin/transactions/${row.id}`}
											className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
										>
											<div className="min-w-0 space-y-1">
												<div className="flex flex-wrap items-center gap-2">
													<span className="font-medium font-mono text-sm">
														{row.caseNo ?? row.id.slice(0, 8)}
													</span>
													<Badge className={getStatusBadgeClass(row.status)}>
														{formatStatusLabel(row.status)}
													</Badge>
												</div>
												<p className="text-muted-foreground text-sm">
													{row.projectName ?? "—"} · Unit {row.unitNo ?? "—"} ·{" "}
													{client?.name ?? "—"}
												</p>
												<p className="text-muted-foreground text-xs">
													Booking{" "}
													{formatTransactionDate(
														row.bookingDate ?? row.transactionDate,
													)}
												</p>
											</div>
											<span className="text-muted-foreground text-sm">
												View →
											</span>
										</Link>
									);
								})}
							</div>
						)}

						{total > PAGE_SIZE && (
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
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
