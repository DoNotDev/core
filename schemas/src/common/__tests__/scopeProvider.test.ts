import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  registerScopeProvider,
  unregisterScopeProvider,
  getScopeValue,
  hasScopeProvider,
  getRegisteredScopeProviders,
  clearScopeProviders,
} from '../scopeProvider';

describe('scopeProvider', () => {
  beforeEach(() => {
    clearScopeProviders();
  });

  describe('registerScopeProvider', () => {
    it('registers a provider', () => {
      registerScopeProvider('company', () => 'comp-123');

      expect(hasScopeProvider('company')).toBe(true);
    });

    it('warns when overwriting existing provider (dev only)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registerScopeProvider('company', () => 'a');
      registerScopeProvider('company', () => 'b');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('unregisterScopeProvider', () => {
    it('removes a registered provider', () => {
      registerScopeProvider('company', () => 'comp-123');
      unregisterScopeProvider('company');

      expect(hasScopeProvider('company')).toBe(false);
    });

    it('does not throw for non-existent provider', () => {
      expect(() => unregisterScopeProvider('nonexistent')).not.toThrow();
    });
  });

  describe('getScopeValue', () => {
    it('returns value from registered provider', () => {
      registerScopeProvider('company', () => 'comp-123');

      expect(getScopeValue('company')).toBe('comp-123');
    });

    it('returns null for unregistered provider', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(getScopeValue('unknown')).toBeNull();
    });

    it('returns null when provider returns null', () => {
      registerScopeProvider('company', () => null);

      expect(getScopeValue('company')).toBeNull();
    });

    it('calls provider function each time', () => {
      let count = 0;
      registerScopeProvider('counter', () => `val-${++count}`);

      expect(getScopeValue('counter')).toBe('val-1');
      expect(getScopeValue('counter')).toBe('val-2');
    });
  });

  describe('getRegisteredScopeProviders', () => {
    it('returns empty array when no providers', () => {
      expect(getRegisteredScopeProviders()).toEqual([]);
    });

    it('returns all registered provider names', () => {
      registerScopeProvider('company', () => 'a');
      registerScopeProvider('tenant', () => 'b');

      const names = getRegisteredScopeProviders();
      expect(names).toContain('company');
      expect(names).toContain('tenant');
      expect(names.length).toBe(2);
    });
  });

  describe('clearScopeProviders', () => {
    it('removes all providers', () => {
      registerScopeProvider('a', () => '1');
      registerScopeProvider('b', () => '2');

      clearScopeProviders();

      expect(getRegisteredScopeProviders()).toEqual([]);
    });
  });
});
