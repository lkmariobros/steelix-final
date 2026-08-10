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
import { trpc } from "@/utils/trpc";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

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
			<div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading preview…
			</div>
		);
	}

	return (
		<>
			{showImage ? (
				<div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-muted/40 p-2">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={viewUrl}
						alt={doc.fileName}
						className="max-h-[70vh] w-auto max-w-full object-contain"
					/>
				</div>
			) : showPdf ? (
				<iframe
					title={doc.fileName}
					src={viewUrl}
					className="h-[70vh] w-full rounded-md border bg-background"
				/>
			) : viewUrl ? (
				<div className="space-y-3 py-6 text-center">
					<p className="text-muted-foreground text-sm">
						Preview is not available for this file type.
					</p>
					<Button asChild>
						<a href={viewUrl} target="_blank" rel="noopener noreferrer">
							<ExternalLink className="mr-1 h-4 w-4" />
							Open in new tab
						</a>
					</Button>
				</div>
			) : (
				<p className="py-8 text-center text-muted-foreground text-sm">
					Document unavailable.
				</p>
			)}

			{viewUrl ? (
				<div className="flex justify-end">
					<Button variant="outline" size="sm" asChild>
						<a href={viewUrl} target="_blank" rel="noopener noreferrer">
							<ExternalLink className="mr-1 h-3 w-3" />
							Open in new tab
						</a>
					</Button>
				</div>
			) : null}
		</>
	);
}

interface TransactionDocumentsPanelProps {
	transactionId: string;
	fallbackDocuments?: FallbackDocument[] | null;
}

export function TransactionDocumentsPanel({
	transactionId,
	fallbackDocuments,
}: TransactionDocumentsPanelProps) {
	const [selectedDoc, setSelectedDoc] = useState<DisplayDocument | null>(null);

	const { data: apiDocs = [], isLoading } = trpc.documents.list.useQuery(
		{ transactionId },
		{ enabled: Boolean(transactionId) },
	);

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

	if (isLoading) {
		return <DocumentListSkeleton count={4} />;
	}

	if (documents.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No documents uploaded.</p>
		);
	}

	return (
		<>
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
