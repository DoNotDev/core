/**
 * @fileoverview llms.txt (Next runtime)
 * @description Builds the app's llms.txt (llmstxt.org) in the generated
 * `app/llms.txt` route handler, from the same public pages as the sitemap
 * ({@link listPublicPages}): static pages under the localized pages heading, then one
 * section per entity route listing every published record with the title and
 * description `<Seo entity data>` uses (`deriveEntitySeo`). The Vite build writes the
 * same format statically (same formatter). Runs at request time, server only.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import i18next from 'i18next';

import { formatLlmsTxt } from '../../utils/llmsTxtFormat.js';
import { listPublicPages } from './publicPages.js';

/** Entity definitions among a module's exports, by collection. */
function entityByCollection(entities) {
  const byCollection = new Map();
  for (const value of Object.values(entities)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'collection' in value &&
      'fields' in value
    ) {
      byCollection.set(value.collection, value);
    }
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
 * - URLs: exactly the sitemap's pages, absolute, in the default language
 * - static page: its build-resolved label and description, under `pagesHeading`
 *   (or its own `section`)
 * - entity page: the record's title and description from `deriveEntitySeo` (formatted
 *   like the CRUD card, in `language`), under the route's `section` or the entity's plural name
 *
 * @param {import('../index.js').LlmsTxtSource & import('../index.js').LlmsTxtContext} source - Build-written source plus the shared helpers
 * @returns {Promise<string>} llms.txt text
 * @throws {Error} When a static route has no label, a dynamic route's collection has no
 *   entity definition or heading, a published record has no title, or the read fails
 *
 * @example
 * await buildLlmsTxt({ ...SOURCE, entities, crud, deriveEntitySeo, hiddenStatuses });
 */
export async function buildLlmsTxt(source) {
  const { crud, deriveEntitySeo, hiddenStatuses } = source;
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

  for (const { route, path, record } of await listPublicPages(source.routes, crud, hiddenStatuses)) {
    const url = `${source.baseUrl}${path}`;

    if (!record) {
      if (!route.title) {
        throw new Error(
          `[dndev] llms.txt: page "${route.path}" has no label in the app language.`
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
    if (!seo.title) {
      throw new Error(
        `[dndev] llms.txt: published "${route.collection}" record at "${path}" has no title ` +
          '(listCardFields title fields, or first text field, are empty).'
      );
    }
    sectionFor(heading).links.push({
      title: seo.title,
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
