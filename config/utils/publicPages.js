/**
 * @fileoverview Public page lister (Next runtime, Vite prerender)
 * @description The one URL set the app publishes: static routes as they are, and each
 * single-param dynamic route (`/produits/:slug`) expanded to one page per public record
 * of its entity's collection. Shared by the generated Next sitemap and llms.txt routes
 * ({@link listPublicPages}), the generated Next pages' `generateStaticParams`
 * ({@link listStaticParams}) and the Vite record prerender ({@link listPublicPages}, at
 * build), so the crawlers' URLs and the pages prerendered at build are the same set.
 * Records are read with their entity's read schema (`entityReadSchemas`): keyed by the
 * entity's field names, everything the database returns to a signed-out visitor.
 * Platform-neutral, no imports. Server only (request time and build).
 *
 * @version 0.4.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

/** Records per dynamic route (adapter query maximum). */
const MAX_RECORDS_PER_ROUTE = 1000;

/**
 * `:param` segment names of a route path.
 * @param {string} path - Route path in React Router syntax (`/produits/:slug`)
 * @returns {string[]} e.g. `['slug']`
 */
export function routeParams(path) {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));
}

/**
 * The read schema of a record route's collection, from the readers' `readSchemas`.
 *
 * @param {{ path: string, collection: string }} route - Route reading records
 * @param {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>> | undefined} readSchemas - `entityReadSchemas` of the app's entities
 * @returns {import('@donotdev/core/server').dndevSchema<unknown>}
 * @throws {Error} When the collection has no read schema
 * @since 0.3.2
 */
export function routeReadSchema(route, readSchemas) {
  const schema =
    readSchemas && Object.hasOwn(readSchemas, route.collection)
      ? readSchemas[route.collection]
      : undefined;
  if (!schema) {
    throw new Error(
      `[dndev] Route "${route.path}" reads "${route.collection}" records but no read schema was given ` +
        "for that collection (entityReadSchemas of the app's entities)."
    );
  }
  return schema;
}

/**
 * Public records of a single-param route, with the param value each one fills:
 * `status` not in `hiddenStatuses` (the framework's definition of publicly readable),
 * read with the collection's read schema (rows keyed by the entity's field names), the
 * param read from the record field of the same name; records
 * without a string/number value are skipped.
 *
 * @param {import('../next/index.js').PublicRoute} route - Route with one `:param` and a collection
 * @param {import('@donotdev/core/server').ICrudAdapter | undefined} crud - Public (anonymous) CRUD reader
 * @param {readonly string[]} hiddenStatuses - `HIDDEN_STATUSES` from @donotdev/core/server
 * @param {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>> | undefined} readSchemas - `entityReadSchemas` of the app's entities
 * @returns {Promise<Array<{ param: string, value: string, record: Record<string, unknown> }>>}
 * @throws {Error} When the route has no collection or several params, no reader or read schema is given, or the read fails
 * @since 0.3.1
 */
async function listPublicRecords(route, crud, hiddenStatuses, readSchemas) {
  const params = routeParams(route.path);
  const param = params[0];
  if (params.length !== 1 || !route.collection || !param) {
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
  const schema = routeReadSchema(route, readSchemas);
  let result;
  try {
    result = await crud.query(
      route.collection,
      {
        where: [
          { field: 'status', operator: 'not-in', value: [...hiddenStatuses] },
        ],
        limit: MAX_RECORDS_PER_ROUTE,
      },
      schema
    );
  } catch (error) {
    // CRUD errors keep the provider's own message in `details.originalMessage`.
    const reason = error?.details?.originalMessage ?? error?.message ?? String(error);
    throw new Error(
      `[dndev] Route "${route.path}" could not read its public "${route.collection}" records ` +
        `(signed-out visitor: RLS / Security Rules must allow it): ${reason}`,
      { cause: error }
    );
  }

  const records = [];
  for (const record of result.items) {
    const value = record[param];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    records.push({ param, value: String(value), record });
  }
  return records;
}

/**
 * List the public pages of the given routes, in route order.
 *
 * - static route: one page
 * - single-param route with a collection: one page per public record
 *   ({@link listPublicRecords})
 *
 * @template {import('../next/index.js').PublicRoute} R
 * @param {readonly R[]} routes - Public routes (auth-only and `seo.noindex` routes already excluded by the build)
 * @param {import('@donotdev/core/server').ICrudAdapter | undefined} crud - Public (anonymous) CRUD reader; required when a route lists records
 * @param {readonly string[]} hiddenStatuses - `HIDDEN_STATUSES` from @donotdev/core/server (statuses never public)
 * @param {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>>} [readSchemas] - `entityReadSchemas` of the app's entities; required when a route lists records
 * @returns {Promise<Array<{ route: R, path: string, record?: Record<string, unknown> }>>} Pages, never a `:param` template
 * @throws {Error} When a dynamic route has no collection or several params, no reader or read schema is given, or the read fails
 */
export async function listPublicPages(routes, crud, hiddenStatuses, readSchemas) {
  const pages = [];

  for (const route of routes) {
    if (routeParams(route.path).length === 0) {
      pages.push({ route, path: route.path });
      continue;
    }
    for (const { param, value, record } of await listPublicRecords(
      route,
      crud,
      hiddenStatuses,
      readSchemas
    )) {
      pages.push({
        route,
        path: route.path.replace(`:${param}`, encodeURIComponent(value)),
        record,
      });
    }
  }

  return pages;
}

/**
 * `generateStaticParams` of a generated entity page (`/produits/:slug`): one params
 * object per public record, the same records as the page's sitemap URLs
 * ({@link listPublicRecords}). Values are raw (Next encodes them into the URL).
 *
 * @param {import('../next/index.js').PublicRoute} route - Route with one `:param` and a collection
 * @param {import('@donotdev/core/server').ICrudAdapter} crud - Public (anonymous) CRUD reader
 * @param {readonly string[]} hiddenStatuses - `HIDDEN_STATUSES` from @donotdev/core/server
 * @param {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>>} readSchemas - `entityReadSchemas` of the app's entities
 * @returns {Promise<Array<Record<string, string>>>} e.g. `[{ slug: 'cleanser' }]`
 * @throws {Error} When the route has no collection or several params, no reader or read schema is given, or the read fails
 * @since 0.3.1
 *
 * @example
 * export async function generateStaticParams() {
 *   return listStaticParams({ path: '/produits/:slug', collection: 'products' }, CRUD, HIDDEN_STATUSES, READ_SCHEMAS);
 * }
 */
export async function listStaticParams(route, crud, hiddenStatuses, readSchemas) {
  return (await listPublicRecords(route, crud, hiddenStatuses, readSchemas)).map(
    ({ param, value }) => ({ [param]: value })
  );
}
