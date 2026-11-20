/**
 * @fileoverview On-demand revalidation (Next runtime)
 * @description Server side of the generated `src/app/api/dndev/revalidate` route handler,
 * which a database webhook calls on every insert, update or delete of a watched table.
 * Maps the changed record to the cached pages that show it ({@link revalidationPaths})
 * and invalidates them (`revalidatePath`), so the long-lived ISR cache of the site tree
 * stays fresh without waiting for `revalidate`. The proxy does not run for on-demand
 * revalidation: paths are the internal ones Next caches (`/<lang>/…` for every
 * language with 2+ languages), never the public unprefixed URL. Server only.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { createHash, timingSafeEqual } from 'node:crypto';

import { routeParams } from './seo/publicPages.js';

/** Env variable holding the webhook's shared secret (`Authorization: Bearer <secret>`). */
export const REVALIDATE_SECRET_ENV = 'DNDEV_REVALIDATE_SECRET';

/** URL of the generated revalidation route handler. */
export const REVALIDATE_ROUTE_PATH = '/api/dndev/revalidate';

/** Shortest accepted secret (characters): a guessable secret fails like an unset one. */
export const REVALIDATE_SECRET_MIN_LENGTH = 32;

/** Postgres schema of the tables the public reader reads (`.from(collection)`). */
const PUBLIC_SCHEMA = 'public';

/** Generated feeds listing records (sitemap, llms.txt): outside the language tree. */
const RECORD_FEEDS = ['/sitemap.xml', '/llms.txt'];

/**
 * A param value in the form of Next's cache tags. Next tags a rendered page with its
 * pathname decoded per segment, then path delimiters re-escaped (`decodePathParams` →
 * `escapePathDelimiters(…, true)` in next/dist/server/lib/router-utils/decode-path-params.js),
 * and `revalidatePath` compares that string as given (both sides then go through
 * `encodeHeaderSafe`, which percent-encodes non-ASCII only). So `a&b`, `x+y`, `p,q;r=s@t$`
 * stay raw (an `encodeURIComponent` form `a%26b` would never match), and only `/ # ? \`
 * (raw, or already as `%2f %23 %3f %5c`) are percent-encoded.
 */
function cacheTagSegment(value) {
  return value.replace(/[/#?\\]|%(2f|23|3f|5c)/gi, (char) => encodeURIComponent(char));
}

/**
 * Internal (cached) paths of an app path: `/<lang>/…` for every language with 2+
 * languages (the app/[lang] route, the default language included), the path itself
 * with one.
 */
function internalPaths(path, routing) {
  if (routing.languages.length < 2) return [path];
  return routing.languages.map(
    (language) => `/${language}${path === '/' ? '' : path}`
  );
}

/**
 * Cached paths a record change makes stale.
 *
 * - Entity route (`/produits/:slug`, one param, `collection` = the changed table): the
 *   page of the new and of the old record (a changed or removed slug leaves its old page
 *   stale), the param read from the record field of the same name (as the sitemap does),
 *   in Next's cache-tag form ({@link cacheTagSegment}).
 * - Static routes: every one. Any of them may list the collection (home, catalogue);
 *   the build cannot tell which, so all are invalidated (regenerated on their next visit).
 * - Feeds (`/sitemap.xml`, `/llms.txt`) when an entity route uses the table.
 * - Other dynamic routes (several params, no entity) are not revalidated: they refresh
 *   on their `revalidate` timer. Same for entity pages showing records of another table
 *   (a brand page listing products).
 *
 * @param {readonly import('./index.js').PublicRoute[]} routes - Cached routes, as written by the build
 * @param {import('./index.js').RecordChange} change - Changed table and rows (app field names)
 * @param {import('@donotdev/core/server').LanguageRouting} routing - App languages
 * @returns {string[]} Internal paths, each language, sorted, no duplicates
 */
export function revalidationPaths(routes, change, routing) {
  const appPaths = new Set();
  const paths = new Set();
  for (const route of routes) {
    const params = routeParams(route.path);
    if (params.length === 0) {
      appPaths.add(route.path);
      continue;
    }
    const [param] = params;
    if (params.length !== 1 || !param || route.collection !== change.table) continue;
    for (const row of [change.record, change.oldRecord]) {
      const value = row?.[param];
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      appPaths.add(route.path.replace(`:${param}`, cacheTagSegment(String(value))));
    }
    for (const feed of RECORD_FEEDS) paths.add(feed);
  }
  for (const path of appPaths) {
    for (const internal of internalPaths(path, routing)) paths.add(internal);
  }
  return [...paths].sort();
}

/** Constant-time comparison of a bearer token with the secret (hashes: equal lengths). */
function isAuthorized(authorization, secret) {
  const match = /^Bearer (.+)$/.exec(authorization ?? '');
  if (!match) return false;
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(match[1]), digest(secret));
}

/**
 * Handle a database webhook call (POST): authenticate the shared secret, read the
 * change, invalidate its paths.
 *
 * - Secret unset or shorter than {@link REVALIDATE_SECRET_MIN_LENGTH}: throws (the route
 *   answers 500 and logs it). Never a default secret.
 * - Missing or wrong `Authorization: Bearer <secret>`: 401.
 * - Body not JSON, or not a change `readChange` accepts: 400 with the reason.
 * - A table outside the `public` schema: 400 (the public reader only reads `public`).
 * - Otherwise: `revalidatePath` on every {@link revalidationPaths} path, 200 with the list.
 *
 * @param {Request} request - The webhook request
 * @param {import('./index.js').RevalidationContext} context - Secret, routes, languages, reader, Next's revalidatePath
 * @returns {Promise<Response>}
 * @throws {Error} When the secret is unset or too short; anything `readChange` throws that is not an Error
 *
 * @example
 * export async function POST(request: Request) {
 *   return handleRevalidationWebhook(request, {
 *     secret: process.env.DNDEV_REVALIDATE_SECRET, routes: ROUTES, routing: LANGUAGE_ROUTING,
 *     readChange: readDatabaseWebhook, revalidatePath,
 *   });
 * }
 */
export async function handleRevalidationWebhook(
  request,
  { secret, routes, routing, readChange, revalidatePath }
) {
  if (!secret || secret.length < REVALIDATE_SECRET_MIN_LENGTH) {
    throw new Error(
      `[dndev] Set ${REVALIDATE_SECRET_ENV} to a random secret of at least ${REVALIDATE_SECRET_MIN_LENGTH} characters: the revalidation webhook (${REVALIDATE_ROUTE_PATH}) authenticates with it.`
    );
  }
  if (!isAuthorized(request.headers.get('authorization'), secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let change;
  try {
    change = readChange(await request.json());
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (change.schema !== PUBLIC_SCHEMA) {
    return Response.json(
      {
        error: `Table "${change.schema}.${change.table}" is not in the "${PUBLIC_SCHEMA}" schema: only public content tables are revalidated.`,
      },
      { status: 400 }
    );
  }
  const paths = revalidationPaths(routes, change, routing);
  for (const path of paths) revalidatePath(path);
  return Response.json({ revalidated: paths });
}
