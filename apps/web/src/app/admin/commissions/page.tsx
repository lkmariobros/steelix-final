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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { MetricCard } from "@/dashboards/admin/widgets/metric-card";
import { authClient } from "@/lib/auth-client";
import { formatDateDMY } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiCalendarLine,
	RiCheckboxCircleLine,
	RiDashboardLine,
	RiDownloadLine,
	RiEyeLine,
	RiMoneyDollarCircleLine,
	RiSearchLine,
	RiTimeLine,
	RiWallet3Line,
} from "@remixicon/react";
import { format } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const actionBtnClass =
	"size-8 shrink-0 rounded-full border-0 bg-primary/12 p-0 text-primary shadow-none hover:bg-primary/20 hover:text-primary";

function formatRm(n: number | string) {
	return new Intl.NumberFormat("en-MY", {
		style: "currency",
		currency: "MYR",
		minimumFractionDigits: 2,
	}).format(typeof n === "string" ? Number.parseFloat(n) : n);
}

function parseYmd(value: string): Date | undefined {
	if (!value) return undefined;
	const d = new Date(`${value}T00:00:00`);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

function toYmd(date: Date | undefined): string {
	if (!date) return "";
	return format(date, "yyyy-MM-dd");
}

function statusBadge(status: string) {
	const map: Record<string, { label: string; className: string }> = {
		pending_approval: {
			label: "Pending Approval",
			className:
				"bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300",
		},
		approved: {
			label: "Approved",
			className: "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-300",
		},
		released: {
			label: "Released",
			className:
				"bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-300",
		},
		paid: {
			label: "Paid",
			className:
				"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300",
		},
		on_hold: {
			label: "On Hold",
			className: "bg-muted text-muted-foreground",
		},
		voided: {
			label: "Voided",
			className: "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-300",
		},
	};
	const m = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
	return (
		<span
			className={cn(
				"inline-flex rounded-full px-2.5 py-0.5 font-medium text-[11px]",
				m.className,
			)}
		>
			{m.label}
		</span>
	);
}

function FilterDatePicker({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (next: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const selected = parseYmd(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"h-9 w-[158px] justify-start gap-2 rounded-full border-border/70 bg-card font-normal shadow-card",
						!selected && "text-muted-foreground",
					)}
				>
					<RiCalendarLine className="size-3.5 shrink-0" />
					<span className="truncate text-xs">
						{selected ? formatDateDMY(selected) : label}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto border-border/70 p-0 shadow-card" align="start">
				<Calendar
					mode="single"
					selected={selected}
					onSelect={(date) => {
						onChange(toYmd(date));
						if (date) setOpen(false);
					}}
					initialFocus
				/>
				<div className="flex items-center justify-between border-border/60 border-t px-3 py-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							onChange("");
							setOpen(false);
						}}
					>
						Clear
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 rounded-full px-2.5 text-xs"
						onClick={() => {
							onChange(toYmd(new Date()));
							setOpen(false);
						}}
					>
						Today
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

const thClass =
	"h-11 bg-muted/50 px-3 font-semibold text-foreground/80 text-xs tracking-wide";
const tdClass = "px-3 py-3 align-middle text-sm";

export default function AdminCommissionsPage() {
	const { data: session } = authClient.useSession();
	const searchParams = useSearchParams();

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
	const [releaseDateOpen, setReleaseDateOpen] = useState(false);

	useEffect(() => {
		const statusParam = searchParams.get("status");
		if (statusParam === "pending_approval") {
			setStatus("pending_approval");
			setPage(0);
		}
	}, [searchParams]);

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
			<header className="sticky top-0 z-40 -mx-4 flex h-16 shrink-0 items-center gap-2 border-border/60 border-b bg-background px-4 backdrop-blur-md supports-backdrop-filter:bg-background/95 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
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
									<RiDashboardLine size={22} aria-hidden />
									<span className="sr-only">Admin</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage className="flex items-center gap-2 font-medium">
									<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiMoneyDollarCircleLine size={16} />
									</span>
									Commissions &amp; payout
								</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-5 py-5 lg:gap-6 lg:py-7">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="font-bold text-2xl tracking-tight">
							Commissions &amp; payout
						</h1>
						<p className="mt-0.5 text-muted-foreground text-sm">
							Approve, release, and track agent commission payments (RM).
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-9 rounded-xl"
							asChild
						>
							<Link href="/admin/commissions/claim-schedules">
								Claim schedules
							</Link>
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-9 gap-1.5 rounded-xl"
							onClick={exportCsv}
						>
							<RiDownloadLine className="size-4" />
							Export CSV
						</Button>
					</div>
				</div>

				<div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						title="Total pending"
						value={formatRm(summaryQuery.data?.pendingRm ?? 0)}
						changeLabel="Awaiting approval / on hold"
						trend="neutral"
						icon={<RiTimeLine size={20} />}
						sparkline={[40, 48, 42, 55, 50, 62, 58, 70, 64, 72, 68, 75]}
					/>
					<MetricCard
						title="Total approved"
						value={formatRm(summaryQuery.data?.approvedRm ?? 0)}
						changeLabel="Ready to pay"
						trend="up"
						icon={<RiCheckboxCircleLine size={20} />}
						sparkline={[30, 35, 40, 38, 48, 52, 50, 60, 58, 65, 70, 74]}
					/>
					<MetricCard
						title="Total released"
						value={formatRm(summaryQuery.data?.releasedRm ?? 0)}
						changeLabel="Payment sent"
						trend="up"
						icon={<RiWallet3Line size={20} />}
						sparkline={[25, 32, 28, 40, 45, 42, 55, 50, 60, 58, 66, 72]}
					/>
					<MetricCard
						title="Total paid"
						value={formatRm(summaryQuery.data?.paidRm ?? 0)}
						changeLabel="Confirmed received"
						trend={
							(summaryQuery.data?.paidRm ?? 0) > 0 ? "up" : "neutral"
						}
						icon={<RiMoneyDollarCircleLine size={20} />}
						variant="gradient"
					/>
				</div>

				<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
					<CardContent className="flex flex-col gap-4 p-5">
						<div className="flex flex-wrap items-center gap-2.5">
							<div className="relative min-w-[200px] flex-1">
								<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
								<Input
									className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 shadow-none focus-visible:bg-background"
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
								<SelectTrigger className="h-10 w-[180px] rounded-xl border-border/70 bg-muted/30 shadow-none">
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
								<SelectTrigger className="h-10 w-[180px] rounded-xl border-border/70 bg-muted/30 shadow-none">
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
								<SelectTrigger className="h-10 w-[180px] rounded-xl border-border/70 bg-muted/30 shadow-none">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__all__">All statuses</SelectItem>
									<SelectItem value="pending_approval">
										Pending approval
									</SelectItem>
									<SelectItem value="approved">Approved</SelectItem>
									<SelectItem value="released">Released</SelectItem>
									<SelectItem value="paid">Paid</SelectItem>
									<SelectItem value="on_hold">On hold</SelectItem>
									<SelectItem value="voided">Voided</SelectItem>
								</SelectContent>
							</Select>
							<FilterDatePicker
								label="From date"
								value={dateFrom}
								onChange={(v) => {
									setDateFrom(v);
									setPage(0);
								}}
							/>
							<FilterDatePicker
								label="To date"
								value={dateTo}
								onChange={(v) => {
									setDateTo(v);
									setPage(0);
								}}
							/>
						</div>

						{(selectedPending.length > 0 || selectedApproved.length > 0) && (
							<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
								<span className="text-sm">
									{selectedPending.length} pending ·{" "}
									{selectedApproved.length} approved selected
								</span>
								<Button
									size="sm"
									className="rounded-lg"
									disabled={selectedPending.length === 0}
									onClick={() => setApproveOpen(true)}
								>
									Approve selected
								</Button>
								<Button
									size="sm"
									variant="secondary"
									className="rounded-lg"
									disabled={selectedApproved.length === 0}
									onClick={() => setReleaseOpen(true)}
								>
									Release selected
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="rounded-lg"
									onClick={() => setSelected(new Set())}
								>
									Clear
								</Button>
							</div>
						)}

						<div className="overflow-x-auto rounded-xl border border-border/70">
							<Table>
								<TableHeader>
									<TableRow className="border-border/60 hover:bg-transparent">
										<TableHead className={cn(thClass, "w-10")}>
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
										<TableHead className={cn(thClass, "w-[120px]")}>Agent</TableHead>
										<TableHead className={cn(thClass, "w-[120px]")}>Project</TableHead>
										<TableHead className={cn(thClass, "w-[88px]")}>Case</TableHead>
										<TableHead className={cn(thClass, "w-[96px] text-right")}>
											Nett
										</TableHead>
										<TableHead className={cn(thClass, "w-14 text-right")}>%</TableHead>
										<TableHead className={cn(thClass, "w-[96px] text-right")}>
											Gross
										</TableHead>
										<TableHead className={cn(thClass, "w-[80px] text-right")}>
											SST
										</TableHead>
										<TableHead className={cn(thClass, "w-[96px] text-right")}>
											Net
										</TableHead>
										<TableHead className={cn(thClass, "w-[120px]")}>Status</TableHead>
										<TableHead className={cn(thClass, "w-14 text-center")}>
											Action
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{listQuery.isLoading ? (
										Array.from({ length: 8 }, (_, i) => `sk-commission-${i}`).map(
											(id) => (
												<TableRow
													key={id}
													className="border-border/50 hover:bg-transparent"
												>
													<TableCell className={tdClass}>
														<Skeleton className="size-4 rounded" />
													</TableCell>
													<TableCell className={tdClass}>
														<div className="space-y-1.5">
															<Skeleton className="h-4 w-28" />
															<Skeleton className="h-3 w-14" />
														</div>
													</TableCell>
													<TableCell className={tdClass}>
														<Skeleton className="h-3.5 w-24" />
													</TableCell>
													<TableCell className={tdClass}>
														<Skeleton className="h-3.5 w-16" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-right")}>
														<Skeleton className="ml-auto h-3.5 w-16" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-right")}>
														<Skeleton className="ml-auto h-3.5 w-8" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-right")}>
														<Skeleton className="ml-auto h-3.5 w-16" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-right")}>
														<Skeleton className="ml-auto h-3.5 w-12" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-right")}>
														<Skeleton className="ml-auto h-3.5 w-16" />
													</TableCell>
													<TableCell className={tdClass}>
														<Skeleton className="h-5 w-24 rounded-full" />
													</TableCell>
													<TableCell className={cn(tdClass, "text-center")}>
														<Skeleton className="mx-auto size-8 rounded-full" />
													</TableCell>
												</TableRow>
											),
										)
									) : items.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={11}
												className="py-10 text-center text-muted-foreground"
											>
												No commission rows yet. Approve a transaction first.
											</TableCell>
										</TableRow>
									) : (
										items.map((r) => (
											<TableRow
												key={r.id}
												className="border-border/50 hover:bg-muted/35"
											>
												<TableCell className={tdClass}>
													{(r.status === "pending_approval" ||
														r.status === "approved") && (
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
												<TableCell className={tdClass}>
													<div className="min-w-0">
														<p className="truncate font-semibold text-sm">
															{r.agentName}
														</p>
														<Button
															variant="link"
															className="h-auto p-0 text-xs"
															asChild
														>
															<Link
																href={`/admin/commissions/agents/${r.payeeAgentId}`}
															>
																History
															</Link>
														</Button>
													</div>
												</TableCell>
												<TableCell
													className={cn(tdClass, "max-w-[140px] truncate")}
													title={r.projectName ?? undefined}
												>
													{r.projectName ?? "—"}
												</TableCell>
												<TableCell
													className={cn(tdClass, "font-mono text-xs")}
												>
													{r.caseNo ?? "—"}
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-right tabular-nums")}
												>
													{formatRm(r.nettPrice)}
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-right tabular-nums")}
												>
													{r.commissionPercent}%
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-right tabular-nums")}
												>
													{formatRm(r.grossCommission)}
												</TableCell>
												<TableCell
													className={cn(tdClass, "text-right tabular-nums")}
												>
													{formatRm(r.sstAmount)}
												</TableCell>
												<TableCell
													className={cn(
														tdClass,
														"text-right font-semibold tabular-nums",
													)}
												>
													{formatRm(r.netCommission)}
												</TableCell>
												<TableCell className={tdClass}>
													{statusBadge(r.status)}
												</TableCell>
												<TableCell className={cn(tdClass, "w-14 text-center")}>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className={actionBtnClass}
																title="Open details"
																asChild
															>
																<Link href={`/admin/commissions/${r.id}`}>
																	<RiEyeLine size={15} />
																	<span className="sr-only">Open</span>
																</Link>
															</Button>
														</TooltipTrigger>
														<TooltipContent>Open details</TooltipContent>
													</Tooltip>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-t pt-3 text-muted-foreground text-sm">
							<span>
								Showing page {page + 1} · {listQuery.data?.total ?? 0} entries
							</span>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									className="h-8 rounded-lg"
									disabled={page === 0}
									onClick={() => setPage((p) => Math.max(0, p - 1))}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="h-8 rounded-lg"
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
								<Popover open={releaseDateOpen} onOpenChange={setReleaseDateOpen}>
									<PopoverTrigger asChild>
										<Button
											type="button"
											variant="outline"
											className={cn(
												"mt-1 h-9 w-full justify-start gap-2 rounded-full font-normal shadow-card",
												!releaseDate && "text-muted-foreground",
											)}
										>
											<RiCalendarLine className="size-3.5 text-muted-foreground" />
											{releaseDate
												? formatDateDMY(parseYmd(releaseDate) ?? new Date())
												: "Select payment date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto border-border/70 p-0 shadow-card" align="start">
										<Calendar
											mode="single"
											selected={parseYmd(releaseDate)}
											onSelect={(date) => {
												setReleaseDate(toYmd(date));
												if (date) setReleaseDateOpen(false);
											}}
											initialFocus
										/>
									</PopoverContent>
								</Popover>
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
