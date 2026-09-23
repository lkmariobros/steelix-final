import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { transactionDocuments, transactions } from "../models/transactions";
import { writeRecordLog } from "../services/record-log";
import { db } from "../utils/db";
import { assertSupabaseConfigured, supabaseAdmin } from "../utils/supabase";
import { getPrimaryRole, hasAdminAccess } from "../utils/user-roles";
import { protectedProcedure, router } from "../utils/trpc";

const DOCUMENT_CATEGORIES = [
	"contract",
	"identification",
	"financial",
	"miscellaneous",
	"ic_passport",
	"sales_form",
	"bank_letter",
	"payment_proof",
	"other",
	"booking_form",
	"receipt",
	"co_broke_letter",
	"tenancy_agreement",
	"spa",
] as const;

const DOCUMENTS_BUCKET = "transaction-documents";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Legacy base64 through /api/trpc — keep tiny; large files must use signed upload. */
const BASE64_MAX_BYTES = 512 * 1024;

const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES);

const documentUploadSchema = z
	.object({
		transactionId: z.string().uuid(),
		fileName: z.string().min(1).max(255),
		fileType: z.string(),
		fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
		documentCategory: documentCategorySchema,
		/** Preferred: already uploaded via signed URL */
		storagePath: z.string().min(1).optional(),
		/** Legacy small-file path — avoid on production for large PDFs */
		base64Data: z.string().optional(),
		uploadedFrom: z.string().max(64).optional(),
	})
	.refine((v) => Boolean(v.storagePath || v.base64Data), {
		message: "storagePath or base64Data is required",
	});

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const ALLOWED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
] as const;

function assertAllowedFileType(fileType: string) {
	if (!ALLOWED_TYPES.includes(fileType as (typeof ALLOWED_TYPES)[number])) {
		throw new Error(`File type ${fileType} is not allowed`);
	}
}

async function assertCanAccessTransactionDocuments(
	transactionId: string,
	userId: string,
	userRole?: string | null,
	userRoles?: string[] | null,
) {
	const [tx] = await db
		.select({ agentId: transactions.agentId })
		.from(transactions)
		.where(eq(transactions.id, transactionId))
		.limit(1);

	if (!tx) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
	}

	const isAdmin = hasAdminAccess({ role: userRole, roles: userRoles ?? [] });
	if (!isAdmin && tx.agentId !== userId) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
	}

	return tx;
}

