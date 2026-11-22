/**
 * @fileoverview Entity page SEO (Next runtime)
 * @description Server-side identity of a generated entity page (`/produits/:slug`): the
 * record the URL names, read with the public reader the page's `generateStaticParams`
 * uses (signed-out visitor, `status` not hidden, the entity's read schema), then its Next `Metadata` and JSON-LD
 * from the entity definition (`entityRecordSeo`: `deriveEntitySeo`, `buildProductJsonLd`). The generated
 * page calls {@link readEntityPageRecord} once per request (React `cache`), its
 * `generateMetadata` and its component use the result; a missing record is a 404
 * (`notFound()`). Canonical, `og:url` and hreflang are not part of it: AutoMetaTags emits
 * them on every route from the same URL helper. Server only.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { entityRecordSeo } from '../../utils/entityRecordSeo.js';
import { routeParams, routeReadSchema } from '../../utils/publicPages.js';

/** og:type values Next's metadata API renders (`openGraph.type`); others go in the page. */
const NEXT_OG_TYPES = new Set(['website', 'article']);

/**
 * The public record an entity page URL names: `<param> == value` and `status` not in
 * `hiddenStatuses`, read with the public (anonymous) reader and the entity's read schema.
 * Same filter and schema as the page's `generateStaticParams` and sitemap URLs, so a URL
 * they list resolves and any other 404s.
 *
 * @param {import('../index.js').PublicRoute} route - Route with one `:param` and a collection
 * @param {string} value - The URL's param value (decoded, as Next passes it)
 * @param {import('@donotdev/core/server').ICrudAdapter} crud - Public (anonymous) CRUD reader
 * @param {readonly string[]} hiddenStatuses - `HIDDEN_STATUSES` from @donotdev/core/server
 * @param {Readonly<Record<string, import('@donotdev/core/server').dndevSchema<unknown>>>} readSchemas - `entityReadSchemas` of the app's entities: the record comes back keyed by the entity's field names
 * @returns {Promise<Record<string, unknown> | null>} The record, null when none is public
 * @throws {Error} When the route has no collection or several params, no reader or read schema is given, or the read fails
 * @since 0.3.2
 *
 * @example
 * const record = await readEntityPageRecord({ path: '/produits/:slug', collection: 'products' }, slug, CRUD, HIDDEN_STATUSES, READ_SCHEMAS);
 */
export async function readEntityPageRecord(route, value, crud, hiddenStatuses, readSchemas) {
  const params = routeParams(route.path);
  const param = params[0];
  if (params.length !== 1 || !route.collection || !param) {
    throw new Error(
      `[dndev] Entity page "${route.path}": only single-param routes of an entity collection read a record.`
    );
  }
  if (!crud) {
    throw new Error(
      `[dndev] Entity page "${route.path}" reads a "${route.collection}" record but no server CRUD reader was given.`
    );
  }
  const schema = routeReadSchema(route, readSchemas);
  let result;
  try {
    result = await crud.query(
      route.collection,
      {
        where: [
          { field: param, operator: '==', value },
          { field: 'status', operator: 'not-in', value: [...hiddenStatuses] },
        ],
        limit: 1,
      },
      schema
    );
  } catch (error) {
    // CRUD errors keep the provider's own message in `details.originalMessage`.
    const reason = error?.details?.originalMessage ?? error?.message ?? String(error);
    throw new Error(
      `[dndev] Entity page "${route.path}" could not read its public "${route.collection}" record ` +
        `(signed-out visitor: RLS / Security Rules must allow it): ${reason}`,
      { cause: error }
    );
  }
  return result.items[0] ?? null;
}

/**
 * Next `Metadata` and JSON-LD of an entity page, from its record's identity
 * (`entityRecordSeo`, shared with the Vite record prerender): title `<record title> | <site
 * name>` (site name alone without a record title; absolute, so no layout title template
 * applies), description, Open Graph and Twitter card (image absolute: the record's, else
 * the site's default `DEFAULT_OG_IMAGE`), og:type from the
 * page's `seo.type`, and Product JSON-LD for `type: 'product'`. The record's text is
 * formatted in the page's language with the entity's translations (`translate`).
 *
 * @param {Record<string, unknown>} record - Output of {@link readEntityPageRecord}
 * @param {import('../index.js').EntityPageContext} context - Route, URL, language and the shared helpers
 * @returns {import('../index.js').EntityPageSeo} `metadata` for generateMetadata; `ogType`,
 *   `jsonLd` and `breadcrumb` for the page to render (og:types Next's metadata API does not
 *   render, Product and BreadcrumbList JSON-LD scripts)
 * @throws {Error} When the route's collection has no entity definition
 * @since 0.3.2
 *
 * @example
 * entityPageSeo(record, { route, value: slug, language, routing, baseUrl, trailingSlash, siteName,
 *   type: 'product', entities, translate, deriveEntitySeo, buildProductJsonLd, languageUrl });
 */
export function entityPageSeo(record, context) {
  const { title, description, image, type, jsonLd, breadcrumb } = entityRecordSeo(
    record,
    context
  );

  const metadata = {
    title: { absolute: title },
    ...(description && { description }),
    openGraph: {
      title: { absolute: title },
      ...(description && { description }),
      ...(NEXT_OG_TYPES.has(type) && { type }),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: { absolute: title },
      ...(description && { description }),
      images: [image],
    },
  };

  return {
    metadata,
    ogType: NEXT_OG_TYPES.has(type) ? null : type,
    jsonLd,
    breadcrumb,
  };
}

/**
 * JSON-LD as the text of a `<script type="application/ld+json">`: `<` escaped so a record
 * value cannot close the script (Next's documented JSON-LD pattern).
 *
 * @param {Record<string, unknown>} jsonLd - JSON-LD object
 * @returns {string} Script text
 * @since 0.3.2
 */
export function jsonLdScript(jsonLd) {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
