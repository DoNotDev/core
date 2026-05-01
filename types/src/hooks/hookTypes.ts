// packages/core/types/src/hooks/hookTypes.ts

/**
 * @fileoverview Hook Types
 * @description Type definitions for hook types. Defines options for listing operations, pagination, filtering, and sorting used by hooks.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Options for listing operations.
 * Used to customize the behavior of list hooks.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ListOptions {
  /** The page number (1-indexed) to fetch */
  page?: number;
  /** The number of items per page */
  pageSize?: number;
  /** Filters to apply to the list */
  filters?: Record<string, any>;
  /** Sorting options */
  sort?: {
    /** The field to sort by */
    field: string;
    /** The direction to sort in */
    direction: 'asc' | 'desc';
  };
}

/**
 * Standard response for list operations.
 * Used by list hooks to return paginated data.
 * @template T - The type of items in the list
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ListResponse<T> {
  /** The items in the current page */
  items: T[];
  /** The total number of items across all pages */
  total: number;
  /** The current page number */
  page: number;
  /** The number of items per page */
  pageSize: number;
  /** Whether there are more pages to fetch */
  hasMore: boolean;
}

/**
 * Standard response for mutations.
 * Used by create, update, and delete hooks to return the result of the operation.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface MutationResponse {
  /** The ID of the affected entity */
  id: string;
  /** Additional fields that may be returned by the mutation */
  [key: string]: any;
}
