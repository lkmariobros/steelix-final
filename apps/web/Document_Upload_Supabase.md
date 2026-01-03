# Document Upload Integration with Supabase Storage
## Comprehensive Implementation Plan

### Executive Summary
This document outlines the complete implementation strategy for integrating real Supabase Storage functionality into the transaction form's document upload feature (Step 6), replacing the current mock implementation with production-ready file storage, security policies, and robust error handling.

---

## Current State Analysis

### Existing Implementation
- **Location**: `apps/web/src/features/sales-entry/steps/step-6-documents.tsx`
- **Status**: Mock implementation with fake URLs (`mock://uploaded/filename`)
- **Upload Process**: Simulated with `setTimeout` delays
- **File Storage**: Local state only, no persistent storage
- **File Metadata**: Basic DocumentFile interface with id, name, type, url, uploadedAt

### Current Data Flow
```
User selects files → Mock upload simulation → Local state update → Form data update → Transaction submission
```

---

## Technical Architecture Design

### 1. Supabase Storage Setup

#### Storage Bucket Configuration
```sql
-- Create transaction-documents bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('transaction-documents', 'transaction-documents', false);

-- Storage policies for secure access
CREATE POLICY "Users can upload their own transaction documents" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own transaction documents" ON storage.objects
FOR SELECT USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own transaction documents" ON storage.objects
FOR DELETE USING (bucket_id = 'transaction-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

#### File Path Structure
```
transaction-documents/
├── {user_id}/
│   ├── {transaction_id}/
│   │   ├── contracts/
│   │   ├── identification/
│   │   ├── financial/
│   │   └── miscellaneous/
```

### 2. Database Schema Extensions

#### Document Metadata Table
```sql
-- Extend existing schema with document metadata
CREATE TABLE transaction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  document_category TEXT CHECK (document_category IN ('contract', 'identification', 'financial', 'miscellaneous')),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT unique_file_per_transaction UNIQUE(transaction_id, storage_path)
);

-- Indexes for performance
CREATE INDEX idx_transaction_documents_transaction_id ON transaction_documents(transaction_id);
CREATE INDEX idx_transaction_documents_user_id ON transaction_documents(user_id);
CREATE INDEX idx_transaction_documents_category ON transaction_documents(document_category);
```

### 3. Backend Implementation

#### tRPC Document Upload Router
```typescript
// apps/server/src/routers/documents.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { supabaseAdmin } from '../lib/supabase-admin';

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
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'text/plain'];
        if (!allowedTypes.includes(fileType)) {
          throw new Error('File type not allowed');
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
        const documentRecord = await ctx.db.insert(transactionDocuments).values({
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
      
      const documents = await ctx.db.select()
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
      const document = await ctx.db.select()
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
      await ctx.db.delete(transactionDocuments)
        .where(eq(transactionDocuments.id, input.documentId));

      return { success: true };
    })
});
```

#### Supabase Admin Client Setup
```typescript
// apps/server/src/lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

### 4. Frontend Implementation

#### Enhanced Document Upload Component
```typescript
// apps/web/src/features/sales-entry/steps/step-6-documents.tsx
import { trpc } from '@/utils/trpc';
import { useSession } from '@/lib/auth-client';

// File upload hook
function useDocumentUpload(transactionId?: string) {
  const uploadMutation = trpc.documents.upload.useMutation();
  const deleteMutation = trpc.documents.delete.useMutation();
  
  const uploadFile = async (file: File, category: DocumentCategory): Promise<DocumentFile> => {
    // Validate file
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    // Convert to base64
    const base64Data = await fileToBase64(file);

    // Upload via tRPC
    const result = await uploadMutation.mutateAsync({
      transactionId: transactionId || 'temp',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      documentCategory: category,
      base64Data
    });

    return {
      id: result.id,
      name: result.fileName,
      type: result.fileType,
      url: result.url,
      uploadedAt: result.uploadedAt,
      category: result.documentCategory
    };
  };

  const deleteFile = async (documentId: string) => {
    await deleteMutation.mutateAsync({ documentId });
  };

  return {
    uploadFile,
    deleteFile,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    uploadError: uploadMutation.error?.message,
    deleteError: deleteMutation.error?.message
  };
}

// Helper function is now defined in use-document-upload.ts hook
```

