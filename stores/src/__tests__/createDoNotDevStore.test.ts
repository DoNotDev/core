import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import type { StoreApi } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';

import { createDoNotDevStore, isDoNotDevStore } from '../createDoNotDevStore';
import type { DoNotDevStore, DoNotDevStoreConfig, DomainStoreConfig } from '../createDoNotDevStore';

vi.mock('@donotdev/utils', () => ({
  isClient: () => true,
  isDev: () => true,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Reset global store registry between tests
beforeEach(() => {
  delete (globalThis as any)._DNDEV_STORES_;
});

describe('createDoNotDevStore', () => {
  it('creates a store with lifecycle methods', () => {
    const useStore = createDoNotDevStore({
      name: 'test-basic',
      createStore: (set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
      }),
    });

    const state = useStore.getState();
    expect(state.count).toBe(0);
    expect(state.isReady).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.initialize).toBe('function');
    expect(typeof state.cleanup).toBe('function');
    expect(typeof state.setLoading).toBe('function');
    expect(typeof state.setError).toBe('function');
    expect(typeof state.clearError).toBe('function');
  });

  it('user state works', () => {
    const useStore = createDoNotDevStore({
      name: 'test-state',
      createStore: (set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
      }),
    });

    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);
  });

  it('initialize sets isReady to true', async () => {
    const useStore = createDoNotDevStore({
      name: 'test-init',
      createStore: () => ({ value: 'hello' }),
    });

    const success = await useStore.getState().initialize();

    expect(success).toBe(true);
    expect(useStore.getState().isReady).toBe(true);
  });

  it('initialize calls custom initializer', async () => {
    const initFn = vi.fn().mockResolvedValue(true);

    const useStore = createDoNotDevStore({
      name: 'test-custom-init',
      createStore: () => ({}),
      initialize: initFn,
    });

    await useStore.getState().initialize({ some: 'data' });

    expect(initFn).toHaveBeenCalledWith({ some: 'data' });
    expect(useStore.getState().isReady).toBe(true);
  });

  it('initialize handles failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const useStore = createDoNotDevStore({
      name: 'test-init-fail',
      createStore: () => ({}),
      initialize: async () => {
        throw new Error('init failed');
      },
    });

    const success = await useStore.getState().initialize();

    expect(success).toBe(false);
    expect(useStore.getState().isReady).toBe(false);
  });

  it('setLoading / setError / clearError work', () => {
    const useStore = createDoNotDevStore({
      name: 'test-helpers',
      createStore: () => ({}),
    });

    useStore.getState().setLoading(true);
    expect(useStore.getState().isLoading).toBe(true);

    useStore.getState().setError('Something broke');
    expect(useStore.getState().error).toBe('Something broke');

    useStore.getState().clearError();
    expect(useStore.getState().error).toBeNull();
  });

  it('provides default reset when user does not define one', () => {
    const useStore = createDoNotDevStore({
      name: 'test-default-reset',
      createStore: () => ({}),
    });

    useStore.getState().setLoading(true);
    useStore.getState().setError('err');
    useStore.getState().reset();

    expect(useStore.getState().isLoading).toBe(false);
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().isReady).toBe(false);
  });

  it('preserves custom reset from user', () => {
    const customReset = vi.fn();

    const useStore = createDoNotDevStore({
      name: 'test-custom-reset',
      createStore: () => ({
        reset: customReset,
      }),
    });

    useStore.getState().reset();
    expect(customReset).toHaveBeenCalled();
  });

  describe('singleton pattern', () => {
    it('returns same instance for same name', () => {
      const config = {
        name: 'test-singleton',
        createStore: () => ({ val: 1 }),
      };

      const store1 = createDoNotDevStore(config);
      const store2 = createDoNotDevStore(config);

      expect(store1).toBe(store2);
    });

    it('returns different instances for different names', () => {
      const store1 = createDoNotDevStore({
        name: 'test-a',
        createStore: () => ({}),
      });
      const store2 = createDoNotDevStore({
        name: 'test-b',
        createStore: () => ({}),
      });

      expect(store1).not.toBe(store2);
    });
  });
});

