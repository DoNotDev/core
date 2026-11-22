// packages/core/utils/src/common/headTags.ts

/**
 * @fileoverview SEO head tags shared by AutoMetaTags and the Vite prerender
 * @description One source for the `<head>` of a page: the route identity (PageMeta +
 * i18n, {@link routeSeo} / {@link routeHeadTags}), an entity record's identity
 * ({@link recordHeadTags}), the site tags of every page ({@link siteHeadTags}) and the
 * BreadcrumbList JSON-LD ({@link buildBreadcrumbJsonLd}) and the favicon set
 * ({@link resolveFaviconFiles} / {@link faviconHeadTags}). AutoMetaTags renders these
 * lists in the browser; the Vite build writes the same lists into each prerendered
 * page and embeds them ({@link PRERENDERED_HEAD_ELEMENT_ID}), so the head
 * react-helmet-async manages after the app loads is the one crawlers read, node for
 * node. The favicon tags are rendered by FaviconHead on Next (server HTML) and written
 * into `index.html` by the Vite build. The plain-Node build (Next metadata manifest, Vite
 * plugins) imports the same functions from `config/utils/headTags.js`, which
 * `bun run bpr` compiles from this file: edit this file, never the `.js`.
 *
 * @version 0.3.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import type { TFunction } from 'i18next';

import type { FaviconConfig, SeoMeta } from '@donotdev/types';

import { translateArray } from './arrayTranslations';

/**
 * One `<head>` element: tag name, attributes (HTML names), text content.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface HeadTag {
  tag: 'title' | 'meta' | 'link' | 'script';
  attributes: Readonly<Record<string, string>>;
  /** Text content (`<title>`, `<script>`), already safe to place in the element */
  text?: string;
}

/**
 * Page identity of one public entity record, derived at build or on the Next server
 * from the record (`entityRecordSeo` in @donotdev/core config: `deriveEntitySeo` with the
 * entity's `seo` option and translations, in the page language).
 *
 * @version 0.2.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface RecordSeo {
  /** Absolute public URL of the page in its language (`languageUrl`): canonical, `og:url` */
  url: string;
  /** `<record title> | <site name>` (the site name alone without a record title) */
  title: string;
  /** Record description, max 160 chars */
  description?: string;
  /** Absolute URL of the record's first image */
  image?: string;
  /** og:type: the page's PageMeta `seo.type` */
  type: 'website' | 'article' | 'product';
  /** Product JSON-LD (`type: 'product'`), null otherwise */
  jsonLd: Record<string, unknown> | null;
  /** BreadcrumbList JSON-LD ending with the record title ({@link buildBreadcrumbJsonLd}), null without a record title */
  breadcrumb: Record<string, unknown> | null;
}

/**
 * What a prerendered page (Vite build) embeds: its URL, the identity tags written into
 * its head, and whether they include its BreadcrumbList (record pages), so AutoMetaTags
 * renders exactly them on that URL and emits no second breadcrumb.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface PrerenderedHead {
  /** Canonical URL of the page (`languageUrl`) */
  url: string;
  /** Identity tags ({@link routeHeadTags} or {@link recordHeadTags}) */
  tags: HeadTag[];
  /** The tags hold the page's BreadcrumbList (AutoMetaTags emits none) */
  breadcrumb: boolean;
}