#### Document Category Selection UI
```typescript
// Enhanced file upload with categorization
const DocumentCategorySelector = ({ onSelect, selectedCategory }: {
  onSelect: (category: DocumentCategory) => void;
  selectedCategory?: DocumentCategory;
}) => {
  const categories = [
    { value: 'contract', label: 'Contracts', icon: FileText },
    { value: 'identification', label: 'ID Documents', icon: User },
    { value: 'financial', label: 'Financial', icon: CreditCard },
    { value: 'miscellaneous', label: 'Other', icon: File }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {categories.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={selectedCategory === value ? "default" : "outline"}
          onClick={() => onSelect(value as DocumentCategory)}
          className="h-20 flex-col gap-2"
        >
          <Icon size={24} />
          <span className="text-sm">{label}</span>
        </Button>
      ))}
    </div>
  );
};
```

---

## Security Implementation

### 1. File Validation
- **File Type Whitelist**: PDF, DOCX, DOC, TXT, JPEG, PNG only
- **File Size Limits**: Maximum 50MB per file, 500MB per transaction
- **File Name Sanitization**: Remove special characters, prevent path traversal
- **Virus Scanning**: Integration with ClamAV or similar service

### 2. Access Control
- **Row Level Security**: Users can only access their own documents
- **Session Validation**: All operations require valid authentication
- **Rate Limiting**: Prevent abuse with upload frequency limits
- **CORS Configuration**: Restrict cross-origin requests

