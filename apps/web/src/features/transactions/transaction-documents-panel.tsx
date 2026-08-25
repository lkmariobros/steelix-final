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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DocumentCategory } from "@/hooks/use-document-upload";
import { trpc } from "@/utils/trpc";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
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
	{ value: "other", label: "Other" },
];

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

const fileToBase64 = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result ?? "");
			const base64 = result.includes(",") ? result.split(",")[1]! : result;
			resolve(base64);
		};
		reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
		reader.readAsDataURL(file);
	});

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

	const uploadDocument = trpc.documents.upload.useMutation();

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

		return merged.filter((d) => d.url || d.fileName);
	}, [apiDocs, fallbackDocuments]);

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
				const base64Data = await fileToBase64(file);
				await uploadDocument.mutateAsync({
					transactionId,
					fileName: file.name,
					fileType,
					fileSize: file.size,
					documentCategory: category,
					base64Data,
					uploadedFrom: "transaction_detail",
				});
			}
			await utils.documents.list.invalidate({ transactionId });
			toast.success("Document uploaded");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Upload failed");
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
				<ul className="space-y-2">
					{documents.map((doc) => {
						const sizeLabel = formatFileSize(doc.fileSize);
						return (
							<li key={doc.id}>
								<button
									type="button"
									onClick={() => setSelectedDoc(doc)}
									className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
								>
									<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-primary text-sm underline-offset-2 hover:underline">
											{doc.fileName}
										</p>
										<p className="text-muted-foreground text-xs">
											{sizeLabel ?? doc.fileType}
										</p>
									</div>
									<Badge
										variant="secondary"
										className="shrink-0 text-xs capitalize"
									>
										{formatCategory(doc.documentCategory)}
									</Badge>
								</button>
							</li>
						);
					})}
				</ul>
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
