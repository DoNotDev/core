// packages/core/hooks/src/core/useQuery.ts

/**
 * @fileoverview useQuery Hook Wrapper - Framework-Enhanced TanStack Query
 * @description Wrapper around TanStack Query's useQuery with framework defaults,
 * error handling, and SSR safety. Matches Firebase wrapper pattern.
 *
 * **Framework Enhancements:**
 * - Automatic default options (staleTime, retry, refetchOnWindowFocus)
 * - Integrated error handling with handleError()
 * - SSR safety helpers
 * - Consistent with framework patterns
 *
 * **Benefits:**
 * - API changes isolated to one place
 * - Consistent defaults across framework
 * - Better error messages
 * - Framework can add enhancements without breaking changes
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useQuery as tanstackUseQuery, isServer } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { handleError } from '@donotdev/utils';

import { useAppConfig } from '../providers/AppConfigProvider';

/**
 * Framework default query options (fallback when no config)
 * These match the defaults in queryClient.ts for consistency
 *
 * **Default Strategy: Infinite Cache**
 * - Data never becomes stale (staleTime: Infinity)
 * - No automatic refetch on window focus or reconnect
 * - Manual refresh via UI buttons or invalidation
 */
const frameworkDefaults = {
  staleTime: Infinity, // Never stale - manual refresh only
  retry: 1,
  refetchOnWindowFocus: false, // Manual refresh only
  refetchOnReconnect: false, // Manual refresh only
} as const;

/**
 * Enhanced useQuery hook with framework defaults and error handling
 *
 * **Framework Defaults Applied:**
 * - `staleTime: Infinity` (data never becomes stale - manual refresh only)
 * - `retry: 1` (one retry attempt on failure)
 * - `refetchOnWindowFocus: false` (no automatic refetch on focus)
 * - `refetchOnReconnect: false` (no automatic refetch on reconnect)
 *
 * **Error Handling:**
 * - Errors are automatically wrapped with handleError()
 * - User-friendly error messages
 * - Optional notification display
 *
 * **SSR Safety:**
 * - Automatically disables queries on server if `ssr: false` is set
 * - Preserves SSR behavior by default
 *
 * @template TData - Query data type
 * @template TError - Error type (defaults to Error)
 * @param options - Query options (framework defaults merged with user options)
 * @returns Query result with reactive loading states
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useQuery({
 *   queryKey: ['users', userId],
 *   queryFn: () => fetchUser(userId),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With custom error handling
 * const { data } = useQuery({
 *   queryKey: ['users', userId],
 *   queryFn: () => fetchUser(userId),
 *   userMessage: 'Failed to load user',
 *   showNotification: true,
 *   onError: (error) => {
 *     console.error('Custom error handler', error);
 *   },
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Disable SSR for client-only queries
 * const { data } = useQuery({
 *   queryKey: ['client-only'],
 *   queryFn: () => fetchClientData(),
 *   ssr: false, // Won't run on server
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseQueryOptionsWithErrorHandling<
  TData,
  TError = Error,
> extends UseQueryOptions<TData, TError> {
  /** User-friendly error message (optional) */
  userMessage?: string;
  /** Show toast notification on error (default: false) */
  showNotification?: boolean;
  /** Disable query on server (default: false, preserves SSR) */
  ssr?: boolean;
  /** Custom error handler (optional) */
  onError?: (error: TError) => void;
}

export function useQuery<TData = unknown, TError = Error>(
  options: UseQueryOptionsWithErrorHandling<TData, TError>
): UseQueryResult<TData, TError> {
  const {
    userMessage,
    showNotification = false,
    ssr = true,
    onError,
    enabled,
    ...queryOptions
  } = options;

  // Get query config from app config (if available)
  const config = useAppConfig();
  const queryConfig = config?.query;

  // Build defaults from app config or framework defaults
  const appDefaults = useMemo(
    () => ({
      staleTime: queryConfig?.staleTime ?? frameworkDefaults.staleTime,
      retry: queryConfig?.retry ?? frameworkDefaults.retry,
      refetchOnWindowFocus:
        queryConfig?.refetchOnWindowFocus ??
        frameworkDefaults.refetchOnWindowFocus,
      refetchOnReconnect:
        queryConfig?.refetchOnReconnect ?? frameworkDefaults.refetchOnReconnect,
    }),
    [queryConfig]
  );

  // SSR safety: disable query on server if ssr: false
  const isServerSide = isServer;
  const shouldEnable = enabled !== false && (ssr || !isServerSide);

  // Merge app defaults with user options (user options take precedence)
  const mergedOptions: UseQueryOptions<TData, TError> = {
    ...appDefaults,
    ...queryOptions,
    enabled: shouldEnable,
  };

  const result = tanstackUseQuery<TData, TError>(mergedOptions);

  // Handle errors via useEffect (TanStack Query v5 doesn't support onError in options)
  useEffect(() => {
    if (result.error) {
      // Wrap error with framework error handler
      const wrappedError = handleError(result.error, {
        userMessage: userMessage || 'Query failed',
        showNotification,
      });

      // Call user's error handler if provided
      onError?.(wrappedError as TError);
    }
  }, [result.error, userMessage, showNotification, onError]);

  return result;
}