function extractStoragePathFromPublicUrl(publicUrl: string): string | null {
	const marker = "/transaction-documents/";
	const idx = publicUrl.indexOf(marker);
	if (idx === -1) return null;
	return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

async function resolveDocumentViewUrl(doc: {
	storagePath?: string | null;
	publicUrl?: string | null;
	fileType: string;
}): Promise<string> {
	const storagePath =
		doc.storagePath ?? extractStoragePathFromPublicUrl(doc.publicUrl ?? "");

	if (storagePath && supabaseAdmin) {
		const { data, error } = await supabaseAdmin.storage
			.from(DOCUMENTS_BUCKET)
			.createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

		if (!error && data?.signedUrl) {
			return data.signedUrl;
		}
	}

	return doc.publicUrl ?? "";
}

async function syncTransactionDocumentsJsonb(transactionId: string) {
	const docs = await db
		.select()
		.from(transactionDocuments)
		.where(eq(transactionDocuments.transactionId, transactionId))
		.orderBy(desc(transactionDocuments.uploadedAt));

	const snapshot = docs.map((d) => ({
		id: d.id,
		name: d.fileName,
		type: d.fileType,
		url: d.publicUrl ?? "",
		uploadedAt: d.uploadedAt.toISOString(),
		category: d.documentCategory,
	}));

	await db
		.update(transactions)
		.set({ documents: snapshot, updatedAt: new Date() })
		.where(eq(transactions.id, transactionId));
}

function mapDocumentRow(doc: {
	id: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	documentCategory: string;
	uploadedAt: Date;
	url: string;
}) {
	return {
		id: doc.id,
		name: doc.fileName,
		fileName: doc.fileName,
		type: doc.fileType,
		fileType: doc.fileType,
		fileSize: doc.fileSize,
		url: doc.url,
		documentCategory: doc.documentCategory,
		category: doc.documentCategory,
		uploadedAt: doc.uploadedAt.toISOString(),
	};
}

async function persistDocumentRecord(opts: {
	transactionId: string;
	userId: string;
	fileName: string;
	fileType: string;
	fileSize: number;
	storagePath: string;
	documentCategory: (typeof DOCUMENT_CATEGORIES)[number];
	uploadedFrom?: string;
	actorRole?: string | null;
}) {
	if (!supabaseAdmin) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message:
				"Document upload is unavailable. Supabase configuration is missing.",
		});
	}

	const { error: existsError } = await supabaseAdmin.storage
		.from(DOCUMENTS_BUCKET)
		.createSignedUrl(opts.storagePath, 60);
	if (existsError) {
		throw new Error("Upload not found in storage. Please re-upload the file.");
	}

	const { data: urlData } = supabaseAdmin.storage
		.from(DOCUMENTS_BUCKET)
		.getPublicUrl(opts.storagePath);

	const [documentRecord] = await db
		.insert(transactionDocuments)
		.values({
			transactionId: opts.transactionId,
			userId: opts.userId,
			fileName: opts.fileName,
			fileType: opts.fileType,
			fileSize: opts.fileSize,
			storagePath: opts.storagePath,
			publicUrl: urlData.publicUrl,
			documentCategory: opts.documentCategory,
			metadata: {
				originalName: opts.fileName,
				uploadedFrom: opts.uploadedFrom ?? "transaction-form",
			},
		})
		.returning();

	await syncTransactionDocumentsJsonb(opts.transactionId);

	const [txRow] = await db
		.select({ caseNo: transactions.caseNo })
		.from(transactions)
		.where(eq(transactions.id, opts.transactionId))
		.limit(1);

	void writeRecordLog({
		category: "transaction",
		action: "upload_document",
		summary: "Uploaded transaction document",
		actorId: opts.userId,
		actorRole: opts.actorRole,
		entityType: "transaction",
		entityId: opts.transactionId,
		caseNo: txRow?.caseNo,
		detail: opts.fileName,
		metadata: {
			documentCategory: opts.documentCategory,
			fileType: opts.fileType,
			fileSize: opts.fileSize,
			documentId: documentRecord.id,
		},
	});

	const viewUrl = await resolveDocumentViewUrl({
		storagePath: opts.storagePath,
		publicUrl: urlData.publicUrl,
		fileType: opts.fileType,
	});

	return {
		id: documentRecord.id,
		fileName: opts.fileName,
		fileType: opts.fileType,
		fileSize: opts.fileSize,
		url: viewUrl,
		documentCategory: opts.documentCategory,
		uploadedAt: documentRecord.uploadedAt.toISOString(),
		storagePath: opts.storagePath,
	};
}

