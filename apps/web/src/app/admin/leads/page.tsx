"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDateDMY } from "@/lib/date-format";
import { trpc } from "@/utils/trpc";
import {
	RiCheckboxMultipleLine,
	RiCloseLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiEyeLine,
	RiFileDownloadLine,
	RiFileUploadLine,
	RiFileList3Line,
	RiLoader4Line,
	RiMore2Line,
	RiPriceTagLine,
	RiSearchLine,
	RiShieldUserLine,
	RiUserLine,
} from "@remixicon/react";
import { FileSpreadsheet, FileText } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";

import { AdminLeadsPageHeader } from "./_components/admin-leads-page-header";
import { BulkEditDialog } from "./_components/bulk-edit-dialog";
import { BulkDeleteDialog } from "./_components/bulk-delete-dialog";
import { CreateLeadDialog } from "./_components/create-lead-dialog";
import { DeleteLeadDialog } from "./_components/delete-lead-dialog";
import { EditLeadDialog } from "./_components/edit-lead-dialog";
import {
	LEAD_TYPE_OPTIONS,
	formatLeadTypeLabel,
	PAGE_SIZE_OPTIONS,
	PIPELINE_STAGES,
	stageMap,
} from "./_components/lead-constants";
import { LeadDetailSheet } from "./_components/lead-detail-sheet";
import {
	type Lead,
	type SortKey,
	formatLeadContact,
	getLeadDisplayTags,
} from "./_components/lead-models";
import { StageBadge, StatusBadge } from "./_components/lead-ui";
import { LeadsCharts } from "./_components/leads-charts";
import { SortHeader } from "./_components/sort-header";
import { StatsCards } from "./_components/stats-cards";
import { TodayTasksWidget } from "./_components/today-tasks-widget";
import { KanbanPipelineBoard } from "./_components/kanban-pipeline-board";
import { ImportLeadsDialog } from "./_components/import-leads-dialog";
import { cn } from "@/lib/utils";

function leadInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

const actionBtnClass =
	"size-8 shrink-0 rounded-full border border-border/60 bg-muted/40 p-0 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground";

