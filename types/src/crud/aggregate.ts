// packages/core/types/src/crud/aggregate.ts

/**
 * @fileoverview Aggregation Types
 * @description Types for generic entity aggregation/analytics functions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { CRUD_OPERATORS } from './constants';

/** Supported aggregation operations */
export const AGGREGATE_OPERATIONS = {
  COUNT: 'count',
  SUM: 'sum',
  AVG: 'avg',
  MIN: 'min',
  MAX: 'max',
} as const;

/** Aggregation operation type derived from AGGREGATE_OPERATIONS constant. */
export type AggregateOperation =
  (typeof AGGREGATE_OPERATIONS)[keyof typeof AGGREGATE_OPERATIONS];

/** Filter operators for aggregation (subset of CRUD_OPERATORS) */
export const AGGREGATE_FILTER_OPERATORS = {
  EQ: CRUD_OPERATORS.EQ,
  NEQ: CRUD_OPERATORS.NEQ,
  LT: CRUD_OPERATORS.LT,
  LTE: CRUD_OPERATORS.LTE,
  GT: CRUD_OPERATORS.GT,
  GTE: CRUD_OPERATORS.GTE,
} as const;

/** Filter operator type for aggregation queries. */
export type AggregateFilterOperator =
  (typeof AGGREGATE_FILTER_OPERATORS)[keyof typeof AGGREGATE_FILTER_OPERATORS];

/**
 * Single metric definition for aggregation
 *
 * @example
 * ```typescript
 * // Count all documents
 * { field: '*', operation: 'count', as: 'total' }
 *
 * // Sum a numeric field
 * { field: 'price', operation: 'sum', as: 'totalValue' }
 *
 * // Count with filter
 * {
 *   field: '*',
 *   operation: 'count',
 *   as: 'availableCount',
 *   filter: { field: 'status', operator: '==', value: 'available' }
 * }
 * ```
 */
export interface MetricDefinition {
  /** Field to aggregate ('*' for count all) */
  field: string;
  /** Aggregation operation */
  operation: AggregateOperation;
  /** Output name for this metric */
  as: string;
  /** Optional filter for this metric */
  filter?: {
    field: string;
    operator: AggregateFilterOperator;
    value: any;
  };
}

/**
 * Group by definition for aggregation
 *
 * @example
 * ```typescript
 * {
 *   field: 'status',
 *   metrics: [
 *     { field: '*', operation: 'count', as: 'count' },
 *     { field: 'price', operation: 'sum', as: 'value' },
 *   ]
 * }
 * ```
 */
export interface GroupByDefinition {
  /** Field to group by */
  field: string;
  /** Metrics to compute per group */
  metrics: MetricDefinition[];
}

/**
 * Aggregation configuration for entity analytics
 *
 * @example
 * ```typescript
 * const carsAnalyticsConfig: AggregateConfig = {
 *   metrics: [
 *     { field: '*', operation: 'count', as: 'total' },
 *     { field: 'price', operation: 'sum', as: 'totalValue' },
 *     { field: 'price', operation: 'avg', as: 'avgPrice' },
 *   ],
 *   groupBy: [
 *     {
 *       field: 'status',
 *       metrics: [
 *         { field: '*', operation: 'count', as: 'count' },
 *         { field: 'price', operation: 'sum', as: 'value' },
 *       ],
 *     },
 *   ],
 *   where: [['isActive', '==', true]],
 * };
 * ```
 */
export interface AggregateConfig {
  /** Top-level metrics (computed on entire collection) */
  metrics?: MetricDefinition[];
  /** Group by configurations */
  groupBy?: GroupByDefinition[];
  /** Optional global filters */
  where?: Array<[string, AggregateFilterOperator | string, unknown]>;
}

/**
 * Request payload for aggregate function calls
 */
export interface AggregateRequest {
  /** Optional runtime filters (merged with config filters) */
  where?: Array<[string, AggregateFilterOperator | string, unknown]>;
  /** Optional date range filter */
  dateRange?: {
    field: string;
    start?: string;
    end?: string;
  };
}

/**
 * Response from aggregate function
 */
export interface AggregateResponse {
  /** Computed top-level metrics */
  metrics: Record<string, number | null>;
  /** Grouped metrics by field */
  groups: Record<string, Record<string, Record<string, number | null>>>;
  /** Metadata about the aggregation */
  meta: {
    collection: string;
    totalDocs: number;
    computedAt: string;
  };
}
