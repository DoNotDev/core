// packages/core/hooks/src/core/useDebounce.ts

/**
 * @fileoverview useDebounce Hook - Debounced Value Management
 * @description High-performance hook for debouncing values with optimal performance
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Configurable delay with immediate execution option
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React
 *
 * Performance:
 * - Efficient timeout management
 * - Automatic cleanup prevents memory leaks
 * - Minimal re-renders with optimized state updates
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Options for useDebounce hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseDebounceOptions<T = any> {
  /**
   * Debounce delay in milliseconds
   * @default 500
   */
  delay?: number;

  /**
   * Whether to execute immediately on first call
   * @default false
   */
  immediate?: boolean;

  /**
   * Initial value for SSR
   */
  initialValue?: T;
}

/**
 * useDebounce - Debounced Value Management Hook
 *
 * High-performance hook for debouncing values with configurable delay and
 * immediate execution options. Perfect for search inputs, API calls, and
 * expensive computations.
 *
 * @template T - Type of the value being debounced
 * @param value - Value to debounce
 * @param options - Configuration options for debouncing
 * @returns Debounced value
 *
 * @example Search input debouncing
 * ```tsx
 * function SearchInput() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, { delay: 300 });
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       // Perform search API call
 *       searchAPI(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return (
 *     <input
 *       type="text"
 *       value={query}
 *       onChange={(e) => setQuery(e.target.value)}
 *       placeholder="Search..."
 *     />
 *   );
 * }
 * ```
 *
 * @example API call debouncing
 * ```tsx
 * function ApiComponent() {
 *   const [data, setData] = useState(null);
 *   const [loading, setLoading] = useState(false);
 *   const debouncedId = useDebounce(id, { delay: 500 });
 *
 *   useEffect(() => {
 *     if (debouncedId) {
 *       setLoading(true);
 *       fetchData(debouncedId).then(setData).finally(() => setLoading(false));
 *     }
 *   }, [debouncedId]);
 *
 *   return (
 *     <div>
 *       {loading && <Spinner />}
 *       {data && <DataDisplay data={data} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Form validation debouncing
 * ```tsx
 * function FormInput() {
 *   const [value, setValue] = useState('');
 *   const [error, setError] = useState('');
 *   const debouncedValue = useDebounce(value, { delay: 300 });
 *
 *   useEffect(() => {
 *     if (debouncedValue) {
 *       validateInput(debouncedValue).then(setError);
 *     }
 *   }, [debouncedValue]);
 *
 *   return (
 *     <div>
 *       <input
 *         value={value}
 *         onChange={(e) => setValue(e.target.value)}
 *         className={error ? 'border-red-500' : 'border-gray-300'}
 *       />
 *       {error && <p className="text-red-500">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Immediate execution
 * ```tsx
 * function ImmediateDebounce() {
 *   const [value, setValue] = useState('');
 *   const debouncedValue = useDebounce(value, {
 *     delay: 200,
 *     immediate: true
 *   });
 *
 *   // Executes immediately on first call, then debounces
 *   useEffect(() => {
 *     console.log('Value changed:', debouncedValue);
 *   }, [debouncedValue]);
 *
 *   return (
 *     <input
 *       value={value}
 *       onChange={(e) => setValue(e.target.value)}
 *     />
 *   );
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useDebounce<T>(value: T, options: UseDebounceOptions = {}): T {
  const { delay = 500, immediate = false, initialValue = value } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current && immediate) {
      setDebouncedValue(value);
      isFirstRun.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, immediate]);

  return debouncedValue;
}
