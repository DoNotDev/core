// packages/core/stores/src/templates/navigationStore.ts

/**
 * @fileoverview Navigation Store - Route Management and Navigation State
 * @module @donotdev/stores/navigation
 * @description Centralized navigation store with route discovery integration
 *
 * Features:
 * - Route discovery integration via globalThis._DNDEV_CONFIG_
 * - Automatic filtering of dynamic routes from navigation menus
 * - Auth-based route filtering with intelligent caching
 * - Route grouping by entity/domain for organized navigation
 * - Performance optimization through memoization
 * - SSR-safe initialization patterns
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { RoutesPluginConfig, NavigationRoute } from '@donotdev/types';
import { handleError, hasRoleAccess, isDev } from '@donotdev/utils';

import { createDoNotDevStore } from '../createDoNotDevStore';

/**
 * Route data type - single source of truth from discovery
 * @typedef {RoutesPluginConfig['mapping'][0]} RouteData
 * @since 0.0.1
 */
type RouteData = RoutesPluginConfig['mapping'][0];

/**
 * Cached navigation data keyed by auth state
 * @interface NavigationCache
 * @since 0.0.1
 */
interface NavigationCache {
  /** All discovered routes (unfiltered) */
  allRoutes: NavigationRoute[];
  /** Routes filtered by auth state, keyed by cache key */
  filteredRoutes: Map<string, NavigationRoute[]>;
  /** Route groups organized by entity */
  routeGroups: Map<string, { label: string; routes: NavigationRoute[] }>;
  /** Route manifest metadata */
  manifest: Record<string, unknown> | null;
  /** Last cache update timestamp */
  lastUpdated: number;
}

/**
 * Navigation store state interface
 * @interface NavigationState
 * @since 0.0.1
 */
interface NavigationState {
  /** Cached navigation data */
  cache: NavigationCache;
  /** Favorite route paths (persisted per computer) */
  favorites: string[];
  /** Recent route paths (persisted per computer, max 8) */
  recent: string[];

  /** Invalidate cache and force refresh */
  invalidateCache: () => void;

  /** Get all routes without filtering */
  getAllRoutes: () => NavigationRoute[];
  /** Get routes filtered by auth state with caching */
  getFilteredRoutes: (authState: {
    authenticated: boolean;
    role: string;
  }) => NavigationRoute[];
  /** Get route groups organized by entity */
  getRouteGroups: () => Array<{ label: string; routes: NavigationRoute[] }>;
  /** Get route manifest metadata */
  getManifest: () => Record<string, unknown> | null;

  /** Toggle favorite status for a route */
  toggleFavorite: (path: string) => void;
  /** Check if a route is favorited */
  isFavorite: (path: string) => boolean;
  /** Get all favorite route paths */
  getFavorites: () => string[];
  /** Add route to recent history */
  addRecent: (path: string) => void;
  /** Get recent route paths */
  getRecent: () => string[];

  /** Update cache data (internal) */
  setCacheData: (data: Partial<NavigationCache>) => void;
  /** Set partial state (internal) */
  setState: (partial: Partial<NavigationState>) => void;
}

/**
 * Create default cache state
 * @returns {NavigationCache} Initial cache state
 * @since 0.0.1
 */
const createDefaultCache = (): NavigationCache => ({
  allRoutes: [],
  filteredRoutes: new Map(),
  routeGroups: new Map(),
  manifest: null as Record<string, unknown> | null,
  lastUpdated: 0,
});

/**
 * Check if a route path contains dynamic parameters
 *
 * Dynamic routes (e.g., /:id, /users/:userId) should not appear in navigation
 * menus as they're accessed programmatically, not through static links.
 *
 * @param {string} path - Route path to check
 * @returns {boolean} True if route contains dynamic parameters
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * isDynamicRoute('/blog/:slug')     // true
 * isDynamicRoute('/users/:id/edit') // true
 * isDynamicRoute('/about')          // false
 * ```
 */
function isDynamicRoute(path: string): boolean {
  return path.includes(':');
}

/**
 * Transform RouteData from discovery to NavigationRoute
 *
 * Converts raw route discovery data into navigation-ready format with
 * proper metadata, labels, and configuration.
 *
 * @param {RouteData} route - Raw route data from discovery
 * @returns {NavigationRoute} Transformed navigation route
 * @since 0.0.1
 */
