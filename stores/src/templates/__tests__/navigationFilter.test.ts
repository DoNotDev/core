import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NavigationRoute } from '@donotdev/types';

import { filterNavigationRoutes, useNavigationStore } from '../navigationStore';

const routes: NavigationRoute[] = [
  { path: '/default', label: 'Default' },
  { path: '/public', label: 'Public', auth: false },
  { path: '/signed-in', label: 'Signed in', auth: true },
  { path: '/required', label: 'Required', auth: { required: true } },
  { path: '/guest', label: 'Guest', auth: { role: 'guest' } },
  { path: '/user', label: 'User', auth: { role: 'user' } },
  { path: '/admin', label: 'Admin', auth: { required: true, role: 'admin' } },
  { path: '/super', label: 'Super', auth: { role: 'super' } },
  { path: '/hidden', label: 'Hidden', auth: false, meta: { hideFromMenu: true } },
  { path: '/visible', label: 'Visible', meta: { hideFromMenu: false } },
];
const paths = (filtered: NavigationRoute[]) => filtered.map((route) => route.path);

beforeEach(() => {
  useNavigationStore.getState().setCacheData({
    allRoutes: routes, filteredRoutes: new Map(), lastUpdated: 0,
  });
});

describe('filterNavigationRoutes', () => {
  it.each([
    [false, 'guest', ['/default', '/public', '/guest', '/visible']],
    [false, 'user', ['/default', '/public', '/guest', '/user', '/visible']],
    [true, 'user', ['/default', '/public', '/signed-in', '/required', '/guest', '/user', '/visible']],
    [true, 'admin', ['/default', '/public', '/signed-in', '/required', '/guest', '/user', '/admin', '/visible']],
    [true, 'super', ['/default', '/public', '/signed-in', '/required', '/guest', '/user', '/admin', '/super', '/visible']],
  ] satisfies [boolean, string, string[]][])(
    'preserves visibility for authenticated=%s role=%s', (authenticated, role, expected) => {
      const auth = { authenticated, role };
      const state = useNavigationStore.getState();
      const filtered = filterNavigationRoutes(routes, auth);
      expect(paths(filtered)).toEqual(expected);
      expect(state.getFilteredRoutes(auth)).toEqual(filtered);
      expect(state.getFilteredRoutes(auth)).toBe(state.getFilteredRoutes(auth));
      expect(filtered.every((route) => routes.includes(route))).toBe(true);
      expect(filterNavigationRoutes(routes, auth)).not.toBe(filtered);
    }
  );

  it('is pure and does not add tier or custom validation policy', () => {
    const validate = vi.fn(() => false);
    const route: NavigationRoute = {
      path: '/tier', label: 'Tier', auth: { tier: 'pro', validate },
    };
    Object.freeze(route.auth);
    Object.freeze(route);
    const input = [route];
    Object.freeze(input);
    const state = useNavigationStore.getState();
    expect(filterNavigationRoutes(input, { authenticated: false, role: 'guest' })).toEqual([route]);
    expect(validate).not.toHaveBeenCalled();
    expect(useNavigationStore.getState()).toBe(state);
    expect(state.cache.filteredRoutes.size).toBe(0);
    expect(filterNavigationRoutes([], { authenticated: false, role: 'guest' })).toEqual([]);
  });

  it('retains imperative cache identity, auth keys, invalidation and initialization reset', async () => {
    const state = useNavigationStore.getState();
    const auth = { authenticated: true, role: 'admin' };
    const before = state.getFilteredRoutes(auth);
    state.getFilteredRoutes({ authenticated: false, role: 'admin' });
    expect(state.cache.filteredRoutes.size).toBe(2);
    const listener = vi.fn();
    const unsubscribe = useNavigationStore.subscribe(listener);
    try {
      expect(state.getFilteredRoutes(auth)).toBe(before);
      state.getFilteredRoutes({ authenticated: true, role: 'guest' });
      expect(listener).not.toHaveBeenCalled();
      state.invalidateCache();
      expect(useNavigationStore.getState().cache.allRoutes).toBe(routes);
      expect(state.getFilteredRoutes(auth)).not.toBe(before);
      await state.initialize({ routes: [{
        path: '/new', component: 'NewPage', importPath: '/NewPage.tsx', auth: false,
      }] });
      expect(useNavigationStore.getState().cache.filteredRoutes.size).toBe(0);
      expect(paths(state.getFilteredRoutes(auth))).toEqual(['/new']);
    } finally {
      unsubscribe();
    }
  });
});
