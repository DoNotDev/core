/**
 * @fileoverview llms.txt Generator
 * @description llms.txt (llmstxt.org) from the same routes as the sitemap
 * (SEOGenerator.getSitemapRoutes), labelled in the app's language. Next serves it from
 * a generated route (records expanded at request time); Vite writes it at build with the
 * records (`buildLlmsTxt`, vite/buildPages.js).
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { routeTitle } from './headTags.js';
import { PathResolver } from './PathResolver.js';
import { translationT } from './translationT.js';

/** Framework namespace holding the llms.txt section labels (`seo.llmsPages`, `seo.llmsBlog`). */
const FRAMEWORK_NAMESPACE = 'dndev';

/** CRUD namespace (field type labels: price, duration, status defaults). */
const CRUD_NAMESPACE = 'crud';

/** Prefix of entity translation namespaces (defineEntity: `entity-<name>`). */
const ENTITY_NAMESPACE_PREFIX = 'entity-';

/**
 * Translation object of a namespace in a language.
 * @param {Record<string, Record<string, Object>>} translations - i18n discovery `content` (namespace → language → JSON)
 * @param {string|undefined} namespace
 * @param {string} language
 * @returns {Object|undefined}
 */
function translationOf(translations, namespace, language) {
  return namespace ? translations?.[namespace]?.[language] : undefined;
}

