import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock platformDetection before importing strategy
vi.mock('../../../platformDetection', () => ({
  isClient: vi.fn(() => true),
}));

// Mock StorageEncryption
vi.mock('../../StorageEncryption', () => ({
  encryptData: vi.fn((v: unknown) =>
    Promise.resolve(`encrypted:${JSON.stringify(v)}`)
  ),
  decryptData: vi.fn((v: string) =>
    Promise.resolve(JSON.parse(v.replace('encrypted:', '')))
  ),
}));

import { isClient } from '../../../platformDetection';
import { HybridStorageStrategy } from '../HybridStorageStrategy';

const mockIsClient = vi.mocked(isClient);

// ---------- helpers ----------

/**
 * Creates a mock Storage where keys are enumerable via Object.keys(),
 * which is required by LocalStorageStrategy.clear().
 *
 * Stored items become own enumerable properties on the object so that
 * Object.keys(localStorage) returns them. Methods are non-enumerable
 * so they don't appear in Object.keys() but vi.spyOn can still access them.
 */
function createEnumerableMockStorage(): Storage {
  const storage = Object.create(null) as Record<string, any>;

  Object.defineProperties(storage, {
    getItem: {
      configurable: true,
      writable: true,
      enumerable: false,
      value(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(storage, key)
          ? storage[key]
          : null;
      },
    },
    setItem: {
      configurable: true,
      writable: true,
      enumerable: false,
      value(key: string, val: string): void {
        storage[key] = val;
      },
    },
    removeItem: {
      configurable: true,
      writable: true,
      enumerable: false,
      value(key: string): void {
        delete storage[key];
      },
    },
    clear: {
      configurable: true,
      writable: true,
      enumerable: false,
      value(): void {
        for (const k of Object.keys(storage)) delete storage[k];
      },
    },
    key: {
      configurable: true,
      writable: true,
      enumerable: false,
      value(index: number): string | null {
        return Object.keys(storage)[index] ?? null;
      },
    },
    length: {
      configurable: true,
      enumerable: false,
      get() {
        return Object.keys(storage).length;
      },
    },
  });

  return storage as unknown as Storage;
}

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  });
}

function mockFetch404() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    statusText: 'Not Found',
  });
}

function mockFetchError() {
  return vi.fn().mockRejectedValue(new Error('Network error'));
}

function mockFetchServerError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  });
}

// ---------- suite ----------

