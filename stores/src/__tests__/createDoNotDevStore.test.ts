import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createDoNotDevStore, isDoNotDevStore } from '../createDoNotDevStore';

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
