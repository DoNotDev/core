/**
 * @fileoverview Font Plugin - Build-time font filtering + preload injection
 * @description @donotdev/ui/dndev.css declares the whole font catalogue; the build keeps
 * only the framework fonts the app's theme renders text in (ThemeDiscovery
 * fontFamilies → resolveFontManifest), for the subsets of its locales, woff2 only.
 * A theme that uses only its own fonts ships no framework font file.
 *
 * Strategy:
 * - buildStart(): theme font families + locales (I18n) → manifest
 * - generateBundle(): delete the other catalogue font assets, remove their @font-face
 *   blocks from CSS, strip .woff references from the remaining blocks
 * - writeBundle(): inject <link rel="preload"> into index.html
 *
 * @version 0.0.5
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import {
  catalogueFontStem,
  resolveFontManifest,
  stripWoffFromSrc,
} from '../../fonts/resolveFontManifest.js';
import { I18nDiscovery } from '../../discovery/I18nDiscovery.js';
import { ThemeDiscovery } from '../../discovery/ThemeDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

const MAX_PRELOADS = 3;
const FONT_PRELOAD_MARKER = '<!-- DNDEV_FONT_PRELOADS -->';
/** Every url(...) of a CSS block */
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;

/**
 * @param {Object} options - Plugin options
 * @returns {Object} Vite plugin
 */
