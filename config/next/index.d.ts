// packages/core/config/next/index.d.ts

/**
 * @fileoverview Next.js Configuration Type Definitions
 * @description TypeScript type definitions for Next.js configuration.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export only the function signature and types, not all types (avoids circular dependency)
export type { NextConfigOptions } from '../index.js';
export { defineNextConfig } from '../index.js';

/**
 * Create PostCSS configuration for Next.js consumer apps.
 * Handles @fontsource CSS alias and workspace-aware package resolution.
 *
 * @example
 * ```js
 * // postcss.config.js
 * import { definePostCSSConfig } from '@donotdev/core/next';
 * export default definePostCSSConfig();
 * ```
 */
export function definePostCSSConfig(): Promise<{ plugins: Array<unknown> }>;

/**
 * Next.js Metadata object (simplified)
 */
interface NextMetadata {
  title?: string;
  description?: string;
  keywords?: string | string[];
  openGraph?: {
    title?: string;
    description?: string;
    type?: string;
    images?: string[];
    siteName?: string;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    title?: string;
    description?: string;
    images?: string[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
  };
}

/**
 * Get Next.js Metadata object for a given path.
 * Reads pre-built metadata from manifest generated at build time.
 *
 * @example
 * ```tsx
 * // app/layout.next.tsx
 * import { getMetadataForPath } from '@donotdev/core/next';
 *
 * export async function generateMetadata() {
 *   return getMetadataForPath('/');
 * }
 * ```
 *
 * @param path - Route path (e.g., '/', '/about')
 * @param locale - Current locale (defaults to manifest's defaultLocale)
 * @param options - Additional options
 */
export function getMetadataForPath(
  path: string,
  locale?: string,
  options?: { siteName?: string }
): NextMetadata;

/**
 * Clear the metadata manifest cache.
 * Useful for development hot-reload scenarios.
 */
export function clearMetadataCache(): void;

// ---------------------------------------------------------------------------
// Sitemap / llms.txt (server runtime of the generated route handlers)
// ---------------------------------------------------------------------------

import type {
  AnyEntity,
  EntitySeo,
  EntitySeoOptions,
  EntitySeoRecord,
  ICrudAdapter,
  LanguageRouting,
  languageUrls,
} from '@donotdev/core/server';

/** One public route, as written by the build into a generated SEO route. */
export interface PublicRoute {
  /** Route path in React Router syntax (`/produits/:slug`) */
  path: string;
  /** Collection whose published records fill the `:param` segment. Required for dynamic routes. */
  collection?: string;
}

/** One public route of the sitemap. */
export interface SitemapRoute extends PublicRoute {
  /** Pre-computed lastmod (blog posts), ISO date */
  lastModified?: string;
  /** 0.0–1.0 */
  priority?: number;
  changeFrequency?: SitemapEntry['changeFrequency'];
}

/** Sitemap entry. */
export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  /** URL of the same page in every language (2+ languages) */
  alternates?: { languages: Record<string, string> };
}

/** What the generated sitemap route passes besides its routes. */
export interface SitemapContext {
  /** Absolute production URL, no trailing slash */
  baseUrl: string;
  /** App languages (one language: one URL per page, no alternates) */
  routing: LanguageRouting;
  /** Public (anonymous) CRUD reader; required when a route lists records (`collection`) */
  crud?: ICrudAdapter;
  /** `languageUrls` from @donotdev/core/server */
  languageUrls: typeof languageUrls;
  /** `HIDDEN_STATUSES` from @donotdev/core/server: records with these statuses are not listed */
  hiddenStatuses: readonly string[];
}

/**
 * Build the sitemap entries: static routes, plus one URL per published record of each
 * single-param route's collection; with 2+ languages once per language URL, with alternates.
 *
 * @throws When a dynamic route has no collection or several params, or the read fails
 */
export function buildSitemap(
  routes: readonly SitemapRoute[],
  context: SitemapContext
): Promise<SitemapEntry[]>;

/**
 * Base URL of the generated sitemap / llms.txt routes, resolved at request time:
 * `appBaseUrl(process.env.NEXT_PUBLIC_APP_URL)`. Trimmed, no trailing slash, `https://`
 * added when the value has no scheme.
 *
 * @throws When the URL is unset
 * @since 0.3.1
 */
export function appBaseUrl(raw: string | undefined): string;

/** Serialize sitemap entries to sitemap.xml (with hreflang alternates). */
export function formatSitemapXml(entries: readonly SitemapEntry[]): string;

/** One public route of llms.txt, as written by the build. */
export interface LlmsTxtRoute extends PublicRoute {
  /** Page label in the app's language (static routes; a dynamic route uses each record's title) */
  title?: string;
  /** Page description in the app's language (static routes) */
  description?: string;
  /** Section heading (static default: the pages heading; dynamic default: the entity's plural name) */
  section?: string;
}

