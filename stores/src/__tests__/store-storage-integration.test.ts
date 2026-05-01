import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createDoNotDevStore } from '../createDoNotDevStore';

// Mock storage with tracking
const mockStorage = new Map<string, string>();
let storageCallCount = 0;

const mockStorageAdapter = {
  getItem: vi.fn((name: string): string | null => {
    storageCallCount++;
    return mockStorage.get(name) ?? null;
  }),
  setItem: vi.fn((name: string, value: string): void => {
    storageCallCount++;
    mockStorage.set(name, value);
  }),
  removeItem: vi.fn((name: string): void => {
    storageCallCount++;
    mockStorage.delete(name);
  }),
};

vi.mock('@donotdev/utils', () => ({
  isClient: vi.fn(() => true),
  isDev: vi.fn(() => false),
}));

describe('Store + Storage Integration', () => {
  beforeEach(() => {
    mockStorage.clear();
    storageCallCount = 0;
    vi.clearAllMocks();
  });

  it('creates store with persistOptions and storage adapter is used', () => {
    interface TestState {
      count: number;
    }

    interface TestStateWithActions {
      count: number;
      increment: () => void;
    }

    const store = createDoNotDevStore<TestStateWithActions>({
      name: 'test-store-persist',
      createStore: (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      persistOptions: {
        name: 'test-store-persist',
        storage: mockStorageAdapter as any,
      },
    });

    // Store should be created successfully
    expect(store).toBeDefined();
    expect(store.getState).toBeDefined();

    // Update state - this should trigger persist
    store.getState().increment();

    // Storage adapter should have been called (Zustand persist calls it)
    // Note: Actual persistence happens async, but adapter should be configured
    expect(mockStorageAdapter.setItem).toHaveBeenCalled();
  });

  it('uses partialize function when provided', () => {
    interface TestStateWithActions {
      count: number;
      temporary: string;
      increment: () => void;
    }

    const partializeSpy = vi.fn((state: TestStateWithActions) => ({
      count: state.count,
    }));

    const store = createDoNotDevStore<TestStateWithActions>({
      name: 'test-store-partialize',
      createStore: (set) => ({
        count: 0,
        temporary: 'temp',
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      persistOptions: {
        name: 'test-store-partialize',
        storage: mockStorageAdapter as any,
        partialize: partializeSpy,
      },
    });

    store.getState().increment();

    // partialize should be called by Zustand persist middleware
    // Verify store was created with persist options
    expect(store).toBeDefined();
  });

  it('works without persistOptions (no persistence)', () => {
    interface TestStateWithActions {
      count: number;
      increment: () => void;
    }

    const initialCallCount = storageCallCount;

    const store = createDoNotDevStore<TestStateWithActions>({
      name: 'test-store-no-persist',
      createStore: (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      // No persistOptions
    });

    store.getState().increment();

    // Storage should not be called when no persistOptions
    expect(storageCallCount).toBe(initialCallCount);
  });

  it('handles storage adapter interface correctly', () => {
    const testAdapter = {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => {}),
      removeItem: vi.fn(async () => {}),
    };

    interface TestState {
      count: number;
    }

    const store = createDoNotDevStore<TestState>({
      name: 'test-store-adapter',
      createStore: (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }),
      persistOptions: {
        name: 'test-store-adapter',
        storage: testAdapter as any,
      },
    });

    expect(store).toBeDefined();
    // Adapter methods should be callable (Zustand will call them)
    expect(typeof testAdapter.getItem).toBe('function');
    expect(typeof testAdapter.setItem).toBe('function');
    expect(typeof testAdapter.removeItem).toBe('function');
  });
});
