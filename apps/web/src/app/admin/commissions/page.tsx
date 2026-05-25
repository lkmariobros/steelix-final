"use client";

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/dialog";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import { SidebarTrigger } from "@/components/sidebar";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiDashboardLine,
	RiDownloadLine,
	RiMoneyDollarCircleLine,
	RiSearchLine,
} from "@remixicon/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

function statusBadge(status: string) {
	const map: Record<string, { label: string; className: string }> = {
		pending_approval: {
			label: "Pending Approval",
			className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
		},
		approved: {
			label: "Approved",
			className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
		},
		released: {
			label: "Released",
			className: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
		},
		paid: {
			label: "Paid",
			className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
		},
		on_hold: {
			label: "On Hold",
			className: "bg-muted text-muted-foreground",
		},
		voided: {
			label: "Voided",
			className: "bg-destructive/10 text-destructive",
		},
	};
	const m = map[status] ?? { label: status, className: "" };
	return (
		<Badge variant="outline" className={m.className}>
			{m.label}
		</Badge>
	);
}

export default function AdminCommissionsPage() {
	const { data: session } = authClient.useSession();

	const [search, setSearch] = useState("");
	const [agentId, setAgentId] = useState("__all__");
	const [projectName, setProjectName] = useState("__all__");
	const [status, setStatus] = useState<string>("__all__");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [page, setPage] = useState(0);
	const pageSize = 25;
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const [approveOpen, setApproveOpen] = useState(false);
	const [releaseOpen, setReleaseOpen] = useState(false);
	const [releaseMethod, setReleaseMethod] = useState<"bank_transfer" | "cheque" | "cash">(
		"bank_transfer",
	);
	const [releaseRef, setReleaseRef] = useState("");
	const [releaseDate, setReleaseDate] = useState("");

	const filterArgs = useMemo(
		() => ({
			search: search.trim() || undefined,
			agentId: agentId === "__all__" ? undefined : agentId,
			projectName: projectName === "__all__" ? undefined : projectName,
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
			dateFrom: dateFrom ? new Date(dateFrom) : undefined,
			dateTo: dateTo ? new Date(dateTo) : undefined,
			limit: pageSize,
			offset: page * pageSize,
		}),
		[search, agentId, projectName, status, dateFrom, dateTo, page],
	);

	const summaryFilters = useMemo(
		() => ({
			agentId: agentId === "__all__" ? undefined : agentId,
			projectName: projectName === "__all__" ? undefined : projectName,
			dateFrom: dateFrom ? new Date(dateFrom) : undefined,
			dateTo: dateTo ? new Date(dateTo) : undefined,
		}),
		[agentId, projectName, dateFrom, dateTo],
	);

	const listQuery = trpc.commissionPayouts.adminList.useQuery(filterArgs, {
		enabled: !!session,
		staleTime: 10_000,
	});

	const summaryQuery = trpc.commissionPayouts.adminSummary.useQuery(summaryFilters, {
		enabled: !!session,
		staleTime: 10_000,
	});

	const projectsQuery = trpc.commissionSchemes.listProjects.useQuery(undefined, {
		enabled: !!session,
	});

	const agentsQuery = trpc.agents.list.useQuery(
		{ limit: 100, offset: 0, role: "agent", sortBy: "name", sortOrder: "asc" },
		{ enabled: !!session },
	);

	const approveMut = trpc.commissionPayouts.adminBulkApprove.useMutation({
		onSuccess: () => {
			toast.success("Selected commissions approved");
			setSelected(new Set());
			setApproveOpen(false);
			void listQuery.refetch();
			void summaryQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const releaseMut = trpc.commissionPayouts.adminBulkRelease.useMutation({
		onSuccess: () => {
			toast.success("Release recorded for selected items");
			setSelected(new Set());
			setReleaseOpen(false);
			void listQuery.refetch();
			void summaryQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const exportCsv = () => {
		const items = listQuery.data?.items ?? [];
		const headers = [
			"Agent",
			"Project",
			"Case No",
			"Nett Price (RM)",
			"Commission %",
			"Gross (RM)",
			"SST (RM)",
			"Net (RM)",
			"Status",
			"Type",
		];
		const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
		const lines = [
			headers.join(","),
			...items.map((r) =>
				[
					esc(r.agentName ?? ""),
					esc(r.projectName ?? ""),
					esc(r.caseNo ?? ""),
					r.nettPrice,
					r.commissionPercent,
					r.grossCommission,
					r.sstAmount,
					r.netCommission,
					r.status,
					r.payoutType,
				].join(","),
			),
		];
		const blob = new Blob(["\ufeff", lines.join("\n")], {
			type: "text/csv;charset=utf-8",
		});
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `commissions_export_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const items = listQuery.data?.items ?? [];
	const selectable = items.filter(
		(i) => i.status === "pending_approval" || i.status === "approved",
	);
	const selectedPending = [...selected].filter((id) =>
		items.some((s) => s.id === id && s.status === "pending_approval"),
	);
	const selectedApproved = [...selected].filter((id) =>
		items.some((s) => s.id === id && s.status === "approved"),
	);

	return (
		<>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden />
										<span className="sr-only">Admin</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiMoneyDollarCircleLine size={18} />
										Commissions &amp; payout
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<HeaderActions />
				</header>

				<div className="flex flex-1 flex-col gap-4 py-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h1 className="font-semibold text-2xl">Commissions &amp; payout</h1>
							<p className="text-muted-foreground text-sm">
								Approve, release, and track agent commission payments (RM).
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" asChild>
								<Link href="/admin/commissions/claim-schedules">Claim schedules</Link>
							</Button>
							<Button variant="outline" size="sm" onClick={exportCsv}>
								<RiDownloadLine className="mr-2 size-4" />
								Export CSV
							</Button>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{(
							[
								["Total pending", summaryQuery.data?.pendingRm ?? 0, "Awaiting approval / on hold"],
								["Total approved", summaryQuery.data?.approvedRm ?? 0, "Ready to pay"],
								["Total released", summaryQuery.data?.releasedRm ?? 0, "Payment sent"],
								["Total paid", summaryQuery.data?.paidRm ?? 0, "Confirmed received"],
							] as const
						).map(([title, val, sub]) => (
							<Card key={title}>
								<CardContent className="pt-4">
									<p className="text-muted-foreground text-xs">{title}</p>
									<p className="font-semibold text-lg">{formatRm(val)}</p>
									<p className="text-muted-foreground text-xs">{sub}</p>
								</CardContent>
							</Card>
						))}
					</div>

					<Card>
						<CardContent className="flex flex-col gap-4 pt-4">
							<div className="flex flex-wrap gap-2">
								<div className="relative min-w-[200px] flex-1">
									<RiSearchLine className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
									<Input
										className="ps-8"
										placeholder="Search agent or case no…"
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(0);
										}}
									/>
								</div>
								<Select
									value={agentId}
									onValueChange={(v) => {
										setAgentId(v);
										setPage(0);
									}}
								>
									<SelectTrigger className="w-[200px]">
										<SelectValue placeholder="Agent" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__all__">All agents</SelectItem>
										{(agentsQuery.data?.agents ?? []).map(({ agent }) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={projectName}
									onValueChange={(v) => {
										setProjectName(v);
										setPage(0);
									}}
								>
									<SelectTrigger className="w-[200px]">
										<SelectValue placeholder="Project" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__all__">All projects</SelectItem>
										{(projectsQuery.data ?? []).map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
										<SelectItem value="__all__">All statuses</SelectItem>
										<SelectItem value="pending_approval">Pending approval</SelectItem>
										<SelectItem value="approved">Approved</SelectItem>
										<SelectItem value="released">Released</SelectItem>
										<SelectItem value="paid">Paid</SelectItem>
										<SelectItem value="on_hold">On hold</SelectItem>
										<SelectItem value="voided">Voided</SelectItem>
									</SelectContent>
								</Select>
								<Input
									type="date"
									className="w-[150px]"
									value={dateFrom}
									onChange={(e) => {
										setDateFrom(e.target.value);
										setPage(0);
									}}
								/>
								<Input
									type="date"
									className="w-[150px]"
									value={dateTo}
									onChange={(e) => {
										setDateTo(e.target.value);
										setPage(0);
									}}
								/>
							</div>

							{(selectedPending.length > 0 || selectedApproved.length > 0) && (
								<div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
									<span className="text-sm">
										{selectedPending.length} pending · {selectedApproved.length} approved
										selected
									</span>
									<Button
										size="sm"
										disabled={selectedPending.length === 0}
										onClick={() => setApproveOpen(true)}
									>
										Approve selected
									</Button>
									<Button
										size="sm"
										variant="secondary"
										disabled={selectedApproved.length === 0}
										onClick={() => setReleaseOpen(true)}
									>
										Release selected
									</Button>
									<Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
										Clear
									</Button>
								</div>
							)}

							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-10">
												<Checkbox
													checked={
														selectable.length > 0 &&
														selectable.every((s) => selected.has(s.id))
													}
													onCheckedChange={(c) => {
														if (c) {
															setSelected(new Set(selectable.map((s) => s.id)));
														} else {
															setSelected(new Set());
														}
													}}
												/>
											</TableHead>
											<TableHead>Agent</TableHead>
											<TableHead>Project</TableHead>
											<TableHead>Case</TableHead>
											<TableHead className="text-right">Nett</TableHead>
											<TableHead className="text-right">%</TableHead>
											<TableHead className="text-right">Gross</TableHead>
											<TableHead className="text-right">SST</TableHead>
											<TableHead className="text-right">Net</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{listQuery.isLoading ? (
											<TableRow>
												<TableCell colSpan={11} className="text-center text-muted-foreground">
													Loading…
												</TableCell>
											</TableRow>
										) : items.length === 0 ? (
											<TableRow>
												<TableCell colSpan={11} className="text-center text-muted-foreground">
													No commission rows yet. Approve a transaction first.
												</TableCell>
											</TableRow>
										) : (
											items.map((r) => (
												<TableRow key={r.id}>
													<TableCell>
														{(r.status === "pending_approval" || r.status === "approved") && (
															<Checkbox
																checked={selected.has(r.id)}
																onCheckedChange={(c) => {
																	setSelected((prev) => {
																		const n = new Set(prev);
																		if (c) n.add(r.id);
																		else n.delete(r.id);
																		return n;
																	});
																}}
															/>
														)}
													</TableCell>
													<TableCell>
														<div className="font-medium">{r.agentName}</div>
														<Button variant="link" className="h-auto p-0 text-xs" asChild>
															<Link href={`/admin/commissions/agents/${r.payeeAgentId}`}>
																History
															</Link>
														</Button>
													</TableCell>
													<TableCell>{r.projectName ?? "—"}</TableCell>
													<TableCell className="font-mono text-sm">{r.caseNo ?? "—"}</TableCell>
													<TableCell className="text-right">{formatRm(r.nettPrice)}</TableCell>
													<TableCell className="text-right">{r.commissionPercent}%</TableCell>
													<TableCell className="text-right">{formatRm(r.grossCommission)}</TableCell>
													<TableCell className="text-right">{formatRm(r.sstAmount)}</TableCell>
													<TableCell className="text-right font-medium">
														{formatRm(r.netCommission)}
													</TableCell>
													<TableCell>{statusBadge(r.status)}</TableCell>
													<TableCell className="text-right">
														<Button variant="outline" size="sm" asChild>
															<Link href={`/admin/commissions/${r.id}`}>Open</Link>
														</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</div>

							<div className="flex justify-between text-muted-foreground text-sm">
								<span>
									Page {page + 1} · {listQuery.data?.total ?? 0} total
								</span>
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
										disabled={!listQuery.data?.hasMore}
										onClick={() => setPage((p) => p + 1)}
									>
										Next
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<Dialog open={approveOpen} onOpenChange={setApproveOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Approve {selectedPending.length} commission(s)?</DialogTitle>
						</DialogHeader>
						<p className="text-muted-foreground text-sm">
							Commission breakdown is stored on each payout record. You can add notes on the
							detail page per item if needed.
						</p>
						<DialogFooter>
							<Button variant="outline" onClick={() => setApproveOpen(false)}>
								Cancel
							</Button>
							<Button
								disabled={approveMut.isPending}
								onClick={() => approveMut.mutate({ ids: selectedPending })}
							>
								Confirm approve
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Release payment</DialogTitle>
						</DialogHeader>
						<p className="text-muted-foreground text-sm">
							Only rows already in <strong>Approved</strong> can be released. Reference will be
							suffixed per row.
						</p>
						<div className="grid gap-3">
							<div>
								<Label>Method</Label>
								<Select
									value={releaseMethod}
									onValueChange={(v) => setReleaseMethod(v as typeof releaseMethod)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="bank_transfer">Bank transfer</SelectItem>
										<SelectItem value="cheque">Cheque</SelectItem>
										<SelectItem value="cash">Cash</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Payment date</Label>
								<Input
									type="date"
									value={releaseDate}
									onChange={(e) => setReleaseDate(e.target.value)}
								/>
							</div>
							<div>
								<Label>Reference prefix</Label>
								<Input
									value={releaseRef}
									onChange={(e) => setReleaseRef(e.target.value)}
									placeholder="e.g. FT-2026-"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setReleaseOpen(false)}>
								Cancel
							</Button>
							<Button
								disabled={releaseMut.isPending || !releaseDate || !releaseRef}
								onClick={() => {
									if (selectedApproved.length === 0) {
										toast.message("Select approved rows to release");
										return;
									}
									releaseMut.mutate({
										ids: selectedApproved,
										paymentMethod: releaseMethod,
										paymentDate: new Date(releaseDate),
										paymentReferenceNo: releaseRef,
									});
								}}
							>
								Confirm release
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
		</>
	);
}
