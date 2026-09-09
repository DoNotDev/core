// packages/core/stores/src/createDoNotDevStore.ts

/**
 * @fileoverview DoNotDev store factory
 * @description Factory function for creating Zustand stores with framework conventions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { create } from 'zustand';
import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { PersistOptions } from 'zustand/middleware';

import type { BaseStoreActions, BaseStoreState } from '@donotdev/types';
import { isClient, isDev } from '@donotdev/utils';

/**
 * DoNotDev store interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DoNotDevStore extends BaseStoreActions, BaseStoreState {
  readonly isReady: boolean;
  readonly _hasHydrated?: boolean;
  initialize(data?: Record<string, unknown>): Promise<boolean>;
  cleanup?(): void;
}

/**
 * Configuration for creating a DoNotDev store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DoNotDevStoreConfig<T> {
  name: string;
  createStore: (
    set: (
      partial:
        | Partial<T & DoNotDevStore>
        | ((state: T & DoNotDevStore) => Partial<T & DoNotDevStore>)
    ) => void,
    get: () => T & DoNotDevStore,
    api: StoreApi<T & DoNotDevStore>
  ) => T;
  initialize?: (data?: Record<string, unknown>) => Promise<boolean>;
  cleanup?: () => void;
  /**
   * Optional persist configuration
   * When provided, store state is persisted to storage
   *
   * @since 0.0.1
   */
  persistOptions?: Omit<
    PersistOptions<T & DoNotDevStore, Partial<T & DoNotDevStore>>,
    'name'
  > & {
    /** Storage key name (required) */
    name: string;
  };
}

