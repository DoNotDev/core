import { describe, it, expect, vi } from 'vitest';

import { lazyImport } from '../lazyImport';

describe('lazyImport', () => {
  it('calls import function and returns result', async () => {
    const module = { default: 'hello' };
    const importFn = vi.fn().mockResolvedValue(module);

    const result = await lazyImport(importFn, 'test-module');
    expect(result).toBe(module);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('caches result for same key', async () => {
    const module = { default: 'cached' };
    const importFn = vi.fn().mockResolvedValue(module);

    const result1 = await lazyImport(importFn, 'cached-key');
    const result2 = await lazyImport(importFn, 'cached-key');

    expect(result1).toBe(result2);
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('uses different cache entries for different keys', async () => {
    const moduleA = { name: 'A' };
    const moduleB = { name: 'B' };
    const importFnA = vi.fn().mockResolvedValue(moduleA);
    const importFnB = vi.fn().mockResolvedValue(moduleB);

    const resultA = await lazyImport(importFnA, 'key-a');
    const resultB = await lazyImport(importFnB, 'key-b');

    expect(resultA).toBe(moduleA);
    expect(resultB).toBe(moduleB);
  });

  it('returns the same promise for concurrent calls with same key', () => {
    const importFn = vi.fn().mockResolvedValue({ value: 1 });

    const promise1 = lazyImport(importFn, 'concurrent');
    const promise2 = lazyImport(importFn, 'concurrent');

    expect(promise1).toBe(promise2);
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
