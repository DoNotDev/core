import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F02 executable boundary investigation. `it.fails` marks an OPEN isolation
 * contract, not a passing security guarantee. These assertions must become normal
 * tests when ownership is enforced at query/stream ingress as well as eviction.
 * All identities and payloads below are synthetic.
 */
type ClientModule = typeof import('../queryClient');
type TanstackModule = typeof import('@tanstack/react-query');

const KEY = ['identity-boundary', 'document'];
const A = { owner: 'synthetic-A' };
const B = { owner: 'synthetic-B' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('F02 query identity boundary', () => {
  let identity: ClientModule;
  let query: TanstackModule;
  const cleanups: Array<() => void> = [];

  beforeEach(async () => {
    vi.resetModules();
    query = await import('@tanstack/react-query');
    identity = await import('../queryClient');
    identity.syncQueryCacheIdentity('synthetic-A', true);
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    identity.getQueryClient().clear();
  });

  function mounted(initialData = A) {
    const client = identity.getQueryClient();
    // Disabled observers are still mounted. They must not retain private data
    // while a view waits for auth/permissions before enabling its next request.
    const observer = new query.QueryObserver(client, {
      queryKey: KEY,
      initialData,
      enabled: false,
      gcTime: Infinity,
    });
    cleanups.push(observer.subscribe(() => {}));
    return observer;
  }

  it('preserves the browser client and same-identity seeded hydration', () => {
    const client = identity.getQueryClient();
    const server = new query.QueryClient();
    server.setQueryData(KEY, A);
    query.hydrate(client, query.dehydrate(server));
    server.clear();
    identity.syncQueryCacheIdentity('synthetic-A');
    expect(identity.getQueryClient()).toBe(client);
    expect(client.getQueryData(KEY)).toEqual(A);
  });

  it('evicts ordinary cache data through A → logout → B', () => {
    const client = identity.getQueryClient();
    client.setQueryData(KEY, A);
    identity.syncQueryCacheIdentity(null);
    expect(client.getQueryData(KEY)).toBeUndefined();
    identity.syncQueryCacheIdentity('synthetic-B');
    expect(client.getQueryData(KEY)).toBeUndefined();
    client.setQueryData(KEY, B);
    expect(client.getQueryData(KEY)).toEqual(B);
  });

  it.fails('OPEN: drops initialData from a mounted observer at logout', () => {
    const observer = mounted();
    identity.syncQueryCacheIdentity(null);
    expect(observer.getCurrentResult().data).toBeUndefined();
  });

  it.fails('OPEN: never resurrects A initialData for B on the same key', () => {
    const observer = mounted();
    identity.syncQueryCacheIdentity(null);
    identity.syncQueryCacheIdentity('synthetic-B');
    expect(observer.getCurrentResult().data).toBeUndefined();
    expect(identity.getQueryClient().getQueryData(KEY)).toBeUndefined();
  });

  it('rejects a pending response even when its queryFn ignores AbortSignal', async () => {
    const client = identity.getQueryClient();
    const response = deferred<typeof A>();
    const pending = client.fetchQuery({
      queryKey: KEY,
      queryFn: () => response.promise, // Intentionally never reads signal.
      retry: false,
    }).catch(() => undefined);
    identity.syncQueryCacheIdentity(null);
    identity.syncQueryCacheIdentity('synthetic-B');
    client.setQueryData(KEY, B);
    response.resolve(A);
    await pending;
    expect(client.getQueryData(KEY)).toEqual(B);
  });

  it.fails('OPEN: does not refetch with the old auth state before the caller updates it', () => {
    // AuthStore calls syncQueryCacheIdentity BEFORE set({ user: ... }).
    let authOwner: string | null = 'synthetic-A';
    const fetchOwners: Array<string | null> = [];
    const observer = new query.QueryObserver(identity.getQueryClient(), {
      queryKey: KEY,
      initialData: A,
      queryFn: async () => {
        fetchOwners.push(authOwner);
        return A;
      },
      staleTime: Infinity,
      retry: false,
    });
    cleanups.push(observer.subscribe(() => {}));
    identity.syncQueryCacheIdentity(null);
    authOwner = null;
    expect(fetchOwners).not.toContain('synthetic-A');
  });

  it.fails('OPEN: rejects a late A hydration entry after logout and B sign-in', () => {
    const server = new query.QueryClient();
    server.setQueryData(KEY, A);
    const lateEntry = query.dehydrate(server);
    server.clear();
    identity.syncQueryCacheIdentity(null);
    identity.syncQueryCacheIdentity('synthetic-B');
    // Same ingress used by ReactQueryStreamedHydration.onEntries.
    query.hydrate(identity.getQueryClient(), lateEntry);
    expect(identity.getQueryClient().getQueryData(KEY)).toBeUndefined();
  });

  it.fails('OPEN: rejects a pending A hydration promise first received after B sign-in', async () => {
    const server = new query.QueryClient();
    const response = deferred<typeof A>();
    const pending = server.fetchQuery({ queryKey: KEY, queryFn: () => response.promise });
    const lateEntry = query.dehydrate(server, { shouldDehydrateQuery: () => true });
    identity.syncQueryCacheIdentity(null);
    identity.syncQueryCacheIdentity('synthetic-B');
    const client = identity.getQueryClient();
    query.hydrate(client, lateEntry);
    response.resolve(A);
    await pending;
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    server.clear();
    expect(client.getQueryData(KEY)).toBeUndefined();
  });

  describe('why cancel/evict alone is not a complete replacement', () => {
    it.fails('OPEN: cancel + remove must also scrub subscribed observers', async () => {
      const observer = mounted();
      const client = identity.getQueryClient();
      await client.cancelQueries();
      client.removeQueries();
      expect(client.getQueryData(KEY)).toBeUndefined();
      expect(observer.getCurrentResult().data).toBeUndefined();
    });

    it.fails('OPEN: clear must also scrub subscribed observers', () => {
      const observer = mounted();
      const client = identity.getQueryClient();
      client.clear();
      expect(client.getQueryData(KEY)).toBeUndefined();
      expect(observer.getCurrentResult().data).toBeUndefined();
    });

    it.fails('OPEN: remount after eviction must not re-adopt stale initialData', () => {
      mounted();
      identity.getQueryClient().clear();
      const remounted = mounted(A);
      expect(remounted.getCurrentResult().data).toBeUndefined();
    });

    it.fails('OPEN: eviction must not allow a late stream to recreate the old query', () => {
      const server = new query.QueryClient();
      server.setQueryData(KEY, A);
      const lateEntry = query.dehydrate(server);
      server.clear();
      identity.getQueryClient().clear();
      query.hydrate(identity.getQueryClient(), lateEntry);
      expect(identity.getQueryClient().getQueryData(KEY)).toBeUndefined();
    });
  });
});
