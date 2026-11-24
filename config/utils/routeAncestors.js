// GENERATED from ../../utils/src/common/routeAncestors.ts by bun run bpr. Do not edit; edit the .ts and rerun bpr.

// packages/core/utils/src/common/routeMatch.ts
var segmentsOf = (path) => path.split('/').filter(Boolean);
function isCatchAllPath(path) {
  return path === '*' || path.endsWith('/*');
}
function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
function paramsOf(pattern, segments) {
  const params = {};
  pattern.forEach((part, i) => {
    if (part.startsWith(':') && segments[i] !== void 0) {
      params[part.slice(1)] = decodeSegment(segments[i]);
    }
  });
  return params;
}
function matchRoute(routes, pathname) {
  const segments = segmentsOf(pathname);
  const key = segments.join('/');
  const exact = routes.find(
    (route) =>
      typeof route.path === 'string' && segmentsOf(route.path).join('/') === key
  );
  if (exact) return { route: exact, params: {} };
  let dynamic = null;
  for (const route of routes) {
    if (typeof route.path !== 'string' || !route.path.includes(':')) continue;
    if (isCatchAllPath(route.path)) continue;
    const pattern = segmentsOf(route.path);
    if (pattern.length !== segments.length) continue;
    if (
      !pattern.every((part, i) => part.startsWith(':') || part === segments[i])
    )
      continue;
    if (!dynamic || route.path.length > dynamic.route.path.length) {
      dynamic = { route, pattern };
    }
  }
  if (dynamic) {
    return {
      route: dynamic.route,
      params: paramsOf(dynamic.pattern, segments),
    };
  }
  let catchAll = null;
  for (const route of routes) {
    if (typeof route.path !== 'string' || !isCatchAllPath(route.path)) continue;
    const prefix = segmentsOf(route.path).slice(0, -1);
    if (segments.length < prefix.length) continue;
    let staticSegments = 0;
    let matches = true;
    for (let i = 0; i < prefix.length; i++) {
      const part = prefix[i];
      if (part.startsWith(':')) continue;
      if (part !== segments[i]) {
        matches = false;
        break;
      }
      staticSegments++;
    }
    if (!matches) continue;
    const score = [prefix.length, staticSegments];
    if (
      !catchAll ||
      score[0] > catchAll.score[0] ||
      (score[0] === catchAll.score[0] && score[1] > catchAll.score[1])
    ) {
      catchAll = { route, prefix, score };
    }
  }
  if (catchAll) {
    return {
      route: catchAll.route,
      params: paramsOf(catchAll.prefix, segments),
    };
  }
  return null;
}

// packages/core/utils/src/common/routeAncestors.ts
function getPathPrefixes(pathname) {
  const prefixes = [];
  let current = '';
  for (const segment of pathname.split('/').filter(Boolean)) {
    current += `/${segment}`;
    prefixes.push(current);
  }
  return prefixes;
}
var normalized = (path) => `/${path.split('/').filter(Boolean).join('/')}`;
var isStaticPath = (path) =>
  !path
    .split('/')
    .some((segment) => segment.startsWith(':') || segment === '*');
function routeAncestors(pathname, routes) {
  const staticRoutes = /* @__PURE__ */ new Map();
  for (const route of routes) {
    if (typeof route.path === 'string' && isStaticPath(route.path)) {
      staticRoutes.set(normalized(route.path), route);
    }
  }
  const parentOf = (path, route) => {
    const prefixes = getPathPrefixes(path).slice(0, -1);
    const direct = prefixes.at(-1);
    const directRoute = direct === void 0 ? void 0 : staticRoutes.get(direct);
    if (directRoute) return directRoute;
    const declared = route?.meta?.parent;
    if (declared !== void 0) {
      if (normalized(declared) === '/') return null;
      const parent2 = staticRoutes.get(normalized(declared));
      if (!parent2) {
        throw new Error(
          `[dndev] ${route?.path}: PageMeta parent ${JSON.stringify(declared)} is not a static route path of the app.`
        );
      }
      return parent2;
    }
    for (let index = prefixes.length - 2; index >= 0; index--) {
      const prefixRoute = staticRoutes.get(prefixes[index]);
      if (prefixRoute) return prefixRoute;
    }
    return null;
  };
  const ancestors = [];
  const seen = /* @__PURE__ */ new Set([normalized(pathname)]);
  let parent = parentOf(pathname, matchRoute(routes, pathname)?.route);
  while (parent) {
    const path = normalized(parent.path);
    if (seen.has(path)) {
      throw new Error(
        `[dndev] PageMeta parent loop: ${[...seen, path].join(' \u2192 ')}. Each page needs one parent chain up to home.`
      );
    }
    seen.add(path);
    ancestors.unshift(parent);
    parent = parentOf(path, parent);
  }
  return ancestors;
}
export { getPathPrefixes, routeAncestors };
