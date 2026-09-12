"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/table";
import {
	FolderGridSkeleton,
	FilesTableSkeleton,
	StorageUsageSkeleton,
} from "@/components/loading-skeletons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeDMY } from "@/lib/date-format";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import {
	RiArrowLeftSLine,
	RiDeleteBinLine,
	RiDownloadLine,
	RiDriveLine,
	RiEditLine,
	RiEyeLine,
	RiFolderAddLine,
	RiFolderLine,
	RiFolderTransferLine,
	RiGridLine,
	RiListCheck2,
	RiRefreshLine,
	RiUploadCloud2Line,
} from "@remixicon/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	type DriveSortBy,
	type DriveSortOrder,
	type DriveSpace,
	type DriveViewMode,
	PORTAL_SHARED_OWNER_SELECT_VALUE,
	fileIconClass,
	formatFileSize,
	getFileTypeIcon,
	isPreviewableType,
} from "./portal-files-utils";
import { usePortalFileUpload } from "./use-portal-file-upload";

export { PORTAL_SHARED_OWNER_SELECT_VALUE };

export type PortalFilesMode = "agent" | "admin";

export function PortalFilesBrowser({ mode }: { mode: PortalFilesMode }) {
	const isAdminMode = mode === "admin";
	const { data: session } = authClient.useSession();
	const myUserId = session?.user?.id;

	const [space, setSpace] = useState<DriveSpace>("company");
	const [agentId, setAgentId] = useState<string>("");
	const [folderId, setFolderId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [viewMode, setViewMode] = useState<DriveViewMode>("list");
	const [sortBy, setSortBy] = useState<DriveSortBy>("date");
	const [sortOrder, setSortOrder] = useState<DriveSortOrder>("desc");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [renameTarget, setRenameTarget] = useState<
		| { type: "file"; id: string; name: string }
		| { type: "folder"; id: string; name: string }
		| null
	>(null);
	const [renameValue, setRenameValue] = useState("");
	const [moveTarget, setMoveTarget] = useState<
		| { type: "file"; id: string; name: string }
		| { type: "folder"; id: string; name: string }
		| null
	>(null);
	const [moveDestFolderId, setMoveDestFolderId] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewMeta, setPreviewMeta] = useState<{
		fileName: string;
		fileType: string;
	} | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<
		| { type: "file"; id: string; name: string }
		| { type: "folder"; id: string; name: string }
		| { type: "bulk"; ids: string[]; count: number }
		| null
	>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: capabilities } = trpc.portalFiles.getCapabilities.useQuery();
	const canUpload = capabilities?.canUpload ?? isAdminMode;
	const canDownload = capabilities?.canDownload ?? isAdminMode;
	const canManage = capabilities?.canManage ?? isAdminMode;
	const canView = capabilities?.canView ?? true;

	const effectiveOwner = useMemo(() => {
		if (space === "company") return PORTAL_SHARED_OWNER_SELECT_VALUE;
		if (space === "mine") return myUserId;
		if (space === "agent" && agentId) return agentId;
		return PORTAL_SHARED_OWNER_SELECT_VALUE;
	}, [space, myUserId, agentId]);

	const queriesEnabled =
		space !== "agent" || Boolean(agentId) || !isAdminMode;

	const usageQuery = trpc.portalFiles.getStorageUsage.useQuery(
		{ ownerUserId: effectiveOwner },
		{ enabled: canUpload && queriesEnabled && Boolean(effectiveOwner) },
	);

	const foldersQuery = trpc.portalFiles.listFolders.useQuery(
		{
			ownerUserId: effectiveOwner,
			parentFolderId: folderId,
		},
		{ enabled: queriesEnabled && Boolean(effectiveOwner) },
	);

	const filesQuery = trpc.portalFiles.listFiles.useQuery(
		{
			ownerUserId: effectiveOwner,
			folderId,
			search: search.trim() || undefined,
			sortBy,
			sortOrder,
		},
		{ enabled: queriesEnabled && Boolean(effectiveOwner) },
	);

	const pathQuery = trpc.portalFiles.getFolderPath.useQuery(
		{ folderId: folderId! },
		{ enabled: Boolean(folderId) },
	);

	const moveFoldersQuery = trpc.portalFiles.listFoldersForMove.useQuery(
		{
			ownerUserId: effectiveOwner,
			parentFolderId: null,
			excludeFolderId:
				moveTarget?.type === "folder" ? moveTarget.id : undefined,
		},
		{ enabled: canManage && moveTarget !== null && Boolean(effectiveOwner) },
	);

	const agentsQuery = trpc.agents.list.useQuery(
		{ limit: 100, offset: 0, sortBy: "name", sortOrder: "asc" },
		{ enabled: isAdminMode },
	);

	const utils = trpc.useUtils();

	const createFolder = trpc.portalFiles.createFolder.useMutation({
		onSuccess: () => {
			toast.success("Folder created");
			setNewFolderOpen(false);
			setNewFolderName("");
			void foldersQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const deleteFile = trpc.portalFiles.deleteFile.useMutation({
		onSuccess: () => {
			toast.success("File deleted");
			setSelectedIds(new Set());
			void filesQuery.refetch();
			void usageQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const deleteFilesBulk = trpc.portalFiles.deleteFilesBulk.useMutation({
		onSuccess: (res) => {
			toast.success(`Deleted ${res.deleted} file(s)`);
			setSelectedIds(new Set());
			void filesQuery.refetch();
			void usageQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const deleteFolder = trpc.portalFiles.deleteFolder.useMutation({
		onSuccess: () => {
			toast.success("Folder deleted");
			void foldersQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const renameFile = trpc.portalFiles.renameFile.useMutation({
		onSuccess: () => {
			toast.success("File renamed");
			setRenameTarget(null);
			void filesQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const renameFolder = trpc.portalFiles.renameFolder.useMutation({
		onSuccess: () => {
			toast.success("Folder renamed");
			setRenameTarget(null);
			void foldersQuery.refetch();
			void pathQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const moveFile = trpc.portalFiles.moveFile.useMutation({
		onSuccess: () => {
			toast.success("File moved");
			setMoveTarget(null);
			void filesQuery.refetch();
			void foldersQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const moveFolder = trpc.portalFiles.moveFolder.useMutation({
		onSuccess: () => {
			toast.success("Folder moved");
			setMoveTarget(null);
			void foldersQuery.refetch();
		},
		onError: (e) => toast.error(e.message),
	});

	const getDownloadUrl = useCallback(
		async (fileId: string) => utils.portalFiles.getDownloadUrl.fetch({ fileId }),
		[utils],
	);
	const getViewUrl = useCallback(
		async (fileId: string) => utils.portalFiles.getViewUrl.fetch({ fileId }),
		[utils],
	);

	const handleDownload = useCallback(
		async (fileId: string) => {
			try {
				const { url, fileName } = await getDownloadUrl(fileId);
				const a = document.createElement("a");
				a.href = url;
				a.download = fileName;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
				a.click();
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Download failed");
			}
		},
		[getDownloadUrl],
	);

	const { uploadFiles, uploading, progress } = usePortalFileUpload({
		ownerUserId: effectiveOwner,
		folderId,
		onComplete: () => {
			void filesQuery.refetch();
			void usageQuery.refetch();
		},
		disabled: !canUpload,
	});

	const handlePreview = useCallback(
		async (fileId: string, fileName: string, fileType: string) => {
			try {
				const { url } = await getViewUrl(fileId);
				setPreviewUrl(url);
				setPreviewMeta({ fileName, fileType });
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Preview failed");
			}
		},
		[getViewUrl],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (!canUpload) return;
			if (e.dataTransfer.files?.length) {
				void uploadFiles(e.dataTransfer.files);
			}
		},
		[canUpload, uploadFiles],
	);

	const switchSpace = (next: DriveSpace) => {
		setSpace(next);
		setFolderId(null);
		setSelectedIds(new Set());
		setSearch("");
	};

	const openFolder = (id: string) => {
		setFolderId(id);
		setSelectedIds(new Set());
	};

	const goToBreadcrumb = (id: string | null) => {
		setFolderId(id);
		setSelectedIds(new Set());
	};

	const handleConfirmDelete = () => {
		if (!deleteTarget) return;
		if (deleteTarget.type === "file") {
			deleteFile.mutate(
				{ fileId: deleteTarget.id },
				{ onSettled: () => setDeleteTarget(null) },
			);
		} else if (deleteTarget.type === "folder") {
			deleteFolder.mutate(
				{ folderId: deleteTarget.id, ownerUserId: effectiveOwner },
				{ onSettled: () => setDeleteTarget(null) },
			);
		} else {
			deleteFilesBulk.mutate(
				{ fileIds: deleteTarget.ids },
				{ onSettled: () => setDeleteTarget(null) },
			);
		}
	};

	const isDeleting =
		deleteFile.isPending ||
		deleteFolder.isPending ||
		deleteFilesBulk.isPending;

	const folders = foldersQuery.data ?? [];
	const files = filesQuery.data ?? [];
	const isContentLoading = foldersQuery.isLoading || filesQuery.isLoading;
	const isUsageLoading = canUpload && usageQuery.isLoading;
	const usage = usageQuery.data;
	const agents = agentsQuery.data?.agents ?? [];
	const trail = pathQuery.data?.trail ?? [];
	const moveFolderOptions = moveFoldersQuery.data ?? [];

	const allSelected =
		files.length > 0 && files.every((f) => selectedIds.has(f.id));

	const toggleSelectAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(files.map((f) => f.id)));
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const spaceLabel =
		space === "company"
			? "Company"
			: space === "mine"
				? "My files"
				: "Agent folder";

	const emptyMessage = canUpload
		? "This folder is empty. Upload files or create a folder."
		: "No files here yet. Ask an admin to upload documents.";

	return (
		<div className="space-y-4">
			{/* Space tabs */}
			<div className="flex flex-wrap items-center gap-3">
				<Tabs
					value={space === "agent" ? "agent" : space}
					onValueChange={(v) => {
						if (v === "company" || v === "mine") switchSpace(v);
						if (v === "agent" && isAdminMode) switchSpace("agent");
					}}
				>
					<TabsList>
						<TabsTrigger value="company" className="gap-1.5">
							<RiDriveLine className="size-3.5" />
							Company
						</TabsTrigger>
						<TabsTrigger value="mine" className="gap-1.5">
							My files
						</TabsTrigger>
						{isAdminMode ? (
							<TabsTrigger value="agent" className="gap-1.5">
								Agent folder
							</TabsTrigger>
						) : null}
					</TabsList>
				</Tabs>

				{isAdminMode && space === "agent" ? (
					<Select
						value={agentId || undefined}
						onValueChange={(v) => {
							setAgentId(v);
							setFolderId(null);
							setSelectedIds(new Set());
						}}
					>
						<SelectTrigger className="w-[220px]">
							<SelectValue placeholder="Select agent" />
						</SelectTrigger>
						<SelectContent>
							{agents.map((row) => (
								<SelectItem key={row.agent.id} value={row.agent.id}>
									{row.agent.name ?? row.agent.email ?? row.agent.id}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}

				{!isAdminMode ? (
					<p className="text-muted-foreground text-xs sm:ml-auto">
						View only — contact admin to download files
					</p>
				) : null}
			</div>

			{isUsageLoading ? (
				<StorageUsageSkeleton />
			) : usage && canUpload ? (
				<div className="space-y-1.5">
					<div className="flex justify-between text-muted-foreground text-sm">
						<span>Storage used</span>
						<span>
							{formatFileSize(usage.usedBytes)} /{" "}
							{formatFileSize(usage.quotaBytes)}
						</span>
					</div>
					<Progress value={usage.usedPercent} className="h-2" />
				</div>
			) : null}

			{/* Breadcrumb path */}
			<nav className="flex flex-wrap items-center gap-1 text-sm">
				<button
					type="button"
					className={cn(
						"rounded px-1.5 py-0.5 font-medium hover:bg-muted",
						!folderId ? "text-foreground" : "text-muted-foreground",
					)}
					onClick={() => goToBreadcrumb(null)}
				>
					{spaceLabel}
				</button>
				{trail.map((crumb) => (
					<span key={crumb.id} className="flex items-center gap-1">
						<span className="text-muted-foreground">/</span>
						<button
							type="button"
							className={cn(
								"rounded px-1.5 py-0.5 hover:bg-muted",
								crumb.id === folderId
									? "font-medium text-foreground"
									: "text-muted-foreground",
							)}
							onClick={() => goToBreadcrumb(crumb.id)}
						>
							{crumb.name}
						</button>
					</span>
				))}
			</nav>

			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-2">
				{canUpload ? (
					<>
						<Button
							type="button"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading || (space === "agent" && !agentId)}
						>
							<RiUploadCloud2Line className="mr-1.5 size-4" />
							Upload
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => setNewFolderOpen(true)}
							disabled={space === "agent" && !agentId}
						>
							<RiFolderAddLine className="mr-1.5 size-4" />
							New folder
						</Button>
					</>
				) : null}

				{canManage && selectedIds.size > 0 ? (
					<Button
						type="button"
						size="sm"
						variant="destructive"
						onClick={() =>
							setDeleteTarget({
								type: "bulk",
								ids: [...selectedIds],
								count: selectedIds.size,
							})
						}
					>
						<RiDeleteBinLine className="mr-1.5 size-4" />
						Delete ({selectedIds.size})
					</Button>
				) : null}

				{folderId ? (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => {
							const parent =
								trail.length > 1 ? trail[trail.length - 2]?.id ?? null : null;
							goToBreadcrumb(parent);
						}}
					>
						<RiArrowLeftSLine className="mr-1 size-4" />
						Up
					</Button>
				) : null}

				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => {
						void foldersQuery.refetch();
						void filesQuery.refetch();
						void usageQuery.refetch();
					}}
				>
					<RiRefreshLine className="mr-1.5 size-4" />
					Refresh
				</Button>

				<div className="ml-auto flex flex-wrap items-center gap-2">
					<Select
						value={`${sortBy}-${sortOrder}`}
						onValueChange={(v) => {
							const [by, order] = v.split("-") as [DriveSortBy, DriveSortOrder];
							setSortBy(by);
							setSortOrder(order);
						}}
					>
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="date-desc">Newest</SelectItem>
							<SelectItem value="date-asc">Oldest</SelectItem>
							<SelectItem value="name-asc">Name A–Z</SelectItem>
							<SelectItem value="name-desc">Name Z–A</SelectItem>
							<SelectItem value="size-desc">Largest</SelectItem>
							<SelectItem value="size-asc">Smallest</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex rounded-md border">
						<Button
							type="button"
							size="sm"
							variant={viewMode === "list" ? "secondary" : "ghost"}
							className="h-9 rounded-r-none px-2"
							onClick={() => setViewMode("list")}
							title="List view"
						>
							<RiListCheck2 className="size-4" />
						</Button>
						<Button
							type="button"
							size="sm"
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							className="h-9 rounded-l-none px-2"
							onClick={() => setViewMode("grid")}
							title="Grid view"
						>
							<RiGridLine className="size-4" />
						</Button>
					</div>

					<Input
						placeholder="Search files…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-9 w-[180px] sm:w-[220px]"
					/>
				</div>
			</div>

			{canUpload ? (
				<input
					ref={fileInputRef}
					type="file"
					multiple
					className="hidden"
					accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm"
					onChange={(e) => {
						if (e.target.files?.length) {
							void uploadFiles(e.target.files);
							e.target.value = "";
						}
					}}
				/>
			) : null}

			{canUpload ? (
				<div
					className="rounded-lg border border-dashed bg-muted/20 p-5 text-center text-muted-foreground text-sm"
					onDragOver={(e) => e.preventDefault()}
					onDrop={onDrop}
				>
					Drag and drop files here, or use Upload (PDF, Office, images, video up
					to 100MB)
				</div>
			) : null}

			{Object.keys(progress).length > 0 ? (
				<div className="space-y-2">
					{Object.entries(progress).map(([name, pct]) => (
						<div key={name} className="space-y-1">
							<p className="truncate text-sm">{name}</p>
							<Progress value={pct} className="h-1.5" />
						</div>
					))}
				</div>
			) : null}

			{isAdminMode && space === "agent" && !agentId ? (
				<p className="rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
					Select an agent to browse or manage their folder.
				</p>
			) : isContentLoading ? (
				<div className="space-y-4">
					<FolderGridSkeleton count={4} />
					<FilesTableSkeleton rows={6} />
				</div>
			) : (
				<>
					{/* Folders */}
					{folders.length > 0 ? (
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
							{folders.map((folder) => (
								<div
									key={folder.id}
									className="group flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
								>
									<button
										type="button"
										className="flex min-w-0 flex-1 items-center gap-2 text-left"
										onClick={() => openFolder(folder.id)}
									>
										<RiFolderLine className="size-6 shrink-0 text-amber-500" />
										<span className="truncate font-medium text-sm">
											{folder.name}
										</span>
									</button>
									{canManage ? (
										<div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												title="Rename"
												onClick={() => {
													setRenameTarget({
														type: "folder",
														id: folder.id,
														name: folder.name,
													});
													setRenameValue(folder.name);
												}}
											>
												<RiEditLine className="size-4" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												title="Move"
												onClick={() => {
													setMoveTarget({
														type: "folder",
														id: folder.id,
														name: folder.name,
													});
													setMoveDestFolderId(null);
												}}
											>
												<RiFolderTransferLine className="size-4" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-destructive"
												title="Delete"
												onClick={() =>
													setDeleteTarget({
														type: "folder",
														id: folder.id,
														name: folder.name,
													})
												}
											>
												<RiDeleteBinLine className="size-4" />
											</Button>
										</div>
									) : null}
								</div>
							))}
						</div>
					) : null}

					{/* Files — list */}
					{viewMode === "list" ? (
						<div className="overflow-hidden rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										{canManage ? (
											<TableHead className="w-10">
												<Checkbox
													checked={allSelected}
													onCheckedChange={toggleSelectAll}
													aria-label="Select all"
												/>
											</TableHead>
										) : null}
										<TableHead>Name</TableHead>
										<TableHead>Size</TableHead>
										<TableHead>Uploaded</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{files.map((file) => {
										const Icon = getFileTypeIcon(file.fileType, file.fileName);
										return (
											<TableRow key={file.id}>
												{canManage ? (
													<TableCell>
														<Checkbox
															checked={selectedIds.has(file.id)}
															onCheckedChange={() => toggleSelect(file.id)}
															aria-label={`Select ${file.fileName}`}
														/>
													</TableCell>
												) : null}
												<TableCell>
													<div className="flex min-w-0 items-center gap-2">
														<Icon
															className={cn(
																"size-5 shrink-0",
																fileIconClass(file.fileType, file.fileName),
															)}
														/>
														<span className="truncate font-medium">
															{file.fileName}
														</span>
													</div>
												</TableCell>
												<TableCell className="tabular-nums text-muted-foreground">
													{formatFileSize(file.fileSize)}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatDateTimeDMY(file.createdAt)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-0.5">
														{canView ? (
															<Button
																type="button"
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0"
																title={
																	isPreviewableType(file.fileType)
																		? "Preview"
																		: "View"
																}
																onClick={() =>
																	void handlePreview(
																		file.id,
																		file.fileName,
																		file.fileType,
																	)
																}
															>
																<RiEyeLine className="size-4" />
															</Button>
														) : null}
														{canDownload ? (
															<Button
																type="button"
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0"
																title="Download"
																onClick={() => void handleDownload(file.id)}
															>
																<RiDownloadLine className="size-4" />
															</Button>
														) : null}
														{canManage ? (
															<>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0"
																	title="Rename"
																	onClick={() => {
																		setRenameTarget({
																			type: "file",
																			id: file.id,
																			name: file.fileName,
																		});
																		setRenameValue(file.fileName);
																	}}
																>
																	<RiEditLine className="size-4" />
																</Button>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0"
																	title="Move"
																	onClick={() => {
																		setMoveTarget({
																			type: "file",
																			id: file.id,
																			name: file.fileName,
																		});
																		setMoveDestFolderId(folderId);
																	}}
																>
																	<RiFolderTransferLine className="size-4" />
																</Button>
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0 text-destructive"
																	title="Delete"
																	onClick={() =>
																		setDeleteTarget({
																			type: "file",
																			id: file.id,
																			name: file.fileName,
																		})
																	}
																>
																	<RiDeleteBinLine className="size-4" />
																</Button>
															</>
														) : null}
													</div>
												</TableCell>
											</TableRow>
										);
									})}
									{files.length === 0 && folders.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={canManage ? 5 : 4}
												className="py-12 text-center text-muted-foreground"
											>
												{emptyMessage}
											</TableCell>
										</TableRow>
									) : null}
									{files.length === 0 && folders.length > 0 ? (
										<TableRow>
											<TableCell
												colSpan={canManage ? 5 : 4}
												className="py-6 text-center text-muted-foreground text-sm"
											>
												No files in this folder.
											</TableCell>
										</TableRow>
									) : null}
								</TableBody>
							</Table>
						</div>
					) : (
						/* Files — grid */
						<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
							{files.map((file) => {
								const Icon = getFileTypeIcon(file.fileType, file.fileName);
								return (
									<div
										key={file.id}
										className="group relative flex flex-col rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
									>
										{canManage ? (
											<div className="absolute top-2 left-2 z-10">
												<Checkbox
													checked={selectedIds.has(file.id)}
													onCheckedChange={() => toggleSelect(file.id)}
												/>
											</div>
										) : null}
										<button
											type="button"
											className="flex flex-1 flex-col items-center gap-2 pt-4 pb-2 text-center"
											onClick={() =>
												void handlePreview(
													file.id,
													file.fileName,
													file.fileType,
												)
											}
										>
											<Icon
												className={cn(
													"size-12",
													fileIconClass(file.fileType, file.fileName),
												)}
											/>
											<span className="line-clamp-2 w-full text-sm font-medium">
												{file.fileName}
											</span>
											<span className="text-muted-foreground text-xs">
												{formatFileSize(file.fileSize)}
											</span>
										</button>
										<div className="flex justify-center gap-0.5 border-t pt-2">
											{canView ? (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() =>
														void handlePreview(
															file.id,
															file.fileName,
															file.fileType,
														)
													}
												>
													<RiEyeLine className="size-4" />
												</Button>
											) : null}
											{canDownload ? (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => void handleDownload(file.id)}
												>
													<RiDownloadLine className="size-4" />
												</Button>
											) : null}
											{canManage ? (
												<>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0"
														onClick={() => {
															setRenameTarget({
																type: "file",
																id: file.id,
																name: file.fileName,
															});
															setRenameValue(file.fileName);
														}}
													>
														<RiEditLine className="size-4" />
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 text-destructive"
														onClick={() =>
															setDeleteTarget({
																type: "file",
																id: file.id,
																name: file.fileName,
															})
														}
													>
														<RiDeleteBinLine className="size-4" />
													</Button>
												</>
											) : null}
										</div>
									</div>
								);
							})}
							{files.length === 0 && folders.length === 0 ? (
								<p className="col-span-full py-12 text-center text-muted-foreground text-sm">
									{emptyMessage}
								</p>
							) : null}
						</div>
					)}
				</>
			)}

			{/* Delete dialog */}
			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent className="gap-5 sm:max-w-md">
					<AlertDialogHeader className="gap-2">
						<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/15 sm:mx-0">
							<RiDeleteBinLine
								className="size-6 text-destructive"
								aria-hidden
							/>
						</div>
						<AlertDialogTitle>
							{deleteTarget?.type === "bulk"
								? `Delete ${deleteTarget.count} files?`
								: `Delete ${deleteTarget?.type === "folder" ? "folder" : "file"}?`}
						</AlertDialogTitle>
						<AlertDialogDescription className="text-left">
							{deleteTarget?.type === "folder" ? (
								<>
									Permanently delete folder{" "}
									<span className="font-medium text-foreground">
										&ldquo;{deleteTarget.name}&rdquo;
									</span>
									. It must be empty.
								</>
							) : deleteTarget?.type === "bulk" ? (
								<>
									Permanently delete {deleteTarget.count} selected file(s). This
									cannot be undone.
								</>
							) : (
								<>
									Permanently delete{" "}
									<span className="font-medium text-foreground">
										&ldquo;{deleteTarget?.name}&rdquo;
									</span>
									. This cannot be undone.
								</>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeleting}
							onClick={(e) => {
								e.preventDefault();
								handleConfirmDelete();
							}}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* New folder */}
			<Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New folder</DialogTitle>
					</DialogHeader>
					<Input
						placeholder="Folder name"
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && newFolderName.trim()) {
								createFolder.mutate({
									name: newFolderName.trim(),
									parentFolderId: folderId,
									ownerUserId: effectiveOwner,
								});
							}
						}}
					/>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={!newFolderName.trim() || createFolder.isPending}
							onClick={() =>
								createFolder.mutate({
									name: newFolderName.trim(),
									parentFolderId: folderId,
									ownerUserId: effectiveOwner,
								})
							}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Rename */}
			<Dialog
				open={renameTarget !== null}
				onOpenChange={(open) => {
					if (!open) setRenameTarget(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Rename {renameTarget?.type === "folder" ? "folder" : "file"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label>Name</Label>
						<Input
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setRenameTarget(null)}>
							Cancel
						</Button>
						<Button
							disabled={
								!renameValue.trim() ||
								renameFile.isPending ||
								renameFolder.isPending
							}
							onClick={() => {
								if (!renameTarget) return;
								if (renameTarget.type === "file") {
									renameFile.mutate({
										fileId: renameTarget.id,
										fileName: renameValue.trim(),
									});
								} else {
									renameFolder.mutate({
										folderId: renameTarget.id,
										name: renameValue.trim(),
									});
								}
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Move */}
			<Dialog
				open={moveTarget !== null}
				onOpenChange={(open) => {
					if (!open) setMoveTarget(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Move {moveTarget?.type === "folder" ? "folder" : "file"}
						</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Moving{" "}
						<span className="font-medium text-foreground">
							{moveTarget?.name}
						</span>
					</p>
					<div className="space-y-2">
						<Label>Destination</Label>
						<Select
							value={moveDestFolderId ?? "__root__"}
							onValueChange={(v) =>
								setMoveDestFolderId(v === "__root__" ? null : v)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select folder" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__root__">
									{spaceLabel} (root)
								</SelectItem>
								{moveFolderOptions.map((f) => (
									<SelectItem key={f.id} value={f.id}>
										{f.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Shows top-level folders in this space. Nested destinations can be
							added later if needed.
						</p>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setMoveTarget(null)}>
							Cancel
						</Button>
						<Button
							disabled={moveFile.isPending || moveFolder.isPending}
							onClick={() => {
								if (!moveTarget) return;
								if (moveTarget.type === "file") {
									moveFile.mutate({
										fileId: moveTarget.id,
										folderId: moveDestFolderId,
									});
								} else {
									moveFolder.mutate({
										folderId: moveTarget.id,
										parentFolderId: moveDestFolderId,
									});
								}
							}}
						>
							Move
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Preview */}
			<Dialog
				open={!!previewUrl}
				onOpenChange={(open) => {
					if (!open) {
						setPreviewUrl(null);
						setPreviewMeta(null);
					}
				}}
			>
				<DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
					<DialogHeader>
						<DialogTitle>{previewMeta?.fileName ?? "Preview"}</DialogTitle>
					</DialogHeader>
					{previewUrl && previewMeta ? (
						<div className="flex justify-center">
							{previewMeta.fileType.startsWith("image/") ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={previewUrl}
									alt={previewMeta.fileName}
									className="max-h-[70vh] max-w-full object-contain"
								/>
							) : previewMeta.fileType.startsWith("video/") ? (
								<video
									src={previewUrl}
									controls
									className="max-h-[70vh] max-w-full"
								/>
							) : (
								<iframe
									src={previewUrl}
									title={previewMeta.fileName}
									className="h-[70vh] w-full rounded border"
								/>
							)}
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
