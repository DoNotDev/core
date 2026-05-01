// packages/core/hooks/src/core/queryTypes.ts

/**
 * @fileoverview TanStack Query Type Re-exports
 * @description Re-exports commonly used TanStack Query types for convenience.
 * Matches Firebase wrapper pattern of re-exporting types.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export commonly used types (QueryOptions omitted: @donotdev/types exports CRUD QueryOptions from core)
export type {
  QueryClient,
  QueryClientProviderProps,
  QueryKey,
  QueryFunction,
  MutationOptions,
  UseQueryOptions,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

// Re-export QueryClientProvider component and useQueryClient hook
export { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
