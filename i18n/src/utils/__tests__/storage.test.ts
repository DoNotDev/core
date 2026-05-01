import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @donotdev/utils before imports
const mockGetLocalStorageItem = vi.fn();
const mockSetLocalStorageItem = vi.fn();
const mockRemoveLocalStorageItem = vi.fn();
const mockIsLocalStorageAvailable = vi.fn();
const mockIsClient = vi.fn();

vi.mock('@donotdev/utils', () => ({
  getLocalStorageItem: mockGetLocalStorageItem,
  setLocalStorageItem: mockSetLocalStorageItem,
  removeLocalStorageItem: mockRemoveLocalStorageItem,
  isLocalStorageAvailable: mockIsLocalStorageAvailable,
  isClient: mockIsClient,
}));

// Mock config with controllable storage config
const mockStorageConfig: {
  type: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  prefix: string;
  ttl: number;
  encryption: boolean;
  maxSize: number;
} = {
  type: 'memory',
  prefix: 'dndev_i18n_',
  ttl: 24 * 60 * 60 * 1000,
  encryption: false,
  maxSize: 5 * 1024 * 1024,
};

vi.mock('../config', () => ({
  getStorageConfig: () => mockStorageConfig,
}));

// Dynamic import after mocks are set up
const { createStorage } = await import('../storage');

import type { StorageStrategy } from '../storage';

describe('MemoryStrategy (via createStorage)', () => {
  let storage: StorageStrategy;

  beforeEach(() => {
    mockStorageConfig.type = 'memory';
    storage = createStorage();
  });

  it('stores and retrieves a value', async () => {
    await storage.set('test-key', { hello: 'world' });
    const result = await storage.get('test-key');
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns null for missing key', async () => {
    const result = await storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a stored value', async () => {
    await storage.set('remove-me', 'data');
    await storage.remove('remove-me');
    const result = await storage.get('remove-me');
    expect(result).toBeNull();
  });

  it('clears all prefixed keys', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.clear();
    expect(await storage.size()).toBe(0);
  });

  it('returns correct keys', async () => {
    await storage.set('key1', 'v1');
    await storage.set('key2', 'v2');
    const keys = await storage.keys();
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.startsWith('dndev_i18n_'))).toBe(true);
  });

  it('returns correct size', async () => {
    expect(await storage.size()).toBe(0);
    await storage.set('x', 1);
    expect(await storage.size()).toBe(1);
    await storage.set('y', 2);
    expect(await storage.size()).toBe(2);
  });

  it('stores various data types', async () => {
    await storage.set('string', 'hello');
    await storage.set('number', 42);
    await storage.set('boolean', true);
    await storage.set('array', [1, 2, 3]);
    await storage.set('object', { nested: { value: true } });

    expect(await storage.get('string')).toBe('hello');
    expect(await storage.get('number')).toBe(42);
    expect(await storage.get('boolean')).toBe(true);
    expect(await storage.get('array')).toEqual([1, 2, 3]);
    expect(await storage.get('object')).toEqual({ nested: { value: true } });
  });

  it('overwrites existing key', async () => {
    await storage.set('key', 'first');
    await storage.set('key', 'second');
    expect(await storage.get('key')).toBe('second');
  });
});

describe('MemoryStrategy TTL expiration', () => {
  let storage: StorageStrategy;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorageConfig.type = 'memory';
    storage = createStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns value before TTL expires', async () => {
    await storage.set('ttl-key', 'alive', 5000);
    vi.advanceTimersByTime(4999);
    expect(await storage.get('ttl-key')).toBe('alive');
  });

  it('returns null after TTL expires', async () => {
    await storage.set('ttl-key', 'alive', 5000);
    vi.advanceTimersByTime(5001);
    expect(await storage.get('ttl-key')).toBeNull();
  });

  it('uses config TTL as default when no explicit TTL', async () => {
    mockStorageConfig.ttl = 1000;
    const shortTtlStorage = createStorage();
    await shortTtlStorage.set('default-ttl', 'data');

    vi.advanceTimersByTime(999);
    expect(await shortTtlStorage.get('default-ttl')).toBe('data');

    vi.advanceTimersByTime(2);
    expect(await shortTtlStorage.get('default-ttl')).toBeNull();

    // Restore
    mockStorageConfig.ttl = 24 * 60 * 60 * 1000;
  });

  it('expired key is cleaned up on get', async () => {
    await storage.set('expire-me', 'value', 100);
    vi.advanceTimersByTime(101);

    // get should return null and clean up
    expect(await storage.get('expire-me')).toBeNull();
  });
});

