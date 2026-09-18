"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { resolvePortalFileMimeType } from "./portal-files-utils";

const PORTAL_MAX_FILE_BYTES = 100 * 1024 * 1024;

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

	return msg;
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
			if (file.size > PORTAL_MAX_FILE_BYTES) {
				toast.error("File exceeds 100MB limit");
				return;
			}

			setUploading(true);
			setProgress((p) => ({ ...p, [file.name]: 10 }));

			try {
				// Always use signed direct upload — never send file bytes through
				// /api/trpc (Vercel/proxy body limits return plain-text 413).
				const fileType = resolvePortalFileMimeType(file);
				const session = await sessionMutation.mutateAsync({
					ownerUserId: opts.ownerUserId,
					folderId: opts.folderId ?? null,
					fileName: file.name,
					fileType,
					fileSize: file.size,
				});
				setProgress((p) => ({ ...p, [file.name]: 30 }));

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
				setProgress((p) => ({ ...p, [file.name]: 85 }));
				await completeMutation.mutateAsync({ fileId: session.fileId });

				setProgress((p) => ({ ...p, [file.name]: 100 }));
				toast.success(`${file.name} uploaded`);
				await invalidate();
			} catch (e) {
				toast.error(uploadErrorMessage(e));
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
