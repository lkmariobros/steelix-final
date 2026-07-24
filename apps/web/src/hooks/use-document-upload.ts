"use client";

import { trpc } from "@/utils/trpc";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type DocumentCategory =
	| "ic_passport"
	| "sales_form"
	| "bank_letter"
	| "payment_proof"
	| "other"
	| "contract"
	| "identification"
	| "financial"
	| "miscellaneous"
	| "booking_form"
	| "receipt"
	| "co_broke_letter"
	| "tenancy_agreement"
	| "spa";

export interface DocumentFile {
	id: string;
	name: string;
	type: string;
	url: string;
	uploadedAt: string;
	category?: DocumentCategory;
	isTemp?: boolean;
	base64Data?: string;
	fileSize?: number;
}

const TEMP_DOCUMENTS_KEY = "transaction-temp-documents";

const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			const result = reader.result as string;
			const base64 = result.split(",")[1];
			resolve(base64);
		};
		reader.onerror = (error) => reject(error);
	});
};

const saveTempDocuments = (docs: DocumentFile[]) => {
	try {
		localStorage.setItem(TEMP_DOCUMENTS_KEY, JSON.stringify(docs));
	} catch (error) {
		console.error("Failed to save temp documents:", error);
	}
};

export const loadTempTransactionDocuments = (): DocumentFile[] => {
	try {
		const saved = localStorage.getItem(TEMP_DOCUMENTS_KEY);
		return saved ? JSON.parse(saved) : [];
	} catch (error) {
		console.error("Failed to load temp documents:", error);
		return [];
	}
};

const clearTempDocumentsStorage = () => {
	try {
		localStorage.removeItem(TEMP_DOCUMENTS_KEY);
	} catch (error) {
		console.error("Failed to clear temp documents:", error);
	}
};

interface UploadProgressEntry {
	progress: number;
	fileName: string;
}

