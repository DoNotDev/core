// packages/core/utils/src/common/adapters/errorUtils.ts

/**
 * @fileoverview Adapter Error Utilities
 * @description Utility functions for wrapping errors in adapter implementations.
 * These utilities help maintain consistent error handling across all adapters without
 * requiring inheritance or base classes.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { DoNotDevError, mapToDoNotDevError } from '../errors';

// =============================================================================
// CRUD Adapter Error Utilities
// =============================================================================

/**
 * Wraps an error from a CRUD adapter operation.
 * Maps common database/API errors to DoNotDevError with appropriate codes.
 *
 * @param error - The original error from the adapter
 * @param context - Context about the operation (e.g., "FirestoreAdapter.get", "SupabaseAdapter.add")
 * @param operation - The operation name (e.g., "get", "add", "query")
 * @param collection - The collection/table name
 * @param id - Optional document ID
 * @returns A DoNotDevError wrapping the original error
 *
 * @example
 * ```typescript
 * try {
 *   return await this.client.from('users').select().eq('id', id).single();
 * } catch (error) {
 *   throw wrapCrudError(error, 'SupabaseCrudAdapter.get', 'get', 'users', id);
 * }
 * ```
 */
export function wrapCrudError(
  error: unknown,
  context: string,
  operation: string,
  collection: string,
  id?: string
): DoNotDevError {
  const fullContext = `${context}.${operation}(${collection}${id ? `, ${id}` : ''})`;
  const originalMessage = getErrorMessage(error);

  // Core stays framework-generic: no CRUD UX copy, no i18n concerns here.
  // Preserve low-level details for logs/devtools; feature/UI layers decide
  // localized end-user wording.
  return mapToDoNotDevError(
    {
      ...(error instanceof Error ? error : new Error(originalMessage)),
      message: 'Request failed.',
      details: {
        context: fullContext,
        originalMessage,
        originalError: error,
      },
    },
    'api'
  );
}

/**
 * Wraps an error from a storage adapter operation.
 *
 * @param error - The original error from the adapter
 * @param context - Context about the operation (e.g., "FirebaseStorageAdapter.upload")
 * @param operation - The operation name (e.g., "upload", "delete", "getUrl")
 * @param path - The storage path or URL
 * @returns A DoNotDevError wrapping the original error
 *
 * @example
 * ```typescript
 * try {
 *   return await this.bucket.upload(file, { destination: path });
 * } catch (error) {
 *   throw wrapStorageError(error, 'S3StorageAdapter.upload', 'upload', path);
 * }
 * ```
 */
export function wrapStorageError(
  error: unknown,
  context: string,
  operation: string,
  path: string
): DoNotDevError {
  const fullContext = `${context}.${operation}(${path})`;
  return mapToDoNotDevError(
    error,
    'api',
    `${fullContext}: ${getErrorMessage(error)}`
  );
}

/**
 * Wraps an error from an auth adapter operation.
 *
 * @param error - The original error from the adapter
 * @param context - Context about the operation (e.g., "FirebaseAuth.signInWithEmail")
 * @param operation - The operation name (e.g., "signInWithEmail", "linkWithPartner")
 * @param details - Optional additional details (e.g., email, partnerId)
 * @returns A DoNotDevError wrapping the original error
 *
 * @example
 * ```typescript
 * try {
 *   return await this.sdk.signInWithEmailAndPassword(email, password);
 * } catch (error) {
 *   throw wrapAuthError(error, 'CustomAuth.signInWithEmail', 'signInWithEmail', { email });
 * }
 * ```
 */
export function wrapAuthError(
  error: unknown,
  context: string,
  operation: string,
  details?: Record<string, unknown>
): DoNotDevError {
  const detailStr = details ? ` ${JSON.stringify(details)}` : '';
  const fullContext = `${context}.${operation}(${detailStr})`;
  const wrapped = mapToDoNotDevError(
    error,
    'auth',
    `${fullContext}: ${getErrorMessage(error)}`
  );

  // Preserve custom error codes (e.g. DELETE_ACCOUNT_REQUIRES_SERVER) that the auth
  // error mapping already handles. This is a safety net — if the original error carries
  // a .code that maps to itself (identity mapping), the wrapped error's code is correct.
  // If somehow the mapping missed, re-stamp from the original error.
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    wrapped.code === 'unknown' &&
    (error as any).code !== 'unknown'
  ) {
    // The mapping didn't recognize the code — return a DoNotDevError with the original code
    // preserved in details so consumers can still access it.
    return new DoNotDevError(wrapped.message, wrapped.code, {
      details: { ...wrapped.details, originalCode: (error as any).code },
      source: wrapped.source,
    });
  }

  return wrapped;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extracts a readable error message from an unknown error.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}
