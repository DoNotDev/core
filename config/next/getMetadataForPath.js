/**
 * @fileoverview Server-side metadata utility for Next.js
 * @description Reads pre-built metadata manifest for SEO. Use in root layout's generateMetadata().
 *
 * @example Root layout usage
 * ```tsx
 * // app/layout.tsx
 * import { getMetadataForPath } from '@donotdev/core/next';
 *
 * export async function generateMetadata() {
 *   return getMetadataForPath('/');
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Cache the manifest to avoid repeated file reads
let manifestCache = null;
let manifestCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load metadata manifest from public directory
 * @returns {Object|null}
 */
function loadManifest() {
  const now = Date.now();

  if (manifestCache && now - manifestCacheTime < CACHE_TTL) {
    return manifestCache;
  }

  try {
    const manifestPath = join(
      process.cwd(),
      'public',
      'metadata-manifest.json'
    );

    if (!existsSync(manifestPath)) {
      return null;
    }

    const content = readFileSync(manifestPath, 'utf-8');
    manifestCache = JSON.parse(content);
    manifestCacheTime = now;

    return manifestCache;
  } catch {
    return null;
  }
}

/**
 * Get Next.js Metadata object for a given path
 *
 * @param {string} path - Route path (e.g., '/', '/about')
 * @param {string} [locale] - Current locale (defaults to manifest's defaultLocale)
 * @param {Object} [options] - Additional options
 * @param {string} [options.siteName] - Site name for OpenGraph
 * @returns {Object} Next.js Metadata object
 */
export function getMetadataForPath(path, locale, options) {
  const manifest = loadManifest();

  const defaultMeta = {
    title: options?.siteName || 'Site',
  };

  if (!manifest) {
    return defaultMeta;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const routeMetadata = manifest[normalizedPath];

  if (!routeMetadata) {
    return defaultMeta;
  }

  const effectiveLocale = locale || routeMetadata.defaultLocale || 'en';
  const localeMetadata =
    routeMetadata.locales[effectiveLocale] ||
    routeMetadata.locales[routeMetadata.defaultLocale] ||
    Object.values(routeMetadata.locales)[0];

  if (!localeMetadata) {
    return defaultMeta;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const metadata = {
    title: localeMetadata.title,
    ...(appUrl && { metadataBase: new URL(appUrl) }),
  };

  if (localeMetadata.description) {
    metadata.description = localeMetadata.description;
  }

  if (localeMetadata.keywords) {
    metadata.keywords = localeMetadata.keywords;
  }

  metadata.openGraph = {
    title: localeMetadata.title,
    type: localeMetadata.type || 'website',
    ...(localeMetadata.description && {
      description: localeMetadata.description,
    }),
    ...(localeMetadata.image && { images: [localeMetadata.image] }),
    ...(options?.siteName && { siteName: options.siteName }),
  };

  metadata.twitter = {
    card: 'summary_large_image',
    title: localeMetadata.title,
    ...(localeMetadata.description && {
      description: localeMetadata.description,
    }),
    ...(localeMetadata.image && { images: [localeMetadata.image] }),
  };

  if (localeMetadata.noindex) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

/**
 * Clear the metadata manifest cache
 */
export function clearMetadataCache() {
  manifestCache = null;
  manifestCacheTime = 0;
}
