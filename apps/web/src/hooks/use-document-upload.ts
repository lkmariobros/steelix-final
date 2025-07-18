import React, { useState } from 'react';
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
}

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



export function useDocumentUpload(transactionId?: string) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [documents, setDocuments] = useState<DocumentFile[]>([]);



  // ✅ CORRECT PATTERN: Use useQuery with tRPC proxy (same as dashboard components)
  const listQuery = useQuery({
    queryKey: ['documents.list', { transactionId: transactionId || '' }],
    queryFn: async () => {
      if (!transactionId || transactionId === 'temp' || transactionId === '') {
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
    enabled: !!transactionId && transactionId !== 'temp' && transactionId !== '',
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
  React.useEffect(() => {
    if (listQuery.data) {
      setDocuments(listQuery.data);
    }
  }, [listQuery.data]);

  const uploadFile = async (file: File, category: DocumentCategory): Promise<DocumentFile> => {
    const fileId = Math.random().toString(36).substring(2, 11);
    
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

      // Start progress tracking
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

      // Convert to base64
      setUploadProgress(prev => ({ ...prev, [fileId]: 25 }));
      const base64Data = await fileToBase64(file);
      
      setUploadProgress(prev => ({ ...prev, [fileId]: 50 }));

      // Upload via tRPC
      const result = await uploadMutation.mutateAsync({
        transactionId: transactionId || 'temp',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        documentCategory: category,
        base64Data
      });

      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));

      // Clean up progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);

      // Refresh the documents list
      if (transactionId && transactionId !== 'temp') {
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
      // Clean up progress on error
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  const deleteFile = async (documentId: string) => {
    try {
      await deleteMutation.mutateAsync({ documentId });
      if (transactionId && transactionId !== 'temp') {
        listQuery.refetch();
      }
      toast.success('File deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  return {
    uploadFile,
    deleteFile,
    documents: documents,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    uploadProgress,
    uploadError: uploadMutation.error?.message,
    deleteError: deleteMutation.error?.message,
    isLoadingDocuments: listQuery.isLoading,
    refetchDocuments: listQuery.refetch
  };
}