export const documentsRouter = router({
	/**
	 * Create a signed upload URL so the browser can PUT the file directly to
	 * storage (avoids Vercel /api/trpc body limits).
	 */
	createUploadSession: protectedProcedure
		.input(
			z.object({
				transactionId: z.string().uuid().optional(),
				fileName: z.string().min(1).max(255),
				fileType: z.string().min(1),
				fileSize: z.number().int().positive().max(MAX_FILE_BYTES),
				documentCategory: documentCategorySchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};

			try {
				assertSupabaseConfigured();
			} catch (e) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: e instanceof Error ? e.message : "Storage not configured",
				});
			}
			if (!supabaseAdmin) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Storage not configured",
				});
			}

			assertAllowedFileType(input.fileType);

			if (input.transactionId) {
				await assertCanAccessTransactionDocuments(
					input.transactionId,
					userId,
					sessionUser.role,
					sessionUser.roles,
				);
			}

			const txSegment = input.transactionId ?? `pending-${crypto.randomUUID()}`;
			const ext = input.fileName.split(".").pop() || "bin";
			const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
			const storagePath = `${userId}/${txSegment}/${input.documentCategory}/${uniqueFileName}`;

			const { data, error } = await supabaseAdmin.storage
				.from(DOCUMENTS_BUCKET)
				.createSignedUploadUrl(storagePath);

			if (error || !data?.signedUrl) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: error?.message ?? "Failed to create upload URL",
				});
			}

			return {
				signedUrl: data.signedUrl,
				token: data.token,
				storagePath,
				maxFileBytes: MAX_FILE_BYTES,
			};
		}),

	upload: protectedProcedure
		.input(documentUploadSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const {
				transactionId,
				fileName,
				fileType,
				fileSize,
				documentCategory,
				storagePath: inputStoragePath,
				base64Data,
				uploadedFrom,
			} = input;

			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionDocuments(
				transactionId,
				userId,
				sessionUser.role,
				sessionUser.roles,
			);

			if (!supabaseAdmin) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						"Document upload is unavailable. Supabase configuration is missing.",
				});
			}

			try {
				assertAllowedFileType(fileType);

				let storagePath = inputStoragePath;

				if (!storagePath) {
					if (!base64Data) {
						throw new Error("Missing file data");
					}
					if (fileSize > BASE64_MAX_BYTES) {
						throw new Error(
							`Files over ${BASE64_MAX_BYTES / 1024}KB must use direct upload`,
						);
					}
					const fileExtension = fileName.split(".").pop();
					const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
					storagePath = `${userId}/${transactionId}/${documentCategory}/${uniqueFileName}`;
					const fileBuffer = Buffer.from(
						base64Data.replace(/^data:[^;]+;base64,/, ""),
						"base64",
					);

					const { error: uploadError } = await supabaseAdmin.storage
						.from(DOCUMENTS_BUCKET)
						.upload(storagePath, fileBuffer, {
							contentType: fileType,
							cacheControl: "3600",
							upsert: false,
						});

					if (uploadError) {
						throw new Error(`Upload failed: ${uploadError.message}`);
					}
				}

				return await persistDocumentRecord({
					transactionId,
					userId,
					fileName,
					fileType,
					fileSize,
					storagePath,
					documentCategory,
					uploadedFrom,
					actorRole: getPrimaryRole({
						role: sessionUser.role,
						roles: sessionUser.roles,
					}),
				});
			} catch (error) {
				console.error("Document upload error:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						error instanceof Error ? error.message : "Failed to upload document",
				});
			}
		}),

	list: protectedProcedure
		.input(z.object({ transactionId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionDocuments(
				input.transactionId,
				ctx.session.user.id,
				sessionUser.role,
				sessionUser.roles,
			);

			const rows = await db
				.select()
				.from(transactionDocuments)
				.where(eq(transactionDocuments.transactionId, input.transactionId))
				.orderBy(desc(transactionDocuments.uploadedAt));

			const withUrls = await Promise.all(
				rows.map(async (doc) => {
					const url = await resolveDocumentViewUrl({
						storagePath: doc.storagePath,
						publicUrl: doc.publicUrl,
						fileType: doc.fileType,
					});
					return mapDocumentRow({
						id: doc.id,
						fileName: doc.fileName,
						fileType: doc.fileType,
						fileSize: doc.fileSize,
						documentCategory: doc.documentCategory,
						uploadedAt: doc.uploadedAt,
						url,
					});
				}),
			);

			return withUrls;
		}),

	resolveLegacyUrl: protectedProcedure
		.input(
			z.object({
				transactionId: z.string().uuid(),
				publicUrl: z.string().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionDocuments(
				input.transactionId,
				ctx.session.user.id,
				sessionUser.role,
				sessionUser.roles,
			);

			if (input.publicUrl.startsWith("data:")) {
				return { url: input.publicUrl };
			}

			const url = await resolveDocumentViewUrl({
				publicUrl: input.publicUrl,
				fileType: "",
			});

			return { url: url || input.publicUrl };
		}),

	getViewUrl: protectedProcedure
		.input(z.object({ documentId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [doc] = await db
				.select()
				.from(transactionDocuments)
				.where(eq(transactionDocuments.id, input.documentId))
				.limit(1);

			if (!doc) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
			}

			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};
			await assertCanAccessTransactionDocuments(
				doc.transactionId,
				ctx.session.user.id,
				sessionUser.role,
				sessionUser.roles,
			);

			const url = await resolveDocumentViewUrl({
				storagePath: doc.storagePath,
				publicUrl: doc.publicUrl,
				fileType: doc.fileType,
			});

			return { url, fileName: doc.fileName, fileType: doc.fileType };
		}),

	delete: protectedProcedure
		.input(z.object({ documentId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const sessionUser = ctx.session.user as typeof ctx.session.user & {
				role?: string;
				roles?: string[];
			};

			const [document] = await db
				.select()
				.from(transactionDocuments)
				.where(eq(transactionDocuments.id, input.documentId))
				.limit(1);

			if (!document) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
			}

			const tx = await assertCanAccessTransactionDocuments(
				document.transactionId,
				userId,
				sessionUser.role,
				sessionUser.roles,
			);

			const isAdmin = hasAdminAccess({
				role: sessionUser.role,
				roles: sessionUser.roles,
			});
			if (
				!isAdmin &&
				document.userId !== userId &&
				tx.agentId !== userId
			) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
			}

			if (supabaseAdmin) {
				const { error: deleteError } = await supabaseAdmin.storage
					.from(DOCUMENTS_BUCKET)
					.remove([document.storagePath]);

				if (deleteError) {
					console.error("Storage deletion error:", deleteError);
				}
			}

			await db
				.delete(transactionDocuments)
				.where(eq(transactionDocuments.id, input.documentId));

			await syncTransactionDocumentsJsonb(document.transactionId);

			return { success: true };
		}),
});
