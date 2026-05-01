// packages/core/stores/src/templates/abortControllerStore.ts

/**
 * @fileoverview Abort controller store template
 * @description Zustand store for managing request cancellation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createDoNotDevStore } from '../createDoNotDevStore';

interface AbortControllerState {
  controllers: Map<string, AbortController>;
  createController: (key: string) => AbortController;
  abortController: (key: string) => void;
  abortAll: () => void;
}

/**
 * Abort controller store for managing request cancellation
 *
 * **Architecture:**
 * This store provides centralized management of AbortController instances
 * for canceling HTTP requests and other async operations. It ensures
 * proper cleanup and prevents memory leaks from abandoned requests.
 *
 * **State Management:**
 * - `controllers`: Map of active AbortController instances keyed by request ID
 * - `isReady`: Store initialization state
 *
 * **Integration Points:**
 * - HTTP request cancellation
 * - Async operation cleanup
 * - Component unmount handling
 * - Framework request management
 *
 * **Performance Features:**
 * - Efficient controller management with Map-based storage
 * - Automatic cleanup of abandoned controllers
 * - Memory leak prevention
 * - Zustand optimization for state management
 *
 * **SSR Compatibility:**
 * - Initializes with safe default values
 * - No client-only dependencies in store definition
 * - Hydration-safe state transitions
 *
 * @example
 * ```tsx
 * // Create controller for request
 * const { createController } = useAbortControllerStore();
 * const controller = createController('user-fetch');
 *
 * // Cancel specific request
 * const { abortController } = useAbortControllerStore();
 * abortController('user-fetch');
 *
 * // Cancel all requests
 * const { abortAll } = useAbortControllerStore();
 * abortAll();
 * ```
 */
export const useAbortControllerStore =
  createDoNotDevStore<AbortControllerState>({
    name: 'abort',
    createStore: (set, get) => ({
      controllers: new Map(),

      /**
       * Create a new AbortController for the specified key
       *
       * Creates a new AbortController and stores it in the controllers map.
       * If a controller already exists for the key, it will be aborted and
       * replaced with the new one.
       *
       * @param key - Unique identifier for the controller
       * @returns The created AbortController instance
       *
       * @example
       * ```tsx
       * const { createController } = useAbortControllerStore();
       *
       * // Create controller for API request
       * const controller = createController('user-profile');
       *
       * // Use with fetch
       * fetch('/api/user', { signal: controller.signal });
       * ```
       */
      createController: (key: string) => {
        const { controllers } = get();
        // Abort any existing controller with the same key
        if (controllers.has(key)) {
          controllers.get(key)?.abort();
        }
        const controller = new AbortController();
        // W-NEW-13 fix: go through set() so Zustand subscribers are notified
        const updated = new Map(controllers);
        updated.delete(key);
        updated.set(key, controller);
        set({ controllers: updated });
        return controller;
      },

      /**
       * Abort a specific controller by key
       *
       * Aborts the controller associated with the specified key and removes
       * it from the controllers map. This is useful for canceling specific
       * requests or operations.
       *
       * @param key - The key of the controller to abort
       *
       * @example
       * ```tsx
       * const { abortController } = useAbortControllerStore();
       *
       * // Cancel specific request
       * abortController('user-profile');
       * ```
       */
      abortController: (key: string) => {
        const { controllers } = get();
        const controller = controllers.get(key);
        if (controller) {
          controller.abort();
          // W-NEW-13 fix: go through set() so Zustand subscribers are notified
          const updated = new Map(controllers);
          updated.delete(key);
          set({ controllers: updated });
        }
      },

      /**
       * Abort all active controllers
       *
       * Aborts all controllers in the map and clears the controllers collection.
       * This is useful for cleanup operations, such as when navigating away
       * from a page or when the application is shutting down.
       *
       * @example
       * ```tsx
       * const { abortAll } = useAbortControllerStore();
       *
       * // Cancel all requests
       * abortAll();
       *
       * // Or use in cleanup
       * useEffect(() => {
       *   return () => abortAll();
       * }, []);
       * ```
       */
      abortAll: () => {
        const { controllers } = get();
        controllers.forEach((controller: AbortController) =>
          controller.abort()
        );
        // W-NEW-13 fix: go through set() so Zustand subscribers are notified
        set({ controllers: new Map() });
      },
    }),
    initialize: async () => {
      // Abort controller store doesn't require complex initialization
      // Just mark as ready since it's already functional
      return true;
    },
  });
