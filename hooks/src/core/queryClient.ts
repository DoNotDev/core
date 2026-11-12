// packages/core/hooks/src/core/queryClient.ts

/**
 * @fileoverview React Query client configuration (SSR-safe)
 * @description QueryClient factory with proper SSR isolation
 *
 * **SSR Safety:**
 * - On server: Creates new QueryClient per request (isolates user data)
 * - On client: Reuses singleton (preserves cache between navigations)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { QueryClient, isServer } from '@tanstack/react-query';

import type { QueryConfig } from '@donotdev/types';

/**
 * Framework default QueryClient options
 * These are used when no app config is provided
 *
 * **Default Strategy: Infinite Cache**
 * - Data never becomes stale (staleTime: Infinity)
 * - No automatic refetch on window focus or reconnect
 * - Manual refresh via UI buttons or invalidation
 * - Best for single-admin apps and cost optimization
 */
const frameworkDefaultOptions = {
  queries: {
    /** Time until data is considered stale (Infinity = never stale) */
    staleTime: Infinity,

    /** Time until inactive data is garbage collected (30 minutes) */
    gcTime: 1000 * 60 * 30,

    /** Number of retry attempts for failed queries */
    retry: 1,

    /** Whether to refetch when window regains focus (false = manual refresh only) */
    refetchOnWindowFocus: false,

    /** Whether to refetch on reconnect (false = manual refresh only) */
    refetchOnReconnect: false,
  },
  mutations: {
    /** Number of retry attempts for failed mutations */
    retry: 1,

    /** Exponential backoff for retries */
    retryDelay: (attemptIndex: number) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),
  },
};

/**
 * Build QueryClient default options from app config
 *
 * @param queryConfig - Optional query config from app
 * @returns QueryClient default options
 */
function buildDefaultOptions(queryConfig?: QueryConfig) {
  return {
    queries: {
      staleTime:
        queryConfig?.staleTime ?? frameworkDefaultOptions.queries.staleTime,
      gcTime: queryConfig?.gcTime ?? frameworkDefaultOptions.queries.gcTime,
      retry: queryConfig?.retry ?? frameworkDefaultOptions.queries.retry,
      refetchOnWindowFocus:
        queryConfig?.refetchOnWindowFocus ??
        frameworkDefaultOptions.queries.refetchOnWindowFocus,
      refetchOnReconnect:
        queryConfig?.refetchOnReconnect ??
        frameworkDefaultOptions.queries.refetchOnReconnect,
    },
    mutations: {
      retry:
        queryConfig?.mutationRetry ?? frameworkDefaultOptions.mutations.retry,
      retryDelay:
        queryConfig?.mutationRetryDelay ??
        frameworkDefaultOptions.mutations.retryDelay,
    },
  };
}

/**
 * Browser singleton instance
 */
let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Get or create QueryClient (SSR-safe)
 *
 * - Server: Always creates new instance (per-request isolation)
 * - Browser: Reuses singleton (cache persistence)
 *
 * @version 0.1.0
 * @since 0.0.3
 * @author AMBROISE PARK Consulting
 *
 * @example
 * ```tsx
 * // In your root layout/provider
 * function Providers({ children }) {
 *   const queryClient = getQueryClient();
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       {children}
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
export function getQueryClient(queryConfig?: QueryConfig): QueryClient {
  const defaultOptions = buildDefaultOptions(queryConfig);

  if (isServer) {
    // Server: Always create new instance for request isolation
    return new QueryClient({ defaultOptions });
  }

  // Browser: Create singleton on first access, reuse thereafter
  // Note: Config is applied only on first call (singleton pattern)
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient({ defaultOptions });
  }
  return browserQueryClient;
}

/**
 * Signed-in user id the browser cache was filled under: `undefined` until known (no
 * session snapshot, provider not ready), `null` signed out.
 */
let cacheIdentity: string | null | undefined = undefined;

/**
 * Track the signed-in identity the browser query cache serves. When it changes
 * (signed out → user, user → signed out, user → other user), every cached query is
 * reset before the new identity renders: data fetched under the previous identity (or
 * as anonymous with a dead session) is never served to the new one, and active queries
 * refetch with the new session.
 *
 * The first identity known is adopted without a reset: the request snapshot during
 * hydration (seed), else the auth provider's first state. So a server render and a
 * client that agree on the user keep the hydrated cache. No-op on the server
 * (per-request clients) and before the browser QueryClient exists.
 *
 * Called by the auth store on every auth transition (`setAuthenticated`,
 * `setUnauthenticated`) and by AuthSessionProvider with the snapshot (`seed`).
 *
 * @param userId - The signed-in user id, `null` signed out
 * @param seed - Adopt the identity only when none is known yet (never resets)
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function syncQueryCacheIdentity(
  userId: string | null,
  seed = false
): void {
  if (isServer) return;
  if (cacheIdentity === undefined) {
    cacheIdentity = userId;
    return;
  }
  if (seed || cacheIdentity === userId) return;
  cacheIdentity = userId;
  // Synchronous state reset (data gone before the next render), then active refetch
  void browserQueryClient?.resetQueries();
}
