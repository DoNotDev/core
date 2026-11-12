// packages/core/hooks/src/core/__tests__/queryCacheIdentity.test.ts

/**
 * Regression (stale session): a user-scoped query fetched as anonymous (dead session)
 * under `userId = X` was served again after X signed in, so the shop showed the
 * company-setup step to an existing pro. The browser cache is now reset whenever the
 * signed-in identity changes, and kept when the provider confirms the server's user.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryClientModule = typeof import('../queryClient');

/** Fresh module state (identity unknown, no browser client) per test. */
async function load(): Promise<QueryClientModule> {
  vi.resetModules();
  return import('../queryClient');
}

const ACCOUNT = ['account', 'u1'];

describe('syncQueryCacheIdentity', () => {
  let mod: QueryClientModule;
  beforeEach(async () => {
    mod = await load();
  });

  const cached = () => mod.getQueryClient().getQueryData(ACCOUNT);

  it('keeps the hydrated cache when the provider confirms the snapshot user', () => {
    mod.syncQueryCacheIdentity('u1', true);
    mod.getQueryClient().setQueryData(ACCOUNT, { id: 'acc' });
    mod.syncQueryCacheIdentity('u1');
    expect(cached()).toEqual({ id: 'acc' });
  });

  it('resets when the provider settles on another identity than the snapshot', () => {
    // Stale cookie said u1, the browser session is dead: data fetched as anonymous
    mod.syncQueryCacheIdentity('u1', true);
    mod.getQueryClient().setQueryData(ACCOUNT, []);
    mod.syncQueryCacheIdentity(null);
    expect(cached()).toBeUndefined();
  });

  it('resets on sign-in, sign-out and switch of user, never on a same-user update', () => {
    mod.syncQueryCacheIdentity(null);
    const client = mod.getQueryClient();

    client.setQueryData(ACCOUNT, []);
    mod.syncQueryCacheIdentity('u1');
    expect(cached()).toBeUndefined();

    client.setQueryData(ACCOUNT, { id: 'acc' });
    mod.syncQueryCacheIdentity('u1'); // token refresh, profile update
    expect(cached()).toEqual({ id: 'acc' });

    mod.syncQueryCacheIdentity('u2');
    expect(cached()).toBeUndefined();

    client.setQueryData(ACCOUNT, { id: 'other' });
    mod.syncQueryCacheIdentity(null);
    expect(cached()).toBeUndefined();
  });

  it('adopts the first identity known without a snapshot (no reset at start-up)', () => {
    mod.getQueryClient().setQueryData(ACCOUNT, { id: 'acc' });
    mod.syncQueryCacheIdentity('u1');
    expect(cached()).toEqual({ id: 'acc' });
  });

  it('never resets or overrides on a later seed', () => {
    mod.syncQueryCacheIdentity('u1');
    mod.getQueryClient().setQueryData(ACCOUNT, { id: 'acc' });
    mod.syncQueryCacheIdentity(null, true);
    expect(cached()).toEqual({ id: 'acc' });
    mod.syncQueryCacheIdentity('u1');
    expect(cached()).toEqual({ id: 'acc' });
  });

  it('tracks the identity before the browser QueryClient exists', () => {
    expect(() => mod.syncQueryCacheIdentity('u1')).not.toThrow();
    expect(() => mod.syncQueryCacheIdentity(null)).not.toThrow();
  });
});
