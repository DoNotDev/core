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
import type { Mutate, StateCreator, StoreApi, UseBoundStore } from 'zustand';
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
  /** Inject framework lifecycle state and actions (default). */
  lifecycle?: true;
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
 * Domain-owned store configuration. No framework lifecycle fields or actions are injected.
 * Singleton registration, devtools and persistence remain enabled.
 */
export interface DomainStoreConfig<T> {
  name: string;
  lifecycle: false;
  createStore: StateCreator<T, [], []>;
  persistOptions?: PersistOptions<T, Partial<T>>;
}

/**
 * Creates a DoNotDev store with framework conventions
 *
 * ## Usage Rules — READ vs CALL
 *
 * **Reading state (reactive):** Use selector hooks — component re-renders when value changes.
 * ```ts
 * const user = useAuthStore((s) => s.user);          // ✅ Reactive state
 * const isReady = useAuthStore((s) => s.isReady);     // ✅ Reactive state
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: interface-typed records have no implicit index signature; Record<string, unknown> would reject them
export function createDoNotDevStore<T extends Record<string, any>>(
  config: DoNotDevStoreConfig<T>
): UseBoundStore<StoreApi<T & DoNotDevStore>>;
/** Create a singleton domain store without injecting framework lifecycle members. */
export function createDoNotDevStore<T extends object>(
  config: DomainStoreConfig<T>
): UseBoundStore<StoreApi<T>>;
export function createDoNotDevStore<T extends object>(
  config: DoNotDevStoreConfig<T> | DomainStoreConfig<T>
): UseBoundStore<StoreApi<T & DoNotDevStore>> | UseBoundStore<StoreApi<T>> {
  if (config.lifecycle === false) {
    const { name, createStore: creator, persistOptions } = config;
    globalThis._DNDEV_STORES_ ??= {};
    const cached = globalThis._DNDEV_STORES_[name];
    // why: registry entries are heterogeneous and identified by their unique name.
    if (cached) return cached as UseBoundStore<StoreApi<T>>;

    const store = persistOptions
      ? isDev() && isClient()
        ? create<T>()(devtools(persist(creator, persistOptions), { name }))
        : create<T>()(persist(creator, persistOptions))
      : isDev() && isClient()
        ? create<T>()(devtools(creator, { name }))
        : create<T>()(creator);

    globalThis._DNDEV_STORES_[name] = store;
    return store;
  }

  const {
    name,
    createStore: storeCreator,
    initialize,
    cleanup,
    persistOptions,
  } = config;

  // why: Partial<T & DoNotDevStore> over a generic T is a deferred mapped type, so TS
  // cannot see that a patch of framework-owned fields fits it. One typed helper, not N casts.
  const patch = (fields: Partial<DoNotDevStore>) =>
    fields as Partial<T & DoNotDevStore>;

  // ========== SINGLETON PATTERN START ==========
  // Initialize global stores registry
  if (typeof globalThis !== 'undefined') {
    if (!globalThis._DNDEV_STORES_) {
      globalThis._DNDEV_STORES_ = {};
    }

    // Return cached store if it exists (CRITICAL: prevents multiple instances)
    if (globalThis._DNDEV_STORES_[name]) {
      // why: the global registry is keyed by name and holds heterogeneous stores
      return globalThis._DNDEV_STORES_[name] as UseBoundStore<
        StoreApi<T & DoNotDevStore>
      >;
    }
  }

  // ========== SINGLETON PATTERN END ==========

  // Per-instance creator result fills partial constructor writes during hydration.
  let completedCreatorState: (T & DoNotDevStore) | undefined;
  let constructing = true;

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

    completedCreatorState = {
      ...userState,
      isReady: false,
      isLoading: false,
      error: null,
      // Factory-owned metadata: true only after successful persist completion.
      ...(persistOptions && { _hasHydrated: false }),

      initialize: async (data?: Record<string, unknown>): Promise<boolean> => {
        try {
          if (initialize) {
            const success = await initialize(data);
            if (success) set(patch({ isReady: true }));
            return success;
          } else {
            set(patch({ isReady: true }));
            return true;
          }
        } catch (error) {
          if (isDev()) {
            console.error(`[${name}] Initialization error:`, error);
          }
          set(patch({ isReady: false }));
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

      setReady: (ready: boolean): void => set(patch({ isReady: ready })),
      setLoading: (loading: boolean): void =>
        set(patch({ isLoading: loading })),
      setError: (error: string | null): void => set(patch({ error })),
      clearError: (): void => set(patch({ error: null })),
      // Only provide default reset if user didn't provide custom one
      ...(!hasCustomReset && {
        reset: (): void =>
          set(
            patch({
              isReady: false,
              isLoading: false,
              error: null,
            })
          ),
      }),
      // why: spreading a generic T plus lifecycle fields; TS cannot prove the result is T & DoNotDevStore
    } as T & DoNotDevStore;
    return completedCreatorState;
  };

  /**
   * Create store with conditional middleware application
   * Order: devtools(persist(wrappedCreator)) when persist is enabled
   */
  let store: UseBoundStore<StoreApi<T & DoNotDevStore>>;

  if (persistOptions) {
    const persistedCreator = persist(wrappedCreator, {
      ...persistOptions,
      // Hydration status belongs to this factory, never to a saved snapshot.
      merge: (saved, current) => {
        // A synchronous creator set() can leave get() partial before hydration.
        // Keep its values, but supply the completed creator's missing members.
        const completeCurrent = constructing
          ? { ...completedCreatorState, ...current }
          : current;
        return {
          ...(persistOptions.merge
            ? persistOptions.merge(saved, completeCurrent)
            : { ...completeCurrent, ...(saved as Partial<T & DoNotDevStore>) }),
          _hasHydrated: false,
        };
      },
    });
    const hydrationCreator: typeof persistedCreator = (set, get, api) => {
      // Capture the outer setter BEFORE persist mutates api.setState. Metadata
      // must notify subscribers/devtools, but must never write to storage.
      let hydrated = false;
      // Normalize factory metadata in the same write as application updates,
      // including custom resets through api.setState(initialState, true).
      // Do not mutate the SSR snapshot or add a second notification/storage write.
      const metadataSet: typeof set = (partial, replace) => {
        const update = (state: T & DoNotDevStore) => {
          const next = typeof partial === 'function' ? partial(state) : partial;
          if ((replace || '_hasHydrated' in next) && next._hasHydrated !== hydrated) {
            return { ...next, _hasHydrated: hydrated };
          }
          return next;
        };
        if (replace) {
          // why: Zustand's replace overload requires a full state, as does its caller.
          set((state) => update(state) as T & DoNotDevStore, true);
        } else {
          set(update, replace);
        }
      };
      api.setState = metadataSet;
      const initialState = persistedCreator(metadataSet, get, api);
      // why: persist attaches this mutator at runtime, except without storage (SSR).
      const persistApi = (api as Mutate<
        StoreApi<T & DoNotDevStore>,
        [['zustand/persist', Partial<T & DoNotDevStore>]]
      >).persist;
      if (persistApi) {
        const markHydrated = (completed: boolean) => {
          hydrated = completed;
          if (get()._hasHydrated !== completed) {
            set(patch({ _hasHydrated: completed }));
          }
        };
        persistApi.onHydrate(() => markHydrated(false));
        persistApi.onFinishHydration(() => markHydrated(true));
        // Synchronous storage can finish before listeners can be registered.
        if (persistApi.hasHydrated()) {
          hydrated = true;
          // Only persist's returned state represents completed hydration. get()
          // can instead contain a partial write made inside the user's creator.
          return { ...initialState, _hasHydrated: true };
        }
      }
      return initialState;
    };
    try {
      store =
        isDev() && isClient()
          ? create<T & DoNotDevStore>()(devtools(hydrationCreator, { name }))
          : create<T & DoNotDevStore>()(hydrationCreator);
    } finally {
      constructing = false;
      completedCreatorState = undefined;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- why: `any[]` params so functions with concrete parameter types satisfy the constraint (parameter contravariance)
export type DoNotDevStoreState<T> = T extends (...args: any[]) => infer R
  ? R extends DoNotDevStore
    ? R
    : never
  : never;