export function useDocumentUpload(transactionId?: string) {
	const [uploadProgress, setUploadProgress] = useState<
		Record<string, UploadProgressEntry>
	>({});
	const [documents, setDocuments] = useState<DocumentFile[]>([]);
	const [tempDocuments, setTempDocuments] = useState<DocumentFile[]>([]);
	const [isMigrating, setIsMigrating] = useState(false);
	const [isUploadingLocal, setIsUploadingLocal] = useState(false);

	const isTempMode =
		!transactionId || transactionId === "temp" || transactionId === "";

	useEffect(() => {
		if (isTempMode) {
			setTempDocuments(loadTempTransactionDocuments());
		}
	}, [isTempMode]);

	const listQuery = trpc.documents.list.useQuery(
		{ transactionId: transactionId ?? "" },
		{ enabled: Boolean(transactionId) && !isTempMode },
	);

	useEffect(() => {
		if (!listQuery.data) return;
		setDocuments(
			listQuery.data.map((d) => ({
				id: d.id,
				name: d.fileName,
				type: d.fileType,
				url: d.url,
				uploadedAt: d.uploadedAt,
				category: d.documentCategory as DocumentCategory,
				fileSize: d.fileSize,
			})),
		);
	}, [listQuery.data]);

	const uploadMutation = trpc.documents.upload.useMutation();
	const deleteMutation = trpc.documents.delete.useMutation();

	const uploadFile = async (
		file: File,
		category: DocumentCategory,
	): Promise<DocumentFile> => {
		const fileId = `temp-${Math.random().toString(36).substring(2, 11)}`;

		if (isTempMode) {
			setIsUploadingLocal(true);
		}

		try {
			const guessMime = (name: string): string => {
				const ext = name.split(".").pop()?.toLowerCase();
				switch (ext) {
					case "pdf":
						return "application/pdf";
					case "jpg":
					case "jpeg":
						return "image/jpeg";
					case "png":
						return "image/png";
					case "doc":
						return "application/msword";
					case "docx":
						return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
					case "txt":
						return "text/plain";
					default:
						return "";
				}
			};

			const fileType = file.type || guessMime(file.name);

			if (file.size > 50 * 1024 * 1024) {
				throw new Error("File size exceeds 50MB limit");
			}

			const allowedTypes = [
				"image/jpeg",
				"image/png",
				"application/pdf",
				"application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"text/plain",
			];

			if (!allowedTypes.includes(fileType)) {
				throw new Error(
					fileType
						? `File type ${fileType} is not allowed`
						: "Could not detect file type. Please use PDF, DOC, DOCX, JPG, or PNG.",
				);
			}

			setUploadProgress((prev) => ({
				...prev,
				[fileId]: { progress: 10, fileName: file.name },
			}));

			const base64Data = await fileToBase64(file);

			setUploadProgress((prev) => ({
				...prev,
				[fileId]: { progress: 40, fileName: file.name },
			}));

			// New transaction (no draft id yet) — keep files locally until create/migrate
			if (isTempMode) {
				const tempDoc: DocumentFile = {
					id: fileId,
					name: file.name,
					type: fileType,
					url: `data:${fileType};base64,${base64Data}`,
					uploadedAt: new Date().toISOString(),
					category,
					isTemp: true,
					base64Data,
					fileSize: file.size,
				};

				setUploadProgress((prev) => ({
					...prev,
					[fileId]: { progress: 100, fileName: file.name },
				}));

				setTempDocuments((prev) => {
					const updated = [...prev, tempDoc];
					saveTempDocuments(updated);
					return updated;
				});

				setTimeout(() => {
					setUploadProgress((prev) => {
						const next = { ...prev };
						delete next[fileId];
						return next;
					});
					setIsUploadingLocal(false);
				}, 800);

				return tempDoc;
			}

			if (!transactionId) {
				throw new Error("Save the draft first, then upload documents.");
			}

			setUploadProgress((prev) => ({
				...prev,
				[fileId]: { progress: 70, fileName: file.name },
			}));

			const result = await uploadMutation.mutateAsync({
				transactionId,
				fileName: file.name,
				fileType,
				fileSize: file.size,
				documentCategory: category,
				base64Data,
			});

			if (!result?.id) {
				throw new Error("Upload failed: empty server response");
			}

			setUploadProgress((prev) => ({
				...prev,
				[fileId]: { progress: 100, fileName: file.name },
			}));

			setTimeout(() => {
				setUploadProgress((prev) => {
					const next = { ...prev };
					delete next[fileId];
					return next;
				});
			}, 800);

			void listQuery.refetch();

			const uploaded: DocumentFile = {
				id: result.id,
				name: result.fileName,
				type: result.fileType,
				url: result.url,
				uploadedAt: result.uploadedAt,
				category: result.documentCategory as DocumentCategory,
			};

			setDocuments((prev) => {
				if (prev.some((d) => d.id === uploaded.id)) return prev;
				return [uploaded, ...prev];
			});

			return uploaded;
		} catch (error) {
			setUploadProgress((prev) => {
				const next = { ...prev };
				delete next[fileId];
				return next;
			});
			setIsUploadingLocal(false);

			const errorMessage =
				error instanceof Error ? error.message : "Upload failed";
			toast.error(errorMessage);
			throw error;
		}
	};

	const deleteFile = async (documentId: string) => {
		try {
			if (documentId.startsWith("temp-") || isTempMode) {
				setTempDocuments((prev) => {
					const updated = prev.filter((doc) => doc.id !== documentId);
					saveTempDocuments(updated);
					return updated;
				});
				toast.success("File removed");
				return;
			}

			await deleteMutation.mutateAsync({ documentId });
			setDocuments((prev) => prev.filter((d) => d.id !== documentId));
			void listQuery.refetch();
			toast.success("File deleted successfully");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Delete failed";
			toast.error(errorMessage);
			throw error;
		}
	};

	const migrateDocuments = useCallback(
		async (newTransactionId: string): Promise<DocumentFile[]> => {
			const pending = tempDocuments.length
				? tempDocuments
				: loadTempTransactionDocuments();
			if (pending.length === 0) return [];

			setIsMigrating(true);
			const migratedDocs: DocumentFile[] = [];
			const failedDocs: string[] = [];

			try {
				for (const tempDoc of pending) {
					try {
						if (!tempDoc.base64Data) {
							failedDocs.push(tempDoc.name);
							continue;
						}

						const result = await uploadMutation.mutateAsync({
							transactionId: newTransactionId,
							fileName: tempDoc.name,
							fileType: tempDoc.type || "application/octet-stream",
							fileSize: tempDoc.fileSize || 0,
							documentCategory: tempDoc.category || "miscellaneous",
							base64Data: tempDoc.base64Data,
						});

						if (!result?.id) {
							failedDocs.push(tempDoc.name);
							continue;
						}

						migratedDocs.push({
							id: result.id,
							name: result.fileName,
							type: result.fileType,
							url: result.url,
							uploadedAt: result.uploadedAt,
							category: result.documentCategory as DocumentCategory,
						});
					} catch (error) {
						console.error(`Failed to migrate document ${tempDoc.name}:`, error);
						failedDocs.push(tempDoc.name);
					}
				}

				if (failedDocs.length === 0) {
					clearTempDocumentsStorage();
					setTempDocuments([]);
				}

				if (failedDocs.length > 0) {
					toast.warning(
						`${failedDocs.length} document(s) failed to migrate: ${failedDocs.join(", ")}`,
					);
				} else if (migratedDocs.length > 0) {
					toast.success(
						`${migratedDocs.length} document(s) migrated successfully`,
					);
				}

				return migratedDocs;
			} finally {
				setIsMigrating(false);
			}
		},
		[tempDocuments, uploadMutation],
	);

	const clearTempDocuments = useCallback(() => {
		clearTempDocumentsStorage();
		setTempDocuments([]);
	}, []);

	const allDocuments = isTempMode ? tempDocuments : documents;

	return {
		uploadFile,
		deleteFile,
		documents: allDocuments,
		tempDocuments,
		isUploading: uploadMutation.isPending || isUploadingLocal,
		isDeleting: deleteMutation.isPending,
		isMigrating,
		uploadProgress,
		uploadError: uploadMutation.error?.message,
		deleteError: deleteMutation.error?.message,
		isLoadingDocuments: listQuery.isLoading,
		refetchDocuments: listQuery.refetch,
		migrateDocuments,
		clearTempDocuments,
		isTempMode,
	};
}
