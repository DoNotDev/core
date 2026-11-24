import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mutate, StoreApi } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';

import { createDoNotDevStore } from '../createDoNotDevStore';

const env = vi.hoisted(() => ({ client: true }));
vi.mock('@donotdev/utils', () => ({ isClient: () => env.client, isDev: () => false }));

interface Cart { lines: string[]; add(line: string): void }

/** One shared "localStorage" for every simulated tab. */
const saved = new Map<string, string>();
const storage = {
  getItem: vi.fn((key: string) => saved.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { saved.set(key, value); }),
  removeItem: vi.fn((key: string) => { saved.delete(key); }),
};

function persistence<T>(store: StoreApi<T>) {
  // why: the public factory contract intentionally omits middleware mutators.
  return (store as Mutate<StoreApi<T>, [['zustand/persist', Partial<T>]]>).persist;
}

/** A tab's store: same storage key, distinct singleton name. */
function tab(name: string, options: { syncAcrossTabs?: boolean; skipHydration?: boolean; key?: string } = {}) {
  const { key = 'cart', ...rest } = options;
  return createDoNotDevStore<Cart>({
    name,
    createStore: (set) => ({ lines: [], add: (line) => set((s) => ({ lines: [...s.lines, line] })) }),
    persistOptions: { name: key, storage: createJSONStorage(() => storage), syncAcrossTabs: true, ...rest },
  });
}

/** What the browser fires in the other tabs after a write. */
function otherTabWrote(key: string) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: saved.get(key) ?? null }));
}

const listeners: EventListenerOrEventListenerObject[] = [];
beforeEach(() => {
  delete globalThis._DNDEV_STORES_;
  saved.clear();
  env.client = true;
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, opts) => {
    if (type === 'storage' && listener) listeners.push(listener);
    add(type, listener, opts);
  });
});
afterEach(() => {
  listeners.splice(0).forEach((listener) => window.removeEventListener('storage', listener));
  vi.restoreAllMocks();
});

describe('persistOptions.syncAcrossTabs', () => {
  it('rehydrates from another tab write: state updated, completion kept, no echo write', () => {
    const a = tab('tab-a');
    const b = tab('tab-b');
    const add = b.getState().add;
    const completion: boolean[] = [];
    b.subscribe((state) => completion.push(state._hasHydrated ?? false));

    a.getState().add('serum');
    storage.setItem.mockClear();
    otherTabWrote('cart');

    expect(b.getState().lines).toEqual(['serum']);
    expect(b.getState()._hasHydrated).toBe(true);
    expect(completion).not.toContain(false);
    expect(b.getState().add).toBe(add);
    expect(storage.setItem).not.toHaveBeenCalled();

    b.getState().add('toner');
    otherTabWrote('cart');
    expect(a.getState().lines).toEqual(['serum', 'toner']);
  });

  it('ignores storage events for another key', () => {
    const b = tab('tab-b');
    saved.set('other', JSON.stringify({ state: { lines: ['x'] }, version: 0 }));
    storage.getItem.mockClear();
    otherTabWrote('other');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(b.getState().lines).toEqual([]);
  });

  it('does not listen without the option', () => {
    const a = tab('tab-a', { syncAcrossTabs: false });
    const b = tab('tab-b', { syncAcrossTabs: false });
    a.getState().add('serum');
    otherTabWrote('cart');
    expect(b.getState().lines).toEqual([]);
    expect(listeners).toHaveLength(0);
  });

  it('is a persist option only', () => {
    createDoNotDevStore<{ count: number }>({
      name: 'plain',
      createStore: () => ({ count: 0 }),
      // @ts-expect-error syncAcrossTabs belongs to persistOptions
      syncAcrossTabs: true,
    });
    expect(listeners).toHaveLength(0);
  });

  it('respects skipHydration until the store hydrates', async () => {
    const a = tab('tab-a');
    const b = tab('tab-b', { skipHydration: true });
    a.getState().add('serum');
    otherTabWrote('cart');
    expect(b.getState().lines).toEqual([]);
    await persistence(b).rehydrate();
    a.getState().add('toner');
    otherTabWrote('cart');
    expect(b.getState().lines).toEqual(['serum', 'toner']);
  });

  it('syncs domain-owned stores', () => {
    const domain = (name: string) => createDoNotDevStore<{ count: number }>({
      name, lifecycle: false, createStore: () => ({ count: 0 }),
      persistOptions: { name: 'counter', storage: createJSONStorage(() => storage), syncAcrossTabs: true },
    });
    const a = domain('domain-a');
    const b = domain('domain-b');
    a.setState({ count: 4 });
    otherTabWrote('counter');
    expect(b.getState()).toEqual({ count: 4 });
    expect(persistence(b).getOptions()).not.toHaveProperty('syncAcrossTabs');
  });

  it('adds no listener on the server', () => {
    env.client = false;
    const b = tab('tab-b');
    expect(listeners).toHaveLength(0);
    b.getState().add('serum');
    expect(b.getState().lines).toEqual(['serum']);
  });
});
