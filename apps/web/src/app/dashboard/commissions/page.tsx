"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/sidebar";
import { useRedirectUnauthenticated } from "@/hooks/use-redirect-unauthenticated";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiDashboardLine,
	RiMoneyDollarCircleLine,
	RiSearchLine,
} from "@remixicon/react";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

function statusBadge(status: string) {
	const muted = "bg-muted text-muted-foreground";
	const map: Record<string, string> = {
		pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		approved: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
		released: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
		paid: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
		on_hold: muted,
		voided: "bg-destructive/10 text-destructive",
	};
	return (
		<Badge variant="outline" className={map[status] ?? muted}>
			{status.replaceAll("_", " ")}
		</Badge>
	);
}

export default function AgentCommissionsPage() {
	const { data: session, isPending } = authClient.useSession();
	useRedirectUnauthenticated(session?.user?.id, isPending);

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<string>("__all__");
	const [page, setPage] = useState(0);
	const pageSize = 20;

	const args = useMemo(
		() => ({
			search: search.trim() || undefined,
			status:
				status === "__all__"
					? undefined
					: (status as
							| "pending_approval"
							| "approved"
							| "released"
							| "paid"
							| "on_hold"
							| "voided"),
			limit: pageSize,
			offset: page * pageSize,
		}),
		[search, status, page],
	);

	const list = trpc.commissionPayouts.agentList.useQuery(args, {
		enabled: !!session,
	});
	const summary = trpc.commissionPayouts.agentSummary.useQuery(undefined, {
		enabled: !!session,
	});

	if (isPending) return <LoadingScreen text="Loading..." />;
	if (!session) return <LoadingScreen text="Redirecting..." />;

	const items = list.data?.items ?? [];

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/dashboard">
										<RiDashboardLine size={22} aria-hidden />
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiMoneyDollarCircleLine size={18} />
										My commissions
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-1 flex-col gap-4 py-6">
					<div>
						<h1 className="font-semibold text-2xl">My commissions</h1>
						<p className="text-muted-foreground text-sm">
							Read-only view of your payout status (RM).
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<Card>
							<CardContent className="pt-4">
								<p className="text-muted-foreground text-xs">Total earned</p>
								<p className="font-semibold text-lg">
									{formatRm(summary.data?.totalEarnedRm ?? 0)}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-4">
								<p className="text-muted-foreground text-xs">Total received</p>
								<p className="font-semibold text-lg">
									{formatRm(summary.data?.totalReceivedRm ?? 0)}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-4">
								<p className="text-muted-foreground text-xs">Outstanding</p>
								<p className="font-semibold text-lg">
									{formatRm(summary.data?.outstandingRm ?? 0)}
								</p>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardContent className="flex flex-col gap-3 pt-4">
							<div className="flex flex-wrap gap-2">
								<div className="relative min-w-[200px] flex-1">
									<RiSearchLine className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
									<Input
										className="ps-8"
										placeholder="Search case or project…"
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(0);
										}}
									/>
								</div>
								<Select
									value={status}
									onValueChange={(v) => {
										setStatus(v);
										setPage(0);
									}}
								>
									<SelectTrigger className="w-[200px]">
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__all__">All</SelectItem>
										<SelectItem value="pending_approval">Pending approval</SelectItem>
										<SelectItem value="approved">Approved</SelectItem>
										<SelectItem value="released">Released</SelectItem>
										<SelectItem value="paid">Paid</SelectItem>
										<SelectItem value="on_hold">On hold</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Project</TableHead>
											<TableHead>Case</TableHead>
											<TableHead className="text-right">Nett</TableHead>
											<TableHead className="text-right">Net comm.</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Detail</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{list.isLoading ? (
											<TableRow>
												<TableCell colSpan={6} className="text-center text-muted-foreground">
													Loading…
												</TableCell>
											</TableRow>
										) : items.length === 0 ? (
											<TableRow>
												<TableCell colSpan={6} className="text-center text-muted-foreground">
													No commission payouts yet.
												</TableCell>
											</TableRow>
										) : (
											items.map((r) => (
												<TableRow key={r.id}>
													<TableCell>{r.projectName ?? "—"}</TableCell>
													<TableCell className="font-mono text-sm">{r.caseNo ?? "—"}</TableCell>
													<TableCell className="text-right">{formatRm(r.nettPrice)}</TableCell>
													<TableCell className="text-right font-medium">
														{formatRm(r.netCommission)}
													</TableCell>
													<TableCell>{statusBadge(r.status)}</TableCell>
													<TableCell className="text-right">
														<Link
															className="text-primary text-sm underline"
															href={`/dashboard/commissions/${r.id}`}
														>
															View
														</Link>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</div>

							<div className="flex justify-between text-muted-foreground text-sm">
								<span>
									{list.data?.total ?? 0} total · page {page + 1}
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
										disabled={page === 0}
										onClick={() => setPage((p) => Math.max(0, p - 1))}
									>
										Prev
									</button>
									<button
										type="button"
										className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
										disabled={!list.data?.hasMore}
										onClick={() => setPage((p) => p + 1)}
									>
										Next
									</button>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
