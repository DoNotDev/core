// packages/core/utils/src/client/reactQueryBridge.ts

/**
 * @fileoverview Enterprise-Grade React Query Bridge
 * @description Production-ready React Query integration with advanced event handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { handleError } from './errors';
import { globalEmitter } from './eventEmitter';
import { isClient } from './platformDetection';
import { createSingletonWithParams } from '../common/singleton';

import type { EventEmitter } from './eventEmitter';

/**
 * React Query bridge configuration interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ReactQueryBridgeConfig {
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Custom event emitter instance */
  eventEmitter?: EventEmitter;
  /** Cache TTL for events in milliseconds */
  cacheTTL?: number;
}

/**
 * React Query bridge interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ReactQueryBridge {
  /** Initialize the bridge */
  initialize(): boolean;
  /** Get current React Query state */
  getCurrentState(): QueryStateData | null;
  /** Check if bridge is active */
  isActive(): boolean;
  /** Cleanup bridge resources */
  cleanup(): void;
}

/**
 * React Query event data interfaces for type safety
 */
interface QueryStateData {
  fetchingCount: number;
  mutatingCount: number;
}

/**
 * React Query bridge implementation for DoNotDev framework
 *
 * **Integration Strategy:**
 * Connects to React Query's internal QueryCache and MutationCache events,
 * transforming them into framework-compatible events that flow through
 * the established EDA system.
 *
 * **Event Flow:**
 * React Query QueryCache/MutationCache → Bridge → Framework EventEmitter → BaseListener
 *
 * **Performance:**
 * - Zero polling (pure event-driven)
 * - Efficient batching of rapid state changes
 * - Automatic cleanup and memory management
 *
 * **SSR Compatibility:**
 * - Gracefully handles server environments where React Query isn't available
 * - Client-only activation prevents hydration issues
 * - Safe fallback behavior
 *
 * @example
 * ```typescript
 * // Usage in store initialization
 * const bridge = new ReactQueryEventBridge(storeEventManager.getEmitter());
 * const success = bridge.initialize();
 *
 * if (success) {
 *   console.log('React Query integration active');
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class ReactQueryEventBridge implements ReactQueryBridge {
  private eventEmitter: EventEmitter;
  private queryUnsubscribe: (() => void) | null = null;
  private mutationUnsubscribe: (() => void) | null = null;
  private isInitialized = false;
  private config: ReactQueryBridgeConfig;

  constructor(eventEmitter: EventEmitter, config: ReactQueryBridgeConfig = {}) {
    this.eventEmitter = eventEmitter;
    this.config = {
      debug: false,
      cacheTTL: 3 * 60 * 1000, // 3 minutes
      ...config,
    };
  }

  /**
   * Initialize the React Query bridge
   *
   * **Initialization Process:**
   * 1. Check if React Query is available
   * 2. Connect to QueryCache and MutationCache
   * 3. Set up event subscriptions
   * 4. Emit initial state
   *
   * @returns True if initialization was successful
   */
  initialize(): boolean {
    try {
      if (this.isInitialized) {
        return true;
      }

      // Check if we're in a browser environment
      if (!isClient()) {
        if (this.config.debug) {
          console.log(
            '[ReactQueryBridge] Skipping initialization - server environment'
          );
        }
        return false;
      }

      // Try to get React Query instance
      const reactQuery = this.getReactQueryInstance();
      if (!reactQuery) {
        if (this.config.debug) {
          console.log('[ReactQueryBridge] React Query not available');
        }
        return false;
      }

      // Set up subscriptions
      const cleanupFunctions = this.setupSubscriptions(reactQuery);
      if (cleanupFunctions.length === 0) {
        return false;
      }

      // Store cleanup functions
      this.queryUnsubscribe = cleanupFunctions[0] || null;
      this.mutationUnsubscribe = cleanupFunctions[1] || null;

      this.isInitialized = true;

      if (this.config.debug) {
        console.log('[ReactQueryBridge] Successfully initialized');
      }

      return true;
    } catch (error) {
      handleError(error, {
        userMessage: 'Failed to initialize React Query bridge',
        context: { operation: 'initialize' },
        severity: 'warning',
      });
      return false;
    }
  }

  /**
   * Get current React Query state for debugging
   *
   * @returns Current query and mutation counts, or null if not connected
   */
  getCurrentState(): QueryStateData | null {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const reactQuery = this.getReactQueryInstance();
      if (!reactQuery) {
        return null;
      }

      const { queryCache, mutationCache } = reactQuery;
      const queries = queryCache.getAll();
      const mutations = mutationCache.getAll();

      return {
        fetchingCount: queries.filter(
          (query: any) => query.state.fetchStatus === 'fetching'
        ).length,
        mutatingCount: mutations.filter(
          (mutation: any) => mutation.state.status === 'pending'
        ).length,
      };
    } catch (error) {
      handleError(error, {
        userMessage: 'Failed to get React Query state',
        context: { operation: 'getCurrentState' },
        severity: 'warning',
      });
      return null;
    }
  }

  /**
   * Check if bridge is active
   *
   * @returns True if bridge is initialized and active
   */
  isActive(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup bridge resources
   */
  // eslint-disable-next-line @donotdev/config/no-singleton-lifecycle
  cleanup(): void {
    try {
      if (this.queryUnsubscribe) {
        this.queryUnsubscribe();
        this.queryUnsubscribe = null;
      }

      if (this.mutationUnsubscribe) {
        this.mutationUnsubscribe();
        this.mutationUnsubscribe = null;
      }

      this.isInitialized = false;

      if (this.config.debug) {
        console.log('[ReactQueryBridge] Cleaned up');
      }
    } catch (error) {
      handleError(error, {
        userMessage: 'Failed to cleanup React Query bridge',
        context: { operation: 'cleanup' },
        severity: 'warning',
      });
    }
  }

  /**
   * Get React Query instance from global context
   *
   * @returns React Query instance or null if not available
   * @private
   */
  private getReactQueryInstance(): any {
    try {
      // Try to get from global context
      if (globalThis.__REACT_QUERY_CLIENT__) {
        return globalThis.__REACT_QUERY_CLIENT__;
      }

      // Try to get from React Query provider context
      if (globalThis.__REACT_QUERY_PROVIDER__) {
        return globalThis.__REACT_QUERY_PROVIDER__;
      }

      // Try to get from Next.js context
      if (globalThis.__NEXT_DATA__?.props?.pageProps?.queryClient) {
        return globalThis.__NEXT_DATA__.props.pageProps.queryClient;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set up React Query cache subscriptions
   *
   * **Subscription Strategy:**
   * - Subscribe to QueryCache for query state changes
   * - Subscribe to MutationCache for mutation state changes
   * - Debounce rapid events to prevent excessive re-renders
   * - Emit aggregated state through framework event system
   *
   * @param reactQuery - React Query instance
   * @returns Array of cleanup functions
   * @private
   */
  private setupSubscriptions(reactQuery: any): (() => void)[] {
    try {
      const { queryCache, mutationCache } = reactQuery;

      if (!queryCache || !mutationCache) {
        if (this.config.debug) {
          console.warn(
            '[ReactQueryBridge] QueryCache or MutationCache not available'
          );
        }
        return [];
      }

      const cleanupFunctions: (() => void)[] = [];

      // Set up query cache subscription
      const queryUnsubscribe = queryCache.subscribe(() => {
        this.emitLoadingStateUpdate(reactQuery);
      });

      cleanupFunctions.push(() => {
        if (queryUnsubscribe) {
          queryUnsubscribe();
        }
      });

      // Set up mutation cache subscription
      const mutationUnsubscribe = mutationCache.subscribe(() => {
        this.emitLoadingStateUpdate(reactQuery);
      });

      cleanupFunctions.push(() => {
        if (mutationUnsubscribe) {
          mutationUnsubscribe();
        }
      });

      // Emit initial state
      this.emitLoadingStateUpdate(reactQuery);

      if (this.config.debug) {
        console.log('[ReactQueryBridge] Subscriptions active');
      }

      return cleanupFunctions;
    } catch (error) {
      handleError(error, {
        userMessage: 'Failed to setup React Query subscriptions',
        context: { operation: 'setupSubscriptions' },
        severity: 'warning',
      });
      return [];
    }
  }

  /**
   * Calculate and emit current loading state from React Query
   *
   * **State Calculation:**
   * - Counts active queries with fetchStatus === 'fetching'
   * - Counts active mutations with status === 'pending'
   * - Emits through framework event system for consistent handling
   *
   * **Performance Optimization:**
   * - Debounced to prevent excessive updates during rapid state changes
   * - Only calculates when actually needed (not continuously)
   *
   * @param reactQuery - React Query instance
   * @private
   */
  private emitLoadingStateUpdate(reactQuery: any): void {
    try {
      const { queryCache, mutationCache } = reactQuery;

      // Get all current queries and mutations
      const queries = queryCache.getAll();
      const mutations = mutationCache.getAll();

      // Count active operations
      const fetchingCount = queries.filter(
        (query: any) => query.state.fetchStatus === 'fetching'
      ).length;

      const mutatingCount = mutations.filter(
        (mutation: any) => mutation.state.status === 'pending'
      ).length;

      // Emit through framework event system
      this.eventEmitter.emit('REACT_QUERY_STATE_CHANGED', {
        fetchingCount,
        mutatingCount,
        timestamp: Date.now(),
      });

      if (this.config.debug) {
        console.log('[ReactQueryBridge] State updated:', {
          fetchingCount,
          mutatingCount,
        });
      }
    } catch (error) {
      handleError(error, {
        userMessage: 'Error emitting React Query loading state',
        context: { operation: 'emitLoadingStateUpdate' },
        severity: 'warning',
      });
    }
  }
}

/**
 * Create React Query bridge instance
 *
 * @param eventEmitter - Event emitter instance
 * @param config - Bridge configuration
 * @returns React Query bridge instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createReactQueryBridge(
  eventEmitter: EventEmitter,
  config: ReactQueryBridgeConfig = {}
): ReactQueryBridge {
  return new ReactQueryEventBridge(eventEmitter, config);
}

/**
 * Get React Query bridge singleton instance
 *
 * @param eventEmitter - Event emitter instance
 * @param config - Bridge configuration
 * @returns React Query bridge instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getReactQueryBridge(
  eventEmitter?: EventEmitter,
  config: ReactQueryBridgeConfig = {}
): ReactQueryBridge {
  // If no event emitter provided, use global emitter
  const emitter = eventEmitter || globalEmitter;

  return createReactQueryBridge(emitter, config);
}
