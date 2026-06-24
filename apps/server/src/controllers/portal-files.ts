import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";
import { portalFiles, portalFolders } from "../models/portal-files";
import {
	PORTAL_BASE64_MAX_BYTES,
	PORTAL_FILES_BUCKET,
	PORTAL_FILE_QUOTA_BYTES,
	assertAllowedPortalMimeType,
	assertCanAccessPortalFile,
	assertPortalFileSize,
	assertPortalFolderAccess,
	assertPortalQuota,
	buildPortalStoragePath,
	createPortalSignedUrl,
	getPortalFileForAccess,
	getPortalStorageUsageBytes,
	mapPortalFileRow,
	resolvePortalOwnerUserId,
	requireSupabaseAdmin,
} from "../services/portal-files";
import { db } from "../utils/db";
import { protectedProcedure, router } from "../utils/trpc";

const ownerInput = z.object({
	ownerUserId: z.string().optional(),
});

const folderInput = z.object({
	ownerUserId: z.string().optional(),
	folderId: z.string().uuid().nullable().optional(),
});

function sessionUser(ctx: { session: { user: { id: string } & Record<string, unknown> } }) {
	return ctx.session.user as {
		id: string;
		role?: string | null;
		roles?: string[] | null;
	};
}

export const portalFilesRouter = router({
	getStorageUsage: protectedProcedure
		.input(ownerInput)
		.query(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);
			const usedBytes = await getPortalStorageUsageBytes(ownerUserId);
			return {
				usedBytes,
				quotaBytes: PORTAL_FILE_QUOTA_BYTES,
				usedPercent: Math.min(100, (usedBytes / PORTAL_FILE_QUOTA_BYTES) * 100),
			};
		}),

	listFolders: protectedProcedure
		.input(
			folderInput.extend({
				parentFolderId: z.string().uuid().nullable().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);
			const parentFolderId = input.parentFolderId ?? null;

			const rows = await db
				.select()
				.from(portalFolders)
				.where(
					and(
						eq(portalFolders.ownerUserId, ownerUserId),
						parentFolderId
							? eq(portalFolders.parentFolderId, parentFolderId)
							: isNull(portalFolders.parentFolderId),
					),
				)
				.orderBy(portalFolders.name);

			return rows.map((f) => ({
				id: f.id,
				name: f.name,
				parentFolderId: f.parentFolderId,
				ownerUserId: f.ownerUserId,
				createdAt: f.createdAt.toISOString(),
			}));
		}),

	listFiles: protectedProcedure
		.input(
			folderInput.extend({
				search: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);
			const folderId = input.folderId ?? null;

			const conditions = [
				eq(portalFiles.ownerUserId, ownerUserId),
				isNull(portalFiles.deletedAt),
				folderId ? eq(portalFiles.folderId, folderId) : isNull(portalFiles.folderId),
			];

			if (input.search?.trim()) {
				conditions.push(ilike(portalFiles.fileName, `%${input.search.trim()}%`));
			}

			const rows = await db
				.select()
				.from(portalFiles)
				.where(and(...conditions))
				.orderBy(desc(portalFiles.createdAt));

			return rows.map(mapPortalFileRow);
		}),

	createFolder: protectedProcedure
		.input(
			folderInput.extend({
				name: z.string().min(1).max(120),
				parentFolderId: z.string().uuid().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);
			const parentFolderId = input.parentFolderId ?? null;

			if (parentFolderId) {
				await assertPortalFolderAccess(ownerUserId, parentFolderId);
			}

			const [folder] = await db
				.insert(portalFolders)
				.values({
					ownerUserId,
					parentFolderId,
					name: input.name.trim(),
				})
				.returning();

			if (!folder) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create folder",
				});
			}

			return {
				id: folder.id,
				name: folder.name,
				parentFolderId: folder.parentFolderId,
				createdAt: folder.createdAt.toISOString(),
			};
		}),

	upload: protectedProcedure
		.input(
			z.object({
				ownerUserId: z.string().optional(),
				folderId: z.string().uuid().nullable().optional(),
				fileName: z.string().min(1).max(255),
				fileType: z.string(),
				fileSize: z.number().int().positive(),
				base64Data: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);

			assertAllowedPortalMimeType(input.fileType);
			assertPortalFileSize(input.fileSize);
			if (input.fileSize > PORTAL_BASE64_MAX_BYTES) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Files over ${PORTAL_BASE64_MAX_BYTES / (1024 * 1024)}MB must use direct upload`,
				});
			}
			await assertPortalFolderAccess(ownerUserId, input.folderId ?? null);
			await assertPortalQuota(ownerUserId, input.fileSize);

			const storage = requireSupabaseAdmin();

			const storagePath = buildPortalStoragePath(
				ownerUserId,
				input.folderId,
				input.fileName,
			);
			const base64 = input.base64Data.replace(/^data:[^;]+;base64,/, "");
			const fileBuffer = Buffer.from(base64, "base64");

			const { error: uploadError } = await storage.storage
				.from(PORTAL_FILES_BUCKET)
				.upload(storagePath, fileBuffer, {
					contentType: input.fileType,
					cacheControl: "3600",
					upsert: false,
				});

			if (uploadError) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Upload failed: ${uploadError.message}`,
				});
			}

			const [file] = await db
				.insert(portalFiles)
				.values({
					ownerUserId,
					folderId: input.folderId ?? null,
					fileName: input.fileName,
					fileType: input.fileType,
					fileSize: input.fileSize,
					storagePath,
					uploadedByUserId: user.id,
					metadata: {
						originalName: input.fileName,
						uploadStatus: "complete",
					},
				})
				.returning();

			if (!file) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save file metadata",
				});
			}

			return mapPortalFileRow(file);
		}),

	createUploadSession: protectedProcedure
		.input(
			z.object({
				ownerUserId: z.string().optional(),
				folderId: z.string().uuid().nullable().optional(),
				fileName: z.string().min(1).max(255),
				fileType: z.string(),
				fileSize: z.number().int().positive(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);

			assertAllowedPortalMimeType(input.fileType);
			assertPortalFileSize(input.fileSize);
			await assertPortalFolderAccess(ownerUserId, input.folderId ?? null);
			await assertPortalQuota(ownerUserId, input.fileSize);

			const storage = requireSupabaseAdmin();

			const storagePath = buildPortalStoragePath(
				ownerUserId,
				input.folderId,
				input.fileName,
			);

			const [pending] = await db
				.insert(portalFiles)
				.values({
					ownerUserId,
					folderId: input.folderId ?? null,
					fileName: input.fileName,
					fileType: input.fileType,
					fileSize: input.fileSize,
					storagePath,
					uploadedByUserId: user.id,
					metadata: {
						originalName: input.fileName,
						uploadStatus: "pending",
					},
				})
				.returning();

			if (!pending) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create upload session",
				});
			}

			const { data, error } = await storage.storage
				.from(PORTAL_FILES_BUCKET)
				.createSignedUploadUrl(storagePath);

			if (error || !data?.signedUrl) {
				await db.delete(portalFiles).where(eq(portalFiles.id, pending.id));
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error?.message ?? "Failed to create upload URL",
				});
			}

			return {
				fileId: pending.id,
				signedUrl: data.signedUrl,
				token: data.token,
				storagePath,
			};
		}),

	completeUpload: protectedProcedure
		.input(z.object({ fileId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const file = await getPortalFileForAccess(input.fileId);
			assertCanAccessPortalFile(user, file);

			const meta = file.metadata ?? {};
			if (meta.uploadStatus !== "pending") {
				return mapPortalFileRow(file);
			}

			const storage = requireSupabaseAdmin();

			const folderPath = file.storagePath.split("/").slice(0, -1).join("/");
			const fileName = file.storagePath.split("/").pop();
			const { data: listed, error } = await storage.storage
				.from(PORTAL_FILES_BUCKET)
				.list(folderPath);

			const found = listed?.some((item) => item.name === fileName);
			if (error || !found) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Upload not found in storage. Please retry.",
				});
			}

			const [updated] = await db
				.update(portalFiles)
				.set({
					metadata: { ...meta, uploadStatus: "complete" },
					updatedAt: new Date(),
				})
				.where(eq(portalFiles.id, file.id))
				.returning();

			return mapPortalFileRow(updated ?? file);
		}),

	getDownloadUrl: protectedProcedure
		.input(z.object({ fileId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const file = await getPortalFileForAccess(input.fileId);
			assertCanAccessPortalFile(user, file);

			const url = await createPortalSignedUrl(file.storagePath, file.fileName);
			return {
				url,
				fileName: file.fileName,
				fileType: file.fileType,
			};
		}),

	getViewUrl: protectedProcedure
		.input(z.object({ fileId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const file = await getPortalFileForAccess(input.fileId);
			assertCanAccessPortalFile(user, file);

			const url = await createPortalSignedUrl(file.storagePath);
			return {
				url,
				fileName: file.fileName,
				fileType: file.fileType,
			};
		}),

	deleteFile: protectedProcedure
		.input(z.object({ fileId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const file = await getPortalFileForAccess(input.fileId);
			assertCanAccessPortalFile(user, file);

			const storage = requireSupabaseAdmin();
			const { error } = await storage.storage
				.from(PORTAL_FILES_BUCKET)
				.remove([file.storagePath]);
			if (error) {
				console.error("Portal file storage delete error:", error);
			}

			await db
				.update(portalFiles)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(eq(portalFiles.id, file.id));

			return { success: true };
		}),

	deleteFolder: protectedProcedure
		.input(
			z.object({
				folderId: z.string().uuid(),
				ownerUserId: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const ownerUserId = resolvePortalOwnerUserId(user, input.ownerUserId);
			await assertPortalFolderAccess(ownerUserId, input.folderId);

			const [childFolder] = await db
				.select({ id: portalFolders.id })
				.from(portalFolders)
				.where(eq(portalFolders.parentFolderId, input.folderId))
				.limit(1);
			if (childFolder) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Folder is not empty (contains subfolders)",
				});
			}

			const [childFile] = await db
				.select({ id: portalFiles.id })
				.from(portalFiles)
				.where(
					and(
						eq(portalFiles.folderId, input.folderId),
						isNull(portalFiles.deletedAt),
					),
				)
				.limit(1);
			if (childFile) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Folder is not empty (contains files)",
				});
			}

			await db.delete(portalFolders).where(eq(portalFolders.id, input.folderId));
			return { success: true };
		}),

	renameFile: protectedProcedure
		.input(
			z.object({
				fileId: z.string().uuid(),
				fileName: z.string().min(1).max(255),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const user = sessionUser(ctx);
			const file = await getPortalFileForAccess(input.fileId);
			assertCanAccessPortalFile(user, file);

			const [updated] = await db
				.update(portalFiles)
				.set({
					fileName: input.fileName.trim(),
					updatedAt: new Date(),
				})
				.where(eq(portalFiles.id, file.id))
				.returning();

			return mapPortalFileRow(updated ?? file);
		}),
});