/**
 * `id` of the `<script type="application/json">` holding a prerendered page's
 * {@link PrerenderedHead} (data, never executed: allowed by any CSP).
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export const PRERENDERED_HEAD_ELEMENT_ID = 'dndev-prerendered-head';

/**
 * Path of the site's logo in its JSON-LD: the Organization `logo` (AutoMetaTags) and
 * the WebPage / Article `publisher.logo` ({@link routeHeadTags}). The app's own
 * `public/logo.svg` (the file the favicon, PWA icons and `og-image.png` are generated
 * from), fixed: no existence check or asset manifest read, so the server render, the
 * browser and the Vite prerender write the same URL.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export const SITE_LOGO_PATH = '/logo.svg';

/**
 * JSON as the text of a `<script>` data block (`application/ld+json`,
 * `application/json`): `<` escaped (`<`), so a value cannot close the script.
 * `JSON.parse` reads it back unchanged.
 *
 * @param value - JSON value
 * @returns Script text
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function jsonScriptText(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const meta = (key: 'name' | 'property', value: string, content: string): HeadTag => ({
  tag: 'meta',
  attributes: { [key]: value, content },
});

const jsonLdTag = (jsonLd: unknown): HeadTag => ({
  tag: 'script',
  attributes: { type: 'application/ld+json' },
  text: jsonScriptText(jsonLd),
});

/**
 * BreadcrumbList JSON-LD of a page from its URL path: the site home, then one item per
 * path segment named like the visible breadcrumb (`Breadcrumbs`: words title-cased),
 * the last one named `lastName` when given (an entity record's title, the label
 * `useRecordBreadcrumb` shows there).
 *
 * @param pathname - Route path without language prefix (`/produits/serum`)
 * @param siteName - Name of the home item
 * @param pageUrl - Absolute public URL of an app path in the page's language
 * @param lastName - Name of the last item (record title); segment label when omitted
 * @returns BreadcrumbList JSON-LD
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function buildBreadcrumbJsonLd(
  pathname: string,
  siteName: string,
  pageUrl: (path: string) => string,
  lastName?: string
): Record<string, unknown> {
  const segments = pathname.split('/').filter(Boolean);
  const items = [
    { '@type': 'ListItem', position: 1, name: siteName, item: pageUrl('/') },
  ];
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name:
        isLast && lastName
          ? lastName
          : segment
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
      item: pageUrl(currentPath),
    });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Head tags of a record page identity, in order: `<title>`, description, Open Graph
 * (`og:title`, `og:description`, `og:type`, `og:image`), Twitter card
 * (`summary_large_image` with an image), Product JSON-LD, BreadcrumbList JSON-LD. Fields
 * without a value emit no tag. Canonical, `og:url`, `og:site_name` and hreflang are not
 * part of it ({@link siteHeadTags}).
 *
 * @param seo - The record page identity
 * @returns Tags to render (AutoMetaTags) or write into the static HTML (Vite build)
 *
 * @version 0.2.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function recordHeadTags(seo: RecordSeo): HeadTag[] {
  const { title, description, image, type, jsonLd, breadcrumb } = seo;
  const tags: HeadTag[] = [{ tag: 'title', attributes: {}, text: title }];
  if (description) tags.push(meta('name', 'description', description));
  tags.push(meta('property', 'og:title', title));
  if (description) tags.push(meta('property', 'og:description', description));
  tags.push(meta('property', 'og:type', type));
  if (image) tags.push(meta('property', 'og:image', image));
  if (image) tags.push(meta('name', 'twitter:card', 'summary_large_image'));
  tags.push(meta('name', 'twitter:title', title));
  if (description) tags.push(meta('name', 'twitter:description', description));
  if (image) tags.push(meta('name', 'twitter:image', image));
  if (jsonLd) tags.push(jsonLdTag(jsonLd));
  if (breadcrumb) tags.push(jsonLdTag(breadcrumb));
  return tags;
}

/**
 * Site tags of every page with a URL: canonical and `og:url` (with an app URL),
 * `og:site_name`, and the hreflang alternates (one per language, then `x-default` = the
 * default language URL; the sitemap's `languageUrls`).
 *
 * @param site - The page URL (null without an app URL), site name and hreflang alternates
 *   (null: none, one language or `seo.hreflang: false`)
 * @returns Tags
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function siteHeadTags(site: {
  url: string | null;
  siteName: string;
  alternates: Record<string, string> | null;
  defaultLanguage: string;
}): HeadTag[] {
  const tags: HeadTag[] = [];
  if (site.url) {
    tags.push({ tag: 'link', attributes: { rel: 'canonical', href: site.url } });
    tags.push(meta('property', 'og:url', site.url));
  }
  tags.push(meta('property', 'og:site_name', site.siteName));
  if (site.alternates) {
    for (const [language, href] of Object.entries(site.alternates)) {
      tags.push({ tag: 'link', attributes: { rel: 'alternate', hreflang: language, href } });
    }
    const xDefault = site.alternates[site.defaultLanguage];
    if (xDefault) {
      tags.push({
        tag: 'link',
        attributes: { rel: 'alternate', hreflang: 'x-default', href: xDefault },
      });
    }
  }
  return tags;
}

/** Most keywords read from a namespace's `meta.keywords` array. */
const MAX_KEYWORDS = 20;

