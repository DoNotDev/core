/**
 * @fileoverview llms.txt Generator
 * @description llms.txt (llmstxt.org) from the same routes as the sitemap
 * (SEOGenerator.getSitemapRoutes), labelled in the app's language. Next serves it from
 * a generated route (records expanded at request time); Vite writes it at build.
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import { formatLlmsTxt } from './llmsTxtFormat.js';
import { PathResolver } from './PathResolver.js';

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
 * Label and description of a page in the app's language, from what the page itself
 * declares: its i18n namespace (`title`, `description`, `meta.fullTitle`) and its
 * PageMeta `seo` (written in the app's language). The discovered `meta.title` is
 * derived from the file name (English) and is never used.
 *
 * @param {Object} route - Discovered route (Next: `metaExport`; Vite manifest: `meta`)
 * @param {Record<string, Record<string, Object>>} translations - i18n discovery `content`
 * @param {string} language - App default language
 * @returns {{ title?: string, description?: string }}
 */
export function resolvePageText(route, translations, language) {
  const meta = route.metaExport || route.meta || {};
  const seo = meta.seo || {};
  const translation = translationOf(translations, meta.namespace, language);
  const title =
    text(translation?.title) ??
    text(seo.title) ??
    text(translation?.meta?.fullTitle) ??
    text(seo.fullTitle);
  const description =
    seo.description === null
      ? undefined
      : (text(seo.description) ?? text(translation?.description));
  return {
    ...(title && { title }),
    ...(description && { description }),
  };
}

/**
 * Source of the app's llms.txt: the sitemap's routes with their labels in the app's
 * language. Serialized into the Next llms.txt route (records expanded at request time
 * by `buildLlmsTxt` from @donotdev/core/next/seo) and formatted at build by Vite.
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
 * @returns {{ name: string, summary?: string, baseUrl: string, pagesHeading: string, routes: Array, entityHeadings: Record<string, string>, language: string, translations: Record<string, Object> }}
 *   `translations`: entity namespaces and `crud` in `language` (record text, formatted like the card)
 * @throws {Error} When a static page or a framework label has no text in the app language
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
  } = options;

  const labels = translationOf(translations, FRAMEWORK_NAMESPACE, language)?.seo;
  const pagesHeading = text(labels?.llmsPages);
  const blogHeading = text(labels?.llmsBlog);
  if (!pagesHeading || !blogHeading) {
    throw new Error(
      `[dndev] llms.txt: framework labels seo.llmsPages / seo.llmsBlog missing for language "${language}".`
    );
  }

  const routeByPath = new Map(routes.map((route) => [route.path, route]));
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
    const page = pageText(path);
    if (path === blogPath && !page.title) return { path, ...page, title: blogHeading };
    if (!page.title) {
      const route = routeByPath.get(path);
      const namespace = (route?.metaExport || route?.meta)?.namespace;
      throw new Error(
        `[dndev] llms.txt: page "${path}" has no title in "${language}". Add "title" to ` +
          (namespace ? `${namespace}_${language}.json` : 'its translations') +
          ' or `seo: { title }` to its PageMeta.'
      );
    }
    return { path, ...page };
  });

  function pageText(path) {
    const route = routeByPath.get(path);
    return route ? resolvePageText(route, translations, language) : {};
  }

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
 * Static llms.txt (Vite build): the static pages of the source, which is exactly the
 * Vite sitemap's URL set (no runtime to expand entity records).
 *
 * @param {ReturnType<typeof getLlmsTxtSource>} source
 * @returns {string} llms.txt text
 */
export function generateStaticLlmsTxt(source) {
  const sections = new Map([[source.pagesHeading, []]]);
  for (const route of source.routes) {
    if (route.collection || route.path.includes(':')) continue;
    const heading = route.section ?? source.pagesHeading;
    if (!sections.has(heading)) sections.set(heading, []);
    sections.get(heading).push({
      title: route.title,
      url: `${source.baseUrl}${route.path}`,
      ...(route.description && { description: route.description }),
    });
  }
  return formatLlmsTxt({
    name: source.name,
    ...(source.summary && { summary: source.summary }),
    sections: [...sections].map(([heading, links]) => ({ heading, links })),
  });
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
