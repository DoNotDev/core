import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { resetGlobalConfig } from '../../__tests__/test-utils';

// We need fresh module imports per test group because platformDetection has module-level caches.
// Use vi.resetModules() + dynamic import for cache isolation.

describe('platformDetection', () => {
  beforeEach(() => {
    vi.resetModules();
    resetGlobalConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobalConfig();
  });

  describe('isClient', () => {
    it('returns true when window is defined (jsdom)', async () => {
      const { isClient } = await import('../platformDetection');
      expect(isClient()).toBe(true);
    }, 10_000);
  });

  describe('isServer', () => {
    it('returns true when process.versions.node exists', async () => {
      const { isServer } = await import('../platformDetection');
      // In vitest (Node), process.versions.node exists
      expect(isServer()).toBe(true);
    });
  });

  describe('isTest', () => {
    it('returns true when NODE_ENV is test', async () => {
      const { isTest } = await import('../platformDetection');
      // vitest sets NODE_ENV=test
      expect(isTest()).toBe(true);
    });
  });

  describe('isNextJs', () => {
    it('returns true when __NEXT_DATA__ is on globalThis', async () => {
      (globalThis as any).__NEXT_DATA__ = { page: '/' };
      const { isNextJs } = await import('../platformDetection');
      expect(isNextJs()).toBe(true);
    });

    it('returns true when NEXT_RUNTIME env var is set', async () => {
      process.env.NEXT_RUNTIME = 'nodejs';
      const { isNextJs } = await import('../platformDetection');
      expect(isNextJs()).toBe(true);
      delete process.env.NEXT_RUNTIME;
    });

    it('returns false in plain environment', async () => {
      const { isNextJs } = await import('../platformDetection');
      expect(isNextJs()).toBe(false);
    });
  });

  describe('isVite', () => {
    it('returns true when config.platform is vite', async () => {
      (globalThis as any)._DNDEV_CONFIG_ = {
        platform: 'vite',
        mode: 'development',
        context: 'client',
      };
      const { isVite } = await import('../platformDetection');
      expect(isVite()).toBe(true);
    });

    it('returns false when no vite signals', async () => {
      const { isVite } = await import('../platformDetection');
      expect(isVite()).toBe(false);
    });
  });

  describe('detectPlatform', () => {
    it('returns unknown when no signals present', async () => {
      const { detectPlatform } = await import('../platformDetection');
      expect(detectPlatform()).toBe('unknown');
    });

    it('returns vite when config says vite', async () => {
      (globalThis as any)._DNDEV_CONFIG_ = {
        platform: 'vite',
        mode: 'development',
        context: 'client',
      };
      const { detectPlatform } = await import('../platformDetection');
      expect(detectPlatform()).toBe('vite');
    });

    it('returns nextjs when config says nextjs', async () => {
      (globalThis as any)._DNDEV_CONFIG_ = {
        platform: 'nextjs',
        mode: 'development',
        context: 'client',
      };
      const { detectPlatform } = await import('../platformDetection');
      expect(detectPlatform()).toBe('nextjs');
    });
  });

  describe('detectPlatformInfo (caching)', () => {
    it('returns same reference on second call', async () => {
      const { detectPlatformInfo } = await import('../platformDetection');
      const first = detectPlatformInfo();
      const second = detectPlatformInfo();
      expect(first).toBe(second);
    });
  });

  describe('initializePlatformDetection', () => {
    it('returns config and sets globalThis._DNDEV_CONFIG_', async () => {
      const { initializePlatformDetection } =
        await import('../platformDetection');
      const config = initializePlatformDetection();
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('mode');
      expect(config).toHaveProperty('context');
      expect((globalThis as any)._DNDEV_CONFIG_).toBeDefined();
    });

    it('resets cache so next detectPlatformInfo re-detects', async () => {
      const { detectPlatformInfo, initializePlatformDetection } =
        await import('../platformDetection');
      const first = detectPlatformInfo();
      initializePlatformDetection();
      // After init, cache is cleared — next call re-detects
      const second = detectPlatformInfo();
      expect(first).not.toBe(second);
    });
  });
});
