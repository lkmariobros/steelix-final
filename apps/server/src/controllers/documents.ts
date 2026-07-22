import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { transactionDocuments, transactions } from "../models/transactions";
import { db } from "../utils/db";
import { supabaseAdmin } from "../utils/supabase";
import { hasAdminAccess } from "../utils/user-roles";
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

const documentUploadSchema = z.object({
	transactionId: z.string().uuid(),
	fileName: z.string().min(1).max(255),
	fileType: z.string(),
	fileSize: z.number().max(50 * 1024 * 1024),
	documentCategory: z.enum(DOCUMENT_CATEGORIES),
	base64Data: z.string(),
});

const SIGNED_URL_TTL_SECONDS = 60 * 60;

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
			.from("transaction-documents")
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

export const documentsRouter = router({
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
				base64Data,
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
				const allowedTypes = [
					"image/jpeg",
					"image/png",
					"image/webp",
					"application/pdf",
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					"text/plain",
				];

				if (!allowedTypes.includes(fileType)) {
					throw new Error(`File type ${fileType} is not allowed`);
				}

				const fileExtension = fileName.split(".").pop();
				const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
				const storagePath = `${userId}/${transactionId}/${documentCategory}/${uniqueFileName}`;
				const fileBuffer = Buffer.from(base64Data, "base64");

				const { error: uploadError } = await supabaseAdmin.storage
					.from("transaction-documents")
					.upload(storagePath, fileBuffer, {
						contentType: fileType,
						cacheControl: "3600",
						upsert: false,
					});

				if (uploadError) {
					throw new Error(`Upload failed: ${uploadError.message}`);
				}

				const { data: urlData } = supabaseAdmin.storage
					.from("transaction-documents")
					.getPublicUrl(storagePath);

				const [documentRecord] = await db
					.insert(transactionDocuments)
					.values({
						transactionId,
						userId,
						fileName,
						fileType,
						fileSize,
						storagePath,
						publicUrl: urlData.publicUrl,
						documentCategory,
						metadata: {
							originalName: fileName,
							uploadedFrom: "transaction-form",
						},
					})
					.returning();

				await syncTransactionDocumentsJsonb(transactionId);

				const viewUrl = await resolveDocumentViewUrl({
					storagePath,
					publicUrl: urlData.publicUrl,
					fileType,
				});

				return {
					id: documentRecord.id,
					fileName,
					fileType,
					fileSize,
					url: viewUrl,
					documentCategory,
					uploadedAt: documentRecord.uploadedAt.toISOString(),
				};
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

	/** Resolve a viewable URL for a legacy JSONB snapshot entry (public Supabase URL). */
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
					.from("transaction-documents")
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
