// packages/core/hooks/src/core/useMutation.ts

/**
 * @fileoverview useMutation Hook Wrapper - Framework-Enhanced TanStack Query
 * @description Wrapper around TanStack Query's useMutation with framework defaults,
 * error handling, and consistent patterns. Matches Firebase wrapper pattern.
 *
 * **Framework Enhancements:**
 * - Automatic default options (retry, retryDelay)
 * - Integrated error handling with handleError()
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

import { useMutation as tanstackUseMutation } from '@tanstack/react-query';

import { handleError } from '@donotdev/utils';

import type {
  UseMutationOptions,
  UseMutationResult,
  MutationFunctionContext,
} from '@tanstack/react-query';

/**
 * Framework default mutation options
 * These match the defaults in queryClient.ts for consistency
 */
const frameworkDefaults = {
  retry: 1,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
} as const;

/**
 * Enhanced useMutation hook with framework defaults and error handling
 *
 * **Framework Defaults Applied:**
 * - `retry: 1` (one retry attempt on failure)
 * - `retryDelay: exponential backoff` (1s, 2s, 4s, ... max 30s)
 *
 * **Error Handling:**
 * - Errors are automatically wrapped with handleError()
 * - User-friendly error messages
 * - Optional notification display
 *
 * @template TData - Mutation data type
 * @template TError - Error type (defaults to Error)
 * @template TVariables - Variables type
 * @template TContext - Context type for optimistic updates
 * @param options - Mutation options (framework defaults merged with user options)
 * @returns Mutation result with reactive loading states
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useMutation({
 *   mutationFn: (data) => createUser(data),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With custom error handling
 * const { mutate } = useMutation({
 *   mutationFn: (data) => createUser(data),
 *   userMessage: 'Failed to create user',
 *   showNotification: true,
 *   onError: (error) => {
 *     console.error('Custom error handler', error);
 *   },
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseMutationOptionsWithErrorHandling<
  TData,
  TError = Error,
  TVariables = void,
  TContext = unknown,
> extends UseMutationOptions<TData, TError, TVariables, TContext> {
  /** User-friendly error message (optional) */
  userMessage?: string;
  /** Show toast notification on error (default: false) */
  showNotification?: boolean;
}

export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptionsWithErrorHandling<
    TData,
    TError,
    TVariables,
    TContext
  >
): UseMutationResult<TData, TError, TVariables, TContext> {
  const {
    userMessage,
    showNotification = false,
    onError,
    ...mutationOptions
  } = options;

  // Merge framework defaults with user options (user options take precedence)
  const mergedOptions: UseMutationOptions<TData, TError, TVariables, TContext> =
    {
      ...frameworkDefaults,
      ...mutationOptions,
      onError: (
        error: TError,
        variables: TVariables,
        onMutateResult: TContext | undefined,
        context: MutationFunctionContext
      ) => {
        // Wrap error with framework error handler
        const wrappedError = handleError(error as Error, {
          userMessage: userMessage || 'Mutation failed',
          showNotification,
        });

        // Call user's error handler if provided (with correct signature)
        onError?.(wrappedError as TError, variables, onMutateResult, context);
      },
    };

  return tanstackUseMutation<TData, TError, TVariables, TContext>(
    mergedOptions
  );
}

// Re-export types for convenience
export type {
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';