/**
 * Creates a DoNotDev store with framework conventions
 *
 * ## Usage Rules — READ vs CALL
 *
 * **Reading state (reactive):** Use selector hooks — component re-renders when value changes.
 * ```ts
 * const user = useAuthStore((s) => s.user);          // ✅ Reactive state
 * const isReady = useFormStore((s) => s.isReady);     // ✅ Reactive state
 * ```
 *
 * **Calling actions (imperative):** Use `getState()` — no subscription, stable reference.
 * ```ts
 * useEffect(() => {
 *   useFormStore.getState().setIsDirty(formId, true); // ✅ Action via getState
 *   return () => {
 *     useUploadStore.getState().unregisterUpload(id); // ✅ Cleanup via getState
 *   };
 * }, [formId]);
 * ```
 *
 * **NEVER** select actions via hooks or put them in dependency arrays:
 * ```ts
 * const setDirty = useFormStore((s) => s.setIsDirty);  // ❌ Creates subscription
 * useEffect(() => { setDirty(id, true); }, [setDirty]); // ❌ Infinite loop risk
 *
 * const store = useUploadStore();                       // ❌ Entire store = new ref every update
 * useEffect(() => { ... }, [store]);                    // ❌ Infinite loop
 * ```
 *
 * Middleware (devtools, persist) can break action reference stability,
 * making `getState()` the only safe pattern for imperative store access.
 *
 * @remarks
 * The `Record<string, any>` constraint on `T` is intentional. Using `unknown` instead of `any`
 * breaks all consumer store definitions because TypeScript's mapped types and index signatures
 * are incompatible with `unknown` in this position. Specifically, store state types use index
 * signatures (e.g., `[key: string]: ...`) that require `any` to satisfy the constraint.
 * This is a known TypeScript limitation — not a code quality issue.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createDoNotDevStore<T extends Record<string, any>>(
  config: DoNotDevStoreConfig<T>
) {
  const {
    name,
    createStore: storeCreator,
    initialize,
    cleanup,
    persistOptions,
  } = config;

  // ========== SINGLETON PATTERN START ==========
  // Initialize global stores registry
  if (typeof globalThis !== 'undefined') {
    if (!globalThis._DNDEV_STORES_) {
      globalThis._DNDEV_STORES_ = {};
    }

    // Return cached store if it exists (CRITICAL: prevents multiple instances)
    if (globalThis._DNDEV_STORES_[name]) {
      return globalThis._DNDEV_STORES_[name] as UseBoundStore<
        StoreApi<T & DoNotDevStore>
      >;
    }
  }

  // ========== SINGLETON PATTERN END ==========

  // Wrap user's store with lifecycle methods
  const wrappedCreator: StateCreator<T & DoNotDevStore, [], []> = (
    set,
    get,
    api
  ) => {
    const userState = storeCreator(set, get, api);

    // Check if user provided custom reset
    const hasCustomReset =
      'reset' in userState && typeof userState.reset === 'function';

    return {
      ...userState,
      isReady: false,
      isLoading: false,
      error: null,
      // Hydration flag for persisted stores — false until onRehydrateStorage fires
      ...(persistOptions && { _hasHydrated: false }),

      initialize: async (data?: Record<string, unknown>): Promise<boolean> => {
        try {
          if (initialize) {
            const success = await initialize(data);
            if (success)
              set({ isReady: true } as unknown as Partial<T & DoNotDevStore>);
            return success;
          } else {
            set({ isReady: true } as unknown as Partial<T & DoNotDevStore>);
            return true;
          }
        } catch (error) {
          if (isDev()) {
            console.error(`[${name}] Initialization error:`, error);
          }
          set({ isReady: false } as unknown as Partial<T & DoNotDevStore>);
          return false;
        }
      },

      cleanup: (): void => {
        try {
          if (cleanup) cleanup();
        } catch (error) {
          if (isDev()) {
            console.error(`[${name}] Cleanup error:`, error);
          }
        }
      },

      setReady: (ready: boolean): void =>
        set({ isReady: ready } as unknown as Partial<T & DoNotDevStore>),
      setLoading: (loading: boolean): void =>
        set({ isLoading: loading } as unknown as Partial<T & DoNotDevStore>),
      setError: (error: string | null): void =>
        set({ error } as unknown as Partial<T & DoNotDevStore>),
      clearError: (): void =>
        set({ error: null } as unknown as Partial<T & DoNotDevStore>),
      // Only provide default reset if user didn't provide custom one
      ...(!hasCustomReset && {
        reset: (): void =>
          set({
            isReady: false,
            isLoading: false,
            error: null,
          } as unknown as Partial<T & DoNotDevStore>),
      }),
    } as unknown as T & DoNotDevStore;
  };

  /**
   * Create store with conditional middleware application
   * Order: devtools(persist(wrappedCreator)) when persist is enabled
   */
  let store: UseBoundStore<StoreApi<T & DoNotDevStore>>;

  if (persistOptions) {
    // With persistence: devtools(persist(...))
    store =
      isDev() && isClient()
        ? create<T & DoNotDevStore>()(
            devtools(persist(wrappedCreator, persistOptions), { name })
          )
        : create<T & DoNotDevStore>()(persist(wrappedCreator, persistOptions));

    // Zustand 5 built-in: set _hasHydrated after rehydration + user's onRehydrateStorage.
    // Guarded because persist middleware short-circuits without attaching `api.persist`
    // when running in non-browser environments (no window.localStorage) — e.g. SSR,
    // Bun-driven codegen tools that dynamically import entity modules.
    const persistApi = (
      store as unknown as {
        persist?: { onFinishHydration: (cb: () => void) => () => void };
      }
    ).persist;
    if (persistApi) {
      persistApi.onFinishHydration(() => {
        store.setState({ _hasHydrated: true } as Partial<T & DoNotDevStore>);
      });
    }
  } else {
    // Without persistence: devtools(...)
    store =
      isDev() && isClient()
        ? create<T & DoNotDevStore>()(devtools(wrappedCreator, { name }))
        : create<T & DoNotDevStore>()(wrappedCreator);
  }

  // ========== SINGLETON REGISTRATION START ==========
  // Cache the store globally for future imports
  if (typeof globalThis !== 'undefined') {
    if (!globalThis._DNDEV_STORES_) {
      globalThis._DNDEV_STORES_ = {};
    }
    globalThis._DNDEV_STORES_[name] = store;
  }
  // ========== SINGLETON REGISTRATION END ==========

  return store;
}

/**
 * Type guard to check if a store is a DoNotDev store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isDoNotDevStore(store: unknown): store is DoNotDevStore {
  return (
    store !== null &&
    typeof store === 'object' &&
    'initialize' in store &&
    typeof store.initialize === 'function' &&
    'isReady' in store
  );
}

/**
 * Extract the state type from a DoNotDev store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type DoNotDevStoreState<T> = T extends (...args: any[]) => infer R
  ? R extends DoNotDevStore
    ? R
    : never
  : never;
