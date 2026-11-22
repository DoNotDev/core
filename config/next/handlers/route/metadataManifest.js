/**
 * @fileoverview Next route handler: Metadata manifest
 * @description `public/metadata-manifest.json`: per route and language, the identity `getMetadataForPath` serves. Methods of {@link NextRouteHandler} (mixed into its prototype by
 * `../RouteHandler.js`); `this` is the route handler.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import {
  readTranslation,
  getSupportedLocales,
  getFallbackLocale,
} from '../../utils/TranslationReader.js';
import { routeSeo } from '../../../utils/headTags.js';
import { translationT } from '../../../utils/translationT.js';

export const metadataManifestMethods = {
  /**
   * Generate metadata manifest for centralized SEO (`public/metadata-manifest.json`, read
   * by `getMetadataForPath`). Pre-resolves i18n at build time for all routes, from this
   * build's translations and site name ({@link useI18n}, `options.siteName`), never from
   * files a previous build wrote.
   *
   * @param {Object} routeData - Route discovery results
   * @returns {Promise<void>}
   */
  async generateMetadataManifest(routeData) {
    const i18nConfig = this.i18n;
    if (!i18nConfig) {
      throw new Error(
        'Route handler: translations not set before the metadata manifest (runDiscoveries calls useI18n)'
      );
    }
    const locales = getSupportedLocales(i18nConfig);
    const fallbackLocale = getFallbackLocale(i18nConfig);
    // Page titles end with the site name (appConfig.seo.siteName, else appConfig.app.name)
    const siteName = this.options.siteName || '';

    const manifest = {};

    for (const route of routeData.routes) {
      // AutoMetaTags' namespace: the page's, else the site defaults of
      // appConfig.seo.defaultNamespace ('home'), never for the title
      const ownNamespace = route.metaExport?.namespace || null;
      const defaultNamespace = this.defaultNamespace();
      const namespace = ownNamespace || defaultNamespace;

      // Per-locale metadata
      const localeMetadata = {};

      for (const locale of locales) {
        // Read translation for this locale
        const translation =
          readTranslation(
            namespace,
            locale,
            i18nConfig,
            this.pathResolver
          ) ||
          readTranslation(
            namespace,
            fallbackLocale,
            i18nConfig,
            this.pathResolver
          );

        // The page identity AutoMetaTags and the Vite prerender render (routeSeo, core
        // headTags.ts), image kept relative (no base URL: getMetadataForPath sets
        // metadataBase)
        const identity = routeSeo({
          meta: route.metaExport || {},
          ns: ownNamespace,
          defaultNs: defaultNamespace,
          t: translationT({ [namespace]: translation }),
          siteName,
          baseUrl: '',
          url: null,
          defaultImage: this.defaultImage(),
          authOnly: Boolean(route.auth),
        });

        localeMetadata[locale] = {
          title: identity.title,
          ...(identity.description && { description: identity.description }),
          image: identity.image,
          type: identity.type,
          ...(identity.keywords && { keywords: identity.keywords }),
          ...(identity.robots && { robots: identity.robots }),
        };
      }

      manifest[route.path] = {
        locales: localeMetadata,
        defaultLocale: fallbackLocale,
      };
    }

    // Write manifest to public directory for static access
    const manifestContent = JSON.stringify(manifest, null, 2);
    this.writeGeneratedFile(
      'public/metadata-manifest.json',
      manifestContent,
      'metadata manifest'
    );

    this.logger.debug(
      `Generated metadata manifest for ${Object.keys(manifest).length} routes`
    );
  },
};
