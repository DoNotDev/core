/**
 * @fileoverview Font Plugin - the font plan in the Vite document head
 * @description Vite emitter of the app's font plan (fonts/buildFontPlan.js, the one
 * source of truth both bundlers share). No font goes through the CSS bundle.
 *
 * - buildStart (dev and build): build the plan from the theme tokens (ThemeDiscovery
 *   `fontCss`), `appConfig.fonts` and the app languages (i18n discovery), then write its
 *   files to `public/fonts/` (writeFontPlan: Vite serves `public/` in dev and copies it
 *   into `dist/`). In dev, an edited CSS file rebuilds it (page reload when it changed).
 * - transformIndexHtml (`order: 'pre'`): the default language's font preloads
 *   (`fontPreloadHeadTags`) and one inline `<style id="dndev-fonts">` with every
 *   `@font-face`, injected into `<head>` before the stylesheet Vite adds, so the font
 *   requests start with the HTML, in parallel with the CSS.
 * - The prerender starts from the built `index.html`: every page carries the tags, and
 *   a page in another language gets that language's preloads ({@link localizeFontPreloads}).
 *
 * @version 0.1.0
 * @since 0.3.3
 * @author AMBROISE PARK Consulting
 */

import { ThemeDiscovery } from '../../discovery/ThemeDiscovery.js';
import { buildFontPlan } from '../../fonts/buildFontPlan.js';
import { writeFontPlan } from '../../fonts/writeFontPlan.js';
import { createLogger } from '../../utils/debugLog.js';
import { FONT_STYLE_ID, fontPreloadHeadTags } from '../../utils/headTags.js';
import { PathResolver } from '../../utils/PathResolver.js';

/** A font preload link as Vite serializes `fontPreloadHeadTags` (the only font preloads of a page). */
const FONT_PRELOAD_LINK_RE = /[ \t]*<link rel="preload" as="font"[^>]*>\n?/g;

/**
 * Escape an attribute value for HTML.
 * @param {string} value
 * @returns {string}
 */
const escapeAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * The page's HTML with the font preloads of its language in place of the shell's (the
 * default language's): same position, same attributes (`fontPreloadHeadTags`).
 *
 * @param {string} html - A page built from the shell
 * @param {readonly string[]} hrefs - The page language's font plan `preloads`
 * @returns {string}
 * @throws {Error} When the shell has no font preload but the language has some (the
 *   shell's font tags were removed)
 * @since 0.3.3
 */
export function localizeFontPreloads(html, hrefs) {
  const links = fontPreloadHeadTags(hrefs)
    .map(
      ({ attributes }) =>
        `    <link ${Object.entries(attributes)
          .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
          .join(' ')}>\n`
    )
    .join('');
  const first = html.search(FONT_PRELOAD_LINK_RE);
  if (first === -1) {
    if (hrefs.length === 0) return html;
    const style = html.indexOf(`<style id="${FONT_STYLE_ID}"`);
    if (style === -1) {
      throw new Error(
        `[dndev-fonts] Prerender: the SPA shell has no font tags (<style id="${FONT_STYLE_ID}">): keep the font plugin (createVitePlugins) before the prerender.`
      );
    }
    const lineStart = html.lastIndexOf('\n', style) + 1;
    return html.slice(0, lineStart) + links + html.slice(lineStart);
  }
  const without = html.replace(FONT_PRELOAD_LINK_RE, '');
  return without.slice(0, first) + links + without.slice(first);
}

/**
 * Store of this build's font plan: set by the font plugin's buildStart, read by the
 * prerender (per-language preloads).
 *
 * @returns {{ set(plan: import('../../fonts/buildFontPlan.js').FontPlan): void, get(): import('../../fonts/buildFontPlan.js').FontPlan }}
 * @since 0.3.3
 */
export function createFontPlanStore() {
  let current = null;
  return {
    set(plan) {
      current = plan;
    },
    get() {
      if (!current) {
        throw new Error('[dndev-fonts] The font plan is not built yet (the font plugin builds it in buildStart).');
      }
      return current;
    },
  };
}

/**
 * Vite font plugin.
 *
 * @param {Object} options
 * @param {Object} options.appConfig - App config (`fonts`: the app's own font files)
 * @param {ReturnType<import('./I18nPlugin.js').createI18nStore>} options.i18nStore - This build's i18n discovery (languages), set by the i18n plugin
 * @param {ReturnType<typeof createFontPlanStore>} options.fontPlan - Receives the plan (read by the prerender)
 * @param {boolean} [options.debug]
 * @returns {import('vite').Plugin}
 * @throws {Error} When a store is missing
 * @since 0.3.3
 */
export function createViteFontPlugin({ appConfig, i18nStore, fontPlan, debug = false }) {
  if (!i18nStore || !fontPlan) {
    throw new Error(
      "[dndev] createViteFontPlugin: options.i18nStore and options.fontPlan are required (createVitePlugins passes the i18n plugin's createI18nStore and createFontPlanStore)."
    );
  }
  const logger = createLogger('fonts', debug, false);
  let publicPath = '';
  let defaultLanguage = null;

  /** Build the plan, write its files, publish it to the store. */
  async function refresh() {
    const pathResolver = PathResolver.getInstance();
    const { supportedLanguages, fallbackLanguage } = await i18nStore.ready();
    const { fontCss } = await new ThemeDiscovery(null, pathResolver, { debug }).discoverThemes(true);
    const indexPath = pathResolver.resolveAppPath('index.html');
    const plan = await buildFontPlan({
      fontCss,
      appFonts: appConfig?.fonts,
      languages: supportedLanguages,
      publicPath,
      indexHtml: pathResolver.pathExists(indexPath)
        ? pathResolver.readSync(indexPath, { format: 'text' })
        : null,
      pathResolver,
    });
    writeFontPlan(plan, { pathResolver, publicPath });
    fontPlan.set(plan);
    defaultLanguage = supportedLanguages.includes(fallbackLanguage)
      ? fallbackLanguage
      : supportedLanguages[0];
    logger.debug(
      `Font plan: ${plan.families.map(({ family }) => family).join(', ') || 'system fonts only'} (${plan.files.length} files)`
    );
    for (const notice of plan.notices) logger.info(`🔤 ${notice}`);
  }

  return {
    name: 'dndev-fonts',

    configResolved(config) {
      publicPath = config.base && config.base !== '/' ? config.base.replace(/\/$/, '') : '';
    },

    async buildStart() {
      await refresh();
    },

    // Dev: an edited theme CSS file can change the plan (families, weights): rebuild it,
    // reload the page when it changed
    configureServer(server) {
      server.watcher.on('change', async (file) => {
        if (!file.endsWith('.css')) return;
        const before = fontPlan.get();
        try {
          await refresh();
        } catch (error) {
          // The overlay shows the build error; the page keeps the last valid plan until fixed
          server.config.logger.error(error.message);
          server.ws.send({ type: 'error', err: { message: error.message, stack: '' } });
          return;
        }
        const after = fontPlan.get();
        if (after.css !== before.css || JSON.stringify(after.preloads) !== JSON.stringify(before.preloads)) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },

    transformIndexHtml: {
      order: 'pre',
      /** @returns {import('vite').HtmlTagDescriptor[]} */
      handler() {
        const plan = fontPlan.get();
        return [
          ...fontPreloadHeadTags(plan.preloads[defaultLanguage]).map(({ tag, attributes }) => ({
            tag,
            attrs: attributes,
            injectTo: 'head',
          })),
          ...(plan.css
            ? [{ tag: 'style', attrs: { id: FONT_STYLE_ID }, children: plan.css, injectTo: 'head' }]
            : []),
        ];
      },
    },
  };
}
