/**
 * @fileoverview Favicon Plugin - favicon tags in the HTML
 * @description Writes the favicon tags (`faviconHeadTags` of `@donotdev/core` headTags,
 * generated into `config/utils/headTags.js` by `bun run bpr`) into the `<head>` of
 * `index.html`, in dev and build (Vite `transformIndexHtml`, tag descriptors injected
 * into `head`). The prerender starts from the built `index.html`, so every prerendered
 * page and the SPA shell carry them. The Vite app renders no favicon component: these
 * tags are the one emitter. Next renders the same tags from `FaviconHead`.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import {
  FAVICON_DEFAULTS,
  faviconHeadTags,
  resolveFaviconFiles,
} from '../../utils/headTags.js';
import { PathResolver } from '../../utils/PathResolver.js';

/**
 * Favicon tags plugin. The favicon set is the files `public/` holds when the HTML is
 * transformed (after the asset discovery's `buildStart`, which generates the favicon and
 * PWA icons from `public/logo.svg`), the config `appConfig.favicon` over
 * `FAVICON_DEFAULTS` with the app name as `appName`, as AppConfigProvider resolves it.
 *
 * @param {Object} options - Plugin options
 * @param {Object} options.appConfig - App config (`favicon`: `false` writes no tag; `app.name`)
 * @returns {import('vite').Plugin}
 */
export function createViteFaviconPlugin({ appConfig }) {
  const favicon = appConfig.favicon;
  return {
    name: 'dndev-favicon',

    /** @returns {import('vite').HtmlTagDescriptor[]} */
    transformIndexHtml() {
      if (favicon === false) return [];
      const pathResolver = PathResolver.getInstance();
      const exists = (path) =>
        pathResolver.pathExists(pathResolver.resolveAppPath(`public${path}`));
      const tags = faviconHeadTags(resolveFaviconFiles(exists), {
        ...FAVICON_DEFAULTS,
        appName: appConfig.app?.name,
        ...favicon,
      });
      return tags.map(({ tag, attributes }) => ({
        tag,
        attrs: attributes,
        injectTo: 'head',
      }));
    },
  };
}