/** A non-empty trimmed string, or undefined. */
function text(value) {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

/**
 * PageMeta of a route as discovery holds it (Next: `metaExport`; Vite manifest: `meta`).
 * @param {Object | undefined} route
 * @returns {Object}
 */
function pageMeta(route) {
  return route?.metaExport || route?.meta || {};
}

/**
 * Label of a page in the app's language: its own title without the site name, by the
 * chain of its `<title>` (`routeTitle` of core `headTags.ts`, the one AutoMetaTags, the
 * Vite prerender and the Next metadata manifest apply): `seo.title` (`null`: none), else
 * the namespace's `title` (a page without its own namespace: its `seo.title` only); without
 * one, its full title (`seo.fullTitle`, the namespace's `meta.fullTitle`), else the site
 * name. Never empty. The discovered `meta.title` is derived from the file name (English)
 * and is never used.
 *
 * @param {Object | undefined} route - Discovered route (none: the site name)
 * @param {Object} site
 * @param {string} site.siteName - Site name
 * @param {string} site.defaultNamespace - `appConfig.seo.defaultNamespace` (`home`)
 * @param {(key: string, options?: { defaultValue?: string }) => string} site.t - `t` over the translations in the app's language
 * @returns {string}
 * @since 0.3.2
 */
export function resolvePageTitle(route, { siteName, defaultNamespace, t }) {
  const meta = pageMeta(route);
  const { title, pageTitle } = routeTitle({
    meta,
    ns: meta.namespace || null,
    defaultNs: defaultNamespace,
    t,
    siteName,
  });
  return pageTitle ?? title;
}

/**
 * Description of a page in the app's language, from what the page itself declares: its
 * PageMeta `seo.description` (written in the app's language; `null`: none), else its i18n
 * namespace's `description`.
 *
 * @param {Object | undefined} route - Discovered route (Next: `metaExport`; Vite manifest: `meta`)
 * @param {Record<string, Record<string, Object>>} translations - i18n discovery `content`
 * @param {string} language - App default language
 * @returns {string | undefined}
 */
export function resolvePageDescription(route, translations, language) {
  const meta = pageMeta(route);
  const seo = meta.seo || {};
  if (seo.description === null) return undefined;
  const translation = translationOf(translations, meta.namespace, language);
  return text(seo.description) ?? text(translation?.description);
}

/**
 * Source of the app's llms.txt: the sitemap's routes with their labels in the app's
 * language. Serialized into the Next llms.txt route (records expanded at request time
 * by `buildLlmsTxt`, utils/llmsTxt.js) and built at build by Vite with the same function.
 *
 * @param {Object} options
 * @param {string} options.siteName - appConfig.app.name
 * @param {string} [options.description] - appConfig.app.description
 * @param {string} options.baseUrl - Absolute production URL, no trailing slash
 * @param {Array<{path: string, collection?: string}>} options.sitemapRoutes - SEOGenerator.getSitemapRoutes() output
 * @param {Array} options.routes - Discovered routes (labels, by path)
 * @param {Array} [options.blogPosts] - Discovered blog posts
 * @param {string} [options.blogPath='/blog']
 * @param {Record<string, Record<string, Object>>} options.translations - i18n discovery `content`
 * @param {string} options.language - App default language
 * @param {string} options.defaultNamespace - `appConfig.seo.defaultNamespace` (`home`): the
 *   site defaults a page without its own namespace reads ({@link resolvePageTitle})
 * @returns {{ name: string, summary?: string, baseUrl: string, pagesHeading: string, routes: Array, entityHeadings: Record<string, string>, language: string, translations: Record<string, Object> }}
 *   `translations`: entity namespaces and `crud` in `language` (record text, formatted like the card)
 * @throws {Error} When a framework label has no text in the app language, or without
 *   `defaultNamespace`
 */
export function getLlmsTxtSource(options) {
  const {
    siteName,
    description,
    baseUrl,
    sitemapRoutes,
    routes,
    blogPosts = [],
    blogPath = '/blog',
    translations,
    language,
    defaultNamespace,
  } = options;

  const labels = translationOf(translations, FRAMEWORK_NAMESPACE, language)?.seo;
  const pagesHeading = text(labels?.llmsPages);
  const blogHeading = text(labels?.llmsBlog);
  if (!pagesHeading || !blogHeading) {
    throw new Error(
      `[dndev] llms.txt: framework labels seo.llmsPages / seo.llmsBlog missing for language "${language}".`
    );
  }

  if (!defaultNamespace) {
    throw new Error(
      '[dndev] llms.txt: getLlmsTxtSource needs options.defaultNamespace (appConfig.seo.defaultNamespace, else "home").'
    );
  }

  const routeByPath = new Map(routes.map((route) => [route.path, route]));
  const site = {
    siteName,
    defaultNamespace,
    t: translationT(
      Object.fromEntries(
        Object.entries(translations || {}).map(([namespace, byLanguage]) => [
          namespace,
          byLanguage?.[language],
        ])
      )
    ),
  };
  const postByPath = new Map(
    blogPosts.map((post) => [`${blogPath}/${post.slug}`, post])
  );

  const llmsRoutes = sitemapRoutes.map(({ path, collection }) => {
    const post = postByPath.get(path);
    if (post) {
      return {
        path,
        title: post.title,
        ...(text(post.description) && { description: text(post.description) }),
        section: blogHeading,
      };
    }
    if (collection) return { path, collection };
    const route = routeByPath.get(path);
    // The blog index the posts imply, without a page of its own: the blog heading
    if (!route && path === blogPath) return { path, title: blogHeading };
    const pageDescription = resolvePageDescription(route, translations, language);
    return {
      path,
      title: resolvePageTitle(route, site),
      ...(pageDescription && { description: pageDescription }),
    };
  });

  const entityHeadings = {};
  // Record titles/descriptions are formatted like the CRUD card: entity namespaces + crud
  const entityTranslations = {};
  for (const [namespace, byLanguage] of Object.entries(translations || {})) {
    if (namespace === CRUD_NAMESPACE && byLanguage?.[language]) {
      entityTranslations[namespace] = byLanguage[language];
    }
    if (!namespace.startsWith(ENTITY_NAMESPACE_PREFIX)) continue;
    if (byLanguage?.[language]) entityTranslations[namespace] = byLanguage[language];
    const plural = text(byLanguage?.[language]?.namePlural);
    if (plural) entityHeadings[namespace] = plural;
  }

  return {
    name: siteName,
    ...(text(description) && { summary: text(description) }),
    baseUrl,
    pagesHeading,
    routes: llmsRoutes,
    entityHeadings,
    language,
    translations: entityTranslations,
  };
}

/**
 * Generate llms-full.txt — full content dump for LLM consumption
 * Concatenates blog post markdown content for direct AI ingestion
 * @param {Object} options
 * @param {string} options.siteName - Site/app name
 * @param {string} options.baseUrl - Base URL
 * @param {string} [options.description] - Site description
 * @param {Array} [options.blogPosts] - Blog posts with content
 * @param {string} [options.appRoot] - App root for reading blog files
 * @param {Object} [options.logger] - Logger instance
 * @returns {string|null} llms-full.txt content
 */
export function generateLlmsFullTxt(options = {}) {
  const {
    siteName,
    baseUrl,
    blogPosts = [],
    blogPath = '/blog',
    appRoot,
    logger,
  } = options;

  if (!siteName || !baseUrl) {
    return null;
  }

  if (blogPosts.length === 0) {
    logger?.debug?.('llms-full.txt skipped: no blog posts');
    return null;
  }

  const pathResolver = PathResolver.getInstance();
  const blogDir = appRoot
    ? pathResolver.resolvePath('src/content/blog', appRoot)
    : null;

  if (!blogDir || !pathResolver.pathExists(blogDir)) {
    return null;
  }

  const sections = [`# ${siteName}\n`];

  if (options.description) {
    sections.push(`> ${options.description}\n`);
  }

  for (const post of blogPosts) {
    const filePath = pathResolver.resolvePath(`${post.slug}_en.md`, blogDir);
    try {
      const raw = pathResolver.readSync(filePath, { format: 'text' });
      if (!raw) continue;

      // Strip frontmatter, keep content
      const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
      const url = `${baseUrl}${blogPath}/${post.slug}`;

      sections.push(`## ${post.title}\n`);
      sections.push(`Source: ${url}\n`);
      if (post.date) sections.push(`Date: ${post.date}\n`);
      sections.push(content.trim());
      sections.push('');
    } catch {
      logger?.debug?.(`llms-full.txt: could not read ${post.slug}`);
    }
  }

  return sections.join('\n');
}