function transformRouteData(route: RouteData): NavigationRoute {
  // Handle route config: can be string or { params?: string[] }
  const routeConfig = route.meta?.route;
  const params =
    typeof routeConfig === 'object' && routeConfig !== null
      ? routeConfig.params
      : undefined;
  const path = buildRoutePath(route.path, params);
  const rawTitle = route.meta?.title;
  const labelFromTitle = rawTitle ? rawTitle.split(' - ')[0] : undefined;
  return {
    path,
    label: labelFromTitle || generateLabelFromPath(path),
    icon: route.meta?.icon,
    external: false,
    auth: route.auth,
    meta: {
      ...route.meta,
    },
  };
}

/**
 * Build complete route path with dynamic parameters
 *
 * @param {string} basePath - Base path from file structure
 * @param {string[]} [params] - Route parameters
 * @returns {string} Complete route path
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * buildRoutePath('/blog', ['slug'])           // '/blog/:slug'
 * buildRoutePath('/users', ['id', 'action']) // '/users/:id/:action'
 * buildRoutePath('/about')                    // '/about'
 * ```
 */
function buildRoutePath(basePath: string, params?: string[]): string {
  if (!params || params.length === 0) {
    return basePath;
  }

  const paramSuffix = params.map((param) => `:${param}`).join('/');
  return `${basePath}/${paramSuffix}`;
}

/**
 * Generate human-readable label from route path
 *
 * Converts kebab-case path segments into Title Case labels.
 *
 * @param {string} path - Route path
 * @returns {string} Human-readable label
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * generateLabelFromPath('/user-settings')    // 'User Settings'
 * generateLabelFromPath('/blog-posts')       // 'Blog Posts'
 * generateLabelFromPath('/')                 // 'Home'
 * ```
 */
function generateLabelFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) return 'Home';

  return lastSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Group navigation routes by entity/domain
 *
 * Organizes routes into logical groups based on entity names for better
 * navigation structure and UX.
 *
 * @param {NavigationRoute[]} routes - Routes to group
 * @returns {Array<{ label: string; routes: NavigationRoute[] }>} Grouped routes
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * const routes = [
 *   { path: '/users', entity: 'users' },
 *   { path: '/users/create', entity: 'users' },
 *   { path: '/posts', entity: 'posts' }
 * ];
 *
 * groupRoutesByEntity(routes);
 * // [
 * //   { label: 'Users', routes: [...] },
 * //   { label: 'Posts', routes: [...] }
 * // ]
 * ```
 */
function groupRoutesByEntity(
  routes: NavigationRoute[]
): Array<{ label: string; routes: NavigationRoute[] }> {
  const groups = new Map<string, NavigationRoute[]>();

  routes.forEach((route) => {
    const entity = route.meta?.entity || extractEntityFromPath(route.path);
    if (!entity) return;

    if (!groups.has(entity)) {
      groups.set(entity, []);
    }
    groups.get(entity)?.push(route);
  });

  return Array.from(groups.entries()).map(([entity, routes]) => ({
    label: entity.charAt(0).toUpperCase() + entity.slice(1),
    routes,
  }));
}

/**
 * Extract entity name from route path for grouping
 *
 * @param {string} path - Route path
 * @returns {string | null} Entity name or null
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * extractEntityFromPath('/users/profile')  // 'users'
 * extractEntityFromPath('/blog/posts')     // 'blog'
 * extractEntityFromPath('/')               // null
 * ```
 */
function extractEntityFromPath(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  return segments[0] || null;
}

/**
 * Navigation Store
 *
 * Provides centralized management of navigation routes with intelligent caching
 * and auth-based filtering. Integrates with route discovery system and provides
 * optimized data access for UI components.
 *
 * **Key Features:**
 * - Route discovery integration via globalThis._DNDEV_CONFIG_
 * - Automatic filtering of dynamic routes (/:id, /users/:userId) from navigation
 * - Auth-based route filtering with intelligent caching
 * - Route grouping by entity/domain for organized menus
 * - Performance optimization through memoization
 * - SSR-safe initialization patterns
 *
 * **Route Filtering:**
 * - Dynamic routes (containing `:`) are excluded from navigation menus
 * - Auth-based filtering applied per user permissions
 * - Routes cached by auth state key (authenticated-role)
 * - Groups computed once and reused across components
 * - Cache invalidation on route discovery changes
 *
 * **Performance:**
 * - Routes cached after first access
 * - Auth filtering memoized by state key
 * - Groups computed once at initialization
 * - Minimal re-renders with Zustand selectors
 *
 * @constant
 * @type {UseBoundStore<StoreApi<NavigationState & DoNotDevStore>>}
 * @since 0.0.1
 *
 * @example
 * ```typescript
 * // Get all routes
 * const allRoutes = useNavigationStore((state) => state.getAllRoutes());
 *
 * // Get filtered routes by auth
 * const routes = useNavigationStore((state) =>
 *   state.getFilteredRoutes({ authenticated: true, role: 'admin' })
 * );
 *
 * // Get route groups
 * const groups = useNavigationStore((state) => state.getRouteGroups());
 * ```
 */