describe('LocalStorageStrategy (via createStorage)', () => {
  let storage: StorageStrategy;

  beforeEach(() => {
    mockStorageConfig.type = 'localStorage';
    mockIsLocalStorageAvailable.mockReturnValue(true);
    mockIsClient.mockReturnValue(true);
    mockGetLocalStorageItem.mockReturnValue(null);
    storage = createStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to memory when localStorage unavailable', () => {
    mockIsLocalStorageAvailable.mockReturnValue(false);
    const fallbackStorage = createStorage();
    // Memory storage should work without localStorage
    expect(fallbackStorage).toBeDefined();
  });

  it('delegates get to getLocalStorageItem', async () => {
    const now = Date.now();
    mockGetLocalStorageItem.mockReturnValue({
      value: { greeting: 'hello' },
      created: now,
      expires: now + 100000,
    });

    const result = await storage.get('translations');
    expect(mockGetLocalStorageItem).toHaveBeenCalledWith(
      'dndev_i18n_translations',
      null
    );
    expect(result).toEqual({ greeting: 'hello' });
  });

  it('returns null when getLocalStorageItem returns null', async () => {
    mockGetLocalStorageItem.mockReturnValue(null);
    const result = await storage.get('missing');
    expect(result).toBeNull();
  });

  it('delegates set to setLocalStorageItem', async () => {
    await storage.set('lang', 'fr');
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'dndev_i18n_lang',
      expect.objectContaining({ value: 'fr' })
    );
  });

  it('delegates remove to removeLocalStorageItem', async () => {
    await storage.remove('old-key');
    expect(mockRemoveLocalStorageItem).toHaveBeenCalledWith(
      'dndev_i18n_old-key'
    );
  });

  it('skips set when item exceeds maxSize', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSetLocalStorageItem.mockClear();
    mockStorageConfig.maxSize = 10; // Very small
    const smallStorage = createStorage();

    await smallStorage.set('big', 'a'.repeat(100));
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();

    // Restore
    mockStorageConfig.maxSize = 5 * 1024 * 1024;
    warnSpy.mockRestore();
  });

  it('returns null and does not throw on get when unavailable', async () => {
    mockIsLocalStorageAvailable.mockReturnValue(false);
    const unavailableStorage = createStorage();
    // Falls back to MemoryStrategy, which returns null for missing keys
    const result = await unavailableStorage.get('anything');
    expect(result).toBeNull();
  });

  it('handles expired items by removing them', async () => {
    vi.useFakeTimers();
    const past = Date.now() - 1000;
    mockGetLocalStorageItem.mockReturnValue({
      value: 'stale',
      created: past - 5000,
      expires: past,
    });

    const result = await storage.get('expired-key');
    expect(result).toBeNull();
    expect(mockRemoveLocalStorageItem).toHaveBeenCalledWith(
      'dndev_i18n_expired-key'
    );
    vi.useRealTimers();
  });

  it('gracefully handles getLocalStorageItem throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetLocalStorageItem.mockImplementation(() => {
      throw new Error('Storage corrupted');
    });

    const result = await storage.get('corrupted');
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('gracefully handles setLocalStorageItem throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSetLocalStorageItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    await expect(storage.set('key', 'value')).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });
});

describe('createStorage factory', () => {
  beforeEach(() => {
    mockIsLocalStorageAvailable.mockReturnValue(false);
    mockIsClient.mockReturnValue(false);
  });

  it('creates memory strategy for type "memory"', () => {
    mockStorageConfig.type = 'memory';
    const s = createStorage();
    expect(s).toBeDefined();
  });

  it('creates sessionStorage strategy for type "sessionStorage"', () => {
    mockStorageConfig.type = 'sessionStorage';
    const s = createStorage();
    expect(s).toBeDefined();
  });

  it('creates indexedDB strategy for type "indexedDB"', () => {
    mockStorageConfig.type = 'indexedDB';
    const s = createStorage();
    expect(s).toBeDefined();
  });

  it('falls back to memory for localStorage when unavailable', () => {
    mockStorageConfig.type = 'localStorage';
    mockIsLocalStorageAvailable.mockReturnValue(false);
    const s = createStorage();
    expect(s).toBeDefined();
  });

  it('falls back to memory for unknown storage type', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (mockStorageConfig as any).type = 'unknownType';
    const s = createStorage();
    expect(s).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown storage type')
    );
    warnSpy.mockRestore();
  });
});