/** Build-written part of llms.txt. */
export interface LlmsTxtSource {
  /** Site name (appConfig.app.name) */
  name: string;
  /** Site summary (appConfig.app.description) */
  summary?: string;
  /** Absolute production URL, no trailing slash */
  baseUrl: string;
  /** Heading of the static pages section, in the app's language */
  pagesHeading: string;
  /** Same routes as the sitemap, in sitemap order */
  routes: readonly LlmsTxtRoute[];
  /** Entity i18n namespace (`entity-product`) → plural name in the app's language */
  entityHeadings: Readonly<Record<string, string>>;
  /** App default language: record titles/descriptions are formatted in it */
  language: string;
  /** Entity namespaces and `crud` in `language` (namespace → translation JSON) */
  translations: Readonly<Record<string, Record<string, unknown>>>;
}

/** What the generated llms.txt route passes besides the build-written source. */
export interface LlmsTxtContext {
  /** The app's entity definitions (`import * as entities from 'entities'`) */
  entities: Readonly<Record<string, unknown>>;
  /** Public (anonymous) CRUD reader; required when a route lists records (`collection`) */
  crud?: ICrudAdapter;
  /** `deriveEntitySeo` from @donotdev/core/server */
  deriveEntitySeo: (
    entity: AnyEntity,
    data: EntitySeoRecord,
    options: EntitySeoOptions
  ) => EntitySeo;
  /** `HIDDEN_STATUSES` from @donotdev/core/server: records with these statuses are not listed */
  hiddenStatuses: readonly string[];
}

/**
 * Build the app's llms.txt: the sitemap's pages, static ones under the pages heading,
 * entity records under their entity's plural name with their `deriveEntitySeo` title.
 *
 * @throws When a static route has no label, a collection has no entity definition or
 *   heading, a published record has no title, or the read fails
 */
export function buildLlmsTxt(
  source: LlmsTxtSource & LlmsTxtContext
): Promise<string>;

/**
 * `generateStaticParams` of a generated entity page (`/produits/:slug`): one params object
 * per public record of the route's collection (`status` not in `hiddenStatuses`), the same
 * records as the route's sitemap and llms.txt URLs. Values are raw (Next encodes them).
 *
 * @throws When the route has no collection or several params, or the read fails
 * @since 0.3.1
 */
export function listStaticParams(
  route: PublicRoute,
  crud: ICrudAdapter,
  hiddenStatuses: readonly string[]
): Promise<Array<Record<string, string>>>;

// ---------------------------------------------------------------------------
// On-demand revalidation (server runtime of the generated revalidate route handler)
// ---------------------------------------------------------------------------

/**
 * A changed database record, as a webhook reader returns it: table name and rows with
 * app field names (`readDatabaseWebhook` from @donotdev/supabase/server).
 *
 * @since 0.3.2
 */
export interface RecordChange {
  /** Postgres schema of the table: only `public` is revalidated (400 otherwise) */
  schema: string;
  /** Table (collection) of the record */
  table: string;
  /** Row after the change (`null` on delete) */
  record: Readonly<Record<string, unknown>> | null;
  /** Row before the change (`null` on insert) */
  oldRecord: Readonly<Record<string, unknown>> | null;
}

/** What the generated revalidation route passes to {@link handleRevalidationWebhook}. */
export interface RevalidationContext {
  /** Shared secret (`process.env.DNDEV_REVALIDATE_SECRET`, 32+ characters); unset or shorter throws */
  secret: string | undefined;
  /** Cached routes: static ones, and entity routes with their `collection` */
  routes: readonly PublicRoute[];
  /** App languages */
  routing: LanguageRouting;
  /** Webhook body → change; throws on a body it does not accept (answered 400) */
  readChange: (body: unknown) => RecordChange;
  /** `revalidatePath` from `next/cache` */
  revalidatePath: (path: string) => void;
}

/** Env variable of the revalidation webhook's shared secret: `DNDEV_REVALIDATE_SECRET`. */
export const REVALIDATE_SECRET_ENV: 'DNDEV_REVALIDATE_SECRET';

/** URL of the generated revalidation route handler: `/api/dndev/revalidate`. */
export const REVALIDATE_ROUTE_PATH: '/api/dndev/revalidate';

/**
 * Cached paths a record change makes stale: the entity pages of the new and old row (every
 * language, internal `/<lang>/…` paths with 2+ languages), every static route (any may
 * list the table), and `/sitemap.xml` + `/llms.txt` when an entity route uses the table.
 * Other dynamic routes and cross-entity pages refresh on their `revalidate` timer. Param
 * values are written in Next's cache-tag form: raw, except `/ # ? \` percent-encoded.
 *
 * @since 0.3.2
 */
export function revalidationPaths(
  routes: readonly PublicRoute[],
  change: RecordChange,
  routing: LanguageRouting
): string[];

/**
 * Handle a database webhook call: `Authorization: Bearer <secret>` checked in constant
 * time (401 otherwise), body read by `readChange` (400 when refused or the table is not in
 * the `public` schema), then `revalidatePath` on every {@link revalidationPaths} path;
 * answers `{ revalidated: string[] }`.
 *
 * @throws When the secret is unset or shorter than 32 characters (no default secret)
 * @since 0.3.2
 */
export function handleRevalidationWebhook(
  request: Request,
  context: RevalidationContext
): Promise<Response>;