export const useNavigationStore = createDoNotDevStore<NavigationState>({
  name: 'navigation-store',

  createStore: (set, get) => ({
    // Initial state
    cache: createDefaultCache(),
    favorites: [],
    recent: [],

    /**
     * Invalidate cache and force refresh
     *
     * Clears filtered routes cache while preserving discovered routes.
     * Useful when auth state changes or routes are updated.
     *
     * @since 0.0.1
     */
    invalidateCache: () => {
      set((state) => ({
        cache: {
          ...state.cache,
          filteredRoutes: new Map(),
          lastUpdated: 0,
        },
      }));
    },

    /**
     * Get all discovered routes without filtering
     *
     * Returns the complete list of routes from discovery, excluding only
     * dynamic routes. No auth filtering applied.
     *
     * @returns {NavigationRoute[]} All discovered routes
     * @since 0.0.1
     */
    getAllRoutes: () => {
      const { cache } = get();
      return cache.allRoutes;
    },

    /**
     * Get routes filtered by authentication state
     *
     * Returns routes that the user is authorized to access based on their
     * authentication status and role. Results are cached per auth state.
     *
     * Uses role hierarchy for access control:
     * - Super can access super, admin, user, and guest routes
     * - Admin can access admin, user, and guest routes
     * - User can access user and guest routes
     * - Guest can access guest routes only
     *
     * @param {Object} authState - Authentication state
     * @param {boolean} authState.authenticated - Whether user is authenticated
     * @param {string} authState.role - User's role
     * @returns {NavigationRoute[]} Filtered routes
     * @since 0.0.1
     *
     * @example
     * ```typescript
     * const routes = getFilteredRoutes({
     *   authenticated: true,
     *   role: 'admin'
     * });
     * ```
     */
    getFilteredRoutes: (authState: {
      authenticated: boolean;
      role: string;
    }) => {
      const { cache } = get();
      const cacheKey = `${authState.authenticated}-${authState.role}`;

      // Return cached result if available
      if (cache.filteredRoutes.has(cacheKey)) {
        return cache.filteredRoutes.get(cacheKey)!;
      }

      // Filter routes by auth state and hideFromMenu flag
      const filtered = cache.allRoutes.filter((route) => {
        // Exclude routes with hideFromMenu: true
        if (route.meta?.hideFromMenu === true) {
          return false;
        }

        // Filter by auth state
        if (route.auth === false) return true;

        if (route.auth === true) {
          return authState.authenticated;
        }

        if (typeof route.auth === 'object') {
          if (route.auth.required && !authState.authenticated) {
            return false;
          }

          // Uses role hierarchy: admin >= user >= guest
          if (
            route.auth.role &&
            !hasRoleAccess(authState.role, route.auth.role)
          ) {
            return false;
          }

          // Note: tier and validate checks require subscription data
          // Currently not passed in authState, would need enhancement
          // if (route.auth.tier && authState.tier !== route.auth.tier) return false;
          // if (route.auth.validate && !route.auth.validate(authState.role, authState.tier)) return false;
        }

        return true;
      });

      // Cache in-place without mutating store state (getter should not trigger set())
      cache.filteredRoutes.set(cacheKey, filtered);

      return filtered;
    },

    /**
     * Get route groups organized by entity
     *
     * Returns routes organized into logical groups based on their entity/domain.
     * Useful for building hierarchical navigation menus.
     *
     * @returns {Array<{ label: string; routes: NavigationRoute[] }>} Route groups
     * @since 0.0.1
     *
     * @example
     * ```typescript
     * const groups = getRouteGroups();
     * // [
     * //   { label: 'Users', routes: [...] },
     * //   { label: 'Posts', routes: [...] }
     * // ]
     * ```
     */
    getRouteGroups: () => {
      const { cache } = get();
      return Array.from(cache.routeGroups.values());
    },

    /**
     * Get route manifest metadata
     *
     * Returns the route manifest containing metadata about all discovered routes.
     *
     * @returns {any} Route manifest or null
     * @since 0.0.1
     */
    getManifest: () => {
      const { cache } = get();
      return cache.manifest;
    },

    /**
     * Toggle favorite status for a route
     *
     * Adds or removes a route path from favorites. Persisted per computer via localStorage.
     *
     * @param {string} path - Route path to toggle
     * @since 0.0.2
     *
     * @example
     * ```typescript
     * toggleFavorite('/dashboard');
     * ```
     */
    toggleFavorite: (path: string) => {
      set((state) => ({
        favorites: state.favorites.includes(path)
          ? state.favorites.filter((p) => p !== path)
          : [...state.favorites, path],
      }));
    },

    /**
     * Check if a route is favorited
     *
     * @param {string} path - Route path to check
     * @returns {boolean} True if route is favorited
     * @since 0.0.2
     *
     * @example
     * ```typescript
     * if (isFavorite('/dashboard')) {
     *   // Show favorite icon
     * }
     * ```
     */
    isFavorite: (path: string) => {
      const { favorites } = get();
      return favorites.includes(path);
    },

    /**
     * Get all favorite route paths
     *
     * @returns {string[]} Array of favorited route paths
     * @since 0.0.2
     *
     * @example
     * ```typescript
     * const favoritePaths = getFavorites();
     * // ['/dashboard', '/settings']
     * ```
     */
    getFavorites: () => {
      const { favorites } = get();
      return favorites;
    },

    /**
     * Add route to recent history
     *
     * Adds a route to the beginning of recent list, removes duplicates,
     * and keeps only the last 8 items.
     *
     * @param {string} path - Route path to add
     * @since 0.0.2
     *
     * @example
     * ```typescript
     * addRecent('/dashboard');
     * ```
     */
    addRecent: (path: string) => {
      set((state) => ({
        recent: [path, ...state.recent.filter((p) => p !== path)].slice(0, 8),
      }));
    },

    /**
     * Get recent route paths
     *
     * @returns {string[]} Array of recent route paths (max 8)
     * @since 0.0.2
     *
     * @example
     * ```typescript
     * const recentPaths = getRecent();
     * // ['/dashboard', '/settings', '/profile']
     * ```
     */
    getRecent: () => {
      const { recent } = get();
      return recent;
    },

    // Internal state setters
    setCacheData: (data) =>
      set((state) => ({
        cache: { ...state.cache, ...data },
      })),
    setState: (partial) => set(partial),
  }),

  /**
   * Persist favorites to localStorage (per computer)
   * Only persists favorites, not cache data
   *
   * Design:
   * - Favorites are user preferences, persisted per browser/computer
   * - Cache data (routes, groups) is NOT persisted (rebuilt on init)
   * - Array is JSON-native, no serialization needed
   */
  persistOptions: {
    name: 'navigation-store-favorites',
    partialize: (state) => {
      // Don't persist empty state (truly free when unused)
      const hasFavorites = state.favorites.length > 0;
      const hasRecent = state.recent.length > 0;
      if (!hasFavorites && !hasRecent) return {};
      return {
        ...(hasFavorites && { favorites: state.favorites }),
        ...(hasRecent && { recent: state.recent }),
      };
    },
  },

  /**
   * Initialize navigation store with route data
   *
   * @param {Object} [data] - Route data and manifest from initializer (signature matches DoNotDevStoreConfig)
   * @param {RouteData[]} [data.routes] - Route data from discovery
   * @param {any} [data.manifest] - Route manifest metadata
   */
  initialize: async (data?: Record<string, unknown>): Promise<boolean> => {
    const state = useNavigationStore.getState();

    if (state.cache.lastUpdated > 0) {
      return true;
    }

    try {
      state.setLoading(true);
      state.setError(null);

      const payload = data as
        | { routes?: RouteData[]; manifest?: Record<string, unknown> | null }
        | undefined;
      const routeData = Array.isArray(payload?.routes) ? payload.routes : [];
      const manifest = payload?.manifest ?? null;

      if (routeData.length === 0) {
        if (isDev()) {
          console.warn('[NavigationStore] No route data provided');
        }
        state.setLoading(false);
        state.setReady(true);
        return true;
      }

      const allRoutes = routeData
        .map(transformRouteData)
        .filter((route: NavigationRoute) => !isDynamicRoute(route.path));

      const routeGroups = new Map();
      groupRoutesByEntity(allRoutes).forEach((group) => {
        routeGroups.set(group.label, group);
      });

      // ✅ No getDndevConfig() here anymore!
      state.setCacheData({
        allRoutes,
        routeGroups,
        manifest, // ✅ Use passed manifest
        filteredRoutes: new Map(), // Clear stale cache on init
        lastUpdated: Date.now(),
      });

      return true;
    } catch (error) {
      handleError(error, {
        userMessage: 'Navigation initialization failed',
        context: { operation: 'navigation_initialization' },
        severity: 'error',
        log: true,
        reportToSentry: true,
        showNotification: false,
      });

      state.setError(
        error instanceof Error
          ? error.message
          : 'Navigation initialization failed'
      );

      return false;
    } finally {
      // ✅ Always set loading false and ready true
      state.setLoading(false);
      state.setReady(true);
    }
  },
});
