"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DocumentListSkeleton } from "@/components/loading-skeletons";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DocumentCategory } from "@/hooks/use-document-upload";
import { formatDateTimeSecondsDMY } from "@/lib/date-format";
import { trpc } from "@/utils/trpc";
import {
	Download,
	ExternalLink,
	FileText,
	Loader2,
	Trash2,
	Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type FallbackDocument = {
	id?: string;
	name?: string;
	type?: string;
	url?: string;
	uploadedAt?: string;
	category?: string;
};

type DisplayDocument = {
	id: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	url: string;
	documentCategory: string;
	uploadedAt: string;
	needsLegacyResolve: boolean;
};

const UPLOAD_CATEGORIES: { value: DocumentCategory; label: string }[] = [
	{ value: "ic_passport", label: "IC / Passport" },
	{ value: "sales_form", label: "Sales form" },
	{ value: "booking_form", label: "Booking form" },
	{ value: "payment_proof", label: "Payment proof" },
	{ value: "spa", label: "SPA" },
	{ value: "tenancy_agreement", label: "Tenancy agreement" },
	{ value: "co_broke_letter", label: "Co-broke letter" },
	{ value: "co_agency_invoice", label: "Co-Agency Invoice" },
	{ value: "invoice", label: "Invoice" },
	{ value: "lo_draft", label: "LO Draft" },
	{ value: "lo_signed", label: "LO Signed" },
	{ value: "other", label: "Other" },
];

const UUID_RE = /^[0-9a-f-]{36}$/i;

function isImageType(fileType?: string) {
	if (!fileType) return false;
	return fileType.startsWith("image/");
}

function isPdfType(fileType?: string, fileName?: string) {
	if (fileType === "application/pdf") return true;
	return Boolean(fileName?.toLowerCase().endsWith(".pdf"));
}

function formatCategory(category?: string) {
	if (!category) return "Document";
	const known = UPLOAD_CATEGORIES.find((c) => c.value === category);
	if (known) return known.label;
	return category.replace(/_/g, " ");
}

function formatFileSize(bytes?: number) {
	if (!bytes) return null;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessMime(fileName: string) {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".pdf")) return "application/pdf";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".webp")) return "image/webp";
	return "";
}

function DocumentViewerBody({
	transactionId,
	doc,
}: {
	transactionId: string;
	doc: DisplayDocument;
}) {
	const isUuid = /^[0-9a-f-]{36}$/i.test(doc.id);

	const { data: signed, isLoading: signedLoading } =
		trpc.documents.getViewUrl.useQuery(
			{ documentId: doc.id },
			{
				enabled: isUuid && !doc.needsLegacyResolve,
				staleTime: 60_000,
			},
		);

	const { data: legacy, isLoading: legacyLoading } =
		trpc.documents.resolveLegacyUrl.useQuery(
			{ transactionId, publicUrl: doc.url },
			{
				enabled:
					doc.needsLegacyResolve &&
					Boolean(doc.url) &&
					!doc.url.startsWith("data:"),
			},
		);

	const isLoading = doc.needsLegacyResolve
		? legacyLoading
		: isUuid
			? signedLoading
			: false;

	const viewUrl = doc.needsLegacyResolve
		? (legacy?.url ?? (doc.url.startsWith("data:") ? doc.url : ""))
		: (signed?.url ?? doc.url);

	const showImage = isImageType(doc.fileType) && viewUrl && !isLoading;
	const showPdf =
		isPdfType(doc.fileType, doc.fileName) && viewUrl && !isLoading;

	if (isLoading) {
		return (
			<div className="flex min-h-[240px] items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (showImage) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={viewUrl}
				alt={doc.fileName}
				className="max-h-[70vh] w-full object-contain"
			/>
		);
	}

	if (showPdf) {
		return (
			<iframe
				title={doc.fileName}
				src={viewUrl}
				className="h-[70vh] w-full rounded border"
			/>
		);
	}

	return (
		<div className="space-y-3 py-4 text-center">
			<p className="text-muted-foreground text-sm">
				Preview not available for this file type.
			</p>
			{viewUrl ? (
				<Button variant="outline" size="sm" asChild>
					<a href={viewUrl} target="_blank" rel="noopener noreferrer">
						<ExternalLink className="mr-1 h-4 w-4" />
						Open file
					</a>
				</Button>
			) : null}
		</div>
	);
}

