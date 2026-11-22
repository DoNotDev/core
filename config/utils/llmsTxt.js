/**
 * @fileoverview llms.txt (Next runtime, Vite build)
 * @description Builds the app's llms.txt (llmstxt.org) from the same public pages as the
 * sitemap ({@link listPublicPages}): static pages under the localized pages heading, then
 * one section per entity route listing every published record with the title and
 * description the entity page's metadata uses (`deriveEntitySeo`). Used by the generated
 * Next `app/llms.txt` route handler (request time) and the Vite build (`dist/llms.txt`).
 * Server only.
 *
 * @version 0.2.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import i18next from 'i18next';

import { isEntityDefinition } from './entityRecordSeo.js';
import { formatLlmsTxt } from './llmsTxtFormat.js';
import { listPublicPages } from './publicPages.js';

/** Entity definitions among a module's exports, by collection. */
function entityByCollection(entities) {
  const byCollection = new Map();
  for (const value of Object.values(entities)) {
    if (isEntityDefinition(value)) byCollection.set(value.collection, value);
  }
  return byCollection;
}

/**
 * Translation function per entity, in the source language: entity namespace first,
 * then `crud` (what the CRUD card uses), from the build-written translations.
 *
 * @param {string} language - App default language
 * @param {Record<string, Object>} translations - Namespace → translation JSON in `language`
 * @returns {(namespace: string) => import('i18next').TFunction}
 */
function entityTranslators(language, translations) {
  const instance = i18next.createInstance();
  instance.init({
    lng: language,
    resources: { [language]: translations },
    ns: Object.keys(translations),
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return (namespace) => instance.getFixedT(language, [namespace, 'crud']);
}

/**
 * Build the app's llms.txt.
 *
 * - URLs: exactly the sitemap's pages, absolute, in the default language, in the app's
 *   trailing-slash form (`formatTrailingSlash`)
 * - static page: its build-resolved title (the page's `<title>`, never empty:
 *   `getLlmsTxtSource`) and description, under `pagesHeading` (or its own `section`)
 * - entity page: the record's title and description from `deriveEntitySeo` (formatted
 *   like the CRUD card, in `language`), under the route's `section` or the entity's plural
 *   name; a record without a title gets the site name (`source.name`), the title its page
 *   carries then (`entityRecordSeo`)
 *
 * @param {import('../next/index.js').LlmsTxtSource & import('../next/index.js').LlmsTxtContext} source - Build-written source plus the shared helpers
 * @returns {Promise<string>} llms.txt text
 * @throws {Error} When a dynamic route's collection has no entity definition or heading,
 *   a static route of the source has no title (a source not from `getLlmsTxtSource`), no
 *   reader or read schema is given, or the read fails
 *
 * @example
 * await buildLlmsTxt({ ...SOURCE, trailingSlash, formatTrailingSlash, entities, crud, readSchemas, deriveEntitySeo, hiddenStatuses });
 */
export async function buildLlmsTxt(source) {
  const {
    crud,
    readSchemas,
    deriveEntitySeo,
    hiddenStatuses,
    formatTrailingSlash,
    trailingSlash,
  } = source;
  const entities = entityByCollection(source.entities);
  let translatorFor;
  const sections = new Map();
  const sectionFor = (heading) => {
    let section = sections.get(heading);
    if (!section) {
      section = { heading, links: [] };
      sections.set(heading, section);
    }
    return section;
  };
  // Static pages first, whatever the route order
  sectionFor(source.pagesHeading);

  for (const { route, path, record } of await listPublicPages(
    source.routes,
    crud,
    hiddenStatuses,
    readSchemas
  )) {
    const url = `${source.baseUrl}${formatTrailingSlash(path, trailingSlash)}`;

    if (!record) {
      if (!route.title) {
        throw new Error(
          `[dndev] llms.txt: source route "${route.path}" has no title (getLlmsTxtSource gives every static page one).`
        );
      }
      sectionFor(route.section ?? source.pagesHeading).links.push({
        title: route.title,
        url,
        ...(route.description && { description: route.description }),
      });
      continue;
    }

    const entity = entities.get(route.collection);
    if (!entity) {
      throw new Error(
        `[dndev] llms.txt: no entity definition for collection "${route.collection}" (route "${route.path}"). ` +
          "Export it from the app's `entities` package."
      );
    }
    const heading =
      route.section ??
      (entity.namespace ? source.entityHeadings[entity.namespace] : undefined);
    if (!heading) {
      throw new Error(
        `[dndev] llms.txt: no heading for route "${route.path}". Add "namePlural" to the ` +
          `${entity.namespace ?? `entity-${entity.name.toLowerCase()}`} translations.`
      );
    }
    if (!translatorFor) {
      if (!source.language || !source.translations) {
        throw new Error(
          '[dndev] llms.txt: source has no language/translations (getLlmsTxtSource writes them).'
        );
      }
      translatorFor = entityTranslators(source.language, source.translations);
    }
    const seo = deriveEntitySeo(entity, record, {
      t: translatorFor(entity.namespace),
      locale: source.language,
    });
    sectionFor(heading).links.push({
      // No record title (empty listCardFields title fields): the site name, as its page
      title: seo.title || source.name,
      url,
      ...(seo.description && { description: seo.description }),
    });
  }

  return formatLlmsTxt({
    name: source.name,
    ...(source.summary && { summary: source.summary }),
    sections: [...sections.values()],
  });
}
