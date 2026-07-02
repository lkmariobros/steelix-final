"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { fileToBase64, PORTAL_BASE64_MAX_BYTES } from "./portal-files-utils";

type UploadOpts = {
	ownerUserId?: string;
	folderId?: string | null;
	onComplete?: () => void;
	disabled?: boolean;
};

export function usePortalFileUpload(opts: UploadOpts) {
	const utils = trpc.useUtils();
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState<Record<string, number>>({});

	const uploadMutation = trpc.portalFiles.upload.useMutation();
	const sessionMutation = trpc.portalFiles.createUploadSession.useMutation();
	const completeMutation = trpc.portalFiles.completeUpload.useMutation();

	const invalidate = useCallback(async () => {
		await utils.portalFiles.listFiles.invalidate();
		await utils.portalFiles.getStorageUsage.invalidate();
		opts.onComplete?.();
	}, [utils, opts.onComplete]);

	const uploadFile = useCallback(
		async (file: File) => {
			if (opts.disabled) {
				toast.error("You do not have permission to upload files");
				return;
			}
			if (file.size > 100 * 1024 * 1024) {
				toast.error("File exceeds 100MB limit");
				return;
			}

			setUploading(true);
			setProgress((p) => ({ ...p, [file.name]: 10 }));

			try {
				if (file.size <= PORTAL_BASE64_MAX_BYTES) {
					setProgress((p) => ({ ...p, [file.name]: 40 }));
					const base64Data = await fileToBase64(file);
					setProgress((p) => ({ ...p, [file.name]: 70 }));
					await uploadMutation.mutateAsync({
						ownerUserId: opts.ownerUserId,
						folderId: opts.folderId ?? null,
						fileName: file.name,
						fileType: file.type || "application/octet-stream",
						fileSize: file.size,
						base64Data,
					});
				} else {
					const session = await sessionMutation.mutateAsync({
						ownerUserId: opts.ownerUserId,
						folderId: opts.folderId ?? null,
						fileName: file.name,
						fileType: file.type || "application/octet-stream",
						fileSize: file.size,
					});
					setProgress((p) => ({ ...p, [file.name]: 30 }));

					const res = await fetch(session.signedUrl, {
						method: "PUT",
						body: file,
						headers: {
							"Content-Type": file.type || "application/octet-stream",
						},
					});
					if (!res.ok) {
						throw new Error(`Direct upload failed (${res.status})`);
					}
					setProgress((p) => ({ ...p, [file.name]: 85 }));
					await completeMutation.mutateAsync({ fileId: session.fileId });
				}

				setProgress((p) => ({ ...p, [file.name]: 100 }));
				toast.success(`${file.name} uploaded`);
				await invalidate();
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Upload failed";
				toast.error(msg);
			} finally {
				setTimeout(() => {
					setProgress((p) => {
						const next = { ...p };
						delete next[file.name];
						return next;
					});
					setUploading(false);
				}, 800);
			}
		},
		[
			completeMutation,
			invalidate,
			opts.folderId,
			opts.ownerUserId,
			opts.disabled,
			sessionMutation,
			uploadMutation,
		],
	);

	const uploadFiles = useCallback(
		async (files: FileList | File[]) => {
			const list = Array.from(files);
			for (const file of list) {
				await uploadFile(file);
			}
		},
		[uploadFile],
	);

	return { uploadFiles, uploading, progress };
}
