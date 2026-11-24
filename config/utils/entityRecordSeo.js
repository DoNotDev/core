/**
 * @fileoverview Entity record page identity (Next runtime, Vite prerender)
 * @description The page identity of one public entity record (`/produits/:slug`): title
 * `<record title> | <site name>`, description, absolute image, og:type, URL and Product
 * JSON-LD and BreadcrumbList JSON-LD (the page's ancestor chain, then the record title, the
 * labels the visible breadcrumb shows), from the entity definition (`deriveEntitySeo`, `buildProductJsonLd`,
 * `buildBreadcrumbJsonLd`) in the page language. One derivation for both platforms: the Next entity page maps it to its
 * `generateMetadata` (`entityPageSeo`), the Vite build writes it into each record's
 * static HTML (`recordHeadTags`). Platform-neutral: the core helpers are passed in
 * (`context`), so the file loads in Node without the TypeScript sources. Also the read
 * schemas the public readers query records with (`entityReadSchemas`). Server only.
 *
 * @version 0.3.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { routeParams } from './publicPages.js';

/** Root-relative URLs → absolute (link-preview crawlers and JSON-LD need absolute URLs). */
function absoluteUrl(url, baseUrl) {
  return url.startsWith('/') ? `${baseUrl}${url}` : url;
}

/**
 * Whether a module export is an entity definition (`defineEntity`: `collection` and
 * `fields`), as the app's `entities` package exports them.
 *
 * @param {unknown} value - A module export
 * @returns {boolean}
 * @since 0.3.2
 */
export function isEntityDefinition(value) {
  return (
    typeof value === 'object' && value !== null && 'collection' in value && 'fields' in value
  );
}

/**
 * The entity definition of a collection among a module's exports (`import * as entities`).
 *
 * @param {Readonly<Record<string, unknown>>} entities - The app's `entities` package exports
 * @param {string} collection - The route's collection
 * @param {string} routePath - The route path, for the error
 * @returns {Object} The `defineEntity` definition
 * @throws {Error} When no export is the entity of `collection`
 * @since 0.3.2
 */
export function entityOf(entities, collection, routePath) {
  for (const value of Object.values(entities)) {
    if (isEntityDefinition(value) && value.collection === collection) return value;
  }
  throw new Error(
    `[dndev] Entity page "${routePath}": no entity definition for collection "${collection}". ` +
      "Export it from the app's `entities` package, or mark the page `seo: { noindex: true }`."
  );
}

/**
 * Read schema of each record route's collection: `createSchemas(entity).get` of its
 * entity definition, the schema the client lists pass to `crud.query` (`useCrudList`).
 * The record readers (`listPublicPages`, `listStaticParams`, `readEntityPageRecord`) pass
 * it to the public reader, which keys the rows by the entity's field names and filters
 * nothing: every column / field the database returns to a signed-out visitor
 * (`SupabasePublicReader`: `select=*` with the entity-aware mapper; `FirestorePublicReader`:
 * documents as stored). Without it Supabase camelCases the column names
 * (`availability_date` → `availabilityDate`) and the entity's snake_case fields read as
 * missing.
 *
 * @param {Readonly<Record<string, unknown>>} entities - The app's `entities` package exports
 * @param {ReadonlyArray<{ path: string, collection?: string }>} routes - Routes; each one with a collection gets its schema
 * @param {(entity: Object) => { get: import('@donotdev/core/server').dndevSchema<unknown> }} createSchemas - `createSchemas` from @donotdev/core/server
 * @returns {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>>} Collection → read schema
 * @throws {Error} When a route's collection has no entity definition
 * @since 0.3.2
 *
 * @example
 * const READ_SCHEMAS = entityReadSchemas(entities, [{ path: '/produits/:slug', collection: 'products' }], createSchemas);
 * // { products: createSchemas(productEntity).get }
 */
export function entityReadSchemas(entities, routes, createSchemas) {
  // No prototype: any collection name (`__proto__` included) is an own key
  const schemas = Object.create(null);
  for (const route of routes) {
    if (!route.collection || Object.hasOwn(schemas, route.collection)) continue;
    schemas[route.collection] = createSchemas(
      entityOf(entities, route.collection, route.path)
    ).get;
  }
  return Object.freeze(schemas);
}

/**
 * Page identity of an entity record: title `<record title> | <site name>` (site name alone
 * without a record title), description, image (absolute: the record's first, else the
 * site's default `context.defaultImage`, `appConfig.seo.defaultImage` or `DEFAULT_OG_IMAGE`), og:type from the page's `seo.type`, the page URL in
 * its language and trailing-slash form, Product JSON-LD for `type: 'product'`, and the
 * BreadcrumbList JSON-LD (site home, the page's ancestors `routeAncestors` over
 * `context.routes`, named by their titles as the visible breadcrumb names them, the record
 * title last; none without a record title). The record's text is formatted in the page's
 * language with the entity's translations (`translate`), the ancestors' titles with
 * theirs.
 *
 * @param {Record<string, unknown>} record - The public record the page URL names
 * @param {import('../next/index.js').EntityPageContext} context - Route, URL, language and the shared helpers
 * @returns {import('@donotdev/core/server').RecordSeo} The page identity
 * @throws {Error} When the route's collection has no entity definition
 * @since 0.3.2
 *
 * @example
 * entityRecordSeo(record, { route, value: slug, language, routing, baseUrl, trailingSlash, siteName,
 *   defaultImage: '/og-image.png', type: 'product', entities, translate, deriveEntitySeo, buildProductJsonLd, buildBreadcrumbJsonLd, languageUrl,
 *   routes: [{ path: '/catalogue', meta: { namespace: 'catalogue' } }, { path: '/produits/:slug', meta: { parent: '/catalogue' } }],
 *   defaultNamespace: 'home' });
 * // { url: 'https://shop.example/en/produits/serum', title: 'Bakuchiol Serum | Shop', ... }
 */
export function entityRecordSeo(record, context) {
  const { route, value, language, baseUrl, siteName, type } = context;
  const entity = entityOf(context.entities, route.collection, route.path);
  const seo = context.deriveEntitySeo(entity, record, {
    t: context.translate([entity.namespace, 'crud']),
    locale: language,
  });
  const param = routeParams(route.path)[0];
  const path = route.path.replace(`:${param}`, encodeURIComponent(value));
  const pageUrl = (appPath) =>
    context.languageUrl(appPath, language, baseUrl, context.routing, context.trailingSlash);
  const url = pageUrl(path);
  const title = seo.title ? `${seo.title} | ${siteName}` : siteName;
  // A record without an image shares the site's link-preview image (appConfig.seo.defaultImage,
  // else the generated og-image.png): the one the other pages use
  const image = absoluteUrl(seo.image || context.defaultImage, baseUrl);

  const jsonLd =
    type === 'product'
      ? context.buildProductJsonLd(
          {
            ...seo,
            images: [...new Set(seo.images.map((src) => absoluteUrl(src, baseUrl)))],
          },
          url
        )
      : null;

  return {
    url,
    title,
    ...(seo.description && { description: seo.description }),
    image,
    type,
    jsonLd,
    // Home, the page's ancestors (URL prefixes that are routes, PageMeta `parent`) named
    // by their titles in the page language, the record title last
    breadcrumb: seo.title
      ? context.buildBreadcrumbJsonLd({
          pathname: path,
          routes: context.routes,
          siteName,
          t: context.translate([context.defaultNamespace]),
          defaultNs: context.defaultNamespace,
          pageUrl,
          lastName: seo.title,
        })
      : null,
  };
}
