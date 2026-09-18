import {
	RiFileExcelLine,
	RiFileLine,
	RiFilePdf2Line,
	RiFileTextLine,
	RiFileWordLine,
	RiImageLine,
	RiSlideshowLine,
	RiVideoLine,
} from "@remixicon/react";
import type { ComponentType } from "react";

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isPreviewableType(fileType: string): boolean {
	return (
		fileType.startsWith("image/") ||
		fileType === "application/pdf" ||
		fileType.startsWith("video/")
	);
}

export const PORTAL_BASE64_MAX_BYTES = 512 * 1024;

const EXT_MIME: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	txt: "text/plain",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	mp4: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
};

/** Prefer browser MIME; fall back to extension (Windows often sends empty type). */
export function resolvePortalFileMimeType(file: File): string {
	if (file.type && file.type !== "application/octet-stream") {
		return file.type;
	}
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	return EXT_MIME[ext] || file.type || "application/octet-stream";
}

export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.includes(",") ? result.split(",")[1]! : result;
			resolve(base64);
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

export type FileIconKind =
	| "pdf"
	| "word"
	| "excel"
	| "ppt"
	| "image"
	| "video"
	| "text"
	| "other";

export function getFileIconKind(fileType: string, fileName?: string): FileIconKind {
	const lower = (fileName ?? "").toLowerCase();
	if (fileType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
	if (
		fileType.includes("word") ||
		lower.endsWith(".doc") ||
		lower.endsWith(".docx")
	) {
		return "word";
	}
	if (
		fileType.includes("excel") ||
		fileType.includes("spreadsheet") ||
		lower.endsWith(".xls") ||
		lower.endsWith(".xlsx")
	) {
		return "excel";
	}
	if (
		fileType.includes("powerpoint") ||
		fileType.includes("presentation") ||
		lower.endsWith(".ppt") ||
		lower.endsWith(".pptx")
	) {
		return "ppt";
	}
	if (fileType.startsWith("image/")) return "image";
	if (fileType.startsWith("video/")) return "video";
	if (fileType.startsWith("text/")) return "text";
	return "other";
}

export function getFileTypeIcon(
	fileType: string,
	fileName?: string,
): ComponentType<{ className?: string; size?: number | string }> {
	const kind = getFileIconKind(fileType, fileName);
	switch (kind) {
		case "pdf":
			return RiFilePdf2Line;
		case "word":
			return RiFileWordLine;
		case "excel":
			return RiFileExcelLine;
		case "ppt":
			return RiSlideshowLine;
		case "image":
			return RiImageLine;
		case "video":
			return RiVideoLine;
		case "text":
			return RiFileTextLine;
		default:
			return RiFileLine;
	}
}

export function fileIconClass(fileType: string, fileName?: string): string {
	const kind = getFileIconKind(fileType, fileName);
	switch (kind) {
		case "pdf":
			return "text-red-600";
		case "word":
			return "text-blue-600";
		case "excel":
			return "text-emerald-600";
		case "ppt":
			return "text-orange-600";
		case "image":
			return "text-violet-600";
		case "video":
			return "text-pink-600";
		default:
			return "text-muted-foreground";
	}
}

export const PORTAL_SHARED_OWNER_SELECT_VALUE = "__shared__";
export type DriveSpace = "company" | "mine" | "agent";
export type DriveViewMode = "list" | "grid";
export type DriveSortBy = "name" | "size" | "date";
export type DriveSortOrder = "asc" | "desc";