/** Missing translation → empty string (never the key): absent SEO fields stay absent. */
const EMPTY_WHEN_MISSING = { defaultValue: '' };

/**
 * An SEO text field of PageMeta or its translation: `null` = none, a string = that
 * string, `undefined` = the translation (`''` when missing → none).
 *
 * @param seoValue - PageMeta `seo` field
 * @param translationKey - `ns:key`
 * @param t - Translation function
 * @returns The text, or undefined
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function resolveSeoField(
  seoValue: string | null | undefined,
  translationKey: string,
  t: TFunction
): string | undefined {
  if (seoValue === null) return undefined;
  if (seoValue !== undefined) return seoValue;
  return t(translationKey, EMPTY_WHEN_MISSING) || undefined;
}

/**
 * The `meta` object of a namespace's translations: `fullTitle`, `image`, `type`,
 * `keywords` (array), `author`; missing fields are undefined.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface I18nSeoMeta {
  fullTitle?: string;
  image?: string;
  type?: string;
  keywords?: string[];
  author?: string;
}

/**
 * Read a namespace's `meta` SEO fields from its translations.
 *
 * @param t - Translation function
 * @param ns - Namespace
 * @returns The fields present
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function readI18nSeoMeta(t: TFunction, ns: string): I18nSeoMeta {
  // why: TFunction is an i18next overload set; a single-signature wrapper cannot satisfy it structurally
  const translateOrEmpty = ((key: string) =>
    t(key, EMPTY_WHEN_MISSING)) as unknown as TFunction;
  const field = (name: string) =>
    translateOrEmpty(`${ns}:meta.${name}`) || undefined;
  const keywords = translateArray(translateOrEmpty, `${ns}:meta.keywords`, MAX_KEYWORDS);

  return {
    fullTitle: field('fullTitle'),
    image: field('image'),
    type: field('type'),
    keywords: keywords.length > 0 ? keywords : undefined,
    author: field('author'),
  };
}

/**
 * `<meta name="robots">` content of a page. Auth-only pages (PageMeta `auth`) are noindex
 * by default: robots.txt never blocks a page (a crawler must fetch it to read its noindex,
 * and a blocked URL can still be indexed from links), so the tag keeps it out of the index.
 *
 * @param noindex - PageMeta `seo.noindex` (top-level `noindex` when unset): `true` =
 *   `noindex, nofollow`, `false` = indexable even when auth-only (explicit opt-in)
 * @param authOnly - The route is auth-only
 * @returns Tag content, or null for none
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function robotsContent(
  noindex: boolean | undefined,
  authOnly: boolean
): string | null {
  if (noindex === true) return 'noindex, nofollow';
  if (noindex === false) return null;
  return authOnly ? 'noindex' : null;
}

/**
 * Route metadata the head reads (PageMeta as the route manifest holds it).
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface RouteSeoMeta {
  namespace?: string;
  noindex?: boolean;
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  seo?: SeoMeta;
}

/**
 * Page identity of a route from its PageMeta and translations.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export interface RouteSeo {
  title: string;
  description?: string;
  /** Absolute when the app URL is set */
  image?: string;
  /** Canonical URL, null on the 404 document */
  url: string | null;
  type: string;
  robots: string | null;
  keywords?: string[];
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
}

