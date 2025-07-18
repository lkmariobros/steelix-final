import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../lib/trpc';
import { supabaseAdmin } from '../lib/supabase-admin';
import { db } from '../db';
import { transactionDocuments, insertDocumentSchema } from '../db/schema/transactions';

const documentUploadSchema = z.object({
  transactionId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string(),
  fileSize: z.number().max(50 * 1024 * 1024), // 50MB limit
  documentCategory: z.enum(['contract', 'identification', 'financial', 'miscellaneous']),
  base64Data: z.string(), // For file content
});

export const documentsRouter = router({
  // Upload document to Supabase Storage
  upload: protectedProcedure
    .input(documentUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { transactionId, fileName, fileType, fileSize, documentCategory, base64Data } = input;

      try {
        // Validate file type and size
        const allowedTypes = [
          'image/jpeg', 
          'image/png', 
          'application/pdf', 
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];
        
        if (!allowedTypes.includes(fileType)) {
          throw new Error(`File type ${fileType} is not allowed`);
        }

        // Generate unique file path
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        const storagePath = `${userId}/${transactionId}/${documentCategory}/${uniqueFileName}`;

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('transaction-documents')
          .upload(storagePath, fileBuffer, {
            contentType: fileType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('transaction-documents')
          .getPublicUrl(storagePath);

        // Save metadata to database
        const documentRecord = await db.insert(transactionDocuments).values({
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
            uploadedFrom: 'transaction-form'
          }
        }).returning();

        return {
          id: documentRecord[0].id,
          fileName,
          fileType,
          fileSize,
          url: urlData.publicUrl,
          documentCategory,
          uploadedAt: documentRecord[0].uploadedAt.toISOString()
        };

      } catch (error) {
        console.error('Document upload error:', error);
        throw new Error('Failed to upload document');
      }
    }),

  // List documents for transaction
  list: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      
      const documents = await db.select()
        .from(transactionDocuments)
        .where(
          and(
            eq(transactionDocuments.transactionId, input.transactionId),
            eq(transactionDocuments.userId, userId)
          )
        )
        .orderBy(desc(transactionDocuments.uploadedAt));

      return documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        url: doc.publicUrl,
        documentCategory: doc.documentCategory,
        uploadedAt: doc.uploadedAt.toISOString()
      }));
    }),

  // Delete document
  delete: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get document record
      const document = await db.select()
        .from(transactionDocuments)
        .where(eq(transactionDocuments.id, input.documentId))
        .limit(1);

      if (!document.length || document[0].userId !== userId) {
        throw new Error('Document not found or unauthorized');
      }

      // Delete from Supabase Storage
      const { error: deleteError } = await supabaseAdmin.storage
        .from('transaction-documents')
        .remove([document[0].storagePath]);

      if (deleteError) {
        console.error('Storage deletion error:', deleteError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      await db.delete(transactionDocuments)
        .where(eq(transactionDocuments.id, input.documentId));

      return { success: true };
    })
});
