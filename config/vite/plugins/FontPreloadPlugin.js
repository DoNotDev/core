/**
 * @fileoverview Font Plugin - Build-time font filtering + preload injection
 * @description Filters font assets in the output bundle to include only needed subsets
 * (from app locales) and woff2 only. Also injects preload links into index.html.
 *
 * Strategy:
 * - buildStart(): discover needed fonts (from CSS) + locales (from I18n) → compute manifest
 * - generateBundle(): delete unwanted font assets, remove their @font-face blocks from CSS,
 *   strip .woff references from remaining blocks
 * - writeBundle(): inject <link rel="preload"> into index.html
 *
 * @version 0.0.4
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { FONT_WEIGHTS } from '../../constants.js';
import {
  resolveFontManifest,
  stripWoffFromSrc,
} from '../../fonts/resolveFontManifest.js';
import { I18nDiscovery } from '../../discovery/I18nDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

const MAX_PRELOADS = 3;
const FONT_PRELOAD_MARKER = '<!-- DNDEV_FONT_PRELOADS -->';
const KNOWN_STEMS = Object.keys(FONT_WEIGHTS);

/**
 * @param {Object} options - Plugin options
 * @returns {Object} Vite plugin
 */
export function createViteFontPreloadPlugin(options = {}) {
  const { debug = false } = options;
  const logger = createLogger('font-preload', debug, false);

  let pathResolver;
  let buildConfig = {};
  let isBuild = false;
  /** @type {Set<string>} file stems to keep (e.g. 'inter-latin-400-normal') */
  let allowedStems = new Set();
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

      try {
        // 1. Discover locales from I18n (determines which subsets to keep)
        let locales = ['en'];
        try {
          const i18n = new I18nDiscovery(pathResolver, {
            fallbackLanguage: 'en',
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

        // 2. Resolve manifest — keeps all installed framework fonts, filtered by locale subsets
        const manifest = resolveFontManifest(locales);
        allowedStems = manifest.stems;

        logger.debug(
          `Font filter: ${manifest.fontStems.size} font(s), ${manifest.subsets.size} subset(s), ${allowedStems.size} allowed stem(s)`
        );
      } catch (err) {
        logger.debug(
          `Font preload: discovery failed, using defaults: ${err?.message}`
        );
        const manifest = resolveFontManifest(['en']);
        allowedStems = manifest.stems;
      }
    },

    generateBundle(_outputOptions, bundle) {
      if (allowedStems.size === 0) return;

      let deletedWoff = 0;
      let deletedWoff2 = 0;

      // 1. Delete unwanted font assets
      for (const fileName of Object.keys(bundle)) {
        const info = bundle[fileName];
        if (info.type !== 'asset') continue;

        const lower = fileName.toLowerCase();

        if (fileName.endsWith('.woff')) {
          // Delete ALL .woff for known framework fonts
          if (KNOWN_STEMS.some((stem) => lower.includes(stem))) {
            delete bundle[fileName];
            deletedWoff++;
          }
        } else if (fileName.endsWith('.woff2')) {
          // Delete .woff2 for known fonts NOT in allowed stems
          const isKnownFont = KNOWN_STEMS.some((stem) => lower.includes(stem));
          if (isKnownFont) {
            const isAllowed = Array.from(allowedStems).some((stem) =>
              lower.includes(stem)
            );
            if (!isAllowed) {
              delete bundle[fileName];
              deletedWoff2++;
            }
          }
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
            // Check if this block is for a known framework font
            const isKnownFont = KNOWN_STEMS.some((stem) =>
              block.includes(stem)
            );
            if (!isKnownFont) return block; // Custom font → keep as-is

            // Check if it references an allowed stem
            const isAllowed = Array.from(allowedStems).some((stem) =>
              block.includes(stem)
            );
            if (!isAllowed) return ''; // Unwanted subset → remove entire block

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
        if (!fileName.endsWith('.woff2')) continue;
        const lower = fileName.toLowerCase();
        if (Array.from(allowedStems).some((stem) => lower.includes(stem))) {
          const href = base ? `${base}/${fileName}` : `/${fileName}`;
          collected.push(href);
        }
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
