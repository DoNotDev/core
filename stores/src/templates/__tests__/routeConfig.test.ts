// packages/core/stores/src/templates/__tests__/routeConfig.test.ts

/**
 * @fileoverview Tests for routeConfig utility functions
 * @description Unit tests for route path building, meta resolution, and auth config.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@donotdev/utils', () => ({
  isClient: vi.fn(() => true),
  isDev: vi.fn(() => false),
  getDndevConfig: vi.fn(() => null),
}));

vi.mock('@donotdev/types', async () => {
  const actual = await vi.importActual('@donotdev/types');
  return { ...actual };
});

import { isClient, getDndevConfig } from '@donotdev/utils';

import {
  getSmartDefaults,
  resolvePageMeta,
  resolveAuthConfig,
  getRoutes,
  getRouteManifest,
  getRouteSource,
  buildRoutePath,
  extractRoutePath,
} from '../routeConfig';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isClient).mockReturnValue(true);
  vi.mocked(getDndevConfig).mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// getSmartDefaults
// ============================================================================

describe('getSmartDefaults', () => {
  it('extracts entity from first path segment', () => {
    const defaults = getSmartDefaults('users/edit', {});
    expect(defaults.entity).toBe('users');
  });

  it('extracts action from second path segment', () => {
    const defaults = getSmartDefaults('users/edit', {});
    expect(defaults.action).toBe('edit');
  });

  it('defaults entity to home for root path', () => {
    const defaults = getSmartDefaults('', {});
    expect(defaults.entity).toBe('home');
  });

  it('sets action to null when no second segment', () => {
    const defaults = getSmartDefaults('dashboard', {});
    expect(defaults.action).toBeNull();
  });

  it('generates title from entity', () => {
    const defaults = getSmartDefaults('products/list', {});
    expect(defaults.title).toBe('products.title');
  });

  it('handles leading slash', () => {
    const defaults = getSmartDefaults('/blog/post', {});
    expect(defaults.entity).toBe('blog');
    expect(defaults.action).toBe('post');
  });
});

// ============================================================================
// resolvePageMeta
// ============================================================================

describe('resolvePageMeta', () => {
  it('uses explicit meta over smart defaults', () => {
    const pageModule = { meta: { title: 'Custom Title', entity: 'custom' } };
    const meta = resolvePageMeta('users/list', pageModule);
    expect(meta.title).toBe('Custom Title');
    expect(meta.entity).toBe('custom');
  });

  it('falls back to smart defaults for missing meta properties', () => {
    const pageModule = { meta: { title: 'My Page' } };
    const meta = resolvePageMeta('settings/profile', pageModule);
    expect(meta.title).toBe('My Page');
    expect(meta.entity).toBe('settings');
    expect(meta.action).toBe('profile');
  });

  it('handles page module without meta', () => {
    const meta = resolvePageMeta('about', {});
    expect(meta.entity).toBe('about');
    expect(meta.title).toBe('about.title');
  });

  it('handles null page module', () => {
    const meta = resolvePageMeta('contact', null);
    expect(meta.entity).toBe('contact');
  });
});

// ============================================================================
// resolveAuthConfig
// ============================================================================

describe('resolveAuthConfig', () => {
  it('returns explicit auth from meta', () => {
    const pageModule = { meta: { auth: true } };
    expect(resolveAuthConfig('admin', pageModule)).toBe(true);
  });

  it('returns false (public) when no auth meta', () => {
    expect(resolveAuthConfig('public-page', {})).toBe(false);
  });

  it('returns false when page module is null', () => {
    expect(resolveAuthConfig('page', null)).toBe(false);
  });

  it('respects explicit false', () => {
    const pageModule = { meta: { auth: false } };
    expect(resolveAuthConfig('page', pageModule)).toBe(false);
  });
});

// ============================================================================
// getRoutes
// ============================================================================

describe('getRoutes', () => {
  it('returns empty array when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);
    expect(getRoutes()).toEqual([]);
  });

  it('returns empty array when no config', () => {
    vi.mocked(getDndevConfig).mockReturnValue(null);
    expect(getRoutes()).toEqual([]);
  });

  it('returns empty array when config has no routes', () => {
    vi.mocked(getDndevConfig).mockReturnValue({} as any);
    expect(getRoutes()).toEqual([]);
  });

  it('returns routes mapping from config', () => {
    const mapping = [
      { path: '/home', meta: { title: 'Home' } },
      { path: '/about', meta: { title: 'About' } },
    ];
    vi.mocked(getDndevConfig).mockReturnValue({
      routes: { mapping },
    } as any);
    expect(getRoutes()).toEqual(mapping);
  });

  it('returns empty array when routes.mapping is missing', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      routes: {},
    } as any);
    expect(getRoutes()).toEqual([]);
  });
});

// ============================================================================
// getRouteManifest
// ============================================================================

describe('getRouteManifest', () => {
  it('returns null when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);
    expect(getRouteManifest()).toBeNull();
  });

  it('returns null when no config', () => {
    expect(getRouteManifest()).toBeNull();
  });

  it('returns null when config has no routes', () => {
    vi.mocked(getDndevConfig).mockReturnValue({} as any);
    expect(getRouteManifest()).toBeNull();
  });

  it('returns manifest from config', () => {
    const manifest = { '/home': { title: 'Home' } };
    vi.mocked(getDndevConfig).mockReturnValue({
      routes: { manifest },
    } as any);
    expect(getRouteManifest()).toEqual(manifest);
  });

  it('returns null when routes.manifest is missing', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      routes: {},
    } as any);
    expect(getRouteManifest()).toBeNull();
  });
});

// ============================================================================
// getRouteSource
// ============================================================================

describe('getRouteSource', () => {
  it('returns discovery on client', () => {
    expect(getRouteSource()).toBe('discovery');
  });

  it('returns unknown when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);
    expect(getRouteSource()).toBe('unknown');
  });
});

// ============================================================================
// buildRoutePath
// ============================================================================

describe('buildRoutePath', () => {
  it('returns base path when no params', () => {
    expect(buildRoutePath('/blog')).toBe('/blog');
  });

  it('returns base path when params is empty array', () => {
    expect(buildRoutePath('/blog', [])).toBe('/blog');
  });

  it('appends single param', () => {
    expect(buildRoutePath('/blog', ['slug'])).toBe('/blog/:slug');
  });

  it('appends multiple params', () => {
    expect(buildRoutePath('/users', ['userId', 'tab'])).toBe(
      '/users/:userId/:tab'
    );
  });

  it('handles root path', () => {
    expect(buildRoutePath('/', ['id'])).toBe('//:id');
  });
});

// ============================================================================
// extractRoutePath
// ============================================================================

describe('extractRoutePath', () => {
  it('extracts route from page meta', () => {
    const pageModule = { meta: { route: '/custom-route' } };
    expect(extractRoutePath(pageModule)).toBe('/custom-route');
  });

  it('returns undefined when no meta', () => {
    expect(extractRoutePath({})).toBeUndefined();
  });

  it('returns undefined when no route in meta', () => {
    const pageModule = { meta: { title: 'Test' } };
    expect(extractRoutePath(pageModule)).toBeUndefined();
  });

  it('returns undefined for null module', () => {
    expect(extractRoutePath(null)).toBeUndefined();
  });
});
