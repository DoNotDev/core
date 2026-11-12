/**
 * @fileoverview Public page lister (Next runtime)
 * @description The one URL set the app publishes to crawlers: static routes as they
 * are, and each single-param dynamic route (`/produits/:slug`) expanded to one page per
 * public record of its entity's collection. Shared by the generated sitemap and
 * llms.txt routes so both always list the same pages. Runs at request time, server only.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

/** Records per dynamic route (adapter query maximum). */
const MAX_RECORDS_PER_ROUTE = 1000;

/** `:param` segment names of a route path. */
function routeParams(path) {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));
}

/**
 * List the public pages of the given routes, in route order.
 *
 * - static route: one page
 * - single-param route with a collection: one page per public record
 *   (`status` not in `hiddenStatuses`, the framework's definition of publicly readable),
 *   the param filled from the record field of the same
 *   name; records without a string/number value are skipped
 *
 * @template {import('../index.js').PublicRoute} R
 * @param {readonly R[]} routes - Public routes (auth-only and `seo.noindex` routes already excluded by the build)
 * @param {import('@donotdev/core/server').ICrudAdapter | undefined} crud - Public (anonymous) CRUD reader; required when a route lists records
 * @param {readonly string[]} hiddenStatuses - `HIDDEN_STATUSES` from @donotdev/core/server (statuses never public)
 * @returns {Promise<Array<{ route: R, path: string, record?: Record<string, unknown> }>>} Pages, never a `:param` template
 * @throws {Error} When a dynamic route has no collection or several params, no reader is given, or the read fails
 */
export async function listPublicPages(routes, crud, hiddenStatuses) {
  const pages = [];

  for (const route of routes) {
    const params = routeParams(route.path);

    if (params.length === 0) {
      pages.push({ route, path: route.path });
      continue;
    }

    const param = params[0];
    if (params.length > 1 || !route.collection || !param) {
      throw new Error(
        `[dndev] Cannot list the public URLs of route "${route.path}". Only single-param routes ` +
          'of an entity collection are expanded. Mark the page `seo: { noindex: true }` to keep it out of the sitemap and llms.txt.'
      );
    }

    if (!crud) {
      throw new Error(
        `[dndev] Route "${route.path}" lists "${route.collection}" records but no server CRUD reader was given.`
      );
    }
    const result = await crud.query(route.collection, {
      where: [
        { field: 'status', operator: 'not-in', value: [...hiddenStatuses] },
      ],
      limit: MAX_RECORDS_PER_ROUTE,
    });

    for (const record of result.items) {
      const value = record[param];
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      pages.push({
        route,
        path: route.path.replace(
          `:${param}`,
          encodeURIComponent(String(value))
        ),
        record,
      });
    }
  }

  return pages;
}
