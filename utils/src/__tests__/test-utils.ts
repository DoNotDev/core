// packages/core/utils/src/__tests__/test-utils.ts
/**
 * Shared test utilities for @donotdev/utils tests
 */

/** Create an in-memory Storage implementation (localStorage/sessionStorage mock) */
export function createMockStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

/** Clear globalThis._DNDEV_CONFIG_ and related caches */
export function resetGlobalConfig(): void {
  delete (globalThis as any)._DNDEV_CONFIG_;
  delete (globalThis as any)._DNDEV_STORES_;
  delete (globalThis as any).__NEXT_DATA__;
  delete (globalThis as any).__vite_plugin_react_preamble_installed__;
}
