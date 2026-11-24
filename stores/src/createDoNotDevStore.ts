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
 * Framework persist options added on top of Zustand's `PersistOptions`.
 *
 * @since 0.3.1
 */
export interface DoNotDevPersistOptions {
  /**
   * Keep every tab's store in step: when another tab writes this store's storage
   * key (the `storage` event, fired in the other same-origin tabs only), this tab
   * rehydrates from storage (`persist.rehydrate()`). Events arriving before the
   * store's first completed hydration are ignored (`skipHydration` is respected).
   * Lifecycle stores keep `_hasHydrated: true` through the sync, and actions keep
   * their identity (saved JSON holds no functions; the merge keeps current ones).
   * A rehydration never writes storage, so tabs cannot echo each other.
   *
   * Requires a `localStorage`-backed storage (Zustand's default): `sessionStorage`
   * is per tab, and custom storages (IndexedDB, cookies) fire no `storage` event.
   * A removal in another tab (`persist.clearStorage()`) leaves this tab's state as it is.
   * The listener lives as long as the store singleton (the page), like persist's own.
   *
   * @example
   * ```ts
   * const useCartStore = createDoNotDevStore<CartState>({
   *   name: 'cart',
   *   createStore: (set) => ({ lines: [], add: (line) => set((s) => ({ lines: [...s.lines, line] })) }),
   *   persistOptions: { name: 'cart', syncAcrossTabs: true },
   * });
   * // Tab A: useCartStore.getState().add(line) → tab B's useCartStore((s) => s.lines) re-renders.
   * ```
   *
   * @default false
   * @since 0.3.1
   */
  syncAcrossTabs?: boolean;
}

/**
 * Rehydrate a persisted store when another tab writes its storage key.
 * No-op on the server. Page-lifetime listener (see `syncAcrossTabs`).
 */
function rehydrateOnOtherTabWrites(
  key: string,
  canSync: () => boolean,
  rehydrate: () => Promise<void>
): void {
  if (!isClient()) return;
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === key && canSync()) void rehydrate();
  });
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
  > &
    DoNotDevPersistOptions & {
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
  persistOptions?: PersistOptions<T, Partial<T>> & DoNotDevPersistOptions;
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

    let store: UseBoundStore<StoreApi<T>>;
    if (persistOptions) {
      const { syncAcrossTabs, ...zustandOptions } = persistOptions;
      const persisted =
        isDev() && isClient()
          ? create<T>()(devtools(persist(creator, zustandOptions), { name }))
          : create<T>()(persist(creator, zustandOptions));
      store = persisted;
      // why: typed as always present, but persist attaches it at runtime only with storage (not SSR).
      const persistApi = persisted.persist as typeof persisted.persist | undefined;
      if (syncAcrossTabs && persistApi) {
        rehydrateOnOtherTabWrites(
          zustandOptions.name,
          () => persistApi.hasHydrated(),
          () => persistApi.rehydrate()
        );
      }
    } else {
      store =
        isDev() && isClient()
          ? create<T>()(devtools(creator, { name }))
          : create<T>()(creator);
    }

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
    const { syncAcrossTabs, ...zustandOptions } = persistOptions;
    const persistedCreator = persist(wrappedCreator, {
      ...zustandOptions,
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
        // A rehydration caused by another tab's write updates an already
        // hydrated store: completion stays true throughout (no false blip).
        let otherTabWrite = false;
        persistApi.onHydrate(() => {
          if (!otherTabWrite) markHydrated(false);
        });
        persistApi.onFinishHydration(() => markHydrated(true));
        if (syncAcrossTabs) {
          rehydrateOnOtherTabWrites(
            zustandOptions.name,
            () => hydrated,
            () => {
              // onHydrate listeners run synchronously inside rehydrate().
              otherTabWrite = true;
              try {
                return persistApi.rehydrate();
              } finally {
                otherTabWrite = false;
              }
            }
          );
        }
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