interface TransactionDocumentsPanelProps {
	transactionId: string;
	fallbackDocuments?: FallbackDocument[] | null;
	allowUpload?: boolean;
}

export function TransactionDocumentsPanel({
	transactionId,
	fallbackDocuments,
	allowUpload = false,
}: TransactionDocumentsPanelProps) {
	const [selectedDoc, setSelectedDoc] = useState<DisplayDocument | null>(null);
	const [category, setCategory] = useState<DocumentCategory>("other");
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const utils = trpc.useUtils();

	const { data: apiDocs = [], isLoading } = trpc.documents.list.useQuery(
		{ transactionId },
		{ enabled: Boolean(transactionId) },
	);

	const uploadSession = trpc.documents.createUploadSession.useMutation();
	const uploadDocument = trpc.documents.upload.useMutation();
	const deleteDocument = trpc.documents.delete.useMutation();

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
	const [busyAction, setBusyAction] = useState<
		"delete" | "download" | null
	>(null);

	const documents = useMemo((): DisplayDocument[] => {
		const merged: DisplayDocument[] = apiDocs.map((d) => ({
			id: d.id,
			fileName: d.fileName,
			fileType: d.fileType,
			fileSize: d.fileSize,
			url: d.url,
			documentCategory: d.documentCategory,
			uploadedAt: d.uploadedAt,
			needsLegacyResolve: false,
		}));

		const seen = new Set(apiDocs.map((d) => d.id));

		for (const doc of fallbackDocuments ?? []) {
			if (doc.id && seen.has(doc.id)) continue;
			if (!doc.url && !doc.name) continue;
			merged.push({
				id: doc.id ?? `legacy-${doc.name}`,
				fileName: doc.name ?? "File",
				fileType: doc.type ?? "application/octet-stream",
				fileSize: 0,
				url: doc.url ?? "",
				documentCategory: doc.category ?? "other",
				uploadedAt: doc.uploadedAt ?? new Date().toISOString(),
				needsLegacyResolve: true,
			});
		}

		return merged.filter(
			(d) => (d.url || d.fileName) && !deletedIds.has(d.id),
		);
	}, [apiDocs, fallbackDocuments, deletedIds]);

	const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
	const allSelected =
		documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

	const toggleSelected = (id: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const resolveDownloadUrl = async (doc: DisplayDocument): Promise<string> => {
		if (UUID_RE.test(doc.id) && !doc.needsLegacyResolve) {
			const res = await utils.documents.getViewUrl.fetch({
				documentId: doc.id,
			});
			return res.url || doc.url;
		}
		if (doc.url.startsWith("data:")) return doc.url;
		if (doc.url) {
			const res = await utils.documents.resolveLegacyUrl.fetch({
				transactionId,
				publicUrl: doc.url,
			});
			return res.url || doc.url;
		}
		return "";
	};

	const downloadDocument = async (doc: DisplayDocument) => {
		const url = await resolveDownloadUrl(doc);
		if (!url) throw new Error(`No file available for ${doc.fileName}`);
		const triggerDownload = (href: string) => {
			const a = document.createElement("a");
			a.href = href;
			a.download = doc.fileName;
			a.rel = "noopener noreferrer";
			document.body.appendChild(a);
			a.click();
			a.remove();
		};
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const blobUrl = URL.createObjectURL(await res.blob());
			triggerDownload(blobUrl);
			setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
		} catch {
			// Cross-origin/CORS fallback: let the browser handle the signed URL directly
			triggerDownload(url);
		}
	};

	const handleDownload = async (docs: DisplayDocument[]) => {
		if (docs.length === 0) return;
		setBusyAction("download");
		let failed = 0;
		for (const doc of docs) {
			try {
				await downloadDocument(doc);
			} catch (e) {
				failed += 1;
				toast.error(e instanceof Error ? e.message : "Download failed");
			}
		}
		setBusyAction(null);
		if (failed === 0 && docs.length > 1) {
			toast.success(`Downloading ${docs.length} documents`);
		}
	};

	const handleDelete = async (docs: DisplayDocument[]) => {
		const deletable = docs.filter(
			(d) => UUID_RE.test(d.id) && !d.needsLegacyResolve,
		);
		if (deletable.length === 0) {
			toast.error("These documents cannot be deleted");
			return;
		}
		const skipped = docs.length - deletable.length;
		const confirmed = window.confirm(
			deletable.length === 1
				? `Delete "${deletable[0].fileName}"? This cannot be undone.`
				: `Delete ${deletable.length} documents? This cannot be undone.`,
		);
		if (!confirmed) return;

		setBusyAction("delete");
		const removed: string[] = [];
		for (const doc of deletable) {
			try {
				await deleteDocument.mutateAsync({ documentId: doc.id });
				removed.push(doc.id);
			} catch (e) {
				toast.error(
					`${doc.fileName}: ${e instanceof Error ? e.message : "Delete failed"}`,
				);
			}
		}
		setBusyAction(null);
		if (removed.length > 0) {
			setDeletedIds((prev) => new Set([...prev, ...removed]));
			setSelectedIds((prev) => {
				const next = new Set(prev);
				for (const id of removed) next.delete(id);
				return next;
			});
			toast.success(
				removed.length === 1
					? "Document deleted"
					: `${removed.length} documents deleted`,
			);
			await utils.documents.list.invalidate({ transactionId });
			void utils.transactions.invalidate();
		}
		if (skipped > 0) {
			toast.message(`${skipped} legacy file(s) skipped (cannot be deleted)`);
		}
	};

	const handleUpload = async (fileList: FileList | null) => {
		if (!fileList?.length) return;
		try {
			setIsUploading(true);
			for (const file of Array.from(fileList)) {
				if (file.size > 50 * 1024 * 1024) {
					toast.error(`${file.name} exceeds 50MB limit`);
					continue;
				}
				const fileType = file.type || guessMime(file.name);
				if (!fileType) {
					toast.error(`Could not detect type for ${file.name}`);
					continue;
				}
				const session = await uploadSession.mutateAsync({
					transactionId,
					fileName: file.name,
					fileType,
					fileSize: file.size,
					documentCategory: category,
				});
				const putRes = await fetch(session.signedUrl, {
					method: "PUT",
					body: file,
					headers: { "Content-Type": fileType },
				});
				if (!putRes.ok) {
					throw new Error(`Direct upload failed (${putRes.status})`);
				}
				await uploadDocument.mutateAsync({
					transactionId,
					fileName: file.name,
					fileType,
					fileSize: file.size,
					documentCategory: category,
					storagePath: session.storagePath,
					uploadedFrom: "transaction_detail",
				});
			}
			await utils.documents.list.invalidate({ transactionId });
			toast.success("Document uploaded");
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Upload failed";
			toast.error(
				/Request Entity|Unexpected token ['"]?R/i.test(msg)
					? "Upload rejected: file too large for API proxy. Retry with direct upload."
					: msg,
			);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	if (isLoading) {
		return <DocumentListSkeleton count={4} />;
	}

	return (
		<>
			{allowUpload ? (
				<div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed bg-background p-3">
					<div className="min-w-[140px] space-y-1">
						<p className="text-muted-foreground text-xs">Category</p>
						<Select
							value={category}
							onValueChange={(v) => setCategory(v as DocumentCategory)}
						>
							<SelectTrigger className="h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{UPLOAD_CATEGORIES.map((c) => (
									<SelectItem key={c.value} value={c.value}>
										{c.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						className="hidden"
						multiple
						onChange={(e) => void handleUpload(e.target.files)}
					/>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isUploading}
						onClick={() => fileInputRef.current?.click()}
					>
						{isUploading ? (
							<Loader2 className="mr-1 h-4 w-4 animate-spin" />
						) : (
							<Upload className="mr-1 h-4 w-4" />
						)}
						{isUploading ? "Uploading…" : "Upload document"}
					</Button>
				</div>
			) : null}

			{documents.length === 0 ? (
				<p className="text-muted-foreground text-sm">No documents uploaded.</p>
			) : (
				<div className="space-y-2">
					<div className="flex min-h-9 flex-wrap items-center gap-2 px-1">
						<label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
							<Checkbox
								checked={allSelected}
								onCheckedChange={(c) =>
									setSelectedIds(
										c ? new Set(documents.map((d) => d.id)) : new Set(),
									)
								}
								aria-label="Select all documents"
							/>
							{selectedDocs.length > 0
								? `${selectedDocs.length} selected`
								: "Select all"}
						</label>
						{selectedDocs.length > 0 ? (
							<div className="ml-auto flex items-center gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={busyAction !== null}
									onClick={() => void handleDownload(selectedDocs)}
								>
									{busyAction === "download" ? (
										<Loader2 className="mr-1 h-4 w-4 animate-spin" />
									) : (
										<Download className="mr-1 h-4 w-4" />
									)}
									Download all
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									disabled={busyAction !== null}
									onClick={() => void handleDelete(selectedDocs)}
								>
									{busyAction === "delete" ? (
										<Loader2 className="mr-1 h-4 w-4 animate-spin" />
									) : (
										<Trash2 className="mr-1 h-4 w-4" />
									)}
									Delete all
								</Button>
							</div>
						) : null}
					</div>
					<ul className="space-y-2">
						{documents.map((doc) => {
							const sizeLabel = formatFileSize(doc.fileSize);
							return (
								<li
									key={doc.id}
									className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50"
								>
									<Checkbox
										checked={selectedIds.has(doc.id)}
										onCheckedChange={(c) => toggleSelected(doc.id, c === true)}
										aria-label={`Select ${doc.fileName}`}
									/>
									<button
										type="button"
										onClick={() => setSelectedDoc(doc)}
										className="flex min-w-0 flex-1 items-center gap-3 text-left"
									>
										<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-primary text-sm underline-offset-2 hover:underline">
												{doc.fileName}
											</p>
											<p className="text-muted-foreground text-xs">
												{[sizeLabel ?? doc.fileType, formatDateTimeSecondsDMY(doc.uploadedAt)]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										<Badge
											variant="secondary"
											className="shrink-0 text-xs capitalize"
										>
											{formatCategory(doc.documentCategory)}
										</Badge>
									</button>
									<div className="flex shrink-0 items-center gap-1">
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className="h-8 w-8"
											title="Download"
											disabled={busyAction !== null}
											onClick={() => void handleDownload([doc])}
										>
											<Download className="h-4 w-4" />
											<span className="sr-only">Download</span>
										</Button>
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className="h-8 w-8 text-destructive hover:text-destructive"
											title="Delete"
											disabled={busyAction !== null}
											onClick={() => void handleDelete([doc])}
										>
											<Trash2 className="h-4 w-4" />
											<span className="sr-only">Delete</span>
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			)}

			<Dialog
				open={Boolean(selectedDoc)}
				onOpenChange={(open) => {
					if (!open) setSelectedDoc(null);
				}}
			>
				<DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle className="truncate pr-8">
							{selectedDoc?.fileName ?? "Document"}
						</DialogTitle>
					</DialogHeader>
					{selectedDoc ? (
						<DocumentViewerBody
							transactionId={transactionId}
							doc={selectedDoc}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
