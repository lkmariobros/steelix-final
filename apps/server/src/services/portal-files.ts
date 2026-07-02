import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { portalFiles, portalFolders } from "../models/portal-files";
import { db } from "../utils/db";
import { supabaseAdmin, assertSupabaseConfigured } from "../utils/supabase";
import { hasAdminAccess } from "../utils/user-roles";

/** Reserved owner id for company-wide files visible to all agents (view-only). */
export const PORTAL_SHARED_OWNER_ID = "__portal_shared__";
export const PORTAL_SHARED_OWNER_ALIAS = "__shared__";

export const PORTAL_FILES_BUCKET =
	process.env.PORTAL_FILES_BUCKET?.trim() || "portal-files";
export const PORTAL_FILE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
export const PORTAL_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const PORTAL_BASE64_MAX_BYTES = 25 * 1024 * 1024;
export const PORTAL_SIGNED_URL_TTL_SECONDS = 60 * 60;

export const ALLOWED_PORTAL_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
	"video/mp4",
	"video/quicktime",
	"video/webm",
] as const;

type SessionUser = {
	id: string;
	role?: string | null;
	roles?: string[] | null;
};

export type PortalFileCapabilities = {
	canUpload: boolean;
	canDownload: boolean;
	canManage: boolean;
	canView: boolean;
};

export function isPortalSharedOwner(ownerUserId: string): boolean {
	return ownerUserId === PORTAL_SHARED_OWNER_ID;
}

export function normalisePortalOwnerInput(
	requestedOwnerUserId?: string | null,
): string | null {
	if (!requestedOwnerUserId) return null;
	if (
		requestedOwnerUserId === PORTAL_SHARED_OWNER_ID ||
		requestedOwnerUserId === PORTAL_SHARED_OWNER_ALIAS
	) {
		return PORTAL_SHARED_OWNER_ID;
	}
	return requestedOwnerUserId;
}

export function getPortalFileCapabilities(user: SessionUser): PortalFileCapabilities {
	const isAdmin = hasAdminAccess({ role: user.role, roles: user.roles ?? [] });
	return {
		canUpload: isAdmin,
		canDownload: isAdmin,
		canManage: isAdmin,
		canView: true,
	};
}

export function assertCanUploadPortalFiles(user: SessionUser) {
	if (!getPortalFileCapabilities(user).canUpload) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only admins can upload files",
		});
	}
}

export function assertCanDownloadPortalFiles(user: SessionUser) {
	if (!getPortalFileCapabilities(user).canDownload) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only admins can download files",
		});
	}
}

export function assertCanManagePortalFiles(user: SessionUser) {
	if (!getPortalFileCapabilities(user).canManage) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only admins can manage files and folders",
		});
	}
}

export function resolvePortalOwnerUserId(
	user: SessionUser,
	requestedOwnerUserId?: string | null,
): string {
	const isAdmin = hasAdminAccess({ role: user.role, roles: user.roles ?? [] });
	const normalised = normalisePortalOwnerInput(requestedOwnerUserId);

	if (normalised === PORTAL_SHARED_OWNER_ID) {
		return PORTAL_SHARED_OWNER_ID;
	}

	if (normalised && normalised !== user.id) {
		if (!isAdmin) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You can only access your own files",
			});
		}
		return normalised;
	}

	return normalised ?? user.id;
}

/** Owner ids an agent may list or view (company shared + personal). */
export function agentAccessibleOwnerIds(userId: string): string[] {
	return [PORTAL_SHARED_OWNER_ID, userId];
}

export function sanitizePortalFileName(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export function buildPortalStoragePath(
	ownerUserId: string,
	folderId: string | null | undefined,
	fileName: string,
): string {
	const folderSegment = folderId ?? "root";
	const safeName = sanitizePortalFileName(fileName);
	return `users/${ownerUserId}/${folderSegment}/${Date.now()}-${safeName}`;
}

export function assertAllowedPortalMimeType(fileType: string) {
	if (!ALLOWED_PORTAL_MIME_TYPES.includes(fileType as (typeof ALLOWED_PORTAL_MIME_TYPES)[number])) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `File type ${fileType} is not allowed`,
		});
	}
}

