// packages/core/types/src/storage/adapter.ts

/**
 * @fileoverview Storage Adapter Interface
 * @description Provider-agnostic interface for file/image storage.
 * Any storage backend (Firebase Storage, S3, Cloudflare R2, Supabase Storage) must implement this contract.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Storage Types
// =============================================================================

/** Progress callback for upload operations (0-100) */
export type UploadProgressCallback = (percent: number) => void;

/** Options for file upload */
export interface UploadOptions {
  /** Folder path within the storage bucket (e.g. 'photos/2024'). Omit to upload to bucket root. */
  storagePath?: string;
  /** Custom filename override */
  filename?: string;
  /** Progress callback */
  onProgress?: UploadProgressCallback;
  /** AbortSignal to cancel the upload */
  signal?: AbortSignal;
}

/** Result of an upload operation */
export interface UploadResult {
  /** Public URL of the uploaded file */
  url: string;
  /** Storage path of the uploaded file (for deletion) */
  path: string;
}

// =============================================================================
// IStorageAdapter Interface
// =============================================================================

/**
 * Provider-agnostic storage adapter interface.
 *
 * Implementations:
 * - `FirebaseStorageAdapter` (Firebase Storage)
 * - Future: S3, Cloudflare R2, Supabase Storage adapters
 *
 * @version 0.1.0
 * @since 0.5.0
 */
export interface IStorageAdapter {
  /** Upload a file or blob to storage. Returns the public URL and storage path. */
  upload(file: File | Blob, options?: UploadOptions): Promise<UploadResult>;

  /** Delete a file by its URL or storage path. */
  delete(urlOrPath: string, options?: { signal?: AbortSignal }): Promise<void>;

  /** Get the public download URL for a storage path. */
  getUrl(path: string): Promise<string>;
}
