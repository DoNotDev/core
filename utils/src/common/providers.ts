// packages/core/utils/src/common/providers.ts

/**
 * @fileoverview Provider Registry
 * @description Central registration point for all pluggable backends (CRUD, auth, storage).
 * Call `configureProviders()` once at app startup so that `useCrud`, auth, and storage work.
 * All framework code uses `getProvider()` — no direct backend imports in app code.
 *
 * **Required:** Import your `config/providers` module from the root component (e.g. App.tsx)
 * before any component that uses `useCrud`, auth, or storage.
 *
 * @example Firebase (Vite)
 * ```typescript
 * // App.tsx
 * import './config/providers';
 * // ...
 * ```
 * ```typescript
 * // config/providers.ts
 * import { configureProviders } from '@donotdev/core';
 * import { FirestoreAdapter, FirebaseAuth, FirebaseStorageAdapter } from '@donotdev/firebase';
 * configureProviders({
 *   crud: new FirestoreAdapter(),
 *   auth: new FirebaseAuth(),
 *   storage: new FirebaseStorageAdapter(),
 * });
 * ```
 *
 * @example Supabase
 * ```typescript
 * import { configureProviders } from '@donotdev/core';
 * import { SupabaseCrudAdapter, SupabaseAuth, SupabaseStorageAdapter } from '@donotdev/supabase';
 * const supabase = createClient(url, anonKey);
 * configureProviders({
 *   crud: new SupabaseCrudAdapter(supabase),
 *   auth: new SupabaseAuth(supabase),
 *   storage: new SupabaseStorageAdapter(supabase, 'your-bucket'),
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import type { DndevProviders } from '@donotdev/types';

import { getGlobalSingleton } from './singleton';

// =============================================================================
// Provider Registry (globalThis-backed to survive chunk splits)
// =============================================================================

interface ProviderState {
  providers: DndevProviders | null;
}

function getProviderState(): ProviderState {
  return getGlobalSingleton<ProviderState>('providers', () => ({
    providers: null,
  }));
}

/**
 * Configure all providers for the framework.
 * Must be called once at app startup, before any component uses `useCrud`, auth, or storage.
 * Typically called from a dedicated module (e.g. `config/providers.ts`) imported by main.tsx.
 *
 * @param providers - At least `crud`; optionally `auth`, `storage`, `serverAuth`, `callable`
 * @throws Does not throw; logs a warning if called more than once (use `resetProviders()` in tests)
 */
export function configureProviders(providers: DndevProviders): void {
  const state = getProviderState();
  if (state.providers) {
    console.warn(
      '[dndev] configureProviders() called more than once. Previous providers overwritten.'
    );
  }
  state.providers = providers;
}

/**
 * Get a configured provider by key.
 *
 * @param key - The provider key ('crud', 'auth', 'storage', 'serverAuth', 'callable')
 * @returns The provider instance
 * @throws If provider not configured
 */
export function getProvider<K extends keyof DndevProviders>(
  key: K
): NonNullable<DndevProviders[K]> {
  const { providers } = getProviderState();
  if (!providers) {
    throw new Error(
      `[dndev] Provider "${key}" not available. Call configureProviders() at app startup.`
    );
  }
  const provider = providers[key];
  if (!provider) {
    throw new Error(
      `[dndev] Provider "${key}" not configured. Pass it to configureProviders().`
    );
  }
  return provider as NonNullable<DndevProviders[K]>;
}

/**
 * Check if a provider is configured.
 *
 * @param key - The provider key to check
 * @returns true if the provider is configured
 */
export function hasProvider(key: keyof DndevProviders): boolean {
  return !!getProviderState().providers?.[key];
}

/**
 * Reset all providers. **Only for testing.**
 */
export function resetProviders(): void {
  getProviderState().providers = null;
}