export default function AdminLeadsPage() {
	const trpcUtils = trpc.useUtils();
	// Defer non-critical widgets until after first list paint
	const [loadSecondary, setLoadSecondary] = useState(false);
	useEffect(() => {
		const idle =
			typeof window !== "undefined" && "requestIdleCallback" in window
				? window.requestIdleCallback(() => setLoadSecondary(true), {
						timeout: 1500,
					})
				: null;
		const id = window.setTimeout(() => setLoadSecondary(true), 800);
		return () => {
			if (idle != null && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idle);
			}
			window.clearTimeout(id);
		};
	}, []);

	// ── Filters (server-side via adminLeads.list) ───────────────────────────
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("__all__");
	const [stageFilter, setStageFilter] = useState("__all__");
	const [leadTypeFilter, setLeadTypeFilter] = useState("__all__");
	const [agentFilter, setAgentFilter] = useState("__all__");
	const [categoryFilter, setCategoryFilter] = useState("__all__");
	const [sortKey, setSortKey] = useState<SortKey>("createdAt");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	// Table-first for fast initial paint; kanban still available
	const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

	const debouncedSearch = useDebouncedValue(search, 300);

	// ── Dialogs ────────────────────────────────────────────────────────────
	const [viewLead, setViewLead] = useState<Lead | null>(null);
	const [editLead, setEditLead] = useState<Lead | null>(null);
	const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
	const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isExporting, setIsExporting] = useState(false);
	const [isImportOpen, setIsImportOpen] = useState(false);

	const listSortBy =
		sortKey === "agentName" ? ("createdAt" as const) : sortKey;

	// Server-side filtered + paginated list (table uses pageSize; kanban uses larger page)
	const {
		data: rawData,
		isPending: leadsPending,
		isFetching,
		refetch,
	} = trpc.adminLeads.list.useQuery(
		{
			search: debouncedSearch.trim() || undefined,
			status: statusFilter === "active" ? "active" : undefined,
			excludeActive: statusFilter === "inactive" ? true : undefined,
			stage: stageFilter !== "__all__" ? (stageFilter as never) : undefined,
			leadType:
				leadTypeFilter !== "__all__"
					? (leadTypeFilter as "personal" | "company")
					: undefined,
			agentId: agentFilter !== "__all__" ? agentFilter : undefined,
			tagId: categoryFilter !== "__all__" ? categoryFilter : undefined,
			page: viewMode === "kanban" ? 1 : page,
			limit: viewMode === "kanban" ? 120 : pageSize,
			slim: viewMode === "kanban",
			sortBy: listSortBy,
			sortOrder,
		},
		{ staleTime: 60_000, placeholderData: (prev) => prev },
	);

	const { data: leadsStats, isPending: statsPending } =
		trpc.adminLeads.stats.useQuery(undefined, {
			staleTime: 60_000,
			enabled: loadSecondary,
		});

	const { data: agentsData } = trpc.adminLeads.agentsWithLeads.useQuery(
		undefined,
		{ staleTime: 3 * 60 * 1000, enabled: loadSecondary },
	);
	const { data: tagsData } = trpc.tags.list.useQuery(
		{ page: 1, limit: 100 },
		{ staleTime: 30_000, enabled: loadSecondary },
	);

	const pageLeads = (rawData?.leads ?? []) as Lead[];
	const totalFiltered = rawData?.pagination?.total ?? 0;
	const totalPages = Math.max(1, rawData?.pagination?.totalPages ?? 1);
	const visibleLeads = pageLeads;
	const kanbanLeads = pageLeads;
	const agents = agentsData ?? [];
	const tags = tagsData?.tags ?? [];
	const allLeads = pageLeads;

	const leadStatsSummary = useMemo(() => {
		if (!leadsStats) return null;
		return {
			total: leadsStats.total,
			active: leadsStats.byStatus.active,
			inactive: leadsStats.byStatus.inactive + leadsStats.byStatus.pending,
			appointmentsMade: leadsStats.byStage.appointment_made ?? 0,
			bookingsMade: leadsStats.byStage.booking_made ?? 0,
			buyers: leadsStats.byType.buyer,
			tenants: leadsStats.byType.tenant,
		};
	}, [leadsStats]);

	// ── Sort handler ────────────────────────────────────────────────────────
	const handleSort = useCallback(
		(key: SortKey) => {
			if (sortKey === key) {
				setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
			} else {
				setSortKey(key);
				setSortOrder("asc");
			}
			setPage(1);
		},
		[sortKey],
	);

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
		setStatusFilter("__all__");
		setStageFilter("__all__");
		setLeadTypeFilter("__all__");
		setAgentFilter("__all__");
		setCategoryFilter("__all__");
		setPage(1);
	};

	const hasFilters =
		search ||
		statusFilter !== "__all__" ||
		stageFilter !== "__all__" ||
		leadTypeFilter !== "__all__" ||
		agentFilter !== "__all__" ||
		categoryFilter !== "__all__";

	const handleRefresh = () => {
		setSelectedIds(new Set());
		void refetch();
	};

	const formatDateForExport = (value: Date | string | null | undefined) => {
		if (!value) return "";
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "";
		// Keep exports stable across locales (YYYY-MM-DD) for compliance/handover.
		return d.toISOString().slice(0, 10);
	};

	const capitalizeForExport = (value: string | null | undefined) => {
		if (!value) return "";
		return value.charAt(0).toUpperCase() + value.slice(1);
	};

	const leadsToExportRows = (leads: Lead[]) => {
		return leads.map((lead) => ({
			"Name": lead.name ?? "",
			"Email": lead.email ?? "",
			"Phone": lead.phone ?? "",
			"WhatsApp Username": lead.whatsappUsername ?? "",
			"Property": lead.property ?? "",
			"Project": lead.projectName ?? "",
			"Stage": stageMap[lead.stage]?.label ?? lead.stage ?? "",
			"Agent": lead.agentName ?? "Unassigned",
			"Agent Email": lead.agentEmail ?? "",
			"Followers": lead.followerNames?.length ? lead.followerNames.join("; ") : "",
			"Type": capitalizeForExport(lead.type),
			"Lead Type": formatLeadTypeLabel(lead.leadType),
			"Source": lead.source ?? "",
			Categories:
				(lead.tagNames?.length ? lead.tagNames.join("; ") : lead.tags) ?? "",
			"Last Contact": formatDateForExport(lead.lastContact),
			"Next Contact": formatDateForExport(lead.nextContact),
			"Created At": formatDateForExport(lead.createdAt),
			"Updated At": formatDateForExport(lead.updatedAt),
		}));
	};

	const exportToCSV = useCallback(
		(data: Record<string, string>[], filenameBase: string) => {
			if (!data || data.length === 0) return;

			const headers = Object.keys(data[0] as Record<string, unknown>);
			const csvContent = [
				headers.join(","),
				...data.map((row) =>
					headers
						.map((header) => {
							const value = (row as Record<string, unknown>)[header];
							if (value === null || value === undefined) return "";
							const str = String(value);

							// CSV escaping: quote if value includes comma, quotes, or newlines.
							if (
								str.includes(",") ||
								str.includes('"') ||
								str.includes("\n") ||
								str.includes("\r")
							) {
								return `"${str.replace(/"/g, '""')}"`;
							}
							return str;
						})
						.join(","),
				),
			].join("\n");

			const blob = new Blob([csvContent], {
				type: "text/csv;charset=utf-8;",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filenameBase}_${new Date()
				.toISOString()
				.split("T")[0]}.csv`;
			link.click();
		},
		[],
	);

	const escapeHtml = useCallback(
		(value: string) =>
			value
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;"),
		[],
	);

	// Excel can open HTML tables even with a legacy .xls extension.
	const exportToExcelHtml = useCallback(
		(data: Record<string, string>[], filenameBase: string) => {
			if (!data || data.length === 0) return;

			const headers = Object.keys(data[0] as Record<string, unknown>);
			const thead = `<tr>${headers
				.map((h) => `<th>${escapeHtml(String(h))}</th>`)
				.join("")}</tr>`;

			const tbody = data
				.map((row) => {
					return `<tr>${headers
						.map((h) => {
							const value = (row as Record<string, unknown>)[h];
							return `<td>${escapeHtml(value === undefined || value === null ? "" : String(value))}</td>`;
						})
						.join("")}</tr>`;
				})
				.join("");

			const html = `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
	</head>
	<body>
		<table>
			<thead>${thead}</thead>
			<tbody>${tbody}</tbody>
		</table>
	</body>
</html>`;

			const blob = new Blob([html], {
				type: "application/vnd.ms-excel;charset=utf-8;",
			});

			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${filenameBase}_${new Date()
				.toISOString()
				.split("T")[0]}.xls`;
			link.click();
		},
		[escapeHtml],
	);

	const handleExport = useCallback(
		async (
			format: "csv" | "excel",
			scope: "filtered" | "selected",
		) => {
			if (isExporting || leadsPending) return;
			setIsExporting(true);
			try {
				let leads: Lead[];
				if (scope === "selected") {
					leads = allLeads.filter((l) => selectedIds.has(l.id));
				} else {
					const exported = await trpcUtils.adminLeads.list.fetch({
						search: debouncedSearch.trim() || undefined,
						status: statusFilter === "active" ? "active" : undefined,
						excludeActive: statusFilter === "inactive" ? true : undefined,
						stage:
							stageFilter !== "__all__" ? (stageFilter as never) : undefined,
						leadType:
							leadTypeFilter !== "__all__"
								? (leadTypeFilter as "personal" | "company")
								: undefined,
						agentId: agentFilter !== "__all__" ? agentFilter : undefined,
						tagId: categoryFilter !== "__all__" ? categoryFilter : undefined,
						page: 1,
						limit: 5000,
						forExport: true,
						sortBy: listSortBy,
						sortOrder,
					});
					leads = (exported.leads ?? []) as Lead[];
					if ((exported.pagination?.total ?? 0) > 5000) {
						// Soft notice via console; toast optional
						console.warn(
							"[leads export] Truncated to first 5,000 matching rows",
						);
					}
				}

				const exportRows = leadsToExportRows(leads);
				const baseName =
					scope === "selected" ? "leads_export_selected" : "leads_export";

				if (format === "csv") exportToCSV(exportRows, baseName);
				else exportToExcelHtml(exportRows, baseName);
			} finally {
				setIsExporting(false);
			}
		},
		[
			agentFilter,
			allLeads,
			categoryFilter,
			debouncedSearch,
			exportToCSV,
			exportToExcelHtml,
			isExporting,
			leadTypeFilter,
			leadsPending,
			leadsToExportRows,
			listSortBy,
			selectedIds,
			sortOrder,
			stageFilter,
			statusFilter,
			trpcUtils,
		],
	);

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

	return (
		<>
			{/* Header */}
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
									<span className="sr-only">Dashboard</span>
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="/admin" className="flex items-center gap-1">
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
				<div className="ml-auto flex gap-2">
					<HeaderActions />
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-6 py-6">
					<AdminLeadsPageHeader
						isLoading={leadsPending}
						leadCount={totalFiltered}
						isRefreshing={leadsPending || isFetching}
						viewMode={viewMode}
						onRefresh={handleRefresh}
						onViewMode={(mode) => {
							setViewMode(mode);
							setSelectedIds(new Set());
							setPage(1);
						}}
						onNewLead={() => setIsCreateOpen(true)}
					/>

					{/* Stats */}
					{loadSecondary ? (
						<StatsCards
							summary={leadStatsSummary}
							isLoading={statsPending && !leadsStats}
						/>
					) : null}

					{/* Charts */}
					{loadSecondary ? (
						<LeadsCharts
							chartData={leadsStats}
							isLoading={statsPending && !leadsStats}
						/>
					) : null}

					{/* Today's Tasks */}
					<TodayTasksWidget
						enabled={loadSecondary}
						onViewLead={(leadId) => {
							const lead = allLeads.find((l) => l.id === leadId);
							if (lead) setViewLead(lead);
						}}
					/>

					{/* Table */}
					<Card className="gap-0 overflow-hidden border-border/70 py-0 shadow-card">
						{/* ── Toolbar ── */}
						<div className="flex flex-col gap-3 border-border/60 border-b bg-card px-4 py-4 sm:px-5">
							{/* Row 1: search + filters */}
							<div className="flex flex-wrap items-center gap-2.5">
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
										className="h-10 rounded-xl border-border/70 bg-muted/30 pl-9 text-sm shadow-none focus-visible:bg-background"
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
										<SelectTrigger className="h-10 w-[140px] rounded-xl border-border/70 bg-muted/30 text-xs shadow-none">
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
										<SelectTrigger className="h-10 w-[150px] rounded-xl border-border/70 bg-muted/30 text-xs shadow-none">
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
										<SelectTrigger className="h-10 w-[120px] rounded-xl border-border/70 bg-muted/30 text-xs shadow-none">
											<SelectValue placeholder="Status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Status</SelectItem>
											<SelectItem value="active">Active</SelectItem>
											<SelectItem value="inactive">Inactive</SelectItem>
										</SelectContent>
									</Select>

									<Select
										value={leadTypeFilter}
										onValueChange={setFilter(setLeadTypeFilter)}
									>
										<SelectTrigger className="h-10 w-[130px] rounded-xl border-border/70 bg-muted/30 text-xs shadow-none">
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

									<Select
										value={categoryFilter}
										onValueChange={setFilter(setCategoryFilter)}
									>
										<SelectTrigger className="h-10 w-[160px] rounded-xl border-border/70 bg-muted/30 text-xs shadow-none">
											<RiPriceTagLine
												size={13}
												className="mr-1.5 shrink-0 text-muted-foreground"
											/>
											<SelectValue placeholder="Category" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__all__">All Categories</SelectItem>
											<SelectItem value="__none__">Uncategorized</SelectItem>
											{tags.map((t) => (
												<SelectItem key={t.id} value={t.id}>
													{t.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{hasFilters && (
										<Button
											variant="ghost"
											size="sm"
											className="h-10 gap-1.5 rounded-xl text-muted-foreground text-xs hover:text-foreground"
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
									{categoryFilter !== "__all__" && (
										<span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
											Category:{" "}
											<span className="font-medium">
												{categoryFilter === "__none__"
													? "Uncategorized"
													: (tags.find((t) => t.id === categoryFilter)?.name ??
														categoryFilter)}
											</span>
											<button
												type="button"
												onClick={() => {
													setCategoryFilter("__all__");
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
											<span className="font-medium">
												{formatLeadTypeLabel(leadTypeFilter)}
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
												onClick={() => setIsBulkEditOpen(true)}
											>
												Bulk Edit
											</Button>
											<Button
												size="sm"
												variant="destructive"
												className="h-7 text-xs"
												onClick={() => setIsBulkDeleteOpen(true)}
											>
												Delete
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
										{leadsPending ? (
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
									{/* Import / export */}
									<div className="inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-muted/25">
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													size="icon"
													variant="ghost"
													className="h-8 w-8 rounded-none p-0 text-muted-foreground hover:text-foreground"
													disabled={leadsPending}
													aria-label="Import leads from CSV"
													onClick={() => setIsImportOpen(true)}
												>
													<RiFileUploadLine size={16} aria-hidden />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="z-[60]">Import CSV</TooltipContent>
										</Tooltip>
										<div className="h-5 w-px bg-border" />
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<span
													className={[
														"inline-flex",
														leadsPending || isExporting
															? "pointer-events-none opacity-50"
															: "",
													].join(" ")}
												>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																size="icon"
																variant="ghost"
																className="h-8 w-8 rounded-none p-0 text-muted-foreground hover:text-foreground"
																disabled={leadsPending || isExporting}
																aria-label="Export leads"
															>
																<RiFileDownloadLine
																	size={16}
																	aria-hidden="true"
																/>
															</Button>
														</TooltipTrigger>
														<TooltipContent className="z-[60]">
															Export leads
														</TooltipContent>
													</Tooltip>
												</span>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												className="w-fit min-w-0 p-0"
											>
												<div className="flex items-center gap-0 p-0">
													<Tooltip>
														<TooltipTrigger asChild>
															<DropdownMenuItem
																disabled={
																	leadsPending ||
																	isExporting ||
																	(selectedIds.size === 0 &&
																		kanbanLeads.length === 0)
																}
																onSelect={() => {
																	handleExport(
																		"csv",
																		selectedIds.size > 0
																			? "selected"
																			: "filtered",
																	);
																}}
																className="h-7 w-7 gap-0 !px-0 !py-0 justify-center"
															>
																<FileText size={14} aria-hidden="true" />
															</DropdownMenuItem>
														</TooltipTrigger>
														<TooltipContent className="z-[60]">
															Export CSV (
															{selectedIds.size > 0 ? "selected" : "filtered"})
														</TooltipContent>
													</Tooltip>
													<Tooltip>
														<TooltipTrigger asChild>
															<DropdownMenuItem
																disabled={
																	leadsPending ||
																	isExporting ||
																	(selectedIds.size === 0 &&
																		kanbanLeads.length === 0)
																}
																onSelect={() => {
																	handleExport(
																		"excel",
																		selectedIds.size > 0
																			? "selected"
																			: "filtered",
																	);
																}}
																className="h-7 w-7 gap-0 !px-0 !py-0 justify-center"
															>
																<FileSpreadsheet size={14} aria-hidden="true" />
															</DropdownMenuItem>
														</TooltipTrigger>
														<TooltipContent className="z-[60]">
															Export Excel (
															{selectedIds.size > 0 ? "selected" : "filtered"})
														</TooltipContent>
													</Tooltip>
												</div>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							</div>
						</div>
						<CardContent className="p-0">
							<div className={viewMode === "table" ? "" : "hidden"}>
								{leadsPending ? (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow className="border-border/60 hover:bg-transparent">
													<TableHead className="h-11 w-12 bg-muted/50 pl-5">
														<Skeleton className="size-4 rounded" />
													</TableHead>
													<TableHead className="h-11 bg-muted/50 px-4">
														<Skeleton className="h-3.5 w-24" />
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 md:table-cell">
														<Skeleton className="h-3.5 w-16" />
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 lg:table-cell">
														<Skeleton className="h-3.5 w-16" />
													</TableHead>
													<TableHead className="h-11 bg-muted/50 px-4">
														<Skeleton className="h-3.5 w-12" />
													</TableHead>
													<TableHead className="h-11 bg-muted/50 px-4">
														<Skeleton className="h-3.5 w-14" />
													</TableHead>
													<TableHead className="h-11 bg-muted/50 px-4">
														<Skeleton className="h-3.5 w-12" />
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 xl:table-cell">
														<Skeleton className="h-3.5 w-16" />
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 xl:table-cell">
														<Skeleton className="h-3.5 w-16" />
													</TableHead>
													<TableHead className="h-11 bg-muted/50 px-4">
														<Skeleton className="h-3.5 w-16" />
													</TableHead>
													<TableHead className="h-11 w-[108px] bg-muted/50" />
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
													<TableRow key={id} className="border-border/50 hover:bg-transparent">
														<TableCell className="pl-5">
															<Skeleton className="size-4 rounded" />
														</TableCell>
														<TableCell className="px-4 py-3.5">
															<div className="flex items-center gap-3">
																<Skeleton className="size-9 rounded-full" />
																<Skeleton className="h-4 w-28" />
															</div>
														</TableCell>
														<TableCell className="hidden px-4 md:table-cell">
															<Skeleton className="mb-1 h-3.5 w-28" />
															<Skeleton className="h-3 w-36" />
														</TableCell>
														<TableCell className="hidden px-4 lg:table-cell">
															<Skeleton className="h-5 w-24 rounded-full" />
														</TableCell>
														<TableCell className="px-4">
															<Skeleton className="h-5 w-24 rounded-full" />
														</TableCell>
														<TableCell className="px-4">
															<Skeleton className="h-5 w-16 rounded-full" />
														</TableCell>
														<TableCell className="px-4">
															<Skeleton className="h-3.5 w-20" />
														</TableCell>
														<TableCell className="hidden px-4 xl:table-cell">
															<Skeleton className="h-3.5 w-16" />
														</TableCell>
														<TableCell className="hidden px-4 xl:table-cell">
															<Skeleton className="h-3.5 w-20" />
														</TableCell>
														<TableCell className="px-4">
															<Skeleton className="h-3.5 w-16" />
														</TableCell>
														<TableCell className="w-[108px] pr-5">
															<div className="flex justify-center gap-1.5">
																<Skeleton className="size-8 rounded-full" />
																<Skeleton className="size-8 rounded-full" />
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
												<TableRow className="border-border/60 hover:bg-transparent">
													<TableHead className="h-11 w-12 bg-muted/50 pl-5">
														<input
															type="checkbox"
															checked={allSelected}
															onChange={toggleSelectAll}
															className="size-4 cursor-pointer rounded border-border"
														/>
													</TableHead>
													<SortHeader
														label="Name & Profile"
														sortKey="name"
														current={sortKey}
														order={sortOrder}
														onSort={handleSort}
													/>
													<TableHead className="hidden h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide md:table-cell">
														Contact
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide lg:table-cell">
														Categories
													</TableHead>
													<SortHeader
														label="Stage"
														sortKey="stage"
														current={sortKey}
														order={sortOrder}
														onSort={handleSort}
													/>
													<TableHead className="h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide">
														Status
													</TableHead>
													<SortHeader
														label="Agent"
														sortKey="agentName"
														current={sortKey}
														order={sortOrder}
														onSort={handleSort}
													/>
													<TableHead className="hidden h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide xl:table-cell">
														Followers
													</TableHead>
													<TableHead className="hidden h-11 bg-muted/50 px-4 font-semibold text-foreground/80 text-xs tracking-wide xl:table-cell">
														Lead Type
													</TableHead>
													<SortHeader
														label="Created"
														sortKey="createdAt"
														current={sortKey}
														order={sortOrder}
														onSort={handleSort}
													/>
													<TableHead className="h-11 w-[108px] bg-muted/50 pr-5 text-center font-semibold text-foreground/80 text-xs tracking-wide">
														Action
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{visibleLeads.map((lead) => (
													<TableRow
														key={lead.id}
														className={cn(
															"cursor-pointer border-border/50 transition-colors",
															selectedIds.has(lead.id)
																? "bg-primary/5"
																: "hover:bg-muted/35",
														)}
														onClick={(e) => {
															const target = e.target as HTMLElement | null;
															if (
																target?.closest('input[type="checkbox"]') ||
																target?.closest("button") ||
																target?.closest("[data-radix-menu-content]") ||
																target?.closest("[role='menu']")
															) {
																return;
															}
															setViewLead(lead);
														}}
													>
														<TableCell className="pl-5">
															<input
																type="checkbox"
																checked={selectedIds.has(lead.id)}
																onChange={() => toggleSelect(lead.id)}
																className="size-4 cursor-pointer rounded border-border"
															/>
														</TableCell>
														<TableCell className="px-4 py-3.5">
															<div className="flex min-w-0 items-center gap-3">
																<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary text-xs">
																	{leadInitials(lead.name)}
																</span>
																<div className="min-w-0">
																	<p className="truncate font-semibold text-foreground text-sm leading-snug">
																		{lead.name}
																	</p>
																	<p className="mt-0.5 truncate text-muted-foreground text-xs md:hidden">
																		{formatLeadContact(lead)}
																	</p>
																</div>
															</div>
														</TableCell>
														<TableCell className="hidden px-4 py-3.5 md:table-cell">
															<div className="min-w-0 space-y-0.5">
																<p className="font-medium text-foreground/90 text-sm tabular-nums">
																	{lead.phone?.trim() || "—"}
																</p>
																<p className="truncate text-muted-foreground text-xs">
																	{lead.email ?? "—"}
																</p>
																{(lead.whatsappUsername?.trim() ||
																	lead.source?.trim()) && (
																	<p
																		className="max-w-[200px] truncate text-muted-foreground/80 text-[11px]"
																		title={[
																			lead.whatsappUsername?.trim()
																				? `WA: ${
																						lead.whatsappUsername
																							.trim()
																							.startsWith("@")
																							? lead.whatsappUsername.trim()
																							: `@${lead.whatsappUsername.trim()}`
																					}`
																				: null,
																			lead.source?.trim() || null,
																		]
																			.filter(Boolean)
																			.join(" · ")}
																	>
																		{lead.whatsappUsername?.trim()
																			? `WA: ${
																					lead.whatsappUsername
																						.trim()
																						.startsWith("@")
																						? lead.whatsappUsername.trim()
																						: `@${lead.whatsappUsername.trim()}`
																				}`
																			: null}
																		{lead.whatsappUsername?.trim() &&
																		lead.source?.trim()
																			? " · "
																			: null}
																		{lead.source?.trim() || null}
																	</p>
																)}
															</div>
														</TableCell>
														<TableCell className="hidden px-4 py-3.5 lg:table-cell">
															{(() => {
																const tags = getLeadDisplayTags(lead);
																if (tags.length === 0) {
																	return (
																		<span className="text-muted-foreground text-sm">
																			—
																		</span>
																	);
																}
																const label = tags.join(", ");
																return (
																	<span
																		className="inline-flex max-w-[160px] truncate rounded-full bg-muted/70 px-2.5 py-0.5 font-medium text-foreground/80 text-xs"
																		title={label}
																	>
																		{tags[0]}
																		{tags.length > 1
																			? ` +${tags.length - 1}`
																			: ""}
																	</span>
																);
															})()}
														</TableCell>
														<TableCell className="whitespace-nowrap px-4 py-3.5">
															<StageBadge stage={lead.stage} />
														</TableCell>
														<TableCell className="whitespace-nowrap px-4 py-3.5">
															<StatusBadge status={lead.status} />
														</TableCell>
														<TableCell className="px-4 py-3.5">
															{lead.agentName ? (
																<div className="flex items-center gap-2">
																	<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
																		<RiUserLine size={13} />
																	</span>
																	<span
																		className="max-w-[120px] truncate text-sm"
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
														<TableCell className="hidden px-4 py-3.5 xl:table-cell">
															{lead.followerNames &&
															lead.followerNames.length > 0 ? (
																<p
																	className="max-w-[140px] truncate text-sm text-foreground/80"
																	title={lead.followerNames.join(", ")}
																>
																	{lead.followerNames.join(", ")}
																</p>
															) : (
																<span className="text-muted-foreground text-xs">
																	—
																</span>
															)}
														</TableCell>
														<TableCell className="hidden px-4 py-3.5 xl:table-cell">
															<span className="text-sm text-foreground/80">
																{formatLeadTypeLabel(lead.leadType)}
															</span>
														</TableCell>
														<TableCell className="whitespace-nowrap px-4 py-3.5 text-muted-foreground text-sm">
															{formatDateDMY(lead.createdAt)}
														</TableCell>
														<TableCell className="w-[108px] pr-5">
															<div className="flex items-center justify-center gap-1.5">
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className={actionBtnClass}
																			title="View details"
																			onClick={() => setViewLead(lead)}
																		>
																			<RiEyeLine size={15} />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>View details</TooltipContent>
																</Tooltip>
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className={actionBtnClass}
																			aria-label="More actions"
																		>
																			<RiMore2Line size={15} />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end" className="w-40">
																		<DropdownMenuItem
																			onClick={() => setEditLead(lead)}
																		>
																			<RiEditLine className="mr-2 size-3.5" />
																			Edit
																		</DropdownMenuItem>
																		<DropdownMenuItem
																			className="text-destructive focus:text-destructive"
																			onClick={() => setDeleteLead(lead)}
																		>
																			<RiDeleteBinLine className="mr-2 size-3.5" />
																			Delete
																		</DropdownMenuItem>
																	</DropdownMenuContent>
																</DropdownMenu>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}

								{/* Pagination */}
								{totalFiltered > 0 && viewMode === "table" && (
									<div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-t bg-muted/20 px-5 py-3.5">
										<p className="text-muted-foreground text-xs">
											Showing{" "}
											<span className="font-medium text-foreground">
												{(page - 1) * pageSize + 1}
											</span>{" "}
											to{" "}
											<span className="font-medium text-foreground">
												{Math.min(page * pageSize, totalFiltered)}
											</span>{" "}
											of{" "}
											<span className="font-medium text-foreground">
												{totalFiltered}
											</span>{" "}
											entries
										</p>
										<div className="flex flex-wrap items-center gap-1.5">
										{/* |◄ First */}
										<Button
											variant="outline"
											size="sm"
											className="size-8 rounded-lg p-0"
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
											className="size-8 rounded-lg p-0"
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
														className={cn(
															"size-8 rounded-lg p-0 text-xs",
															p === page && "shadow-sm",
														)}
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
											className="size-8 rounded-lg p-0"
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
											className="size-8 rounded-lg p-0"
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
										<div className="ml-2 flex items-center gap-1.5 border-border/60 border-l pl-2">
											<Select
												value={String(pageSize)}
												onValueChange={(v) => {
													setPageSize(Number(v));
													setPage(1);
												}}
											>
												<SelectTrigger className="h-8 w-16 rounded-lg px-2 text-xs">
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
												/ page
											</span>
										</div>
										</div>
									</div>
								)}
							</div>
							<div className={viewMode === "kanban" ? "p-4" : "hidden"}>
								{leadsPending ? (
									<div className="flex items-center justify-center py-12">
										<RiLoader4Line className="size-8 animate-spin text-primary" />
									</div>
								) : kanbanLeads.length === 0 ? (
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
									<KanbanPipelineBoard
										leads={kanbanLeads}
										onViewLead={(lead) => setViewLead(lead)}
										onRefresh={handleRefresh}
									/>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

			{/* Dialogs & Sheets */}
			<LeadDetailSheet
				lead={viewLead}
				open={!!viewLead}
				onClose={() => setViewLead(null)}
				agents={agents}
				onRefresh={handleRefresh}
				onEditLead={(lead) => {
					setEditLead(lead);
				}}
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
			<BulkEditDialog
				selectedIds={Array.from(selectedIds)}
				open={isBulkEditOpen}
				onClose={() => setIsBulkEditOpen(false)}
				agents={agents}
				onSuccess={() => {
					handleRefresh();
					setSelectedIds(new Set());
				}}
			/>
			<BulkDeleteDialog
				selectedIds={Array.from(selectedIds)}
				open={isBulkDeleteOpen}
				onClose={() => setIsBulkDeleteOpen(false)}
				onSuccess={() => {
					handleRefresh();
					setSelectedIds(new Set());
				}}
			/>
			<ImportLeadsDialog
				open={isImportOpen}
				onOpenChange={setIsImportOpen}
				onImported={handleRefresh}
			/>
		</>
	);
}