export function createViteFontPreloadPlugin(options = {}) {
  const { debug = false, i18nOptions = {} } = options;
  const logger = createLogger('font-preload', debug, false);

  let pathResolver;
  let buildConfig = {};
  let isBuild = false;
  /** @type {Set<string>|null} font file stems to keep (e.g. 'inter-latin-400-normal'); null until buildStart */
  let allowedStems = null;
  /** @type {string[]} */
  let preloadHrefs = [];

  return {
    name: 'vite-font-preload-plugin',
    enforce: 'post',

    configResolved(config) {
      isBuild = config.command === 'build';
      buildConfig = {
        root: config.root,
        base:
          config.base && config.base !== '/'
            ? config.base.replace(/\/$/, '')
            : '',
        outDir: config.build?.outDir ?? 'dist',
      };
      try {
        pathResolver = PathResolver.getInstance();
      } catch (e) {
        logger.debug(`Font preload: PathResolver not ready: ${e?.message}`);
      }
    },

    async buildStart() {
      if (!isBuild || !pathResolver) return;
      const appRoot = pathResolver.getAppRoot();
      if (!appRoot) return;

      // 1. Discover locales from I18n (determines which subsets to keep)
      let locales = [i18nOptions.fallbackLanguage || 'en'];
      try {
        const i18n = new I18nDiscovery(pathResolver, {
          fallbackLanguage: i18nOptions.fallbackLanguage || 'en',
          only: i18nOptions.only,
        });
        const data = await i18n.discoverTranslations();
        if (data?.supportedLanguages?.length) {
          locales = data.supportedLanguages;
        }
      } catch (err) {
        logger.debug(
          `Font preload: i18n discovery failed, using 'en': ${err?.message}`
        );
      }

      // 2. Families the theme renders text in (fails the build when unknown)
      const themes = new ThemeDiscovery(null, pathResolver, { debug });
      const { fontFamilies } = await themes.discoverThemes();

      // 3. Manifest: catalogue families used × weights × locale subsets
      const manifest = resolveFontManifest({ families: fontFamilies, locales });
      allowedStems = manifest.stems;

      logger.debug(
        `Font filter: ${manifest.fontStems.size} font(s) [${[...manifest.fontStems].join(', ')}], ${manifest.subsets.size} subset(s), ${allowedStems.size} allowed stem(s)`
      );
    },

    generateBundle(_outputOptions, bundle) {
      if (!allowedStems) return;

      /** @param {string} name - Asset file name or CSS url() */
      const isCatalogueFont = (name) => catalogueFontStem(name) !== null;
      /** @param {string} name - Asset file name or CSS url() */
      const isAllowedFont = (name) => allowedStems.has(catalogueFontStem(name));

      let deletedWoff = 0;
      let deletedWoff2 = 0;

      // 1. Delete unwanted catalogue font assets (all .woff, unused .woff2)
      for (const fileName of Object.keys(bundle)) {
        const info = bundle[fileName];
        if (info.type !== 'asset' || !isCatalogueFont(fileName)) continue;

        if (fileName.endsWith('.woff')) {
          delete bundle[fileName];
          deletedWoff++;
        } else if (fileName.endsWith('.woff2') && !isAllowedFont(fileName)) {
          delete bundle[fileName];
          deletedWoff2++;
        }
      }

      logger.debug(
        `Font filter: deleted ${deletedWoff} .woff + ${deletedWoff2} .woff2 from bundle`
      );

      // 2. Clean CSS chunks: remove @font-face blocks for deleted fonts, strip woff from kept ones
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (
          chunk.type !== 'asset' ||
          !fileName.endsWith('.css') ||
          typeof chunk.source !== 'string'
        )
          continue;

        const original = chunk.source;
        const cleaned = original.replace(
          /@font-face\s*\{[\s\S]*?\}/g,
          (block) => {
            const urls = [...block.matchAll(CSS_URL_RE)].map((m) => m[1]);
            // App's own font → keep as-is
            if (!urls.some(isCatalogueFont)) return block;
            // Catalogue font the theme does not use → remove entire block
            if (!urls.some(isAllowedFont)) return '';
            // Allowed → keep but strip woff
            return stripWoffFromSrc(block);
          }
        );

        if (cleaned !== original) {
          chunk.source = cleaned;
        }
      }

      // 3. Collect preload hrefs (woff2 only, matching allowed stems)
      const base = buildConfig.base || '';
      const collected = [];
      for (const [fileName, info] of Object.entries(bundle)) {
        if (info.type !== 'asset') continue;
        if (!fileName.endsWith('.woff2') || !isAllowedFont(fileName)) continue;
        const href = base ? `${base}/${fileName}` : `/${fileName}`;
        collected.push(href);
      }
      preloadHrefs = collected.slice(0, MAX_PRELOADS);
    },

    writeBundle() {
      if (!isBuild || !preloadHrefs.length) return;
      const pr = pathResolver || PathResolver.getInstance();
      const root = buildConfig.root || process.cwd();
      const outDir = buildConfig.outDir || 'dist';
      const indexPath = pr.resolvePath(`${outDir}/index.html`, root);
      try {
        if (!pr.pathExists(indexPath)) {
          logger.debug(`Font preload: index.html not found at ${indexPath}`);
          return;
        }
        let html = pr.readSync(indexPath, { format: 'text' });
        const links = preloadHrefs
          .map(
            (href) =>
              `<link rel="preload" as="font" href="${href}" type="font/woff2" crossorigin="anonymous" />`
          )
          .join('\n  ');
        if (html.includes(FONT_PRELOAD_MARKER)) {
          html = html.replace(
            FONT_PRELOAD_MARKER,
            `${FONT_PRELOAD_MARKER}\n  ${links}`
          );
        } else {
          const fontsComment = html.indexOf('<!-- Fonts:');
          const insertIndex =
            fontsComment !== -1
              ? html.indexOf('-->', fontsComment) + 3
              : html.indexOf('</head>');
          if (insertIndex !== -1) {
            html =
              html.slice(0, insertIndex) +
              `\n  ${links}` +
              html.slice(insertIndex);
          }
        }
        pr.writeSync(indexPath, html, { overwrite: true });
        logger.debug(`Font preload: injected ${preloadHrefs.length} link(s)`);
      } catch (err) {
        logger.debug(`Font preload: write failed: ${err?.message}`);
      }
    },
  };
}
