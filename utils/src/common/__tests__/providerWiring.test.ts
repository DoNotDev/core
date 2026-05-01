// packages/core/utils/src/common/__tests__/providerWiring.test.ts

/**
 * @fileoverview Provider Wiring Integration Test
 * @description Verifies configureProviders() → getProvider() → correct instance.
 * Catches regressions in provider registry wiring.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type {
  ICrudAdapter,
  QueryOptions,
  PaginatedQueryResult,
} from '@donotdev/types';

import {
  configureProviders,
  getProvider,
  hasProvider,
  resetProviders,
} from '../providers';

// =============================================================================
// Minimal mock adapters
// =============================================================================

class StubCrudAdapter implements ICrudAdapter {
  readonly _tag = 'StubCrudAdapter';

  async get<T>(): Promise<T | null> {
    return null;
  }
  async add<T>(
    _c: string,
    data: T
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    return { id: '1', data: data as Record<string, unknown> };
  }
  async set(): Promise<void> {}
  async update(): Promise<void> {}
  async delete(): Promise<void> {}
  async query<T>(
    _c: string,
    _o: QueryOptions
  ): Promise<PaginatedQueryResult<T>> {
    return { items: [], hasMore: false, total: 0, lastVisible: null };
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Provider wiring', () => {
  beforeEach(() => {
    resetProviders();
  });

  it('getProvider("crud") returns the configured adapter', () => {
    const adapter = new StubCrudAdapter();
    configureProviders({ crud: adapter });
    const retrieved = getProvider('crud');
    expect(retrieved).toBe(adapter);
  });

  it('hasProvider returns true for configured providers', () => {
    configureProviders({ crud: new StubCrudAdapter() });
    expect(hasProvider('crud')).toBe(true);
  });

  it('hasProvider returns false for unconfigured optional providers', () => {
    configureProviders({ crud: new StubCrudAdapter() });
    expect(hasProvider('auth')).toBe(false);
    expect(hasProvider('storage')).toBe(false);
  });

  it('getProvider throws when no providers configured', () => {
    expect(() => getProvider('crud')).toThrow('not available');
  });

  it('getProvider throws for unconfigured optional provider', () => {
    configureProviders({ crud: new StubCrudAdapter() });
    expect(() => getProvider('auth')).toThrow('not configured');
  });

  it('configureProviders warns on double call', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureProviders({ crud: new StubCrudAdapter() });
    configureProviders({ crud: new StubCrudAdapter() });
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('resetProviders clears all providers', () => {
    configureProviders({ crud: new StubCrudAdapter() });
    expect(hasProvider('crud')).toBe(true);
    resetProviders();
    expect(hasProvider('crud')).toBe(false);
  });

  it('getProvider returns exact same instance (no cloning)', () => {
    const adapter = new StubCrudAdapter();
    configureProviders({ crud: adapter });
    const a = getProvider('crud');
    const b = getProvider('crud');
    expect(a).toBe(b);
    expect(a).toBe(adapter);
  });
});
