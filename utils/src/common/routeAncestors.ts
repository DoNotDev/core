// packages/core/utils/src/common/routeAncestors.ts

/**
 * @fileoverview Ancestor chain of a page
 * @description One rule for every consumer of a page's parents: the visible
 * breadcrumbs (`@donotdev/ui` `Breadcrumbs`), the BreadcrumbList JSON-LD
 * (`buildBreadcrumbJsonLd`: `AutoMetaTags`, the Next entity page, the Vite record
 * prerender) and the forms' parent path (`@donotdev/ui` `getParentRoutePath`). The
 * build validates PageMeta `parent` with it too (route discovery). The plain-Node build
 * imports it from `config/utils/routeAncestors.js`, which `bun run bpr` compiles from
 * this file: edit this file, never the `.js`.
 *
 * @version 0.1.0
 * @since 0.3.4
 * @author AMBROISE PARK Consulting
 */

import { matchRoute } from './routeMatch';

/**
 * A route as the ancestor chain reads it: its path and PageMeta `parent`.
 *
 * @version 0.1.0
 * @since 0.3.4
 * @author AMBROISE PARK Consulting
 */
export interface AncestorRoute {
  path: string;
  meta?: { parent?: string } | null;
}

/**
 * Cumulative prefixes of a pathname: `/a/b/c` → `['/a', '/a/b', '/a/b/c']`.
 *
 * @param pathname - App path (no language prefix)
 * @returns One entry per segment, in order
 *
 * @version 0.1.0
 * @since 0.3.4
 * @author AMBROISE PARK Consulting
 */
export function getPathPrefixes(pathname: string): string[] {
  const prefixes: string[] = [];
  let current = '';
  for (const segment of pathname.split('/').filter(Boolean)) {
    current += `/${segment}`;
    prefixes.push(current);
  }
  return prefixes;
}

/** `/a/b/` → `/a/b`, `''` → `/`. */
const normalized = (path: string) => `/${path.split('/').filter(Boolean).join('/')}`;

/** A static route path: no `:param` or `*` segment (the only paths a URL prefix equals). */
const isStaticPath = (path: string) =>
  !path.split('/').some((segment) => segment.startsWith(':') || segment === '*');

/**
 * The ancestor pages of a URL path, from the top one down to the nearest (home `/`
 * excluded: every trail starts with it). The parent of a path is:
 *
 * 1. its URL prefix (the path minus its last segment) when that prefix is a static route;
 * 2. else the PageMeta `parent` of the path's route (`matchRoute`), when declared
 *    (`'/'`: home, no ancestor);
 * 3. else the nearest shorter URL prefix that is a static route;
 *
 * then the parent's own parent by the same rule, up to the top. A URL prefix that is no
 * route is no ancestor (`/fournisseur/abc/reception` → `/fournisseur`). URL prefixes
 * holding a param value (`/routines/abc`) are never routes: only static paths are.
 *
 * @param pathname - URL path without language prefix (`/produits/serum`) or a route path
 * @param routes - Manifest routes (`routes.mapping`, or the navigation store's routes)
 * @returns Ancestor routes, top first; empty for a top-level page
 * @throws {Error} When a declared `parent` is no static route or the chain loops: the
 *   build rejects both (route discovery), so a built app never throws
 *
 * @example
 * routeAncestors('/produits/serum', [
 *   { path: '/catalogue' },
 *   { path: '/produits/:slug', meta: { parent: '/catalogue' } },
 * ]); // [{ path: '/catalogue' }]
 *
 * @version 0.1.0
 * @since 0.3.4
 * @author AMBROISE PARK Consulting
 */
export function routeAncestors<R extends AncestorRoute>(
  pathname: string,
  routes: readonly R[]
): R[] {
  const staticRoutes = new Map<string, R>();
  for (const route of routes) {
    if (typeof route.path === 'string' && isStaticPath(route.path)) {
      staticRoutes.set(normalized(route.path), route);
    }
  }

  const parentOf = (path: string, route: R | undefined): R | null => {
    const prefixes = getPathPrefixes(path).slice(0, -1);
    const direct = prefixes.at(-1);
    const directRoute = direct === undefined ? undefined : staticRoutes.get(direct);
    if (directRoute) return directRoute;
    const declared = route?.meta?.parent;
    if (declared !== undefined) {
      if (normalized(declared) === '/') return null;
      const parent = staticRoutes.get(normalized(declared));
      if (!parent) {
        throw new Error(
          `[dndev] ${route?.path}: PageMeta parent ${JSON.stringify(declared)} is not a static route path of the app.`
        );
      }
      return parent;
    }
    for (let index = prefixes.length - 2; index >= 0; index--) {
      const prefixRoute = staticRoutes.get(prefixes[index]!);
      if (prefixRoute) return prefixRoute;
    }
    return null;
  };

  const ancestors: R[] = [];
  const seen = new Set<string>([normalized(pathname)]);
  let parent = parentOf(pathname, matchRoute(routes, pathname)?.route);
  while (parent) {
    const path = normalized(parent.path);
    if (seen.has(path)) {
      throw new Error(
        `[dndev] PageMeta parent loop: ${[...seen, path].join(' → ')}. Each page needs one parent chain up to home.`
      );
    }
    seen.add(path);
    ancestors.unshift(parent);
    parent = parentOf(path, parent);
  }
  return ancestors;
}
