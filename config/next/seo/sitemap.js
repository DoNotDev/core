/**
 * @fileoverview Sitemap (Next runtime)
 * @description Builds the sitemap of the generated `app/sitemap.xml` route handler from
 * the app's public pages ({@link listPublicPages}): dynamic routes expand to one URL per
 * published record, so the sitemap never lists a record a visitor could not open. With
 * 2+ languages every page is listed once per language URL (`/x`, `/en/x`), each entry
 * carrying the alternates of all languages (hreflang). Runs at request time, server only.
 *
 * @version 0.3.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import { listPublicPages } from './publicPages.js';

/** Escape a value for XML text. */
function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build sitemap entries.
 *
 * - static routes: one entry each (root priority 1, others 0.8)
 * - single-param routes with a collection: one entry per published record, lastModified
 *   from `updatedAt` (priority 0.7)
 * - 2+ languages: each of those once per language URL, with `alternates.languages`
 *
 * @param {readonly import('../index.js').SitemapRoute[]} routes - Public routes, as written by the build
 * @param {import('../index.js').SitemapContext} context - Base URL, languages and the shared helpers
 * @returns {Promise<import('../index.js').SitemapEntry[]>}
 * @throws {Error} When a dynamic route has no collection or several params, or the read fails
 *
 * @example
 * await buildSitemap(ROUTES, { baseUrl, routing, crud, languageUrls, hiddenStatuses });
 */
export async function buildSitemap(
  routes,
  { baseUrl, routing, crud, languageUrls, hiddenStatuses }
) {
  const entries = [];
  /** One entry per language URL of an app path (one entry, no alternates, with one language). */
  const push = (path, entry) => {
    const languages = languageUrls(path, baseUrl, routing);
    const alternates =
      routing.languages.length > 1 ? { alternates: { languages } } : {};
    for (const language of routing.languages) {
      entries.push({ url: languages[language], ...entry, ...alternates });
    }
  };

  for (const { route, path, record } of await listPublicPages(routes, crud, hiddenStatuses)) {
    if (!record) {
      push(path, {
        changeFrequency: route.changeFrequency ?? 'weekly',
        priority: route.priority ?? (path === '/' ? 1 : 0.8),
        ...(route.lastModified && { lastModified: route.lastModified }),
      });
      continue;
    }
    const updatedAt =
      record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : record.updatedAt;
    push(path, {
      changeFrequency: route.changeFrequency ?? 'weekly',
      priority: route.priority ?? 0.7,
      ...(typeof updatedAt === 'string' && { lastModified: updatedAt }),
    });
  }

  return entries;
}

/**
 * Serialize sitemap entries to sitemap.xml (sitemaps.org 0.9), with one
 * `<xhtml:link rel="alternate" hreflang>` per language when an entry has alternates.
 *
 * @param {readonly import('../index.js').SitemapEntry[]} entries - Output of {@link buildSitemap}
 * @returns {string} sitemap.xml text
 */
export function formatSitemapXml(entries) {
  const hasAlternates = entries.some((entry) => entry.alternates);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${
      hasAlternates ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''
    }>`,
  ];
  for (const entry of entries) {
    lines.push('  <url>', `    <loc>${xmlEscape(entry.url)}</loc>`);
    for (const [language, url] of Object.entries(
      entry.alternates?.languages ?? {}
    )) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${xmlEscape(language)}" href="${xmlEscape(url)}" />`
      );
    }
    if (entry.lastModified) {
      lines.push(`    <lastmod>${xmlEscape(entry.lastModified)}</lastmod>`);
    }
    if (entry.changeFrequency) {
      lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    }
    if (entry.priority !== undefined) {
      lines.push(`    <priority>${entry.priority}</priority>`);
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}
