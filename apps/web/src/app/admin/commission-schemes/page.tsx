"use client";

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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
	RiAddLine,
	RiCheckboxMultipleLine,
	RiDashboardLine,
	RiDeleteBinLine,
	RiEditLine,
	RiFileList3Line,
	RiFileCopyLine,
	RiSearchLine,
	RiSettings3Line,
} from "@remixicon/react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { BulkUpdateDialog } from "./_components/bulk-update-dialog";
import { SchemeFormDialog } from "./_components/scheme-form-dialog";
import { SchemeTiersRow } from "./_components/scheme-tiers-row";

export default function CommissionSchemesAdminPage() {
	const { data: session } = authClient.useSession();

	const [search, setSearch] = useState("");
	const [projectFilter, setProjectFilter] = useState("__all__");
	const [includeInactive, setIncludeInactive] = useState(false);
	const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isBulkOpen, setIsBulkOpen] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);

	const { data: projects } = trpc.commissionSchemes.listProjects.useQuery(
		undefined,
		{ enabled: !!session, staleTime: 60_000 },
	);

	const listQuery = trpc.commissionSchemes.list.useQuery(
		{
			search: search.trim() || undefined,
			projectName: projectFilter === "__all__" ? undefined : projectFilter,
			includeInactive,
			limit: 200,
			offset: 0,
		},
		{ enabled: !!session, staleTime: 10_000 },
	);

	const schemes = listQuery.data?.schemes ?? [];
	const projectOptions = projects ?? [];

	const deleteMutation = trpc.commissionSchemes.delete.useMutation({
		onSuccess: () => {
			toast.success("Scheme deleted");
			void listQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const duplicateMutation = trpc.commissionSchemes.duplicate.useMutation({
		onSuccess: () => {
			toast.success("Scheme duplicated (saved as inactive)");
			void listQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const expanded = useMemo(() => new Set([selectedSchemeId].filter(Boolean) as string[]), [selectedSchemeId]);
	const allSelected = schemes.length > 0 && schemes.every((s) => selectedIds.has(s.id));
	const toggleSelectAll = () => {
		if (allSelected) setSelectedIds(new Set());
		else setSelectedIds(new Set(schemes.map((s) => s.id)));
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
				<header className="flex h-16 shrink-0 items-center gap-2 border-b">
					<div className="flex flex-1 items-center gap-2 px-3">
						<SidebarTrigger className="-ms-4" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/admin">
										<RiDashboardLine size={22} aria-hidden="true" />
										<span className="sr-only">Admin Dashboard</span>
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem className="hidden md:block">
									<BreadcrumbLink href="/admin/commission-settings" className="flex items-center gap-1">
										<RiSettings3Line size={16} />
										Commission Settings
									</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator className="hidden md:block" />
								<BreadcrumbItem>
									<BreadcrumbPage className="flex items-center gap-2">
										<RiFileList3Line size={20} aria-hidden="true" />
										Primary Market Schemes
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
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="font-bold text-2xl tracking-tight">Primary Market Schemes</h1>
							<p className="text-muted-foreground text-sm">
								Agent receives 100% of announced commission; uplines receive override % from scheme tiers.
							</p>
						</div>
						<Button className="h-9" onClick={() => setIsCreateOpen(true)}>
							<RiAddLine className="mr-1.5 size-4" />
							New Scheme
						</Button>
					</div>

					<Card className="overflow-hidden">
						<div className="flex flex-col gap-2 border-b px-4 py-3">
							<div className="flex flex-wrap items-center gap-2">
								<div className="relative min-w-[220px] flex-1">
									<RiSearchLine className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
									<Input
										placeholder="Search scheme name or project…"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										className="h-9 pl-9 text-sm"
									/>
								</div>
								<div className="hidden h-6 w-px bg-border sm:block" />
								<Select value={projectFilter} onValueChange={setProjectFilter}>
									<SelectTrigger className="h-9 w-[220px] text-xs">
										<SelectValue placeholder="Project" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__all__">All projects</SelectItem>
										{projectOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									variant={includeInactive ? "default" : "outline"}
									size="sm"
									className="h-9"
									onClick={() => setIncludeInactive((v) => !v)}
								>
									{includeInactive ? "Including inactive" : "Active only"}
								</Button>
								{selectedIds.size > 0 ? (
									<>
										<div className="hidden h-6 w-px bg-border sm:block" />
										<Button
											variant="outline"
											size="sm"
											className="h-9"
											onClick={() => setIsBulkOpen(true)}
										>
											<RiCheckboxMultipleLine className="mr-1.5 size-4" />
											Bulk update ({selectedIds.size})
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-9"
											onClick={() => setSelectedIds(new Set())}
										>
											Clear
										</Button>
									</>
								) : null}
							</div>
						</div>

						<CardContent className="p-0">
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead className="border-b bg-muted/30 text-muted-foreground text-xs">
										<tr>
											<th className="px-4 py-3 text-left w-10">
												<input
													type="checkbox"
													checked={allSelected}
													onChange={toggleSelectAll}
													className="cursor-pointer rounded"
												/>
											</th>
											<th className="px-4 py-3 text-left">Scheme</th>
											<th className="px-4 py-3 text-left">Shortform</th>
											<th className="px-4 py-3 text-left">Project</th>
											<th className="px-4 py-3 text-left">Description</th>
											<th className="px-4 py-3 text-left">SST</th>
											<th className="px-4 py-3 text-left">Updated</th>
											<th className="px-4 py-3 text-center">Actions</th>
										</tr>
									</thead>
									<tbody>
										{schemes.map((s) => (
											<Fragment key={s.id}>
												<tr
													className="border-b hover:bg-muted/30 cursor-pointer"
													onClick={() =>
														setSelectedSchemeId((cur) => (cur === s.id ? null : s.id))
													}
												>
													<td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
														<input
															type="checkbox"
															checked={selectedIds.has(s.id)}
															onChange={() => toggleSelect(s.id)}
															className="cursor-pointer rounded"
														/>
													</td>
													<td className="px-4 py-3">
														<div className="font-medium">{s.schemeName}</div>
														<div className="text-muted-foreground text-xs">
															{s.blockListingTitle ? `Block: ${s.blockListingTitle}` : "No block linked"}
															{" · "}
															{s.isActive ? "Active" : "Inactive"}
														</div>
													</td>
													<td className="px-4 py-3 font-mono text-xs">{s.shortform}</td>
													<td className="px-4 py-3">{s.projectName}</td>
													<td className="px-4 py-3">{s.description}</td>
													<td className="px-4 py-3 text-xs">
														{s.incSst ? "Inc SST" : "Exc SST"} · {s.sstPercent}% ·{" "}
														{s.sstBorneBy === "client" ? "Client" : "Agent"}
													</td>
													<td className="px-4 py-3 text-xs text-muted-foreground">
														{new Date(s.updatedAt).toLocaleDateString()}
													</td>
													<td className="px-4 py-3">
														<div className="flex items-center justify-center gap-1">
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0"
																onClick={(e) => {
																	e.stopPropagation();
																	setEditId(s.id);
																}}
																title="Edit"
															>
																<RiEditLine size={14} />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0"
																onClick={(e) => {
																	e.stopPropagation();
																	duplicateMutation.mutate({ id: s.id });
																}}
																title="Duplicate"
															>
																<RiFileCopyLine size={14} />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-7 w-7 p-0 text-destructive"
																onClick={(e) => {
																	e.stopPropagation();
																	deleteMutation.mutate({ id: s.id });
																}}
																title="Delete"
															>
																<RiDeleteBinLine size={14} />
															</Button>
														</div>
													</td>
												</tr>
												{expanded.has(s.id) ? (
													<tr className="border-b bg-muted/10">
														<td colSpan={8} className="px-4 py-3">
															<SchemeTiersRow tiers={s.tiers} />
														</td>
													</tr>
												) : null}
											</Fragment>
										))}
										{schemes.length === 0 ? (
											<tr>
												<td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
													No schemes found.
												</td>
											</tr>
										) : null}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>
				</div>

				<BulkUpdateDialog
					ids={Array.from(selectedIds)}
					open={isBulkOpen}
					onOpenChange={setIsBulkOpen}
					onUpdated={() => {
						setSelectedIds(new Set());
						void listQuery.refetch();
					}}
				/>
				<SchemeFormDialog
					open={isCreateOpen}
					onOpenChange={setIsCreateOpen}
					mode="create"
					schemeId={null}
					onSaved={() => void listQuery.refetch()}
				/>
				<SchemeFormDialog
					open={!!editId}
					onOpenChange={(v) => !v && setEditId(null)}
					mode="edit"
					schemeId={editId}
					onSaved={() => void listQuery.refetch()}
				/>
		</>
	);
}