/**
 * Title of a route (PageMeta + i18n), the one chain of {@link routeSeo}:
 *
 * - `title`, the page's `<title>`: `seo.fullTitle`, the page namespace's `meta.fullTitle`,
 *   then `pageTitle` + ` | <site name>`, else the site name
 * - `pageTitle`, the page's own title without the site name: `seo.title` (`null`: none),
 *   else the page namespace's `title`. A page without its own namespace has only its
 *   `seo.title` (never the site defaults' title); the 404 document (no namespace, no site
 *   defaults) has none
 *
 * A page's label (llms.txt) is `pageTitle ?? title`: its own title, else its full title,
 * else the site name.
 *
 * @param input - Route metadata, the page's own namespace (null: none), the site defaults
 *   namespace (null on the 404 document), translation function, site name
 * @returns `title`, and `pageTitle` when the page has one
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function routeTitle(input: {
  meta: RouteSeoMeta;
  ns: string | null;
  defaultNs: string | null;
  t: TFunction;
  siteName: string;
}): { title: string; pageTitle?: string } {
  const { meta: routeMeta, ns, defaultNs, t, siteName } = input;
  const seo = routeMeta.seo;
  // 404 document (no namespace, no site defaults): the site name only
  if (!ns && !defaultNs) return { title: seo?.fullTitle || siteName };
  const pageTitle = ns
    ? resolveSeoField(seo?.title, `${ns}:title`, t)
    : (seo?.title ?? undefined);
  const fullTitle =
    seo?.fullTitle || (ns ? readI18nSeoMeta(t, ns).fullTitle : undefined);
  return {
    title: fullTitle || (pageTitle ? `${pageTitle} | ${siteName}` : siteName),
    ...(pageTitle && { pageTitle }),
  };
}

/**
 * Page identity of a route (PageMeta + i18n). Title ({@link routeTitle}) priority: `seo.fullTitle`, the page
 * namespace's `meta.fullTitle`, then `seo.title` or the namespace's `title`
 * (+ ` | <site name>`), the site name alone. Description: `seo.description`, else i18n
 * `description`. Image, type, keywords: `seo`, else i18n `meta`, else the defaults (image
 * absolute with an app URL).
 *
 * A page without its own namespace reads the site defaults (`defaultNs`,
 * `appConfig.seo.defaultNamespace`) for description, image, type, keywords and author,
 * never for its title: its title is its PageMeta `seo.fullTitle` / `seo.title`, else the
 * site name, so the home page's title never lands on another page.
 *
 * @param input - Route metadata, the page's own namespace (null: none), the site defaults
 *   namespace (null on the 404 document: `seo.fullTitle` or the site name only),
 *   translation function, site name, app URL (`''` when unset), canonical URL, default
 *   image (`appConfig.seo.defaultImage`), whether the route is auth-only
 * @returns The page identity
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function routeSeo(input: {
  meta: RouteSeoMeta;
  ns: string | null;
  defaultNs: string | null;
  t: TFunction;
  siteName: string;
  baseUrl: string;
  url: string | null;
  defaultImage: string | undefined;
  authOnly: boolean;
}): RouteSeo {
  const { meta: routeMeta, ns, defaultNs, t, siteName, baseUrl, url, defaultImage } = input;
  const seo = routeMeta.seo;
  // Text of the page: its own namespace, else the site defaults (never for the title)
  const textNs = ns ?? defaultNs;
  const metaObject = textNs ? readI18nSeoMeta(t, textNs) : null;

  const { title } = routeTitle({ meta: routeMeta, ns, defaultNs, t, siteName });

  const description = textNs
    ? resolveSeoField(seo?.description, `${textNs}:description`, t)
    : undefined;
  const image = seo?.image || metaObject?.image || defaultImage || undefined;
  const keywords = seo?.keywords || metaObject?.keywords;
  const author = routeMeta.author || metaObject?.author;

  return {
    title,
    ...(description && { description }),
    // Link-preview crawlers need an absolute URL
    ...(image && { image: image.startsWith('http') ? image : `${baseUrl}${image}` }),
    url,
    type: seo?.type || metaObject?.type || 'website',
    robots: robotsContent(seo?.noindex ?? routeMeta.noindex, input.authOnly),
    ...(keywords && { keywords }),
    ...(author && { author }),
    ...(routeMeta.publishDate && { publishDate: routeMeta.publishDate }),
    ...(routeMeta.modifiedDate && { modifiedDate: routeMeta.modifiedDate }),
  };
}

/**
 * Head tags of a route identity, in order: `<title>`, description, keywords, author,
 * robots, Open Graph (with image size and article dates), Twitter card, dns-prefetch of
 * an external image origin, WebPage / Article JSON-LD (pages with a URL).
 *
 * @param seo - Output of {@link routeSeo}
 * @param site - Site name and app URL (`''` when unset); the publisher logo is
 *   {@link SITE_LOGO_PATH}
 * @returns Tags
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function routeHeadTags(
  seo: RouteSeo,
  site: { siteName: string; baseUrl: string }
): HeadTag[] {
  const { title, description, image, type, keywords, author } = seo;
  const tags: HeadTag[] = [{ tag: 'title', attributes: {}, text: title }];
  if (description) tags.push(meta('name', 'description', description));
  if (keywords) tags.push(meta('name', 'keywords', keywords.join(', ')));
  if (author) tags.push(meta('name', 'author', author));
  if (seo.robots) tags.push(meta('name', 'robots', seo.robots));

  tags.push(meta('property', 'og:title', title));
  if (description) tags.push(meta('property', 'og:description', description));
  tags.push(meta('property', 'og:type', type));
  if (image) {
    tags.push(meta('property', 'og:image', image));
    tags.push(meta('property', 'og:image:width', '1200'));
    tags.push(meta('property', 'og:image:height', '630'));
  }
  if (type === 'article') {
    if (author) tags.push(meta('property', 'article:author', author));
    if (seo.publishDate) tags.push(meta('property', 'article:published_time', seo.publishDate));
    if (seo.modifiedDate) tags.push(meta('property', 'article:modified_time', seo.modifiedDate));
  }

  tags.push(meta('name', 'twitter:card', 'summary_large_image'));
  tags.push(meta('name', 'twitter:title', title));
  if (description) tags.push(meta('name', 'twitter:description', description));
  if (image) tags.push(meta('name', 'twitter:image', image));
  if (author) tags.push(meta('name', 'twitter:creator', author));

  if (image?.startsWith('http')) {
    tags.push({ tag: 'link', attributes: { rel: 'dns-prefetch', href: new URL(image).origin } });
  }

  if (seo.url) {
    tags.push(
      jsonLdTag({
        '@context': 'https://schema.org',
        '@type': type === 'article' ? 'Article' : 'WebPage',
        name: title,
        ...(description && { description }),
        url: seo.url,
        ...(image && { image }),
        ...(type === 'article' && {
          ...(author && { author: { '@type': 'Person', name: author } }),
          ...(seo.publishDate && { datePublished: seo.publishDate }),
          ...(seo.modifiedDate && { dateModified: seo.modifiedDate }),
        }),
        publisher: {
          '@type': 'Organization',
          name: site.siteName,
          logo: {
            '@type': 'ImageObject',
            // Absolute: schema.org consumers (Google) ignore a relative logo URL
            url: `${site.baseUrl}${SITE_LOGO_PATH}`,
          },
        },
      })
    );
  }
  return tags;
}

/**
 * Favicon files of a site, one path per slot ({@link resolveFaviconFiles}).
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FaviconSet {
  svg?: string;
  ico?: string;
  png16?: string;
  png32?: string;
  apple180?: string;
  android192?: string;
  android512?: string;
}

/**
 * Favicon config defaults (`appConfig.favicon`), applied under the app's own values by
 * AppConfigProvider at runtime and by the Vite build ({@link faviconHeadTags} input).
 * `appName` defaults to the app name, set by each of them.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export const FAVICON_DEFAULTS: Readonly<Omit<FaviconConfig, 'appName'>> = {
  enabled: true,
  themeColor: '#2563eb',
  backgroundColor: '#ffffff',
  includeManifestIcons: true,
  includeMSIcons: false,
};

/**
 * Favicon set of a site from the files it serves: each slot holds its own file
 * (`/favicon.svg`, `/favicon.ico`, `/favicon-16x16.png`, `/favicon-32x32.png`,
 * `/apple-touch-icon.png`, `/icon-192x192.png`, `/icon-512x512.png`; the build generates
 * all but the 16 and 32 px PNGs from `public/logo.svg`) only when the site serves it. A
 * missing file leaves its slot empty: another file would be declared with a size or type
 * it does not have. The same `exists` answers give the same set, so the Next server
 * render, the browser and the Vite build write the same tags.
 *
 * @param exists - Whether the site serves a path (`/favicon.svg`): the asset manifest
 *   (`AssetResolver.assetExists`) at runtime, the app's `public/` in the Vite build
 * @returns The favicon set: the slots whose file exists
 *
 * @version 0.2.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function resolveFaviconFiles(exists: (path: string) => boolean): FaviconSet {
  const file = (path: string) => (exists(path) ? path : undefined);
  return {
    svg: file('/favicon.svg'),
    ico: file('/favicon.ico'),
    png16: file('/favicon-16x16.png'),
    png32: file('/favicon-32x32.png'),
    apple180: file('/apple-touch-icon.png'),
    android192: file('/icon-192x192.png'),
    android512: file('/icon-512x512.png'),
  };
}

const icon = (href: string, type: string, sizes?: string): HeadTag => ({
  tag: 'link',
  attributes: { rel: 'icon', type, ...(sizes && { sizes }), href },
});

/**
 * Favicon head tags of a site, in order: SVG, ICO, 16 and 32 px PNG icons, the
 * apple-touch-icon (180 px) with `apple-mobile-web-app-title` (with an `appName`), the
 * 192 and 512 px icons (`includeManifestIcons`), the Microsoft tile metas
 * (`includeMSIcons`, with a 32 px icon: `msapplication-TileImage`, and
 * `msapplication-TileColor` with a `themeColor`), `theme-color` (with a `themeColor`) and
 * `color-scheme: light dark`. Slots without a file emit no tag; `enabled: false` emits
 * none. The one emitter of these tags: FaviconHead (Next, server HTML) and the Vite build
 * (`index.html`).
 *
 * @param set - Favicon files ({@link resolveFaviconFiles})
 * @param config - `appConfig.favicon` over {@link FAVICON_DEFAULTS} (`appConfig.favicon:
 *   false` renders no tag: the caller skips it)
 * @returns Tags (none with `enabled: false`)
 *
 * @version 0.2.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function faviconHeadTags(set: FaviconSet, config: FaviconConfig): HeadTag[] {
  const { enabled, appName, themeColor, includeManifestIcons, includeMSIcons } = config;
  if (enabled === false) return [];
  const tags: HeadTag[] = [];
  if (set.svg) tags.push(icon(set.svg, 'image/svg+xml'));
  if (set.ico) tags.push(icon(set.ico, 'image/x-icon'));
  if (set.png16) tags.push(icon(set.png16, 'image/png', '16x16'));
  if (set.png32) tags.push(icon(set.png32, 'image/png', '32x32'));
  if (set.apple180) {
    tags.push({
      tag: 'link',
      attributes: { rel: 'apple-touch-icon', sizes: '180x180', href: set.apple180 },
    });
    if (appName) tags.push(meta('name', 'apple-mobile-web-app-title', appName));
  }
  if (includeManifestIcons) {
    if (set.android192) tags.push(icon(set.android192, 'image/png', '192x192'));
    if (set.android512) tags.push(icon(set.android512, 'image/png', '512x512'));
  }
  if (includeMSIcons && set.png32) {
    tags.push(meta('name', 'msapplication-TileImage', set.png32));
    if (themeColor) tags.push(meta('name', 'msapplication-TileColor', themeColor));
  }
  if (themeColor) tags.push(meta('name', 'theme-color', themeColor));
  tags.push(meta('name', 'color-scheme', 'light dark'));
  return tags;
}

/**
 * Key of the framework's inline `@font-face` style (the app's font plan, built at build
 * time by `@donotdev/core` config `fonts/buildFontPlan.js`): the `id` of the `<style>` the
 * Vite build writes into `index.html` and every prerendered page, the `href` / `precedence`
 * React hoists and dedupes on Next (`FontHead`). One style per document.
 *
 * @version 0.1.0
 * @since 0.3.3
 * @author AMBROISE PARK Consulting
 */
export const FONT_STYLE_ID = 'dndev-fonts';

/**
 * Preload tags of a page's first-paint font files (the font plan's `preloads` for the
 * page language), in order: `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
 * `crossorigin` is required even same-origin: fonts are fetched in CORS mode, a preload
 * without it is not reused. The Vite build writes them into `<head>` before the
 * stylesheet; Next renders the same preloads through React's `preload()` (`FontHead`).
 *
 * @param hrefs - Font file URLs (`/fonts/inter-latin-400-normal.1a2b3c4d.woff2`)
 * @returns Tags, one per href
 *
 * @version 0.1.0
 * @since 0.3.3
 * @author AMBROISE PARK Consulting
 */
export function fontPreloadHeadTags(hrefs: readonly string[]): HeadTag[] {
  return hrefs.map((href) => ({
    tag: 'link',
    attributes: {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href,
      crossorigin: 'anonymous',
    },
  }));
}