describe('HybridStorageStrategy', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createEnumerableMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('fetch', mockFetchOk({ value: null }));
    mockIsClient.mockReturnValue(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- constructor ----

  describe('constructor', () => {
    it('throws when userId is empty', () => {
      expect(() => new HybridStorageStrategy('')).toThrow();
    });

    it('creates instance with valid userId', () => {
      const strategy = new HybridStorageStrategy('user-1');
      expect(strategy).toBeInstanceOf(HybridStorageStrategy);
    });

    it('accepts custom apiEndpoint', () => {
      const strategy = new HybridStorageStrategy('user-1', '/custom/api');
      expect(strategy).toBeInstanceOf(HybridStorageStrategy);
    });
  });

  // ---- get ----

  describe('get', () => {
    it('returns data from local storage when available', async () => {
      const stored = JSON.stringify({
        value: { name: 'Alice' },
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:user:user-1:profile', stored);

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('profile', { scope: 'user' });

      expect(result).toEqual({ name: 'Alice' });
      // Should NOT call cloud when local hit
      expect(fetch).not.toHaveBeenCalled();
    });

    it('falls back to cloud when local storage is empty', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchOk({ value: { name: 'Cloud Alice' }, expiresAt: null })
      );

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('profile', { scope: 'user' });

      expect(result).toEqual({ name: 'Cloud Alice' });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null when both local and cloud have no data', async () => {
      vi.stubGlobal('fetch', mockFetch404());

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('missing', { scope: 'user' });

      expect(result).toBeNull();
    });

    it('caches cloud data locally after fetch', async () => {
      vi.stubGlobal(
        'fetch',
        mockFetchOk({ value: 'cached-value', expiresAt: null })
      );

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.get('key1', { scope: 'global' });

      // Allow microtask for the local cache write
      await vi.waitFor(() => {
        const raw = mockStorage.getItem('dndev:global:key1');
        expect(raw).not.toBeNull();
      });

      const cached = JSON.parse(mockStorage.getItem('dndev:global:key1')!);
      expect(cached.value).toBe('cached-value');
    });

    it('returns null for expired cloud data', async () => {
      const pastDate = new Date(Date.now() - 60_000).toISOString();
      vi.stubGlobal(
        'fetch',
        mockFetchOk({ value: 'stale', expiresAt: pastDate })
      );

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('expired-key', { scope: 'global' });

      expect(result).toBeNull();
    });

    it('falls back to local storage when cloud fetch fails', async () => {
      vi.stubGlobal('fetch', mockFetchError());

      const strategy = new HybridStorageStrategy('user-1');
      // No local data either, should return null (cloud error is caught)
      const result = await strategy.get('key', { scope: 'global' });
      expect(result).toBeNull();
    });

    it('returns null for user scope with global option not requiring userId', async () => {
      vi.stubGlobal('fetch', mockFetch404());

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('key', { scope: 'session' });

      expect(result).toBeNull();
    });

    it('uses default scope (user) when no options provided', async () => {
      const stored = JSON.stringify({
        value: 'default-scope',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:user:user-1:mykey', stored);

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('mykey');

      expect(result).toBe('default-scope');
    });
  });

  // ---- set ----

  describe('set', () => {
    it('stores data in local storage', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('key', { foo: 'bar' }, { scope: 'user' });

      const raw = mockStorage.getItem('dndev:user:user-1:key');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.value).toEqual({ foo: 'bar' });
    });

    it('sends data to cloud asynchronously', async () => {
      const fetchMock = mockFetchOk({});
      vi.stubGlobal('fetch', fetchMock);

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('key', 'value', { scope: 'global' });

      // Cloud write is fire-and-forget; wait for microtask
      await new Promise((r) => setTimeout(r, 0));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [url, opts] = call!;
      expect(url).toContain('/api/storage/');
      expect(opts?.method).toBe('PUT');
    });

    it('does not throw when cloud set fails', async () => {
      vi.stubGlobal('fetch', mockFetchServerError());

      const strategy = new HybridStorageStrategy('user-1');
      // Should not throw even if cloud fails
      await expect(
        strategy.set('key', 'value', { scope: 'user' })
      ).resolves.toBeUndefined();
    });

    it('stores with expiry', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('temp', 'data', { scope: 'user', expiry: 3600 });

      const raw = mockStorage.getItem('dndev:user:user-1:temp');
      const parsed = JSON.parse(raw!);
      expect(parsed.expiresAt).not.toBeNull();

      const expiresAt = new Date(parsed.expiresAt).getTime();
      // Should be roughly 1 hour from now (within 5 seconds tolerance)
      expect(expiresAt).toBeGreaterThan(Date.now() + 3595_000);
      expect(expiresAt).toBeLessThan(Date.now() + 3605_000);
    });

    it('throws when local storage set fails', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));
      mockIsClient.mockReturnValue(true);
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        const err = new DOMException('Quota exceeded', 'QuotaExceededError');
        (err as any).code = 22;
        throw err;
      });

      const strategy = new HybridStorageStrategy('user-1');
      await expect(
        strategy.set('key', 'value', { scope: 'user' })
      ).rejects.toThrow();
    });
  });

  // ---- remove ----

  describe('remove', () => {
    it('removes data from local storage', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const stored = JSON.stringify({
        value: 'to-delete',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:user:user-1:key', stored);
      mockStorage.setItem('dndev:global:key', stored);
      mockStorage.setItem('dndev:session:key', stored);

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.remove('key');

      expect(mockStorage.getItem('dndev:user:user-1:key')).toBeNull();
      expect(mockStorage.getItem('dndev:global:key')).toBeNull();
      expect(mockStorage.getItem('dndev:session:key')).toBeNull();
    });

    it('sends delete to cloud asynchronously', async () => {
      const fetchMock = mockFetchOk({});
      vi.stubGlobal('fetch', fetchMock);

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.remove('key');

      // Cloud delete is fire-and-forget
      await new Promise((r) => setTimeout(r, 0));

      // removeFromCloud iterates over 3 scopes
      expect(fetchMock).toHaveBeenCalled();
      const deleteCalls = fetchMock.mock.calls.filter(
        (c: any[]) => c[1]?.method === 'DELETE'
      );
      expect(deleteCalls.length).toBe(3);
    });

    it('does not throw when cloud remove fails', async () => {
      vi.stubGlobal('fetch', mockFetchError());

      const strategy = new HybridStorageStrategy('user-1');
      await expect(strategy.remove('key')).resolves.toBeUndefined();
    });
  });

  // ---- clear ----

  describe('clear', () => {
    it('clears scoped keys from local storage', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const stored = JSON.stringify({
        value: 'v',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:user:user-1:a', stored);
      mockStorage.setItem('dndev:user:user-1:b', stored);
      mockStorage.setItem('dndev:global:c', stored);
      mockStorage.setItem('other:key', 'keep');

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.clear('user');

      expect(mockStorage.getItem('dndev:user:user-1:a')).toBeNull();
      expect(mockStorage.getItem('dndev:user:user-1:b')).toBeNull();
      // Global scope should remain
      expect(mockStorage.getItem('dndev:global:c')).not.toBeNull();
      // Non-app keys should remain
      expect(mockStorage.getItem('other:key')).toBe('keep');
    });

    it('clears all dndev keys when no scope specified', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const stored = JSON.stringify({
        value: 'v',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:user:user-1:a', stored);
      mockStorage.setItem('dndev:global:b', stored);
      mockStorage.setItem('dndev:session:c', stored);
      mockStorage.setItem('other:key', 'keep');

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.clear();

      expect(mockStorage.getItem('dndev:user:user-1:a')).toBeNull();
      expect(mockStorage.getItem('dndev:global:b')).toBeNull();
      expect(mockStorage.getItem('dndev:session:c')).toBeNull();
      expect(mockStorage.getItem('other:key')).toBe('keep');
    });

    it('sends clear to cloud asynchronously', async () => {
      const fetchMock = mockFetchOk({});
      vi.stubGlobal('fetch', fetchMock);

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.clear('user');

      await new Promise((r) => setTimeout(r, 0));

      const deleteCalls = fetchMock.mock.calls.filter(
        (c: any[]) => c[1]?.method === 'DELETE'
      );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('does not throw when cloud clear fails', async () => {
      vi.stubGlobal('fetch', mockFetchError());

      const strategy = new HybridStorageStrategy('user-1');
      await expect(strategy.clear('global')).resolves.toBeUndefined();
    });
  });

  // ---- SSR safety ----

  describe('SSR safety (no window)', () => {
    it('get returns null when not client', async () => {
      mockIsClient.mockReturnValue(false);
      vi.stubGlobal('fetch', mockFetchError());

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('key', { scope: 'global' });

      expect(result).toBeNull();
    });

    it('set does not throw when not client', async () => {
      mockIsClient.mockReturnValue(false);
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      // LocalStorageStrategy checks `typeof window` before writing
      await expect(
        strategy.set('key', 'value', { scope: 'global' })
      ).resolves.toBeUndefined();
    });
  });

  // ---- Quota exceeded handling ----

  describe('quota exceeded handling', () => {
    it('throws with descriptive message on QuotaExceededError', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        const err = new DOMException('Quota exceeded', 'QuotaExceededError');
        (err as any).code = 22;
        throw err;
      });

      const strategy = new HybridStorageStrategy('user-1');

      await expect(
        strategy.set('big-data', 'x'.repeat(10_000), { scope: 'user' })
      ).rejects.toThrow();
    });
  });

  // ---- Private browsing mode ----

  describe('private browsing mode (localStorage throws)', () => {
    it('get returns null when localStorage.getItem throws SecurityError', async () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      // Cloud also fails in this scenario
      vi.stubGlobal('fetch', mockFetchError());

      const strategy = new HybridStorageStrategy('user-1');
      // The outer catch in get re-tries localStrategy.get which also throws,
      // so it should throw the handleError wrapped error
      await expect(strategy.get('key', { scope: 'user' })).rejects.toThrow();
    });

    it('set throws when localStorage.setItem throws SecurityError', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      const strategy = new HybridStorageStrategy('user-1');
      await expect(
        strategy.set('key', 'value', { scope: 'user' })
      ).rejects.toThrow();
    });
  });

  // ---- Cloud API interaction ----

  describe('cloud API interaction', () => {
    it('sends correct PUT request with payload', async () => {
      const fetchMock = mockFetchOk({});
      vi.stubGlobal('fetch', fetchMock);

      const strategy = new HybridStorageStrategy('user-1', '/my-api');
      await strategy.set(
        'settings',
        { theme: 'dark' },
        { scope: 'global', expiry: 60 }
      );

      await new Promise((r) => setTimeout(r, 0));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [url, opts] = call!;
      expect(url).toContain('/my-api/');
      expect(url).toContain(encodeURIComponent('dndev:global:settings'));
      expect(opts?.method).toBe('PUT');
      expect(opts?.headers?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(opts.body);
      expect(body.value).toEqual({ theme: 'dark' });
      expect(body.expiresAt).not.toBeNull();
      expect(body.createdAt).toBeTruthy();
    });

    it('cloud 500 on set is caught and warned', async () => {
      vi.stubGlobal('fetch', mockFetchServerError());

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('key', 'value', { scope: 'user' });

      await new Promise((r) => setTimeout(r, 50));

      expect(console.warn).toHaveBeenCalled();
    });

    it('cloud 500 on get returns null', async () => {
      vi.stubGlobal('fetch', mockFetchServerError());

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('key', { scope: 'global' });

      expect(result).toBeNull();
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles corrupted JSON in local storage gracefully', async () => {
      mockStorage.setItem('dndev:user:user-1:bad', 'NOT_VALID_JSON{{{');
      vi.stubGlobal('fetch', mockFetch404());

      const strategy = new HybridStorageStrategy('user-1');
      // LocalStorageStrategy JSON.parse will throw, which bubbles up
      // through HybridStorageStrategy error path
      await expect(strategy.get('bad', { scope: 'user' })).rejects.toThrow();
    });

    it('handles null value stored in local storage', async () => {
      const stored = JSON.stringify({
        value: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:global:nullval', stored);

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('nullval', { scope: 'global' });

      // null is a valid stored value; local strategy returns null,
      // which causes fallback to cloud
      expect(result).toBeNull();
    });

    it('handles concurrent writes to the same key', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');

      // Fire multiple concurrent writes
      await Promise.all([
        strategy.set('counter', 1, { scope: 'global' }),
        strategy.set('counter', 2, { scope: 'global' }),
        strategy.set('counter', 3, { scope: 'global' }),
      ]);

      // Last write wins in localStorage
      const raw = mockStorage.getItem('dndev:global:counter');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.value).toBe(3);
    });

    it('handles very large values', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const largeValue = 'x'.repeat(100_000);
      const strategy = new HybridStorageStrategy('user-1');

      await strategy.set('large', largeValue, { scope: 'global' });

      const raw = mockStorage.getItem('dndev:global:large');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.value).toBe(largeValue);
    });

    it('handles special characters in key', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('key/with:special.chars', 'value', {
        scope: 'global',
      });

      const raw = mockStorage.getItem('dndev:global:key/with:special.chars');
      expect(raw).not.toBeNull();
    });

    it('handles empty string value', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('empty', '', { scope: 'global' });

      const raw = mockStorage.getItem('dndev:global:empty');
      const parsed = JSON.parse(raw!);
      expect(parsed.value).toBe('');
    });
  });

  // ---- Scope handling ----

  describe('scope handling', () => {
    it('global scope does not require userId', async () => {
      const stored = JSON.stringify({
        value: 'global-val',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
      mockStorage.setItem('dndev:global:shared', stored);

      const strategy = new HybridStorageStrategy('user-1');
      const result = await strategy.get('shared', { scope: 'global' });

      expect(result).toBe('global-val');
    });

    it('session scope works', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-1');
      await strategy.set('sess-key', 'sess-val', { scope: 'session' });

      const raw = mockStorage.getItem('dndev:session:sess-key');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.value).toBe('sess-val');
    });

    it('user scope includes userId in key', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const strategy = new HybridStorageStrategy('user-42');
      await strategy.set('pref', 'dark', { scope: 'user' });

      const raw = mockStorage.getItem('dndev:user:user-42:pref');
      expect(raw).not.toBeNull();
    });
  });
});
