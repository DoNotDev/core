// packages/core/types/src/providers/registry.ts

/**
 * @fileoverview Provider Registry Types
 * @description Types for pluggable backends (CRUD, auth, storage, callable).
 * Consumers call `configureProviders()` once at app startup; `useCrud` and auth hooks
 * use these providers. Import `config/providers` from main.tsx before any CRUD usage.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import type { AuthProvider } from '../auth/types';
import type { ICrudAdapter } from '../crud/adapter';
import type { IStorageAdapter } from '../storage/adapter';
import type { IServerAuthAdapter } from '../auth/serverAdapter';
import type { ICallableProvider } from './callable';

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * All pluggable providers for the DoNotDev framework.
 *
 * - **crud** (required): CRUD adapter. Required for `useCrud` and entity operations.
 * - **auth** (optional): Client auth. Omit if using external auth.
 * - **storage** (optional): File/image storage. Omit if no uploads.
 * - **serverAuth** (optional): Server-side token verification.
 * - **callable** (optional): Server function invocation (e.g. Supabase Edge Functions).
 *
 * @example Firebase
 * ```typescript
 * configureProviders({
 *   crud: new FirestoreAdapter(),
 *   auth: new FirebaseAuth(),
 *   storage: new FirebaseStorageAdapter(),
 * });
 * ```
 *
 * @example Supabase
 * ```typescript
 * configureProviders({
 *   crud: new SupabaseCrudAdapter(supabase),
 *   auth: new SupabaseAuth(supabase),
 *   storage: new SupabaseStorageAdapter(supabase, 'your-bucket'),
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.5.0
 */
export interface DndevProviders {
  /** Client-side authentication provider */
  auth?: AuthProvider;
  /** Server-side token verification and user management */
  serverAuth?: IServerAuthAdapter;
  /** Database / CRUD operations (required) */
  crud: ICrudAdapter;
  /** File and image storage */
  storage?: IStorageAdapter;
  /** Server-side function invocation (Edge Functions, Cloud Functions, API routes) */
  callable?: ICallableProvider;
}
