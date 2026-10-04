"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import {
	type PortalUploadEntry,
	PORTAL_MAX_FILE_BYTES,
	folderSegmentsFromRelativePath,
	formatPortalMaxSizeLabel,
	resolvePortalFileMimeType,
} from "./portal-files-utils";

function uploadErrorMessage(error: unknown): string {
	const msg =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "Upload failed";

	if (
		/Request Entity Too Large/i.test(msg) ||
		/Unexpected token ['"]?R['"]?/i.test(msg) ||
		(/not valid JSON/i.test(msg) && /Request En/i.test(msg))
	) {
		return "Upload rejected: file payload is too large for the API proxy. Please retry (direct upload is used automatically).";
	}

	if (/maximum size|exceeds|too large|Payload Too Large|413/i.test(msg)) {
		return `File too large. Maximum is ${formatPortalMaxSizeLabel()} per file. Also check Supabase Storage global file size limit is ≥ 2GB.`;
	}

	return msg;
}

function toEntries(files: FileList | File[] | PortalUploadEntry[]): PortalUploadEntry[] {
	const list = Array.from(files as ArrayLike<File | PortalUploadEntry>);
	return list.map((item) => {
		if (item && typeof item === "object" && "file" in item && item.file instanceof File) {
			return item;
		}
		const file = item as File;
		const relativePath =
			(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
			file.name;
		return { file, relativePath };
	});
}

/** Recursively collect files from a dropped directory entry. */
async function walkDirectoryEntry(
	entry: FileSystemDirectoryEntry,
	pathPrefix: string,
	out: PortalUploadEntry[],
): Promise<void> {
	const reader = entry.createReader();
	const readBatch = (): Promise<FileSystemEntry[]> =>
		new Promise((resolve, reject) => {
			reader.readEntries(resolve, reject);
		});

	let batch = await readBatch();
	while (batch.length > 0) {
		for (const child of batch) {
			const childPath = pathPrefix
				? `${pathPrefix}/${child.name}`
				: child.name;
			if (child.isFile) {
				const file = await new Promise<File>((resolve, reject) => {
					(child as FileSystemFileEntry).file(resolve, reject);
				});
				out.push({ file, relativePath: childPath });
			} else if (child.isDirectory) {
				await walkDirectoryEntry(
					child as FileSystemDirectoryEntry,
					childPath,
					out,
				);
			}
		}
		batch = await readBatch();
	}
}

export async function collectEntriesFromDataTransfer(
	dataTransfer: DataTransfer,
): Promise<PortalUploadEntry[]> {
	const items = Array.from(dataTransfer.items ?? []);
	const out: PortalUploadEntry[] = [];

	if (items.length > 0 && typeof items[0]?.webkitGetAsEntry === "function") {
		for (const item of items) {
			if (item.kind !== "file") continue;
			const entry = item.webkitGetAsEntry?.();
			if (!entry) continue;
			if (entry.isFile) {
				const file = item.getAsFile();
				if (file) out.push({ file, relativePath: file.name });
			} else if (entry.isDirectory) {
				await walkDirectoryEntry(
					entry as FileSystemDirectoryEntry,
					entry.name,
					out,
				);
			}
		}
		if (out.length > 0) return out;
	}

	return toEntries(dataTransfer.files);
}

export function usePortalFileUpload(opts: {
	ownerUserId?: string;
	folderId?: string | null;
	onComplete?: () => void;
	disabled?: boolean;
}) {
	const utils = trpc.useUtils();
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState<Record<string, number>>({});

	const sessionMutation = trpc.portalFiles.createUploadSession.useMutation();
	const completeMutation = trpc.portalFiles.completeUpload.useMutation();
	const ensureFolderPath = trpc.portalFiles.ensureFolderPath.useMutation();

	const invalidate = useCallback(async () => {
		await utils.portalFiles.listFiles.invalidate();
		await utils.portalFiles.listFolders.invalidate();
		await utils.portalFiles.getStorageUsage.invalidate();
		opts.onComplete?.();
	}, [utils, opts.onComplete]);

	const uploadEntry = useCallback(
		async (entry: PortalUploadEntry, targetFolderId: string | null) => {
			const { file, relativePath } = entry;
			const label = relativePath || file.name;

			if (file.size > PORTAL_MAX_FILE_BYTES) {
				toast.error(
					`${file.name}: exceeds ${formatPortalMaxSizeLabel()} limit`,
				);
				return false;
			}

			setProgress((p) => ({ ...p, [label]: 10 }));

			try {
				const segments = folderSegmentsFromRelativePath(relativePath);
				let folderId = targetFolderId;

				if (segments.length > 0) {
					const ensured = await ensureFolderPath.mutateAsync({
						ownerUserId: opts.ownerUserId,
						parentFolderId: targetFolderId,
						segments,
					});
					folderId = ensured.folderId;
				}

				const fileType = resolvePortalFileMimeType(file);
				const session = await sessionMutation.mutateAsync({
					ownerUserId: opts.ownerUserId,
					folderId: folderId ?? null,
					fileName: file.name,
					fileType,
					fileSize: file.size,
				});
				setProgress((p) => ({ ...p, [label]: 30 }));

				const res = await fetch(session.signedUrl, {
					method: "PUT",
					body: file,
					headers: {
						"Content-Type": fileType,
					},
				});
				if (!res.ok) {
					const detail = await res.text().catch(() => "");
					throw new Error(
						detail
							? `Direct upload failed (${res.status}): ${detail.slice(0, 120)}`
							: `Direct upload failed (${res.status})`,
					);
				}
				setProgress((p) => ({ ...p, [label]: 85 }));
				await completeMutation.mutateAsync({ fileId: session.fileId });
				setProgress((p) => ({ ...p, [label]: 100 }));
				return true;
			} catch (e) {
				toast.error(`${file.name}: ${uploadErrorMessage(e)}`);
				return false;
			} finally {
				setTimeout(() => {
					setProgress((p) => {
						const next = { ...p };
						delete next[label];
						return next;
					});
				}, 800);
			}
		},
		[
			completeMutation,
			ensureFolderPath,
			opts.ownerUserId,
			sessionMutation,
		],
	);

	const uploadFiles = useCallback(
		async (files: FileList | File[] | PortalUploadEntry[]) => {
			if (opts.disabled) {
				toast.error("You do not have permission to upload files");
				return;
			}

			const entries = toEntries(files);
			if (entries.length === 0) return;

			setUploading(true);
			let ok = 0;
			let fail = 0;

			try {
				for (const entry of entries) {
					const success = await uploadEntry(entry, opts.folderId ?? null);
					if (success) ok += 1;
					else fail += 1;
				}

				if (ok > 0) {
					toast.success(
						ok === 1
							? "1 file uploaded"
							: `${ok} files uploaded${fail > 0 ? ` (${fail} failed)` : ""}`,
					);
					await invalidate();
				}
			} finally {
				setUploading(false);
			}
		},
		[invalidate, opts.disabled, opts.folderId, uploadEntry],
	);

	return { uploadFiles, uploading, progress };
}
