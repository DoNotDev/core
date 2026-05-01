// packages/core/utils/src/common/createMetadata.ts

/**
 * @fileoverview Create document metadata utility
 * @description Creates metadata for a new document with timestamps and user IDs
 *
 * This utility provides a standardized way to create document metadata
 * for database operations, ensuring consistency across the application.
 *
 * **Metadata Fields:**
 * - `createdAt`: ISO timestamp when document was created
 * - `updatedAt`: ISO timestamp when document was last updated
 * - `createdById`: User ID who created the document
 * - `updatedById`: User ID who last updated the document
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Usage Pattern:**
 * ```typescript
 * const metadata = createMetadata(userId);
 * const document = { ...data, ...metadata };
 * ```
 *
 * **Database Integration:**
 * - Compatible with Firestore document structure
 * - Supports audit trails and user tracking
 * - Consistent timestamp format across all documents
 */

/**
 * Creates metadata for a new document with audit trail information
 *
 * **Purpose:** Provides standardized metadata for database documents
 * including creation timestamps and user tracking for audit purposes.
 *
 * **Features:**
 * - ISO timestamp format for consistency
 * - User ID tracking for audit trails
 * - Both creation and update fields initialized
 * - Ready for immediate database insertion
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param userId - The ID of the user creating the document
 * @returns Metadata object with timestamps and user IDs
 *
 * @example
 * ```typescript
 * const user = { id: 'user123', name: 'John Doe' };
 * const metadata = createMetadata(user.id);
 *
 * const newPost = {
 *   title: 'My Post',
 *   content: 'Post content...',
 *   ...metadata
 * };
 *
 * await firestore.collection('posts').add(newPost);
 * ```
 */
export function createMetadata(userId: string) {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    createdById: userId,
    updatedById: userId,
  };
}
