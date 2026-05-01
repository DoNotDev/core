// packages/core/utils/src/common/updateMetadata.ts

/**
 * @fileoverview Update document metadata utility
 * @description Creates update metadata for an existing document
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Creates update metadata for an existing document
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param userId - The ID of the user updating the document
 * @returns An object with update timestamp and user ID
 */
export function updateMetadata(userId: string) {
  return {
    updatedAt: new Date().toISOString(),
    updatedById: userId,
  };
}
