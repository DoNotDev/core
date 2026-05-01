import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../platformDetection', () => ({
  isClient: vi.fn(() => true),
}));

vi.mock('../../storage/StorageManager', () => ({
  getStorageManager: vi.fn(),
}));

// Import mocked modules for control
import type { IStorageManager } from '@donotdev/types';

import { isClient } from '../../platformDetection';
import { getStorageManager } from '../../storage/StorageManager';
import { ClaimsCache } from '../ClaimsCache';

function createMockStorage(): IStorageManager {
  const store = new Map<string, any>();
  return {
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      return (store.get(key) as T) ?? null;
    }),
    set: vi.fn(async <T>(key: string, value: T): Promise<void> => {
      store.set(key, value);
    }),
    remove: vi.fn(async (key: string): Promise<void> => {
      store.delete(key);
    }),
    clear: vi.fn(async (): Promise<void> => {
      store.clear();
    }),
  } as unknown as IStorageManager;
}

describe('ClaimsCache', () => {
  let mockStorage: IStorageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = createMockStorage();
    vi.mocked(isClient).mockReturnValue(true);
    vi.mocked(getStorageManager).mockReturnValue(mockStorage as any);
    // Mock navigator.onLine
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('uses default options when none provided', () => {
      const cache = new ClaimsCache();
      expect(getStorageManager).toHaveBeenCalled();
    });

    it('accepts custom options', () => {
      const cache = new ClaimsCache({
        offlineTrustEnabled: true,
        storageKey: 'custom-key',
        userId: 'user-123',
      });
      expect(getStorageManager).toHaveBeenCalled();
    });
  });

  describe('setClaims', () => {
    it('stores claims with timestamp and source', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      const cache = new ClaimsCache();
      const claims = { role: 'admin', tier: 'pro' };

      await cache.setClaims(claims);

      expect(mockStorage.set).toHaveBeenCalledWith('dndev-claims', {
        claims: { role: 'admin', tier: 'pro' },
        source: 'network',
        timestamp: Date.now(),
      });
    });

    it('uses custom storage key', async () => {
      const cache = new ClaimsCache({ storageKey: 'my-claims' });
      await cache.setClaims({ role: 'user' });

      expect(mockStorage.set).toHaveBeenCalledWith(
        'my-claims',
        expect.objectContaining({ claims: { role: 'user' } })
      );
    });

    it('uses user-scoped storage key when userId is set', async () => {
      const cache = new ClaimsCache({ userId: 'user-456' });
      await cache.setClaims({ role: 'editor' });

      expect(mockStorage.set).toHaveBeenCalledWith(
        'dndev-claims-user-456',
        expect.objectContaining({ claims: { role: 'editor' } })
      );
    });

    it('does nothing on server (non-client)', async () => {
      vi.mocked(isClient).mockReturnValue(false);
      const cache = new ClaimsCache();
      await cache.setClaims({ role: 'admin' });

      expect(mockStorage.set).not.toHaveBeenCalled();
    });

    it('warns on storage failure', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(mockStorage.set).mockRejectedValueOnce(new Error('write fail'));

      const cache = new ClaimsCache();
      await cache.setClaims({ role: 'admin' });

      expect(warnSpy).toHaveBeenCalledWith(
        '[ClaimsCache] Failed to cache claims:',
        expect.any(Error)
      );
    });
  });

  describe('clearClaims', () => {
    it('removes claims from storage', async () => {
      const cache = new ClaimsCache();
      await cache.clearClaims();

      expect(mockStorage.remove).toHaveBeenCalledWith('dndev-claims');
    });

    it('uses user-scoped key when userId is set', async () => {
      const cache = new ClaimsCache({ userId: 'user-789' });
      await cache.clearClaims();

      expect(mockStorage.remove).toHaveBeenCalledWith('dndev-claims-user-789');
    });

    it('does nothing on server (non-client)', async () => {
      vi.mocked(isClient).mockReturnValue(false);
      const cache = new ClaimsCache();
      await cache.clearClaims();

      expect(mockStorage.remove).not.toHaveBeenCalled();
    });

    it('warns on storage failure', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(mockStorage.remove).mockRejectedValueOnce(
        new Error('remove fail')
      );

      const cache = new ClaimsCache();
      await cache.clearClaims();

      expect(warnSpy).toHaveBeenCalledWith(
        '[ClaimsCache] Failed to clear claims:',
        expect.any(Error)
      );
    });
  });

  describe('getClaims', () => {
    it('calls verifyFn and caches result when online', async () => {
      const claims = { role: 'admin', tier: 'pro' };
      const verifyFn = vi.fn().mockResolvedValue(claims);

      const cache = new ClaimsCache();
      const result = await cache.getClaims(verifyFn);

      expect(verifyFn).toHaveBeenCalled();
      expect(result).toEqual(claims);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'dndev-claims',
        expect.objectContaining({ claims })
      );
    });

    it('returns empty object on server', async () => {
      vi.mocked(isClient).mockReturnValue(false);
      const verifyFn = vi.fn().mockResolvedValue({ role: 'admin' });

      const cache = new ClaimsCache();
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual({});
      expect(verifyFn).not.toHaveBeenCalled();
    });

    it('throws when online verifyFn fails and offlineTrust disabled', async () => {
      const verifyFn = vi.fn().mockRejectedValue(new Error('network error'));

      const cache = new ClaimsCache({ offlineTrustEnabled: false });

      await expect(cache.getClaims(verifyFn)).rejects.toThrow('network error');
    });

    it('falls back to cache when online verifyFn fails and offlineTrust enabled', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const cachedClaims = { role: 'cached-admin' };
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: cachedClaims,
        source: 'network' as const,
        timestamp: Date.now() - 1000, // 1 second ago, within TTL
      });

      const verifyFn = vi.fn().mockRejectedValue(new Error('network error'));

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual(cachedClaims);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ClaimsCache] Network verification failed, using stale cache'
      );
    });

    it('throws when online verifyFn fails, offlineTrust enabled, but no cache', async () => {
      vi.mocked(mockStorage.get).mockResolvedValue(null);

      const verifyFn = vi.fn().mockRejectedValue(new Error('network error'));

      const cache = new ClaimsCache({ offlineTrustEnabled: true });

      await expect(cache.getClaims(verifyFn)).rejects.toThrow('network error');
    });

    it('returns empty object when offline and offlineTrust disabled', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const verifyFn = vi.fn().mockResolvedValue({ role: 'admin' });
      const cache = new ClaimsCache({ offlineTrustEnabled: false });
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual({});
      expect(verifyFn).not.toHaveBeenCalled();
    });

    it('returns cached claims when offline and offlineTrust enabled', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cachedClaims = { role: 'offline-admin' };
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: cachedClaims,
        source: 'network' as const,
        timestamp: Date.now() - 60_000, // 1 minute ago
      });

      const verifyFn = vi.fn();
      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual(cachedClaims);
      expect(verifyFn).not.toHaveBeenCalled();
    });

    it('returns empty object when offline, offlineTrust enabled, but no cache', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      vi.mocked(mockStorage.get).mockResolvedValue(null);

      const verifyFn = vi.fn();
      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual({});
    });
  });

  describe('TTL expiration', () => {
    it('returns null for cache older than 7 days', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: { role: 'expired' },
        source: 'network' as const,
        timestamp: Date.now() - sevenDaysMs - 1, // just past expiry
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual({});
      expect(mockStorage.remove).toHaveBeenCalledWith('dndev-claims');
    });

    it('returns claims for cache within 7 day TTL', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const cachedClaims = { role: 'valid' };
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: cachedClaims,
        source: 'network' as const,
        timestamp: Date.now() - sevenDaysMs + 1000, // just within TTL
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual(cachedClaims);
    });

    it('clears storage when cache is expired', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: { role: 'old' },
        source: 'network' as const,
        timestamp: Date.now() - sevenDaysMs - 100_000,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      await cache.getClaims(vi.fn());

      expect(mockStorage.remove).toHaveBeenCalledWith('dndev-claims');
    });
  });

  describe('stale cache detection', () => {
    it('uses stale cache on network failure with offlineTrust', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Cache is 3 days old — stale but within TTL
      const staleClaims = { role: 'stale-user' };
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: staleClaims,
        source: 'network' as const,
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
      });

      const verifyFn = vi.fn().mockRejectedValue(new Error('server down'));

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual(staleClaims);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ClaimsCache] Network verification failed, using stale cache'
      );
    });
  });

  describe('claims structure validation', () => {
    it('returns null for cached data with missing claims field', async () => {
      vi.mocked(mockStorage.get).mockResolvedValue({
        source: 'network',
        timestamp: Date.now(),
        // claims field is missing
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual({});
    });

    it('returns null for cached data with null claims', async () => {
      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: null,
        source: 'network',
        timestamp: Date.now(),
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual({});
    });

    it('handles complex claims objects', async () => {
      const complexClaims = {
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
        metadata: { team: 'engineering', level: 3 },
      };
      const verifyFn = vi.fn().mockResolvedValue(complexClaims);

      const cache = new ClaimsCache();
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual(complexClaims);
    });
  });

  describe('edge cases', () => {
    it('handles corrupted storage data gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(mockStorage.get).mockRejectedValue(new Error('corrupted data'));

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        '[ClaimsCache] Failed to read cached claims:',
        expect.any(Error)
      );
    });

    it('handles missing storage key gracefully', async () => {
      vi.mocked(mockStorage.get).mockResolvedValue(null);

      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: true });
      const result = await cache.getClaims(vi.fn());

      expect(result).toEqual({});
    });

    it('setUserId updates the storage key scope', async () => {
      const cache = new ClaimsCache();
      cache.setUserId('new-user');
      await cache.setClaims({ role: 'user' });

      expect(mockStorage.set).toHaveBeenCalledWith(
        'dndev-claims-new-user',
        expect.objectContaining({ claims: { role: 'user' } })
      );
    });

    it('setUserId with null removes user scoping', async () => {
      const cache = new ClaimsCache({ userId: 'old-user' });
      cache.setUserId(null);
      await cache.setClaims({ role: 'user' });

      expect(mockStorage.set).toHaveBeenCalledWith(
        'dndev-claims',
        expect.objectContaining({ claims: { role: 'user' } })
      );
    });

    it('setOfflineTrustEnabled toggles offline trust', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      vi.mocked(mockStorage.get).mockResolvedValue({
        claims: { role: 'cached' },
        source: 'network' as const,
        timestamp: Date.now() - 1000,
      });

      const cache = new ClaimsCache({ offlineTrustEnabled: false });

      // Without offline trust: returns empty
      let result = await cache.getClaims(vi.fn());
      expect(result).toEqual({});

      // Enable offline trust: returns cached
      cache.setOfflineTrustEnabled(true);
      result = await cache.getClaims(vi.fn());
      expect(result).toEqual({ role: 'cached' });
    });

    it('empty claims object is stored and retrieved', async () => {
      const verifyFn = vi.fn().mockResolvedValue({});

      const cache = new ClaimsCache();
      const result = await cache.getClaims(verifyFn);

      expect(result).toEqual({});
      expect(mockStorage.set).toHaveBeenCalled();
    });
  });
});
