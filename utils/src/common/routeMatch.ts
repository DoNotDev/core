// packages/core/utils/src/common/routeMatch.ts

/**
 * @fileoverview Route of a URL path
 * @description One matcher for the route manifest (`_DNDEV_CONFIG_.routes.mapping`):
 * which route a route path (language prefix stripped) belongs to, with Next's precedence:
 * exact path, then `:param` patterns (most specific), then catch-alls (`/docs/*`, longest
 * prefix). AutoMetaTags reads the route's PageMeta with it; crud's `useCrudDoc` checks
 * whether the URL names the record it reads.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

/**
 * A route the URL path matched, with its `:param` values.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface RouteMatch<R> {
  route: R;
  /** `:param` values of the path (percent-decoded), by param name; none for an exact match */
  params: Record<string, string>;
}

/** Path segments (`/produits/a/` → `['produits', 'a']`). */
const segmentsOf = (path: string) => path.split('/').filter(Boolean);

/** Whether a route path is a catch-all (`/docs/*`): its last segment is `*`. */
function isCatchAllPath(path: string): boolean {
  return path === '*' || path.endsWith('/*');
}

/** URL segment as the router hands it to the page (percent-decoded). */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `:param` values of `pattern` segments over the path segments. */
function paramsOf(pattern: readonly string[], segments: readonly string[]) {
  const params: Record<string, string> = {};
  pattern.forEach((part, i) => {
    if (part.startsWith(':') && segments[i] !== undefined) {
      params[part.slice(1)] = decodeSegment(segments[i]);
    }
  });
  return params;
}

/**
 * The route of a route path among the manifest routes. Precedence follows Next's (and
 * React Router's) routing: the exact path; else the `:param` pattern of the same length
 * whose static segments match, the longest pattern winning (`/blog/:slug/comments` over
 * `/blog/:slug/:x`); else the catch-all whose prefix (static or `:param` segments)
 * matches, the longest prefix then the most static one winning (`*` takes the rest, zero
 * or more segments). Trailing slashes are ignored.
 *
 * @param routes - Manifest routes (`routes.mapping`)
 * @param pathname - Route path of the URL, without language prefix (`/produits/serum`)
 * @returns The route and its param values, or null when no route matches
 *
 * @example
 * matchRoute([{ path: '/produits/:slug' }], '/produits/serum');
 * // { route: { path: '/produits/:slug' }, params: { slug: 'serum' } }
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function matchRoute<R extends { path: string }>(
  routes: readonly R[],
  pathname: string
): RouteMatch<R> | null {
  const segments = segmentsOf(pathname);
  const key = segments.join('/');

  // 1. Exact path (static routes)
  const exact = routes.find(
    (route) => typeof route.path === 'string' && segmentsOf(route.path).join('/') === key
  );
  if (exact) return { route: exact, params: {} };

  // 2. `:param` patterns of the same length, most specific (longest) first
  let dynamic: { route: R; pattern: string[] } | null = null;
  for (const route of routes) {
    if (typeof route.path !== 'string' || !route.path.includes(':')) continue;
    if (isCatchAllPath(route.path)) continue;
    const pattern = segmentsOf(route.path);
    if (pattern.length !== segments.length) continue;
    if (!pattern.every((part, i) => part.startsWith(':') || part === segments[i])) continue;
    if (!dynamic || route.path.length > dynamic.route.path.length) {
      dynamic = { route, pattern };
    }
  }
  if (dynamic) {
    return { route: dynamic.route, params: paramsOf(dynamic.pattern, segments) };
  }

  // 3. Catch-alls: the longest matching prefix, then the most static one
  let catchAll: { route: R; prefix: string[]; score: [number, number] } | null = null;
  for (const route of routes) {
    if (typeof route.path !== 'string' || !isCatchAllPath(route.path)) continue;
    const prefix = segmentsOf(route.path).slice(0, -1);
    if (segments.length < prefix.length) continue;
    let staticSegments = 0;
    let matches = true;
    for (let i = 0; i < prefix.length; i++) {
      const part = prefix[i]!;
      if (part.startsWith(':')) continue;
      if (part !== segments[i]) {
        matches = false;
        break;
      }
      staticSegments++;
    }
    if (!matches) continue;
    const score: [number, number] = [prefix.length, staticSegments];
    if (
      !catchAll ||
      score[0] > catchAll.score[0] ||
      (score[0] === catchAll.score[0] && score[1] > catchAll.score[1])
    ) {
      catchAll = { route, prefix, score };
    }
  }
  if (catchAll) {
    return { route: catchAll.route, params: paramsOf(catchAll.prefix, segments) };
  }
  return null;
}
