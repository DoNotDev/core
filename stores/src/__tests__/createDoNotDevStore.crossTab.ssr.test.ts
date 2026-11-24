// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('persistOptions.syncAcrossTabs on the server', () => {
  it('imports and creates the store without window', async () => {
    expect(typeof window).toBe('undefined');
    const { createDoNotDevStore } = await import('../createDoNotDevStore');
    const store = createDoNotDevStore<{ count: number }>({
      name: 'ssr-cross-tab',
      createStore: () => ({ count: 0 }),
      persistOptions: { name: 'ssr-cross-tab', syncAcrossTabs: true },
    });
    expect(store.getState().count).toBe(0);
    expect(store).not.toHaveProperty('persist');
  });
});
