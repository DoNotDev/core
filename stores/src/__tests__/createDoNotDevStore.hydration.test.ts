import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mutate, StateCreator, StoreApi } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

import { createDoNotDevStore } from '../createDoNotDevStore';
import type { DoNotDevStore } from '../createDoNotDevStore';

vi.mock('@donotdev/utils', () => ({ isClient: () => true, isDev: () => true }));

interface Counter { count: number }
function persistence<T>(store: StoreApi<T>) {
  // why: the public factory contract intentionally omits middleware mutators.
  return (store as Mutate<StoreApi<T>, [['zustand/persist', Partial<T>]]>).persist;
}
function storageWith(getItem: StateStorage['getItem']) {
  return {
    getItem: vi.fn(getItem),
    setItem: vi.fn<StateStorage['setItem']>(),
    removeItem: vi.fn<StateStorage['removeItem']>(),
  };
}
function setup(storage: ReturnType<typeof storageWith>, options = {}) {
  return createDoNotDevStore<Counter>({
    name: 'hydration',
    createStore: () => ({ count: 0 }),
    persistOptions: {
      name: 'counter',
      storage: createJSONStorage<Partial<Counter & DoNotDevStore>>(() => storage),
      ...options,
    },
  });
}

beforeEach(() => { delete globalThis._DNDEV_STORES_; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('factory hydration metadata', () => {
  it.each(['sync', 'async', 'skip', 'unavailable'] as const)(
    'retains complete state after constructor writes with %s storage', async (mode) => {
      interface State extends Counter { increment(): void }
      const read = Promise.withResolvers<string | null>();
      const saved = JSON.stringify({ state: { count: 8 }, version: 0 });
      const storage = storageWith(() => mode === 'async' ? read.promise : saved);
      const creator: StateCreator<State> = (set) => {
        set({ count: 3 });
        return { count: 0, increment: () => set((state) => ({ count: state.count + 1 })) };
      };
      const store = createDoNotDevStore<State>({
        name: 'constructor-writes', createStore: creator,
        persistOptions: { name: 'constructor', skipHydration: mode === 'skip',
          storage: mode === 'unavailable' ? undefined : createJSONStorage(() => storage) },
      });
      const check = (count: number, hydrated: boolean) => {
        expect(store.getState()).toEqual({
          count, increment: expect.any(Function), initialize: expect.any(Function),
          cleanup: expect.any(Function), reset: expect.any(Function),
          setReady: expect.any(Function), setLoading: expect.any(Function),
          setError: expect.any(Function), clearError: expect.any(Function),
          isReady: false, isLoading: false, error: null, _hasHydrated: hydrated,
        });
      };
      check(mode === 'sync' ? 8 : 0, mode === 'sync');
      expect(store.getInitialState()).toEqual(expect.objectContaining({ count: 0, increment: expect.any(Function), _hasHydrated: false }));
      expect(storage.setItem).toHaveBeenCalledTimes(mode === 'unavailable' ? 0 : 1);
      if (mode === 'async' || mode === 'skip') {
        const finished = new Promise<void>((resolve) => persistence(store).onFinishHydration(() => resolve()));
        if (mode === 'async') read.resolve(saved);
        else await persistence(store).rehydrate();
        await finished;
        check(8, true);
      }
      store.getState().increment();
      expect(store.getState().count).toBe((mode === 'unavailable' ? 0 : 8) + 1);
      await store.getState().initialize();
      expect(store.getState().isReady).toBe(true);
      store.getState().reset();
      expect(store.getState().isReady).toBe(false);
    }
  );

  it.each([
    [null, false], [null, true],
    [JSON.stringify({ state: { count: 7 }, version: 0 }), false],
    [JSON.stringify({ state: { count: 7 }, version: 0 }), true],
  ])(
    'does not restore omitted fields on rehydration and retry: %s (custom merge: %s)', async (saved, customMerge) => {
      interface State extends Counter { token?: string }
      const storage = storageWith(() => null);
      const merge = vi.fn((persisted: unknown, current: State & DoNotDevStore) => ({
        ...current, ...(persisted as Partial<State>),
      }));
      const store = createDoNotDevStore<State>({
        name: 'omitted-token', createStore: () => ({ count: 0, token: 'secret' }),
        persistOptions: { name: 'omitted-token', storage: createJSONStorage(() => storage), ...(customMerge && { merge }) },
      });
      const { token: _token, ...replacement } = store.getState();
      store.setState({ ...replacement, count: 4 }, true);
      storage.setItem.mockClear();
      storage.getItem.mockReturnValue(saved);
      await persistence(store).rehydrate();
      if (customMerge) expect(merge.mock.lastCall?.[1]).not.toHaveProperty('token');
      expect(store.getState()).not.toHaveProperty('token');
      expect(store.getState().count).toBe(saved ? 7 : 4);
      expect(store.getState()._hasHydrated).toBe(true);
      const error = new Error('read failed');
      storage.getItem.mockImplementation(() => { throw error; });
      await persistence(store).rehydrate();
      expect(store.getState()).not.toHaveProperty('token');
      expect(store.getState()._hasHydrated).toBe(false);
      storage.getItem.mockReturnValue(saved);
      await persistence(store).rehydrate();
      if (customMerge) expect(merge.mock.lastCall?.[1]).not.toHaveProperty('token');
      expect(store.getState()).not.toHaveProperty('token');
      expect(store.getState()._hasHydrated).toBe(true);
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  );

  it('uses post-construction replacement during delayed initial hydration', async () => {
    interface State extends Counter { token?: string }
    const read = Promise.withResolvers<string | null>();
    const storage = storageWith(() => read.promise);
    const merge = vi.fn((saved: unknown, current: State & DoNotDevStore) => ({
      ...current, ...(saved as Partial<State>),
    }));
    const store = createDoNotDevStore<State>({
      name: 'delayed-replacement', createStore: () => ({ count: 0, token: 'secret' }),
      persistOptions: { name: 'delayed', storage: createJSONStorage(() => storage), merge },
    });
    const { token: _token, ...replacement } = store.getState();
    store.setState({ ...replacement, count: 4 }, true);
    storage.setItem.mockClear();
    const finished = new Promise<void>((resolve) => persistence(store).onFinishHydration(() => resolve()));
    read.resolve(null);
    await finished;
    expect(merge.mock.lastCall?.[1]).not.toHaveProperty('token');
    expect(store.getState()).not.toHaveProperty('token');
    expect(store.getState().count).toBe(4);
    expect(store.getState()._hasHydrated).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('passes complete constructor state to custom merge without restoring deliberately omitted fields', () => {
    interface State extends Counter { increment(): void }
    const storage = storageWith(() => null);
    const merge = vi.fn((_saved: unknown, current: State & DoNotDevStore) => {
      expect(current).toEqual(expect.objectContaining({
        count: 3, increment: expect.any(Function), initialize: expect.any(Function), reset: expect.any(Function),
      }));
      return { count: 11 } as State & DoNotDevStore;
    });
    const post = vi.fn();
    const store = createDoNotDevStore<State>({
      name: 'custom-replacement',
      createStore: (set) => { set({ count: 3 }); return { count: 0, increment: () => {} }; },
      persistOptions: { name: 'custom', storage: createJSONStorage(() => storage), merge, onRehydrateStorage: () => post },
    });
    expect(merge).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledExactlyOnceWith({ count: 11, _hasHydrated: false }, undefined);
    expect(store.getState()).toEqual({ count: 11, _hasHydrated: true });
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it.each(['sync', 'async', 'skip', 'unavailable'] as const)(
    'keeps factory metadata truthful across custom resets and replacements (%s)', async (mode) => {
      const read = Promise.withResolvers<string | null>();
      const storage = storageWith(() => mode === 'async' ? read.promise : null);
      interface State extends Counter { reset(): void; replace(): void }
      const store = createDoNotDevStore<State>({
        name: 'reset-metadata',
        createStore: (set, _get, api) => ({
          count: 0,
          reset: () => api.setState(api.getInitialState(), true),
          replace: () => set(() => ({ ...api.getInitialState(), count: 4 })),
        }),
        persistOptions: {
          name: 'reset', skipHydration: mode === 'skip',
          storage: mode === 'unavailable' ? undefined : createJSONStorage(() => storage),
        },
      });
      const snapshot = store.getInitialState();
      const checkReset = (completed: boolean) => {
        store.setState({ count: 9 });
        storage.setItem.mockClear();
        const states: boolean[] = [];
        const unsubscribe = store.subscribe((state) => states.push(state._hasHydrated === true));
        store.getState().reset();
        expect(store.getState().count).toBe(0);
        expect(store.getState()._hasHydrated).toBe(completed);
        expect(states).toEqual([completed]);
        expect(storage.setItem).toHaveBeenCalledTimes(mode === 'unavailable' ? 0 : 1);
        store.getState().replace();
        store.setState((state) => ({ ...state, _hasHydrated: !completed }), true);
        store.setState({ ...snapshot, count: 2 }, true);
        const { _hasHydrated: _ignored, ...withoutMetadata } = snapshot;
        store.setState(withoutMetadata, true);
        expect(states).toEqual(Array(5).fill(completed));
        expect(storage.setItem).toHaveBeenCalledTimes(mode === 'unavailable' ? 0 : 5);
        expect(store.getState()._hasHydrated).toBe(completed);
        if (mode !== 'unavailable') expect(persistence(store).hasHydrated()).toBe(completed);
        expect(store.getInitialState()).toBe(snapshot);
        expect(snapshot._hasHydrated).toBe(false);
        unsubscribe();
      };
      checkReset(mode === 'sync');
      if (mode === 'async' || mode === 'skip') {
        const finished = new Promise<void>((resolve) => persistence(store).onFinishHydration(() => resolve()));
        if (mode === 'async') read.resolve(null);
        else await persistence(store).rehydrate();
        await finished;
        checkReset(true);
      }
    }
  );
  it.each([null, JSON.stringify({ state: { count: 7, _hasHydrated: true }, version: 0 })])(
    'recognizes synchronous completion without any startup write: %s', (saved) => {
      const storage = storageWith(() => saved);
      const post = vi.fn();
      const before = vi.fn(() => post);
      const store = setup(storage, { onRehydrateStorage: before });
      expect(persistence(store).hasHydrated()).toBe(true);
      expect(store.getState()._hasHydrated).toBe(true);
      expect(store.getState().count).toBe(saved === null ? 0 : 7);
      expect(store.getState().isReady).toBe(false);
      expect(before).toHaveBeenCalledOnce();
      expect(post).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ _hasHydrated: false }), undefined
      );
      expect(storage.getItem).toHaveBeenCalledExactlyOnceWith('counter');
      expect(storage.setItem).not.toHaveBeenCalled();
      const snapshot = store.getInitialState();
      expect(snapshot.count).toBe(0);
      expect(snapshot._hasHydrated).toBe(false);
      expect(store.getInitialState()).toBe(snapshot);
      const live = store.getState();
      expect(store.getState()).toBe(live);
    }
  );

  it('waits for async completion, notifies selectors and preserves callback order', async () => {
    const read = Promise.withResolvers<string | null>();
    const storage = storageWith(() => read.promise);
    const order: string[] = [];
    const post = vi.fn((state: Counter & DoNotDevStore, error: unknown) => {
      order.push('after');
      expect(state._hasHydrated).toBe(false);
      expect(error).toBeUndefined();
    });
    const store = setup(storage, { onRehydrateStorage: () => { order.push('before'); return post; } });
    const flags: boolean[] = [];
    const unsubscribe = store.subscribe((state) => { flags.push(state._hasHydrated === true); });
    const finished = new Promise<void>((resolve) => {
      persistence(store).onFinishHydration(() => { order.push('finished'); resolve(); });
    });
    expect(store.getState()._hasHydrated).toBe(false);
    expect(persistence(store).hasHydrated()).toBe(false);
    read.resolve(JSON.stringify({ state: { count: 9, _hasHydrated: true }, version: 0 }));
    await finished;
    expect(order).toEqual(['before', 'after', 'finished']);
    expect(flags).toEqual([false, true]);
    expect(store.getState().count).toBe(9);
    expect(store.getState()._hasHydrated).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.getInitialState()._hasHydrated).toBe(false);
    unsubscribe();
  });

  it.each(['throw', 'reject'] as const)('never touches readable but unwritable storage (%s)', async (mode) => {
    const storage = storageWith(() => JSON.stringify({ state: { count: 2 }, version: 0 }));
    const error = new DOMException('quota exceeded', 'QuotaExceededError');
    storage.setItem.mockImplementation(() => {
      if (mode === 'reject') return Promise.reject(error);
      throw error;
    });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const store = setup(storage);
      expect(store.getState()._hasHydrated).toBe(true);
      expect(storage.setItem).not.toHaveBeenCalled();
      // Actual writes retain Zustand's error contract; no swallowing or custom persistence.
      if (mode === 'throw') expect(() => store.setState({ count: 3 })).toThrow(error);
      else await expect(store.setState({ count: 3 })).rejects.toBe(error);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it.each(['sync', 'async'] as const)('reports %s read failures and supports retries without duplicate listeners', async (mode) => {
    const error = new Error('read failed');
    const storage = storageWith(() => null);
    const post = vi.fn();
    const store = setup(storage, { skipHydration: true, onRehydrateStorage: () => post });
    expect(storage.getItem).not.toHaveBeenCalled();
    const snapshots: boolean[] = [];
    const subscribe = () => store.subscribe((state) => snapshots.push(state._hasHydrated === true));
    const unsubscribe = subscribe();
    storage.getItem.mockImplementation(() => {
      if (mode === 'async') return Promise.reject(error);
      throw error;
    });
    await persistence(store).rehydrate();
    expect(post).toHaveBeenLastCalledWith(undefined, error);
    expect(store.getState()._hasHydrated).toBe(false);
    expect(persistence(store).hasHydrated()).toBe(false);
    storage.getItem.mockReturnValue(JSON.stringify({ state: { count: 5, _hasHydrated: true }, version: 0 }));
    await persistence(store).rehydrate();
    expect(store.getState()._hasHydrated).toBe(true);
    expect(persistence(store).hasHydrated()).toBe(true);
    expect(snapshots).toEqual([false, true]);
    unsubscribe();
    snapshots.length = 0;
    const remount = subscribe();
    expect(setup(storage)).toBe(store);
    storage.getItem.mockImplementation(() => { throw error; });
    await persistence(store).rehydrate();
    expect(store.getState()._hasHydrated).toBe(false);
    storage.getItem.mockReturnValue(null);
    await persistence(store).rehydrate();
    expect(snapshots).toEqual([false, false, true]);
    expect(post).toHaveBeenCalledTimes(4);
    expect(storage.setItem).not.toHaveBeenCalled();
    remount();
  });

  it('retains callback failure behavior and retries', async () => {
    const error = new Error('callback failed');
    const storage = storageWith(() => JSON.stringify({ state: { _hasHydrated: true }, version: 0 }));
    const post = vi.fn((_state: unknown, receivedError: unknown) => {
      if (receivedError === undefined) throw error;
    });
    const store = setup(storage, { onRehydrateStorage: () => post });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenLastCalledWith(undefined, error);
    expect(store.getState()._hasHydrated).toBe(false);
    expect(persistence(store).hasHydrated()).toBe(false);
    post.mockImplementation(() => {});
    await persistence(store).rehydrate();
    expect(store.getState()._hasHydrated).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['throw', 'reject'] as const)('preserves real migration write failures (%s)', async (mode) => {
    const error = new Error('migration write failed');
    const storage = storageWith(() => JSON.stringify({ state: { count: 3 }, version: 0 }));
    storage.setItem.mockImplementation(() => {
      if (mode === 'reject') return Promise.reject(error);
      throw error;
    });
    const post = vi.fn();
    const store = setup(storage, {
      skipHydration: true, version: 1, migrate: (saved: Counter) => saved,
      onRehydrateStorage: () => post,
    });
    await persistence(store).rehydrate();
    expect(post).toHaveBeenCalledExactlyOnceWith(undefined, error);
    expect(persistence(store).hasHydrated()).toBe(false);
    expect(store.getState()._hasHydrated).toBe(false);
    expect(storage.setItem).toHaveBeenCalledOnce();
    storage.setItem.mockImplementation(() => {});
    await persistence(store).rehydrate();
    expect(store.getState()._hasHydrated).toBe(true);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it('preserves custom merge, partialize and migration contracts', async () => {
    const storage = storageWith(() => JSON.stringify({ state: { count: 4 }, version: 0 }));
    const migrate = vi.fn((saved: Counter) => ({ count: saved.count + 1 }));
    const merge = vi.fn((saved: Counter, current: Counter & DoNotDevStore) => ({ ...current, count: saved.count * 2 }));
    const partialize = vi.fn((state: Counter) => ({ count: state.count }));
    const store = setup(storage, { version: 1, migrate, merge, partialize });
    expect(store.getState().count).toBe(10);
    expect(store.getState()._hasHydrated).toBe(true);
    expect(migrate).toHaveBeenCalledOnce();
    expect(merge).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('counter', JSON.stringify({ state: { count: 10 }, version: 1 }));
    store.setState({ count: 11 });
    expect(partialize).toHaveBeenCalledTimes(2);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it('keeps devtools outside the non-persisting metadata setter', async () => {
    const connection = { init: vi.fn(), send: vi.fn(), subscribe: vi.fn() };
    vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', { connect: () => connection });
    const storage = storageWith(() => null);
    const store = setup(storage);
    expect(connection.init).toHaveBeenCalledWith(expect.objectContaining({ _hasHydrated: true }));
    connection.send.mockClear();
    await persistence(store).rehydrate();
    const states = connection.send.mock.calls.map((call) => call[1]._hasHydrated);
    expect(states).toEqual([false, false, true]);
    expect(storage.setItem).not.toHaveBeenCalled();
    store.setState({ count: 1 });
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it('keeps unavailable storage and non-persisted stores incomplete/absent', () => {
    const post = vi.fn();
    const store = setup(storageWith(() => null), {
      storage: createJSONStorage(() => { throw new Error('unavailable'); }),
      onRehydrateStorage: post,
    });
    expect(store).not.toHaveProperty('persist');
    expect(store.getState()._hasHydrated).toBe(false);
    expect(post).not.toHaveBeenCalled();
    const plain = createDoNotDevStore({ name: 'plain', createStore: () => ({ count: 0 }) });
    expect(plain.getState()).not.toHaveProperty('_hasHydrated');
  });

  it('does not normalize domain-owned metadata during full replacement resets', () => {
    const storage = storageWith(() => null);
    interface Domain extends Counter { _hasHydrated: boolean; reset(): void }
    const store = createDoNotDevStore<Domain>({
      name: 'domain-reset', lifecycle: false,
      createStore: (_set, _get, api) => ({
        count: 0, _hasHydrated: false,
        reset: () => api.setState(api.getInitialState(), true),
      }),
      persistOptions: { name: 'domain-reset', storage: createJSONStorage(() => storage) },
    });
    expect(persistence(store).hasHydrated()).toBe(true);
    store.setState({ _hasHydrated: true });
    storage.setItem.mockClear();
    store.getState().reset();
    expect(store.getState()).toBe(store.getInitialState());
    expect(store.getState()._hasHydrated).toBe(false);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });

  it('does not inject fields, alter callbacks or write in domain mode', () => {
    const storage = storageWith(() => JSON.stringify({ state: { count: 4 }, version: 0 }));
    const post = vi.fn();
    const merge = vi.fn((_saved, current: Counter) => ({ ...current, count: 8 }));
    const store = createDoNotDevStore<Counter>({
      name: 'domain', lifecycle: false, createStore: () => ({ count: 0 }),
      persistOptions: { name: 'domain', storage: createJSONStorage(() => storage), merge, onRehydrateStorage: () => post },
    });
    expect(store.getState()).toEqual({ count: 8 });
    expect(persistence(store).getOptions().merge).toBe(merge);
    expect(post).toHaveBeenCalledExactlyOnceWith(store.getState(), undefined);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