export function assertPortalFileSize(fileSize: number) {
	if (fileSize > PORTAL_MAX_FILE_SIZE_BYTES) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `File exceeds maximum size of ${PORTAL_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
		});
	}
}

export async function assertPortalFolderAccess(
	ownerUserId: string,
	folderId: string | null | undefined,
) {
	if (!folderId) return;
	const [folder] = await db
		.select({ id: portalFolders.id, ownerUserId: portalFolders.ownerUserId })
		.from(portalFolders)
		.where(eq(portalFolders.id, folderId))
		.limit(1);
	if (!folder) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
	}
	if (folder.ownerUserId !== ownerUserId) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Folder access denied" });
	}
}

export async function getPortalStorageUsageBytes(ownerUserId: string): Promise<number> {
	const [row] = await db
		.select({
			total: sql<number>`COALESCE(SUM(${portalFiles.fileSize}), 0)::bigint`,
		})
		.from(portalFiles)
		.where(
			and(
				eq(portalFiles.ownerUserId, ownerUserId),
				isNull(portalFiles.deletedAt),
			),
		);
	return Number(row?.total ?? 0);
}

export async function assertPortalQuota(
	ownerUserId: string,
	additionalBytes: number,
) {
	const used = await getPortalStorageUsageBytes(ownerUserId);
	if (used + additionalBytes > PORTAL_FILE_QUOTA_BYTES) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Storage quota exceeded for this user",
		});
	}
}

export async function getPortalFileForAccess(fileId: string) {
	const [file] = await db
		.select()
		.from(portalFiles)
		.where(and(eq(portalFiles.id, fileId), isNull(portalFiles.deletedAt)))
		.limit(1);
	if (!file) {
		throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
	}
	return file;
}

export function assertCanAccessPortalFile(
	user: SessionUser,
	file: { ownerUserId: string },
) {
	const isAdmin = hasAdminAccess({ role: user.role, roles: user.roles ?? [] });
	if (isAdmin) return;

	if (
		file.ownerUserId === user.id ||
		isPortalSharedOwner(file.ownerUserId)
	) {
		return;
	}

	throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}

export function requireSupabaseAdmin() {
	if (!supabaseAdmin) {
		try {
			assertSupabaseConfigured();
		} catch (e) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					e instanceof Error
						? e.message
						: "File storage is not configured",
			});
		}
	}
	return supabaseAdmin!;
}

export async function createPortalSignedUrl(
	storagePath: string,
	options?: { downloadFileName?: string; forceDownload?: boolean },
): Promise<string> {
	const storage = requireSupabaseAdmin();
	const forceDownload = options?.forceDownload === true;
	const { data, error } = await storage.storage
		.from(PORTAL_FILES_BUCKET)
		.createSignedUrl(storagePath, PORTAL_SIGNED_URL_TTL_SECONDS, {
			download: forceDownload
				? (options?.downloadFileName ?? true)
				: false,
		});
	if (error || !data?.signedUrl) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: error?.message ?? "Failed to create download URL",
		});
	}
	return data.signedUrl;
}

export function mapPortalFileRow(file: typeof portalFiles.$inferSelect) {
	return {
		id: file.id,
		ownerUserId: file.ownerUserId,
		isShared: isPortalSharedOwner(file.ownerUserId),
		folderId: file.folderId,
		fileName: file.fileName,
		fileType: file.fileType,
		fileSize: file.fileSize,
		uploadedByUserId: file.uploadedByUserId,
		createdAt: file.createdAt.toISOString(),
		updatedAt: file.updatedAt.toISOString(),
	};
}
