"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderActions } from "@/components/header-actions";
import { Separator } from "@/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/sidebar";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
	RiAddLine,
	RiCheckboxMultipleLine,
	RiCloseLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiEyeLine,
	RiFileList3Line,
	RiLoader4Line,
	RiRefreshLine,
	RiSearchLine,
	RiShieldUserLine,
	RiUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";

import { BulkStageDialog } from "./_components/bulk-stage-dialog";
import { CreateLeadDialog } from "./_components/create-lead-dialog";
import { DeleteLeadDialog } from "./_components/delete-lead-dialog";
import { EditLeadDialog } from "./_components/edit-lead-dialog";
import {
	LEAD_TYPE_OPTIONS,
	PAGE_SIZE_OPTIONS,
	PIPELINE_STAGES,
	STATUS_OPTIONS,
	TYPE_OPTIONS,
	stageMap,
} from "./_components/lead-constants";
import { LeadDetailSheet } from "./_components/lead-detail-sheet";
import type { Lead, SortKey } from "./_components/lead-models";
import { StageBadge, StatusBadge } from "./_components/lead-ui";
import { LeadsCharts } from "./_components/leads-charts";
import { SortHeader } from "./_components/sort-header";
import { StatsCards } from "./_components/stats-cards";
import { TodayTasksWidget } from "./_components/today-tasks-widget";

