import React, { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type DocumentCategory = 'contract' | 'identification' | 'financial' | 'miscellaneous';

export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  category?: DocumentCategory;
  // Issue #3 Fix: Track temp documents
  isTemp?: boolean;
  base64Data?: string; // Store base64 for temp documents
  fileSize?: number;
}

// Issue #3 Fix: Local storage key for temp documents
const TEMP_DOCUMENTS_KEY = 'transaction-temp-documents';

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:mime/type;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Issue #3 Fix: Save temp documents to localStorage
const saveTempDocuments = (docs: DocumentFile[]) => {
  try {
    localStorage.setItem(TEMP_DOCUMENTS_KEY, JSON.stringify(docs));
  } catch (error) {
    console.error('Failed to save temp documents:', error);
  }
};

// Issue #3 Fix: Load temp documents from localStorage
const loadTempDocuments = (): DocumentFile[] => {
  try {
    const saved = localStorage.getItem(TEMP_DOCUMENTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load temp documents:', error);
    return [];
  }
};

// Issue #3 Fix: Clear temp documents from localStorage
const clearTempDocuments = () => {
  try {
    localStorage.removeItem(TEMP_DOCUMENTS_KEY);
  } catch (error) {
    console.error('Failed to clear temp documents:', error);
  }
};



// Progress tracking with file name
interface UploadProgressEntry {
  progress: number;
  fileName: string;
}

export function useDocumentUpload(transactionId?: string) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgressEntry>>({});
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [tempDocuments, setTempDocuments] = useState<DocumentFile[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false); // Track local upload state

  // Issue #3 Fix: Determine if we're in temp mode (no transaction ID yet)
  const isTempMode = !transactionId || transactionId === 'temp' || transactionId === '';

  // Issue #3 Fix: Load temp documents on mount
  useEffect(() => {
    if (isTempMode) {
      const loaded = loadTempDocuments();
      setTempDocuments(loaded);
    }
  }, [isTempMode]);

  // ✅ CORRECT PATTERN: Use useQuery with tRPC proxy (same as dashboard components)
  const listQuery = useQuery({
    queryKey: ['documents.list', { transactionId: transactionId || '' }],
    queryFn: async () => {
      if (isTempMode) {
        return [];
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/trpc/documents.list?input=${encodeURIComponent(JSON.stringify({ transactionId }))}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const result = await response.json();
      return result.result?.data || [];
    },
    enabled: !isTempMode,
    retry: false,
  });

  // ✅ CORRECT PATTERN: Use useMutation with manual fetch (same as commission-approval-queue)
  const uploadMutation = useMutation({
    mutationFn: async (input: {
      transactionId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      documentCategory: string;
      base64Data: string;
    }) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/trpc/documents.upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ json: input }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      return result.result?.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { documentId: string }) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/trpc/documents.delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ json: input }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      return response.json();
    },
  });

  // Update documents when query data changes
  useEffect(() => {
    if (listQuery.data) {
      setDocuments(listQuery.data);
    }
  }, [listQuery.data]);

  // Issue #3 Fix: Upload file - handles both temp and real transaction modes
  const uploadFile = async (file: File, category: DocumentCategory): Promise<DocumentFile> => {
    const fileId = `temp-${Math.random().toString(36).substring(2, 11)}`;

    console.log('[DocumentUpload] Starting upload for:', file.name, 'isTempMode:', isTempMode);

    // Set loading state for temp mode
    if (isTempMode) {
      setIsUploadingLocal(true);
    }

    try {
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit');
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type ${file.type} is not allowed`);
      }

      // Start progress tracking with file name - use delay to ensure UI updates
      console.log('[DocumentUpload] Setting progress 0%');
      setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 0, fileName: file.name } }));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Convert to base64
      console.log('[DocumentUpload] Setting progress 25%');
      setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 25, fileName: file.name } }));
      const base64Data = await fileToBase64(file);

      console.log('[DocumentUpload] Setting progress 50%');
      setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 50, fileName: file.name } }));

      // Issue #3 Fix: If in temp mode, store locally instead of uploading
      if (isTempMode) {
        // Small delay to ensure progress UI is visible
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[DocumentUpload] Setting progress 75%');
        setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 75, fileName: file.name } }));

        await new Promise(resolve => setTimeout(resolve, 200));

        const tempDoc: DocumentFile = {
          id: fileId,
          name: file.name,
          type: file.type,
          url: `data:${file.type};base64,${base64Data}`, // Data URL for preview
          uploadedAt: new Date().toISOString(),
          category,
          isTemp: true,
          base64Data,
          fileSize: file.size,
        };

        console.log('[DocumentUpload] Setting progress 100%');
        setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 100, fileName: file.name } }));

        // Add to temp documents
        console.log('[DocumentUpload] Adding temp document:', tempDoc.name);
        setTempDocuments(prev => {
          const updated = [...prev, tempDoc];
          console.log('[DocumentUpload] Total temp documents:', updated.length);
          saveTempDocuments(updated);
          return updated;
        });

        // Clean up progress after a delay
        setTimeout(() => {
          console.log('[DocumentUpload] Cleaning up progress');
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
          setIsUploadingLocal(false);
        }, 1500);

        return tempDoc;
      }

      // Upload via tRPC for real transactions
      const result = await uploadMutation.mutateAsync({
        transactionId: transactionId!,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        documentCategory: category,
        base64Data
      });

      setUploadProgress(prev => ({ ...prev, [fileId]: { progress: 100, fileName: file.name } }));

      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);

      // Refresh the documents list
      if (!isTempMode) {
        listQuery.refetch();
      }

      return {
        id: result.id,
        name: result.fileName,
        type: result.fileType,
        url: result.url,
        uploadedAt: result.uploadedAt,
        category: result.documentCategory
      };

    } catch (error) {
      // Clean up progress and loading state on error
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
      setIsUploadingLocal(false);

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  // Issue #3 Fix: Delete file - handles both temp and real documents
  const deleteFile = async (documentId: string) => {
    try {
      // Check if it's a temp document
      if (documentId.startsWith('temp-') || isTempMode) {
        setTempDocuments(prev => {
          const updated = prev.filter(doc => doc.id !== documentId);
          saveTempDocuments(updated);
          return updated;
        });
        toast.success('File removed');
        return;
      }

      // Delete from server for real documents
      await deleteMutation.mutateAsync({ documentId });
      if (!isTempMode) {
        listQuery.refetch();
      }
      toast.success('File deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  // Issue #3 Fix: Migrate temp documents to a real transaction
  const migrateDocuments = useCallback(async (newTransactionId: string): Promise<DocumentFile[]> => {
    if (tempDocuments.length === 0) {
      return [];
    }

    setIsMigrating(true);
    const migratedDocs: DocumentFile[] = [];
    const failedDocs: string[] = [];

    try {
      for (const tempDoc of tempDocuments) {
        try {
          if (!tempDoc.base64Data) continue;

          const result = await uploadMutation.mutateAsync({
            transactionId: newTransactionId,
            fileName: tempDoc.name,
            fileType: tempDoc.type,
            fileSize: tempDoc.fileSize || 0,
            documentCategory: tempDoc.category || 'miscellaneous',
            base64Data: tempDoc.base64Data
          });

          migratedDocs.push({
            id: result.id,
            name: result.fileName,
            type: result.fileType,
            url: result.url,
            uploadedAt: result.uploadedAt,
            category: result.documentCategory
          });
        } catch (error) {
          console.error(`Failed to migrate document ${tempDoc.name}:`, error);
          failedDocs.push(tempDoc.name);
        }
      }

      // Clear temp documents after successful migration
      if (failedDocs.length === 0) {
        clearTempDocuments();
        setTempDocuments([]);
      }

      if (failedDocs.length > 0) {
        toast.warning(`${failedDocs.length} document(s) failed to migrate: ${failedDocs.join(', ')}`);
      } else if (migratedDocs.length > 0) {
        toast.success(`${migratedDocs.length} document(s) migrated successfully`);
      }

      return migratedDocs;
    } finally {
      setIsMigrating(false);
    }
  }, [tempDocuments, uploadMutation]);

  // Issue #3 Fix: Get all documents (temp + real)
  const allDocuments = isTempMode ? tempDocuments : documents;

  return {
    uploadFile,
    deleteFile,
    documents: allDocuments,
    tempDocuments,
    // Combine mutation pending state with local uploading state for temp mode
    isUploading: uploadMutation.isPending || isUploadingLocal,
    isDeleting: deleteMutation.isPending,
    isMigrating,
    uploadProgress,
    uploadError: uploadMutation.error?.message,
    deleteError: deleteMutation.error?.message,
    isLoadingDocuments: listQuery.isLoading,
    refetchDocuments: listQuery.refetch,
    // Issue #3 Fix: Export migration function
    migrateDocuments,
    clearTempDocuments: () => {
      clearTempDocuments();
      setTempDocuments([]);
    },
    isTempMode,
  };
}