### 3. Storage Security
```typescript
// File validation middleware
const validateFile = (file: File): void => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
  ];
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`);
  }
  
  if (file.size > maxSize) {
    throw new Error('File size exceeds maximum allowed size');
  }
  
  // Sanitize filename
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (sanitizedName !== file.name) {
    console.warn('Filename was sanitized:', file.name, '->', sanitizedName);
  }
};
```

---

## Error Handling & User Experience

### 1. Upload Progress Tracking
```typescript
// Progress tracking for large files
const UploadProgress = ({ progress, fileName }: { progress: number; fileName: string }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span>{fileName}</span>
      <span>{progress}%</span>
    </div>
    <Progress value={progress} className="h-2" />
  </div>
);
```

### 2. Error States & Recovery
- **Network Failures**: Automatic retry with exponential backoff
- **Storage Quota**: Clear error messages with upgrade prompts
- **Invalid Files**: Detailed validation error messages
- **Partial Uploads**: Resume capability for interrupted uploads

### 3. Loading States
- **Upload Progress**: Real-time progress bars
- **File Processing**: Loading spinners with status messages
- **Batch Operations**: Bulk upload progress indicators

---

## Performance Optimization

### 1. Upload Optimization
- **Chunked Uploads**: Split large files into smaller chunks
- **Parallel Processing**: Multiple file uploads simultaneously
- **Compression**: Image optimization and document compression
- **CDN Integration**: Fast global file delivery

### 2. Client-Side Caching
```typescript
// Cache uploaded documents locally
const useDocumentCache = () => {
  const [cache, setCache] = useState<Map<string, DocumentFile[]>>(new Map());
  
  const getCachedDocuments = (transactionId: string) => {
    return cache.get(transactionId) || [];
  };
  
  const updateCache = (transactionId: string, documents: DocumentFile[]) => {
    setCache(prev => new Map(prev.set(transactionId, documents)));
  };
  
  return { getCachedDocuments, updateCache };
};
```

### 3. Database Optimization
- **Indexed Queries**: Proper database indexes for fast retrieval
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Minimize database round trips

---

## Testing Strategy

### 1. Unit Tests
```typescript
// Document upload service tests
describe('DocumentUploadService', () => {
  test('should upload valid file successfully', async () => {
    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const result = await uploadService.upload(mockFile, 'contract');
    expect(result.url).toBeDefined();
    expect(result.id).toBeDefined();
  });

  test('should reject invalid file types', async () => {
    const mockFile = new File(['test'], 'test.exe', { type: 'application/exe' });
    await expect(uploadService.upload(mockFile, 'contract')).rejects.toThrow('File type not allowed');
  });
});
```

### 2. Integration Tests
- **End-to-End Upload Flow**: File selection to storage completion
- **Storage Integration**: Supabase Storage API interactions
- **Database Consistency**: Document metadata accuracy
- **Security Validation**: Access control enforcement

### 3. Performance Tests
- **Load Testing**: Multiple concurrent uploads
- **Large File Handling**: 50MB file upload performance
- **Network Resilience**: Upload reliability under poor conditions

---

## Deployment Checklist

### 1. Environment Variables
```bash
# Required environment variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional configuration
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=pdf,doc,docx,txt,jpg,jpeg,png
UPLOAD_RATE_LIMIT=10
```

### 2. Supabase Configuration
- [ ] Create `transaction-documents` storage bucket
- [ ] Set up Row Level Security policies
- [ ] Configure CORS for your domain
- [ ] Set up storage quotas and limits
- [ ] Configure CDN settings for fast delivery

### 3. Database Migrations
- [ ] Run `transaction_documents` table creation
- [ ] Add necessary indexes
- [ ] Set up foreign key constraints
- [ ] Configure backup and retention policies

### 4. Security Verification
- [ ] Test file upload restrictions
- [ ] Verify user access controls
- [ ] Validate session requirements
- [ ] Test rate limiting functionality

---

## Monitoring & Maintenance

### 1. Metrics Tracking
- Upload success/failure rates
- File size distribution
- Storage usage per user/transaction
- API response times
- Error frequency by type

### 2. Logging Strategy
```typescript
// Structured logging for document operations
const logger = {
  uploadSuccess: (userId: string, fileName: string, fileSize: number) => {
    console.log(JSON.stringify({
      event: 'document_upload_success',
      userId,
      fileName,
      fileSize,
      timestamp: new Date().toISOString()
    }));
  },
  
  uploadFailure: (userId: string, fileName: string, error: string) => {
    console.error(JSON.stringify({
      event: 'document_upload_failure',
      userId,
      fileName,
      error,
      timestamp: new Date().toISOString()
    }));
  }
};
```

### 3. Maintenance Tasks
- **Storage Cleanup**: Remove orphaned files
- **Quota Management**: Monitor and alert on storage limits
- **Performance Monitoring**: Track upload speeds and success rates
- **Security Audits**: Regular access pattern reviews

---

## Migration Plan from Mock to Production

### Phase 1: Backend Setup (Week 1)
1. Set up Supabase Storage bucket and policies
2. Implement tRPC document router
3. Create database schema and migrations
4. Set up environment variables and configuration

### Phase 2: Frontend Integration (Week 2)
1. Replace mock upload functionality
2. Implement real file upload with progress tracking
3. Add document categorization UI
4. Integrate error handling and user feedback

### Phase 3: Testing & Security (Week 3)
1. Comprehensive testing suite implementation
2. Security audit and penetration testing
3. Performance optimization and load testing
4. User acceptance testing

### Phase 4: Deployment & Monitoring (Week 4)
1. Production deployment with feature flags
2. Monitoring and alerting setup
3. Documentation and training materials
4. Gradual rollout to users

---

## Risk Assessment & Mitigation

### High Risk Items
1. **Data Loss**: Implement redundant backups and versioning
2. **Security Breaches**: Multi-layer security with regular audits
3. **Storage Costs**: Implement quotas and usage monitoring
4. **Performance Issues**: Load testing and optimization

### Mitigation Strategies
- **Gradual Rollout**: Feature flags for controlled deployment
- **Rollback Plan**: Quick reversion to mock implementation
- **Monitoring**: Real-time alerts for critical issues
- **Support**: Dedicated support channels for upload issues

---

## Success Criteria

### Technical Metrics
- [ ] 99.9% upload success rate
- [ ] <30 second upload time for 10MB files
- [ ] Zero data loss incidents
- [ ] <100ms API response time for document listing

### User Experience Metrics
- [ ] <5% user-reported upload failures
- [ ] 95% user satisfaction with upload experience
- [ ] <10 second average upload completion time
- [ ] Intuitive document categorization usage

---

## Conclusion

This comprehensive plan provides a production-ready approach to integrating Supabase Storage with your transaction form's document upload functionality. The implementation prioritizes security, performance, and user experience while maintaining scalability and maintainability.

The modular approach allows for incremental implementation and testing, reducing deployment risks while ensuring robust functionality. Regular monitoring and maintenance procedures will ensure long-term reliability and performance.

**Next Steps**: Begin with Phase 1 backend setup, establishing the Supabase Storage infrastructure and tRPC endpoints before moving to frontend integration.