export default function AdminLeadsPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();

	// ── Filters (all client-side, no backend re-fetch) ──────────────────────
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("__all__");
	const [statusFilter, setStatusFilter] = useState("__all__");
	const [stageFilter, setStageFilter] = useState("__all__");
	const [leadTypeFilter, setLeadTypeFilter] = useState("__all__");
	const [agentFilter, setAgentFilter] = useState("__all__");
	const [sortKey, setSortKey] = useState<SortKey>("createdAt");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	// ── Dialogs ────────────────────────────────────────────────────────────
	const [viewLead, setViewLead] = useState<Lead | null>(null);
	const [editLead, setEditLead] = useState<Lead | null>(null);
	const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isBulkStageOpen, setIsBulkStageOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// ── Fetch ALL leads ONCE — no filter params sent to backend ─────────────
	// Backend returns the full dataset; all filtering/sorting/pagination
	// happens here on the client via useMemo (zero extra network requests).
	const {
		data: rawData,
		isLoading,
		refetch,
	} = trpc.adminLeads.list.useQuery(
		{ limit: 5000, page: 1 }, // fetch entire dataset in one shot
		{ enabled: !!session, staleTime: 60 * 1000 },
	);

	const { data: agentsData } = trpc.adminLeads.agentsWithLeads.useQuery(
		undefined,
		{ enabled: !!session, staleTime: 60 * 1000 },
	);

	const allLeads = (rawData?.leads ?? []) as Lead[];
	const agents = agentsData ?? [];

	// ── Sort handler (just updates state, no API call) ──────────────────────
	// Read sortKey directly from closure — avoids unreliable nested state setters
	const handleSort = useCallback(
		(key: SortKey) => {
			if (sortKey === key) {
				// Same column → toggle direction
				setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
			} else {
				// New column → default ascending
				setSortKey(key);
				setSortOrder("asc");
			}
			setPage(1);
		},
		[sortKey],
	);

	// ── All filtering + sorting + pagination via useMemo ────────────────────
	// Runs entirely in memory — instant, no network round-trips
	const { visibleLeads, totalFiltered } = useMemo(() => {
		const q = search.toLowerCase().trim();

		// 1. Filter
		let filtered = allLeads.filter((lead) => {
			if (
				q &&
				!(
					lead.name.toLowerCase().includes(q) ||
					lead.email.toLowerCase().includes(q) ||
					lead.phone.toLowerCase().includes(q) ||
					lead.property.toLowerCase().includes(q)
				)
			)
				return false;

			if (typeFilter !== "__all__" && lead.type !== typeFilter) return false;
			if (statusFilter !== "__all__" && lead.status !== statusFilter)
				return false;
			if (stageFilter !== "__all__" && lead.stage !== stageFilter) return false;
			if (leadTypeFilter !== "__all__" && lead.leadType !== leadTypeFilter)
				return false;

			if (agentFilter !== "__all__") {
				if (agentFilter === "__unassigned__") {
					if (lead.agentId) return false;
				} else {
					if (lead.agentId !== agentFilter) return false;
				}
			}

			return true;
		});

		// 2. Sort
		filtered = [...filtered].sort((a, b) => {
			let valA: string | number | Date;
			let valB: string | number | Date;

			if (sortKey === "createdAt" || sortKey === "updatedAt") {
				valA = new Date(a[sortKey]).getTime();
				valB = new Date(b[sortKey]).getTime();
			} else if (sortKey === "agentName") {
				valA = (a.agentName ?? "").toLowerCase();
				valB = (b.agentName ?? "").toLowerCase();
			} else {
				valA = String(a[sortKey] ?? "").toLowerCase();
				valB = String(b[sortKey] ?? "").toLowerCase();
			}

			if (valA < valB) return sortOrder === "asc" ? -1 : 1;
			if (valA > valB) return sortOrder === "asc" ? 1 : -1;
			return 0;
		});

		const totalFiltered = filtered.length;

		// 3. Paginate
		const start = (page - 1) * pageSize;
		const visibleLeads = filtered.slice(start, start + pageSize);

		return { visibleLeads, totalFiltered };
	}, [
		allLeads,
		search,
		typeFilter,
		statusFilter,
		stageFilter,
		leadTypeFilter,
		agentFilter,
		sortKey,
		sortOrder,
		page,
		pageSize,
	]);

	const totalPages = Math.ceil(totalFiltered / pageSize);

	// Reset page when filters change
	const setFilter = useCallback(
		(setter: React.Dispatch<React.SetStateAction<string>>) => (v: string) => {
			setter(v);
			setPage(1);
		},
		[],
	);

	const resetFilters = () => {
		setSearch("");
		setTypeFilter("__all__");
		setStatusFilter("__all__");
		setStageFilter("__all__");
		setLeadTypeFilter("__all__");
		setAgentFilter("__all__");
		setPage(1);
	};

	const hasFilters =
		search ||
		typeFilter !== "__all__" ||
		statusFilter !== "__all__" ||
		stageFilter !== "__all__" ||
		leadTypeFilter !== "__all__" ||
		agentFilter !== "__all__";

	const handleRefresh = () => {
		refetch();
		queryClient.invalidateQueries({ queryKey: [["adminLeads"]] });
		setSelectedIds(new Set());
	};

	// Selection
	const allSelected =
		visibleLeads.length > 0 && visibleLeads.every((l) => selectedIds.has(l.id));
	const toggleSelectAll = () => {
		if (allSelected) setSelectedIds(new Set());
		else setSelectedIds(new Set(visibleLeads.map((l) => l.id)));
	};
	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	// Guard
	if (isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<RiLoader4Line className="size-8 animate-spin text-primary" />
			</div>
		);
	}
	if (!session) {
		router.push("/login");
		return null;
	}

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="overflow-hidden px-4 md:px-6 lg:px-8">
				{/* Header */}
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
										<span className="sr-only">Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink
										href="/admin"
										className="flex items-center gap-1"
									>
										<RiShieldUserLine size={16} />
										Admin Portal
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileList3Line size={20} aria-hidden="true" />
										Leads Management
									</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="ml-auto flex gap-3">
						<HeaderActions />
					</div>
				</header>

				<div className="flex flex-1 flex-col gap-6 py-6">
					{/* Page Title */}
					<div className="flex items-center justify-between">
						<div>
							<h1 className="font-bold text-2xl tracking-tight">
								Leads Management
							</h1>
							{isLoading ? (
								<Skeleton className="mt-1.5 h-4 w-64" />
							) : (
								<p className="mt-0.5 text-muted-foreground text-sm">
									{allLeads.length} leads loaded · filters &amp; sorting are
									instant
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleRefresh}
								disabled={isLoading}
							>
								<RiRefreshLine size={16} className="mr-1.5" />
								Refresh
							</Button>
							<Button size="sm" onClick={() => setIsCreateOpen(true)}>
								<RiAddLine size={16} className="mr-1.5" />
								New Lead
							</Button>
						</div>
					</div>

					{/* Stats */}
					<StatsCards leads={allLeads} isLoading={isLoading} />

					{/* Charts */}
					<LeadsCharts leads={allLeads} isLoading={isLoading} />

					{/* Today's Tasks */}
					<TodayTasksWidget
						onViewLead={(leadId) => {
							const lead = allLeads.find((l) => l.id === leadId);
							if (lead) setViewLead(lead);
						}}
					/>

					{/* Table */}
					<Card className="overflow-hidden">
						{/* ── Toolbar ── */}
						<div className="flex flex-col gap-2 border-b px-4 py-3">
							{/* Row 1: search + filters */}
							<div className="flex flex-wrap items-center gap-2">
								{/* Search */}
								<div className="relative min-w-[220px] flex-1">
									<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
									<Input
										placeholder="Search name, email, phone, property…"
										value={search}
										onChange={(e) => {
											setSearch(e.target.value);
											setPage(1);
										}}
										className="h-9 pl-9 text-sm"
									/>
								</div>

								{/* Divider */}
								<div className="hidden h-6 w-px bg-border sm:block" />

								{/* Filter dropdowns */}
								<div className="flex flex-wrap items-center gap-2">
									<Select
										value={agentFilter}
										onValueChange={setFilter(setAgentFilter)}
									>
										<SelectTrigger className="h-9 w-[130px] text-xs">
											<RiUserLine
												size={13}
												className="mr-1.5 shrink-0 text-muted-foreground"
											/>
											<SelectValue placeholder="Agent" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Agents</SelectItem>
											<SelectItem value="__unassigned__">Unassigned</SelectItem>
											{agents.map((a) => (
												<SelectItem key={a.agentId} value={a.agentId}>
													{a.agentName ?? a.agentEmail}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={stageFilter}
										onValueChange={setFilter(setStageFilter)}
									>
										<SelectTrigger className="h-9 w-[140px] text-xs">
											<SelectValue placeholder="Stage" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Stages</SelectItem>
											{PIPELINE_STAGES.map((s) => (
												<SelectItem key={s.value} value={s.value}>
													{s.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={statusFilter}
										onValueChange={setFilter(setStatusFilter)}
									>
										<SelectTrigger className="h-9 w-[120px] text-xs">
											<SelectValue placeholder="Status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Statuses</SelectItem>
											{STATUS_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={typeFilter}
										onValueChange={setFilter(setTypeFilter)}
									>
										<SelectTrigger className="h-9 w-[110px] text-xs">
											<SelectValue placeholder="Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Types</SelectItem>
											{TYPE_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<Select
										value={leadTypeFilter}
										onValueChange={setFilter(setLeadTypeFilter)}
									>
										<SelectTrigger className="h-9 w-[120px] text-xs">
											<SelectValue placeholder="Lead Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Lead Types</SelectItem>
											{LEAD_TYPE_OPTIONS.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{hasFilters && (
										<Button
											variant="ghost"
											size="sm"
											className="h-9 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
											onClick={resetFilters}
										>
											<RiCloseLine size={13} />
											Clear filters
										</Button>
									)}
								</div>
							</div>

							{/* Row 2: active filter chips + result count + bulk actions */}
							<div className="flex items-center justify-between gap-2">
								<div className="flex flex-wrap items-center gap-1.5">
									{agentFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Agent:{" "}
											<span className="font-medium">
												{agentFilter === "__unassigned__"
													? "Unassigned"
													: (agents.find((a) => a.agentId === agentFilter)
															?.agentName ?? agentFilter)}
											</span>
											<button
												type="button"
												onClick={() => {
													setAgentFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{stageFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Stage:{" "}
											<span className="font-medium">
												{stageMap[stageFilter]?.label ?? stageFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setStageFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{statusFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Status:{" "}
											<span className="font-medium capitalize">
												{statusFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setStatusFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{typeFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Type:{" "}
											<span className="font-medium capitalize">
												{typeFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setTypeFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{leadTypeFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Lead Type:{" "}
											<span className="font-medium capitalize">
												{leadTypeFilter}
											</span>
											<button
												type="button"
												onClick={() => {
													setLeadTypeFilter("__all__");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
									{search && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Search:{" "}
											<span className="font-medium">
												&ldquo;{search}&rdquo;
											</span>
											<button
												type="button"
												onClick={() => {
													setSearch("");
													setPage(1);
												}}
												className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
											>
												<RiCloseLine size={11} />
											</button>
										</span>
									)}
								</div>

								{/* Right side: count + bulk */}
								<div className="flex shrink-0 items-center gap-2">
									{selectedIds.size > 0 && (
										<>
											<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
												<RiCheckboxMultipleLine
													size={13}
													className="text-primary"
												/>
												<span className="font-medium text-foreground">
													{selectedIds.size}
												</span>{" "}
												selected
											</span>
											<Button
												size="sm"
												variant="outline"
												className="h-7 text-xs"
												onClick={() => setIsBulkStageOpen(true)}
											>
												Update Stage
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-7 text-xs"
												onClick={() => setSelectedIds(new Set())}
											>
												<RiCloseLine size={13} className="mr-1" />
												Deselect
											</Button>
											<div className="h-4 w-px bg-border" />
										</>
									)}
									<span className="text-muted-foreground text-xs">
										{isLoading ? (
											"Loading…"
										) : totalFiltered === allLeads.length ? (
											<>
												Total leads:{" "}
												<span className="font-medium text-foreground">
													{totalFiltered}
												</span>
											</>
										) : (
											<>
												<span className="font-medium text-foreground">
													{totalFiltered}
												</span>{" "}
												of {allLeads.length} leads
											</>
										)}
									</span>
								</div>
							</div>
						</div>
						<CardContent className="p-0">
							{isLoading ? (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead className="w-10 pl-4">
													<Skeleton className="h-4 w-4 rounded" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead className="hidden md:table-cell">
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead className="hidden lg:table-cell">
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-14" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-12" />
												</TableHead>
												<TableHead className="hidden xl:table-cell">
													<Skeleton className="h-3.5 w-10" />
												</TableHead>
												<TableHead>
													<Skeleton className="h-3.5 w-16" />
												</TableHead>
												<TableHead className="w-[100px]" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{[
												"sk-leads-table-1",
												"sk-leads-table-2",
												"sk-leads-table-3",
												"sk-leads-table-4",
												"sk-leads-table-5",
												"sk-leads-table-6",
												"sk-leads-table-7",
												"sk-leads-table-8",
											].map((id) => (
												<TableRow key={id} className="hover:bg-transparent">
													<TableCell className="pl-4">
														<Skeleton className="h-4 w-4 rounded" />
													</TableCell>
													<TableCell>
														<Skeleton className="mb-1 h-4 w-28" />
														<Skeleton className="h-3 w-36 md:hidden" />
													</TableCell>
													<TableCell className="hidden md:table-cell">
														<Skeleton className="mb-1 h-3.5 w-36" />
														<Skeleton className="h-3 w-24" />
													</TableCell>
													<TableCell className="hidden lg:table-cell">
														<Skeleton className="h-3.5 w-28" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-5 w-24 rounded-full" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-5 w-16 rounded-full" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-3.5 w-20" />
													</TableCell>
													<TableCell className="hidden xl:table-cell">
														<Skeleton className="mb-1 h-3 w-12" />
														<Skeleton className="h-3 w-16" />
													</TableCell>
													<TableCell>
														<Skeleton className="h-3.5 w-16" />
													</TableCell>
													<TableCell className="w-[100px] pr-4">
														<div className="flex justify-center gap-1">
															<Skeleton className="h-7 w-7 rounded" />
															<Skeleton className="h-7 w-7 rounded" />
															<Skeleton className="h-7 w-7 rounded" />
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : visibleLeads.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 text-center">
									<RiUserLine className="mb-3 size-12 text-muted-foreground/30" />
									<p className="font-medium">No leads found</p>
									<p className="mt-1 text-muted-foreground text-sm">
										{allLeads.length === 0
											? "Create your first lead to get started."
											: "Try adjusting or clearing your filters."}
									</p>
									{hasFilters && (
										<Button
											variant="link"
											size="sm"
											className="mt-2"
											onClick={resetFilters}
										>
											Clear filters
										</Button>
									)}
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="hover:bg-transparent">
												<TableHead className="w-10 pl-4">
													<input
														type="checkbox"
														checked={allSelected}
														onChange={toggleSelectAll}
														className="cursor-pointer rounded"
													/>
												</TableHead>
												<SortHeader
													label="Name"
													sortKey="name"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="hidden md:table-cell">
													Contact
												</TableHead>
												<TableHead className="hidden lg:table-cell">
													Property
												</TableHead>
												<SortHeader
													label="Stage"
													sortKey="stage"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<SortHeader
													label="Status"
													sortKey="status"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<SortHeader
													label="Agent"
													sortKey="agentName"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="hidden xl:table-cell">
													Type
												</TableHead>
												<SortHeader
													label="Created"
													sortKey="createdAt"
													current={sortKey}
													order={sortOrder}
													onSort={handleSort}
												/>
												<TableHead className="w-[100px] pr-4 text-center">
													Actions
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{visibleLeads.map((lead) => (
												<TableRow
													key={lead.id}
													className={`transition-colors ${selectedIds.has(lead.id) ? "bg-muted/50" : "hover:bg-muted/30"}`}
													onClick={(e) => {
														const target = e.target as HTMLElement | null;
														// Avoid opening details when user is selecting rows or using an action button.
														if (
															target?.closest('input[type="checkbox"]') ||
															target?.closest("button")
														) {
															return;
														}
														setViewLead(lead);
													}}
												>
													<TableCell className="pl-4">
														<input
															type="checkbox"
															checked={selectedIds.has(lead.id)}
															onChange={() => toggleSelect(lead.id)}
															className="cursor-pointer rounded"
														/>
													</TableCell>
													<TableCell>
														<p className="font-medium text-sm leading-snug">
															{lead.name}
														</p>
														<p className="text-muted-foreground text-xs md:hidden">
															{lead.email}
														</p>
													</TableCell>
													<TableCell className="hidden md:table-cell">
														<p className="text-sm">{lead.email}</p>
														<p className="text-muted-foreground text-xs">
															{lead.phone}
														</p>
													</TableCell>
													<TableCell className="hidden lg:table-cell">
														<p
															className="max-w-[140px] truncate text-sm"
															title={lead.property}
														>
															{lead.property}
														</p>
														{lead.projectName && (
															<p className="max-w-[140px] truncate text-muted-foreground text-xs">
																{lead.projectName}
															</p>
														)}
													</TableCell>
													<TableCell>
														<StageBadge stage={lead.stage} />
													</TableCell>
													<TableCell>
														<StatusBadge status={lead.status} />
													</TableCell>
													<TableCell>
														{lead.agentName ? (
															<div className="flex items-center gap-1.5">
																<RiUserLine
																	size={13}
																	className="shrink-0 text-muted-foreground"
																/>
																<span
																	className="max-w-[110px] truncate text-sm"
																	title={lead.agentName}
																>
																	{lead.agentName}
																</span>
															</div>
														) : (
															<span className="text-muted-foreground text-xs italic">
																Unassigned
															</span>
														)}
													</TableCell>
													<TableCell className="hidden xl:table-cell">
														<p className="text-xs capitalize">{lead.type}</p>
														<p className="text-muted-foreground text-xs capitalize">
															{lead.leadType}
														</p>
													</TableCell>
													<TableCell className="whitespace-nowrap text-muted-foreground text-xs">
														{new Date(lead.createdAt).toLocaleDateString()}
													</TableCell>
													<TableCell className="w-[100px] pr-4">
														<div className="flex items-center justify-center gap-0.5">
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																		title="View details"
																		onClick={() => setViewLead(lead)}
																	>
																		<RiEyeLine size={14} />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>View details</TooltipContent>
															</Tooltip>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																		title="Edit lead"
																		onClick={() => setEditLead(lead)}
																	>
																		<RiEditLine size={14} />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Edit lead</TooltipContent>
															</Tooltip>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
																		title="Delete lead"
																		onClick={() => setDeleteLead(lead)}
																	>
																		<RiDeleteBinLine size={14} />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Delete lead</TooltipContent>
															</Tooltip>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}

							{/* Pagination */}
							{totalFiltered > 0 && (
								<div className="flex flex-wrap items-center justify-center gap-1.5 border-t px-4 py-3">
									{/* |◄ First */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page <= 1}
										onClick={() => setPage(1)}
										title="First page"
									>
										<span className="sr-only">First</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M3 3h1.5v10H3zm2.5 5 6-5v10z" />
										</svg>
									</Button>

									{/* ◄ Prev */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page <= 1}
										onClick={() => setPage((p) => p - 1)}
										title="Previous page"
									>
										<span className="sr-only">Previous</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M10.5 3 4 8l6.5 5z" />
										</svg>
									</Button>

									{/* Numbered pages with ellipsis */}
									{(() => {
										const delta = 2;
										const pages: (number | "…left" | "…right")[] = [];
										const left = Math.max(2, page - delta);
										const right = Math.min(totalPages - 1, page + delta);

										pages.push(1);
										if (left > 2) pages.push("…left");
										for (let i = left; i <= right; i++) pages.push(i);
										if (right < totalPages - 1) pages.push("…right");
										if (totalPages > 1) pages.push(totalPages);

										return pages.map((p) =>
											typeof p === "string" ? (
												<span
													key={p}
													className="flex h-8 w-6 select-none items-center justify-center text-muted-foreground text-xs"
												>
													…
												</span>
											) : (
												<Button
													key={p}
													variant={p === page ? "default" : "outline"}
													size="sm"
													className="h-8 w-8 p-0 text-xs"
													onClick={() => setPage(p)}
												>
													{p}
												</Button>
											),
										);
									})()}

									{/* ► Next */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page >= totalPages}
										onClick={() => setPage((p) => p + 1)}
										title="Next page"
									>
										<span className="sr-only">Next</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M5.5 3 12 8l-6.5 5z" />
										</svg>
									</Button>

									{/* ►| Last */}
									<Button
										variant="outline"
										size="sm"
										className="h-8 w-8 p-0"
										disabled={page >= totalPages}
										onClick={() => setPage(totalPages)}
										title="Last page"
									>
										<span className="sr-only">Last</span>
										<svg
											viewBox="0 0 16 16"
											className="size-3.5"
											fill="currentColor"
											aria-hidden="true"
										>
											<path d="M11.5 3H13v10h-1.5zM4 3l6.5 5L4 13z" />
										</svg>
									</Button>

									{/* Items-per-page selector */}
									<div className="ml-2 flex items-center gap-1.5 border-l pl-2">
										<Select
											value={String(pageSize)}
											onValueChange={(v) => {
												setPageSize(Number(v));
												setPage(1);
											}}
										>
											<SelectTrigger className="h-8 w-16 px-2 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PAGE_SIZE_OPTIONS.map((n) => (
													<SelectItem
														key={n}
														value={String(n)}
														className="text-xs"
													>
														{n}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<span className="whitespace-nowrap text-muted-foreground text-xs">
											items per page
										</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</SidebarInset>

			{/* Dialogs & Sheets */}
			<LeadDetailSheet
				lead={viewLead}
				open={!!viewLead}
				onClose={() => setViewLead(null)}
				agents={agents}
				onRefresh={handleRefresh}
			/>
			<EditLeadDialog
				lead={editLead}
				open={!!editLead}
				onClose={() => setEditLead(null)}
				agents={agents}
				onSuccess={handleRefresh}
			/>
			<DeleteLeadDialog
				lead={deleteLead}
				open={!!deleteLead}
				onClose={() => setDeleteLead(null)}
				onSuccess={handleRefresh}
			/>
			<CreateLeadDialog
				open={isCreateOpen}
				onClose={() => setIsCreateOpen(false)}
				agents={agents}
				onSuccess={handleRefresh}
			/>
			<BulkStageDialog
				selectedIds={Array.from(selectedIds)}
				open={isBulkStageOpen}
				onClose={() => setIsBulkStageOpen(false)}
				onSuccess={() => {
					handleRefresh();
					setSelectedIds(new Set());
				}}
			/>
		</SidebarProvider>
	);
}
