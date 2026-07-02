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
import { trpc } from "@/utils/trpc";
import {
	RiDeleteBinLine,
	RiDownloadLine,
	RiEyeLine,
	RiFolderAddLine,
	RiFolderLine,
	RiRefreshLine,
	RiUploadCloud2Line,
} from "@remixicon/react";
import { format } from "date-fns";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { formatFileSize, isPreviewableType } from "./portal-files-utils";
import { usePortalFileUpload } from "./use-portal-file-upload";

export const PORTAL_SHARED_OWNER_SELECT_VALUE = "__shared__";

export type PortalFilesMode = "agent" | "admin";

export function PortalFilesBrowser({ mode }: { mode: PortalFilesMode }) {
	const isAdminMode = mode === "admin";
	const [ownerUserId, setOwnerUserId] = useState<string | undefined>(undefined);
	const [folderId, setFolderId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [newFolderOpen, setNewFolderOpen] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewMeta, setPreviewMeta] = useState<{
		fileName: string;
		fileType: string;
	} | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<
		| { type: "file"; id: string; name: string }
		| { type: "folder"; id: string; name: string }
		| null
	>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: capabilities } = trpc.portalFiles.getCapabilities.useQuery();
	const canUpload = capabilities?.canUpload ?? isAdminMode;
	const canDownload = capabilities?.canDownload ?? isAdminMode;
	const canManage = capabilities?.canManage ?? isAdminMode;
	const canView = capabilities?.canView ?? true;

	const effectiveOwner =
		isAdminMode && ownerUserId === PORTAL_SHARED_OWNER_SELECT_VALUE
			? PORTAL_SHARED_OWNER_SELECT_VALUE
			: isAdminMode
				? ownerUserId
				: undefined;

	const usageQuery = trpc.portalFiles.getStorageUsage.useQuery(
		{ ownerUserId: effectiveOwner },
		{ enabled: canUpload && (!isAdminMode || !!effectiveOwner || ownerUserId === undefined) },
	);

	const foldersQuery = trpc.portalFiles.listFolders.useQuery({
		ownerUserId: effectiveOwner,
		parentFolderId: folderId,
	});

	const filesQuery = trpc.portalFiles.listFiles.useQuery({
		ownerUserId: effectiveOwner,
		folderId,
		search: search.trim() || undefined,
	});

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

	const handleConfirmDelete = () => {
		if (!deleteTarget) return;
		if (deleteTarget.type === "file") {
			deleteFile.mutate(
				{ fileId: deleteTarget.id },
				{ onSettled: () => setDeleteTarget(null) },
			);
		} else {
			deleteFolder.mutate(
				{
					folderId: deleteTarget.id,
					ownerUserId: effectiveOwner,
				},
				{ onSettled: () => setDeleteTarget(null) },
			);
		}
	};

	const isDeleting = deleteFile.isPending || deleteFolder.isPending;

	const folders = foldersQuery.data ?? [];
	const files = filesQuery.data ?? [];
	const usage = usageQuery.data;
	const agents = agentsQuery.data?.agents ?? [];

	return (
		<div className="space-y-4">
			{isAdminMode ? (
				<div className="flex flex-wrap items-end gap-3">
					<div className="min-w-[240px] flex-1 space-y-1.5">
						<Label>Manage files for</Label>
						<Select
							value={ownerUserId ?? "__me__"}
							onValueChange={(v) => {
								setOwnerUserId(
									v === "__me__" ? undefined : v,
								);
								setFolderId(null);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select location" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={PORTAL_SHARED_OWNER_SELECT_VALUE}>
									Company files (all agents)
								</SelectItem>
								<SelectItem value="__me__">My files (admin)</SelectItem>
								{agents.map((row) => (
									<SelectItem key={row.agent.id} value={row.agent.id}>
										{row.agent.name ?? row.agent.email ?? row.agent.id}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					View company and personal files shared with you. Contact an admin if you
					need a file downloaded.
				</p>
			)}

			{usage && canUpload ? (
				<div className="space-y-1.5">
					<div className="flex justify-between text-muted-foreground text-sm">
						<span>Storage used</span>
						<span>
							{formatFileSize(usage.usedBytes)} / {formatFileSize(usage.quotaBytes)}
						</span>
					</div>
					<Progress value={usage.usedPercent} className="h-2" />
				</div>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{canUpload ? (
					<>
						<Button
							type="button"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploading}
						>
							<RiUploadCloud2Line className="mr-1.5 size-4" />
							Upload
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => setNewFolderOpen(true)}
						>
							<RiFolderAddLine className="mr-1.5 size-4" />
							New folder
						</Button>
					</>
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
				{folderId ? (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => setFolderId(null)}
					>
						← Back to root
					</Button>
				) : null}
				<div className="ml-auto min-w-[200px]">
					<Input
						placeholder="Search files…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-9"
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
					className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-muted-foreground text-sm"
					onDragOver={(e) => e.preventDefault()}
					onDrop={onDrop}
				>
					Drag and drop files here, or use Upload (PDF, Office, images, video up to
					100MB)
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

			{folders.length > 0 ? (
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{folders.map((folder) => (
						<div
							key={folder.id}
							className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
						>
							<button
								type="button"
								className="flex min-w-0 flex-1 items-center gap-2 text-left"
								onClick={() => setFolderId(folder.id)}
							>
								<RiFolderLine className="size-5 shrink-0 text-primary" />
								<span className="truncate font-medium text-sm">{folder.name}</span>
								{"isShared" in folder && folder.isShared ? (
									<Badge variant="secondary" className="text-xs">
										Company
									</Badge>
								) : null}
							</button>
							{canManage ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 w-8 shrink-0 p-0 text-destructive"
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
							) : null}
						</div>
					))}
				</div>
			) : null}

			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Source</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Size</TableHead>
							<TableHead>Uploaded</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{files.map((file) => (
							<TableRow key={file.id}>
								<TableCell className="max-w-[240px] truncate font-medium">
									{file.fileName}
								</TableCell>
								<TableCell>
									{file.isShared ? (
										<Badge variant="secondary" className="text-xs">
											Company
										</Badge>
									) : (
										<Badge variant="outline" className="text-xs">
											Personal
										</Badge>
									)}
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="font-mono text-xs">
										{file.fileType.split("/").pop()}
									</Badge>
								</TableCell>
								<TableCell className="tabular-nums">
									{formatFileSize(file.fileSize)}
								</TableCell>
								<TableCell className="text-muted-foreground text-sm">
									{format(new Date(file.createdAt), "dd MMM yyyy HH:mm")}
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
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
										) : null}
									</div>
								</TableCell>
							</TableRow>
						))}
						{files.length === 0 && !foldersQuery.isLoading ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="py-10 text-center text-muted-foreground"
								>
									No files in this folder yet.
								</TableCell>
							</TableRow>
						) : null}
					</TableBody>
				</Table>
			</div>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent className="gap-5 sm:max-w-md">
					<AlertDialogHeader className="gap-2">
						<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/15 sm:mx-0">
							<RiDeleteBinLine className="size-6 text-destructive" aria-hidden />
						</div>
						<AlertDialogTitle>
							Delete {deleteTarget?.type === "folder" ? "folder" : "file"}?
						</AlertDialogTitle>
						<AlertDialogDescription className="text-left">
							{deleteTarget?.type === "folder" ? (
								<>
									This will permanently delete the folder{" "}
									<span className="font-medium text-foreground">
										&ldquo;{deleteTarget.name}&rdquo;
									</span>
									. The folder must be empty.
								</>
							) : (
								<>
									This will permanently delete{" "}
									<span className="font-medium text-foreground">
										&ldquo;{deleteTarget?.name}&rdquo;
									</span>{" "}
									from your portal drive. This action cannot be undone.
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
							className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New folder</DialogTitle>
					</DialogHeader>
					<Input
						placeholder="Folder name"
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
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