describe('edge cases', () => {
  let storage: StorageStrategy;

  beforeEach(() => {
    mockStorageConfig.type = 'memory';
    storage = createStorage();
  });

  it('handles empty string as key', async () => {
    await storage.set('', 'empty-key-value');
    expect(await storage.get('')).toBe('empty-key-value');
  });

  it('handles empty string as value', async () => {
    await storage.set('empty-val', '');
    expect(await storage.get('empty-val')).toBe('');
  });

  it('handles null-like values', async () => {
    await storage.set('zero', 0);
    await storage.set('false', false);
    expect(await storage.get('zero')).toBe(0);
    expect(await storage.get('false')).toBe(false);
  });

  it('handles special characters in keys', async () => {
    await storage.set('key/with/slashes', 'a');
    await storage.set('key.with.dots', 'b');
    await storage.set('key:with:colons', 'c');
    expect(await storage.get('key/with/slashes')).toBe('a');
    expect(await storage.get('key.with.dots')).toBe('b');
    expect(await storage.get('key:with:colons')).toBe('c');
  });

  it('handles large translation objects', async () => {
    const large: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      large[`key_${i}`] = `value_${i}`;
    }
    await storage.set('large', large);
    const result = await storage.get<Record<string, string>>('large');
    expect(result).toEqual(large);
    expect(Object.keys(result!)).toHaveLength(1000);
  });

  it('concurrent set operations do not corrupt data', async () => {
    const promises = Array.from({ length: 50 }, (_, i) =>
      storage.set(`concurrent_${i}`, i)
    );
    await Promise.all(promises);

    for (let i = 0; i < 50; i++) {
      expect(await storage.get(`concurrent_${i}`)).toBe(i);
    }
  });

  it('concurrent get and set do not throw', async () => {
    await storage.set('race', 'initial');
    const ops = [
      storage.get('race'),
      storage.set('race', 'updated'),
      storage.get('race'),
      storage.set('race', 'final'),
    ];
    await expect(Promise.all(ops)).resolves.toBeDefined();
  });

  it('remove on nonexistent key does not throw', async () => {
    await expect(storage.remove('ghost')).resolves.toBeUndefined();
  });

  it('clear on empty storage does not throw', async () => {
    await expect(storage.clear()).resolves.toBeUndefined();
  });

  it('keys returns empty array on fresh storage', async () => {
    expect(await storage.keys()).toEqual([]);
  });
});

describe('LocalStorageStrategy edge cases', () => {
  beforeEach(() => {
    mockStorageConfig.type = 'localStorage';
    mockIsLocalStorageAvailable.mockReturnValue(true);
    mockIsClient.mockReturnValue(true);
    mockGetLocalStorageItem.mockReturnValue(null);
  });

  describe('error handling', () => {
    it('handles storage errors gracefully', async () => {
      mockGetLocalStorageItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const storage = createStorage();
      const result = await storage.get('test-key');

      expect(result).toBeNull(); // Should return null on error, not throw
    });

    it('handles storage get errors gracefully', async () => {
      mockGetLocalStorageItem.mockImplementation(() => {
        throw new Error('Storage read error');
      });

      const storage = createStorage();
      const result = await storage.get('test-key');

      // Should return null on error, not throw
      expect(result).toBeNull();
    });

    it('handles storage set errors without throwing', async () => {
      mockSetLocalStorageItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const storage = createStorage();

      // Should not throw, should handle gracefully
      await expect(storage.set('key', 'value')).resolves.not.toThrow();
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockIsLocalStorageAvailable.mockReturnValue(true);
      mockIsClient.mockReturnValue(true);
    });

    it('returns null for expired items', async () => {
      const expiredItem = {
        value: 'test',
        created: Date.now() - 100000, // 100 seconds ago
        expires: Date.now() - 50000, // Expired 50 seconds ago
      };
      mockGetLocalStorageItem.mockReturnValue(expiredItem);
      mockStorageConfig.ttl = 50 * 1000; // 50 second TTL in ms

      const storage = createStorage();
      const result = await storage.get('expired-key');

      expect(result).toBeNull();
      expect(mockRemoveLocalStorageItem).toHaveBeenCalled();
    });

    it('returns value for non-expired items', async () => {
      const now = Date.now();
      const validItem = {
        value: 'test',
        created: now - 1000, // 1 second ago
        expires: now + 4000, // Expires in 4 seconds
      };
      mockGetLocalStorageItem.mockReturnValue(validItem);
      mockStorageConfig.ttl = 5000; // 5 second TTL

      const storage = createStorage();
      const result = await storage.get('valid-key');

      expect(result).toBe('test');
    });
  });

  describe('storage size limits', () => {
    it('skips storing items that exceed maxSize', async () => {
      vi.clearAllMocks();
      const largeValue = 'x'.repeat(10 * 1024 * 1024); // 10MB
      mockStorageConfig.maxSize = 5 * 1024 * 1024; // 5MB limit

      const storage = createStorage();
      await storage.set('large-key', largeValue);

      // Should not call setLocalStorageItem for oversized items (returns early)
      // Note: This only works for LocalStorageStrategy, MemoryStrategy doesn't check size
      if (mockStorageConfig.type === 'localStorage') {
        expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
      }
    });

    it('stores items within size limit', async () => {
      vi.clearAllMocks();
      const smallValue = 'small';
      mockStorageConfig.maxSize = 5 * 1024 * 1024;

      const storage = createStorage();
      await storage.set('small-key', smallValue);

      // Only check for localStorage strategy
      if (mockStorageConfig.type === 'localStorage') {
        expect(mockSetLocalStorageItem).toHaveBeenCalled();
      }
    });
  });
});
