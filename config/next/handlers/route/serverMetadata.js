/**
 * @fileoverview Next route handler: Server metadata of generated pages
 * @description Which routes get their identity on the server (entity pages, blog posts, a page module's own `generateMetadata`), the build checks for it, the public reader of entity pages, their `generateStaticParams` and generated `generateMetadata` / JSON-LD / 404. Methods of {@link NextRouteHandler} (mixed into its prototype by
 * `../RouteHandler.js`); `this` is the route handler.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { routeParams } from '../../../utils/publicPages.js';
import { publicRecordsRoute } from '../../../utils/SEOGenerator.js';

export const serverMetadataMethods = {
  /**
   * Whether entity pages prerender their published records at build
   * (`appConfig.prerenderRecords`, default `true`).
   *
   * @returns {boolean}
   * @throws When the value is not a boolean
   * @since 0.3.1
   */
  prerendersRecords() {
    const value = this.options.prerenderRecords ?? true;
    if (typeof value === 'boolean') return value;
    throw new Error(
      `appConfig.prerenderRecords must be true or false. Got ${JSON.stringify(value)}.`
    );
  },

  /**
   * Route a cached page prerenders the records of ({@link publicRecordsRoute}), unless
   * `appConfig.prerenderRecords: false`.
   *
   * @param {Object} route - Route object (`path` in React Router syntax)
   * @returns {{ path: string, collection: string } | null}
   * @since 0.3.1
   */
  prerenderedRecordsRoute(route) {
    return this.prerendersRecords() ? publicRecordsRoute(route) : null;
  },

  /**
   * Where a route's page identity (title, description, Open Graph, JSON-LD) comes from on
   * the server, when it does:
   *
   * - `page`: the page module exports Next's own `generateMetadata` (re-exported by the
   *   generated page; it wins over the generated entity metadata)
   * - `blog`: blog post route (generated from the post's frontmatter)
   * - `entity`: entity route ({@link publicRecordsRoute}): generated from its record
   *
   * AutoMetaTags emits no identity on these routes (`routes.manifest.serverMetadataPaths`):
   * React 19 does not dedupe `<title>`, so each page has exactly one source.
   *
   * @param {Object} route - Route object from discovery (`exportsGenerateMetadata` from the page source)
   * @returns {'page' | 'blog' | 'entity' | null} null: AutoMetaTags (PageMeta + i18n) owns it
   * @since 0.3.2
   */
  serverMetadataSource(route) {
    if (route.exportsGenerateMetadata) return 'page';
    if (this.isBlogPostRoute(route)) {
      return 'blog';
    }
    return publicRecordsRoute(route) ? 'entity' : null;
  },

  /**
   * Route the generated entity metadata reads the record of: an entity route whose page
   * does not export its own `generateMetadata`.
   *
   * @param {Object} route - Route object from discovery
   * @returns {{ path: string, collection: string } | null}
   * @since 0.3.2
   */
  entityMetadataRoute(route) {
    return this.serverMetadataSource(route) === 'entity'
      ? publicRecordsRoute(route)
      : null;
  },

  /**
   * Fail the build on a server metadata source the generated pages cannot serve:
   *
   * - a `'use client'` page exporting `generateMetadata` (Next reads it only from server
   *   modules: the page would ship without metadata)
   * - a blog post page exporting `generateMetadata` (its metadata is generated)
   * - an entity route without the app's `entities` package (the metadata derives from the
   *   entity definition), whose provider has no server reader ({@link serverCrudReader}),
   *   or in an app without a site name ({@link entityMetadataExport})
   *
   * @param {Array} routes - Discovered routes
   * @returns {void}
   * @throws {Error} With what, why and the fix
   * @since 0.3.2
   */
  assertServerMetadata(routes) {
    for (const route of routes) {
      if (route.exportsGenerateMetadata) {
        if (this.isBlogPostRoute(route)) {
          throw new Error(
            `[dndev] ${route.file} exports \`generateMetadata\`, but blog post pages get theirs ` +
              "generated from the post's frontmatter (a second one would conflict). Remove it from the page."
          );
        }
        if (this.isClientComponent(route.file)) {
          throw new Error(
            `[dndev] ${route.file} exports \`generateMetadata\` but is a client module ('use client'). ` +
              'Next reads generateMetadata only from server modules, so the page would ship without ' +
              "its title and description. Keep the page module a server component (no 'use client') " +
              "that exports generateMetadata and renders a 'use client' component, or remove generateMetadata."
          );
        }
        continue;
      }
      const recordsRoute = this.entityMetadataRoute(route);
      if (!recordsRoute) continue;
      if (!this.appDependsOn('entities')) {
        throw new Error(
          `[dndev] ${route.path} is an entity page ("${recordsRoute.collection}" records): its metadata ` +
            "derives from the entity definition, but the app does not depend on an `entities` package. " +
            'Add the entity to the app\'s `entities` package, mark the page `seo: { noindex: true }`, or ' +
            'export `generateMetadata` from a server page module.'
        );
      }
      // Same checks as the generation (reader, languages, site name), outside its
      // per-page error handling
      this.entityMetadataExport(route, this.entityPageReader(route, 'site'));
    }
  },

  /**
   * Public server reader of a generated page ({@link serverCrudReader}): one for its
   * prerendered records ({@link prerenderedRecordsRoute}, cached tree only) and its
   * generated entity metadata ({@link entityMetadataRoute}).
   *
   * @param {Object} route - Route object (`path` in React Router syntax)
   * @param {'site'|'session'} tree - Render tree (per-request pages prerender nothing)
   * @returns {{ imports: string, setup: string, expr: string | null, schemas: string | null,
   *   named: Record<string, string[]> }} Empty when the page reads no record
   * @throws {Error} When the page reads records and the app's provider has no server reader,
   *   or the app has no `entities` package
   * @since 0.3.2
   */
  entityPageReader(route, tree) {
    const recordsRoute = tree === 'site' ? this.prerenderedRecordsRoute(route) : null;
    const metadataRoute = this.entityMetadataRoute(route);
    const readRoute = metadataRoute ?? recordsRoute;
    if (!readRoute) return { imports: '', setup: '', expr: null, schemas: null, named: {} };
    const purpose = [
      metadataRoute && 'entity pages read their record on the server (metadata, JSON-LD, 404)',
      recordsRoute && 'entity pages prerender their published records at build',
    ]
      .filter(Boolean)
      .join('; ');
    const optOut = metadataRoute
      ? 'Mark the page `seo: { noindex: true }`, or export `generateMetadata` from a server page module and set `appConfig.prerenderRecords: false`.'
      : 'Set `appConfig.prerenderRecords: false` to render them on their first request.';
    return this.serverCrudReader([readRoute], purpose, optOut);
  },

  /**
   * generateStaticParams of a cached page with dynamic segments. Every URL is cached like
   * the static pages (ISR, `revalidate` of the cached tree) and `dynamicParams` keeps
   * its default, so a URL not listed renders on its first request.
   *
   * - Entity route ({@link prerenderedRecordsRoute}): one URL per published record,
   *   prerendered at build; the same records as the route's sitemap URLs
   *   (`listStaticParams`, read with the public reader, never a privileged key).
   * - Any other dynamic route: an empty list, every URL renders on its first request.
   *
   * @param {Object} route - Route object (`path` in React Router syntax)
   * @param {{ expr: string | null, schemas: string | null }} reader - The page's reader ({@link entityPageReader})
   * @returns {{ named: Record<string, string[]>, code: string }} Named imports by module and
   *   the export, empty for a static path
   * @since 0.2.3
   */
  staticParamsExport(route, reader) {
    if (!this.convertRouteToAppPath(route.path).includes('[')) {
      return { named: {}, code: '' };
    }
    const recordsRoute = this.prerenderedRecordsRoute(route);
    if (!recordsRoute) {
      return {
        named: {},
        code: `
// Each URL renders on its first request, then is cached like the static pages (ISR)
export function generateStaticParams() {
  return [];
}
`,
      };
    }
    return {
      named: { '@donotdev/core/next': ['listStaticParams'] },
      code: `
// Every published "${recordsRoute.collection}" record is prerendered at build (the sitemap's records,
// public reader). A record published later renders on its first request. All are cached
// like the static pages (ISR). Opt out: appConfig.prerenderRecords = false.
export async function generateStaticParams() {
  return listStaticParams(${JSON.stringify(recordsRoute)}, ${reader.expr}, HIDDEN_STATUSES, ${reader.schemas});
}
`,
    };
  },

  /**
   * Server identity of a generated entity page ({@link entityMetadataRoute}), from the
   * record its URL names, with zero app code:
   *
   * - `generateMetadata`: title, description, Open Graph, Twitter card (`entityPageSeo`
   *   from @donotdev/core/next: `deriveEntitySeo` with the entity's `seo` option and
   *   translations, in the URL's language). Canonical, `og:url` and hreflang stay with
   *   AutoMetaTags, which emits them on every route.
   * - The page: Product JSON-LD (`seo.type: 'product'` in PageMeta) and the BreadcrumbList
   *   (record title last; AutoMetaTags emits none on `recordBreadcrumbPaths`) as
   *   `<script type="application/ld+json">`, og:types the metadata API cannot render. They
   *   render AFTER the page: the layout's `main > :first-child` rule (layout-variables.css)
   *   makes the page grow and never shrink, so a script first in `main` let the page shrink
   *   under the footer.
   * - Missing or hidden record: `notFound()`, an HTTP 404 with the app's 404 page (noindex).
   *
   * The record is read once per request (React `cache`, shared by generateMetadata and the
   * page) with the public reader and read schemas of generateStaticParams.
   *
   * @param {Object} route - Route object (`path`, `meta`, `relativePath`)
   * @param {{ expr: string | null, schemas: string | null }} reader - The page's reader ({@link entityPageReader})
   * @returns {{ vendorImports: string, named: Record<string, string[]>, typeImports: string,
   *   appImports: string, code: string, render: string } | null} Imports (vendor lines,
   *   framework names by module, type lines, app lines), module code (`Params` type,
   *   generateMetadata) and the default export's body (`{PAGE}`: the page element); null
   *   for any other route
   * @throws {Error} When the app's languages are not set
   * @since 0.3.2
   */
  entityMetadataExport(route, reader) {
    const recordsRoute = this.entityMetadataRoute(route);
    if (!recordsRoute) return null;
    const { defaultLanguage, languages } = this.options;
    if (!defaultLanguage) {
      throw new Error(
        'Route handler: languages not set before page generation (runDiscoveries calls useLanguages)'
      );
    }
    const [param] = routeParams(recordsRoute.path);
    const multilingual = this.isMultilingual();
    const type = route.meta?.seo?.type ?? 'website';
    const i18nConfig = this.calculateRelativeImportPath(
      'src/config/dndev-config-i18n.js',
      route.path
    );
    const siteName = this.options.siteName;
    if (!siteName) {
      throw new Error(
        `[dndev] ${route.path}: entity page titles end with the site name. Set appConfig.app.name (or appConfig.seo.siteName).`
      );
    }
    return {
      vendorImports:
        "import type { Metadata } from 'next';\n" +
        "import { notFound } from 'next/navigation';\n" +
        "import { cache } from 'react';\n",
      named: {
        '@donotdev/core/server': [
          'buildBreadcrumbJsonLd',
          'buildProductJsonLd',
          'deriveEntitySeo',
          'languageUrl',
        ],
        '@donotdev/core/next': ['appBaseUrl', 'entityPageSeo', 'jsonLdScript', 'readEntityPageRecord'],
        '@donotdev/core/rsc': ['useTranslation'],
      },
      typeImports: "import type { LanguageRouting } from '@donotdev/core/server';\n",
      // `entities` comes with the page's reader (`serverCrudReader`)
      appImports: `// Server graph: the translations the server useTranslation reads\nimport '${i18nConfig}';\n`,
      code: `
// Page identity from the "${recordsRoute.collection}" record of this URL (server, no app code): title,
// description, Open Graph, Twitter card, ${type === 'product' ? 'Product JSON-LD, ' : ''}in the URL's language. Canonical, og:url
// and hreflang come from AutoMetaTags. No public record (missing, hidden status): HTTP 404.
const ROUTE = ${JSON.stringify(recordsRoute)};

const LANGUAGE_ROUTING: LanguageRouting = ${JSON.stringify({ languages, defaultLanguage })};

// next.config trailingSlash: page URLs end with \`/\` when true
const TRAILING_SLASH = ${JSON.stringify(this.options.trailingSlash)};

type Params = Promise<{ ${multilingual ? 'lang: string; ' : ''}${param}: string }>;

// One read per request: generateMetadata and the page share it (React cache)
const pageSeo = cache(async (language: string, value: string) => {
  const record = await readEntityPageRecord(ROUTE, value, ${reader.expr}, HIDDEN_STATUSES, ${reader.schemas});
  if (!record) return null;
  return entityPageSeo(record, {
    route: ROUTE,
    value,
    language,
    routing: LANGUAGE_ROUTING,
    baseUrl: appBaseUrl(process.env.NEXT_PUBLIC_APP_URL),
    trailingSlash: TRAILING_SLASH,
    siteName: ${JSON.stringify(siteName)},
    defaultImage: ${JSON.stringify(this.defaultImage())},
    type: ${JSON.stringify(type)},
    entities,
    translate: (namespaces) => useTranslation(namespaces, { language }).t,
    deriveEntitySeo,
    buildProductJsonLd,
    languageUrl,
    buildBreadcrumbJsonLd,
  });
});

/** The URL's page identity; \`notFound()\` (HTTP 404) when no public record matches. */
async function requireSeo(params: Params) {
  const { ${multilingual ? 'lang, ' : ''}${param} } = await params;
  const seo = await pageSeo(${multilingual ? 'lang' : JSON.stringify(defaultLanguage)}, ${param});
  if (!seo) notFound();
  return seo;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return (await requireSeo(params)).metadata;
}
`,
      render: `const seo = await requireSeo(props.params);
  return (
    <>
      {PAGE}
      {seo.ogType && <meta property="og:type" content={seo.ogType} />}
      {seo.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(seo.jsonLd) }}
        />
      )}
      {seo.breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(seo.breadcrumb) }}
        />
      )}
    </>
  );`,
    };
  },
};
