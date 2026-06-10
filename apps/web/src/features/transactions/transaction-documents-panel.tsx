"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";

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

function DocumentRow({
	transactionId,
	doc,
}: {
	transactionId: string;
	doc: DisplayDocument;
}) {
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

	const viewUrl = doc.needsLegacyResolve
		? (legacy?.url ?? (doc.url.startsWith("data:") ? doc.url : ""))
		: doc.url;

	const canPreview = isImageType(doc.fileType) && viewUrl && !legacyLoading;

	return (
		<div className="overflow-hidden rounded-lg border bg-background">
			{legacyLoading ? (
				<div className="flex items-center gap-2 border-b p-4 text-muted-foreground text-sm">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading preview…
				</div>
			) : canPreview ? (
				<div className="border-b bg-muted/30 p-2">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={viewUrl}
						alt={doc.fileName}
						className="mx-auto max-h-72 w-auto max-w-full rounded object-contain"
					/>
				</div>
			) : null}
			<div className="flex flex-wrap items-center justify-between gap-2 p-3">
				<div className="flex min-w-0 items-start gap-2">
					<FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{doc.fileName}</p>
						<p className="text-muted-foreground text-xs">
							{doc.fileType}
							{doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary" className="text-xs capitalize">
						{formatCategory(doc.documentCategory)}
					</Badge>
					{viewUrl && !legacyLoading ? (
						<Button variant="outline" size="sm" asChild>
							<a href={viewUrl} target="_blank" rel="noopener noreferrer">
								<ExternalLink className="mr-1 h-3 w-3" />
								Open
							</a>
						</Button>
					) : (
						<span className="text-muted-foreground text-xs">
							{legacyLoading ? "Loading…" : "Unavailable"}
						</span>
					)}
				</div>
			</div>
		</div>
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
		return (
			<div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading documents…
			</div>
		);
	}

	if (documents.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No documents uploaded.</p>
		);
	}

	return (
		<div className="space-y-3">
			{documents.map((doc) => (
				<DocumentRow key={doc.id} transactionId={transactionId} doc={doc} />
			))}
		</div>
	);
}