describe('factory lifecycle isolation', () => {
  it('keeps exported default config and lifecycle overrides compatible', async () => {
    const domainInit = vi.fn();
    const domainCleanup = vi.fn();
    const cleanup = vi.fn();
    const config: DoNotDevStoreConfig<{ value: number }> = {
      name: 'default-config',
      createStore: () => ({ value: 1, initialize: domainInit, cleanup: domainCleanup }),
      initialize: async () => false,
      cleanup,
    };
    const store = createDoNotDevStore(config);
    expectTypeOf(store.getState()).toEqualTypeOf<{ value: number } & DoNotDevStore>();
    expect(await store.getState().initialize()).toBe(false);
    expect(store.getState().isReady).toBe(false);
    store.getState().cleanup?.();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(domainInit).not.toHaveBeenCalled();
    expect(domainCleanup).not.toHaveBeenCalled();
  });

  it('preserves domain state, action signatures, raw creator types and singleton', () => {
    interface Domain {
      errors: Record<string, string>;
      setError: (id: string, message: string) => void;
      cleanup: (id: string) => void;
      isLoading: (id: string) => boolean;
    }
    const creator = vi.fn<DomainStoreConfig<Domain>['createStore']>((set, get, api) => {
      expectTypeOf(set).toEqualTypeOf<StoreApi<Domain>['setState']>();
      expectTypeOf(get).toEqualTypeOf<() => Domain>();
      expectTypeOf(api).toEqualTypeOf<StoreApi<Domain>>();
      return {
        errors: {},
        setError: (id, message) => set({ errors: { ...get().errors, [id]: message } }),
        cleanup: (id) => set((state) => {
          const { [id]: _, ...errors } = state.errors;
          return { errors };
        }),
        isLoading: (id) => id === 'loading',
      };
    });
    const config: DomainStoreConfig<Domain> = {
      name: 'domain-signatures', lifecycle: false, createStore: creator,
    };
    const store = createDoNotDevStore<Domain>(config);
    expectTypeOf(store.getState()).toEqualTypeOf<Domain>();
    expectTypeOf<Extract<keyof Domain, 'setLoading'>>().toBeNever();
    expect(store.getState()).not.toHaveProperty('setLoading');
    expect(store.getState()).not.toHaveProperty('initialize');
    store.getState().setError('a', 'message');
    expect(store.getState().errors).toEqual({ a: 'message' });
    expect(store.getState().isLoading('loading')).toBe(true);
    store.getState().cleanup('a');
    expect(store.getState().errors).toEqual({});
    expect(createDoNotDevStore(config)).toBe(store);
    expect(creator).toHaveBeenCalledOnce();
  });

  it('infers domain state without an explicit generic', () => {
    const store = createDoNotDevStore({
      name: 'inferred-domain',
      lifecycle: false,
      createStore: () => ({
        count: 1,
        isLoading: (id: string) => id === 'busy',
      }),
    });
    expectTypeOf(store.getState()).toEqualTypeOf<{
      count: number;
      isLoading: (id: string) => boolean;
    }>();
    expect(store.getState().isLoading('busy')).toBe(true);
    expect(store.getState()).not.toHaveProperty('setLoading');
  });

  it.each([false, true])('keeps devtools for domain stores, persisted=%s', (persisted) => {
    const connection = { init: vi.fn(), send: vi.fn(), subscribe: vi.fn() };
    const connect = vi.fn(() => connection);
    vi.stubGlobal('__REDUX_DEVTOOLS_EXTENSION__', { connect });
    const store = createDoNotDevStore<{ count: number }>({
      name: 'domain-devtools',
      lifecycle: false,
      createStore: () => ({ count: 0 }),
      ...(persisted && {
        persistOptions: {
          name: 'domain-devtools-persist',
          storage: createJSONStorage<Partial<{ count: number }>>(() => localStorage),
        },
      }),
    });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ name: 'domain-devtools' }));
    expect(connection.init).toHaveBeenCalledWith({ count: 0 });
    store.setState({ count: 1 });
    expect(connection.send).toHaveBeenCalledWith(expect.anything(), { count: 1 });
    localStorage.removeItem('domain-devtools-persist');
  });

  it.each([true, false] as const)('retains persistence with lifecycle=%s', (lifecycle) => {
    const data = new Map<string, string>();
    data.set('persist-key', JSON.stringify({ state: { count: 7 }, version: 0 }));
    const onHydrated = vi.fn();
    interface Counter { count: number; transient: string }
    const options = {
      name: 'persist-key',
      storage: createJSONStorage<Partial<Counter>>(() => ({
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => { data.set(key, value); },
        removeItem: (key) => { data.delete(key); },
      })),
      partialize: (state: Counter) => ({ count: state.count }),
      onRehydrateStorage: () => onHydrated,
    };
    const store = lifecycle
      ? createDoNotDevStore<Counter>({ name: 'persist-default', createStore: () => ({ count: 0, transient: 'private' }), persistOptions: options })
      : createDoNotDevStore<Counter>({ name: 'persist-domain', lifecycle: false, createStore: () => ({ count: 0, transient: 'private' }), persistOptions: options });
    expect(store.getState().count).toBe(7);
    expect(onHydrated).toHaveBeenCalledOnce();
    store.setState({ count: 8 });
    expect(JSON.parse(data.get('persist-key')!)).toEqual({ state: { count: 8 }, version: 0 });
    if (!lifecycle) expect(store.getState()).not.toHaveProperty('_hasHydrated');
  });
});

describe('isDoNotDevStore', () => {
  it('returns true for a DoNotDev store state', () => {
    const useStore = createDoNotDevStore({
      name: 'test-typeguard',
      createStore: () => ({}),
    });

    expect(isDoNotDevStore(useStore.getState())).toBe(true);
  });

  it('returns falsy for plain objects', () => {
    expect(isDoNotDevStore({})).toBeFalsy();
    expect(isDoNotDevStore(null)).toBeFalsy();
    expect(isDoNotDevStore(undefined)).toBeFalsy();
    expect(isDoNotDevStore({ isReady: true })).toBeFalsy(); // missing initialize
  });
});
