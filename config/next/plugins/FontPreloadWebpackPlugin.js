/**
 * @fileoverview Font Preload Webpack Plugin (Next.js)
 * @description After emit: infers app fonts from consumer CSS + locales, collects matching
 * font assets, writes public/dndev-font-preloads.json for FontPreloadLinks server component.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { resolveFontManifest } from '../../fonts/resolveFontManifest.js';
import { I18nDiscovery } from '../../discovery/I18nDiscovery.js';
import { createLogger } from '../../utils/debugLog.js';

const MAX_PRELOADS = 3;
const MANIFEST_FILENAME = 'dndev-font-preloads.json';

/**
 * @param {Object} options
 * @param {Object} options.pathResolver - PathResolver instance
 * @param {boolean} [options.debug] - Debug logging
 * @returns {Object} Webpack plugin
 */
export function createFontPreloadWebpackPlugin({
  pathResolver,
  debug = false,
}) {
  const logger = createLogger('font-preload-next', debug, false);

  return {
    apply(compiler) {
      compiler.hooks.afterEmit.tapAsync(
        'DndevFontPreloadManifest',
        async (compilation, callback) => {
          if (compilation.compiler.isChild()) {
            return callback();
          }
          const isServer = compilation.compiler.name?.includes('server');
          if (isServer) {
            return callback();
          }
          try {
            const appRoot = pathResolver.getAppRoot();
            if (!appRoot) return callback();

            // Get locales from I18n discovery
            let locales = ['en'];
            try {
              const i18n = new I18nDiscovery(pathResolver, {
                fallbackLanguage: 'en',
              });
              const data = await i18n.discoverTranslations();
              if (data?.supportedLanguages?.length) {
                locales = data.supportedLanguages;
              }
            } catch {
              // fallback to ['en']
            }

            // Resolve manifest — all installed framework fonts, filtered by locale subsets
            const manifest = resolveFontManifest(locales);
            const preloadStems = manifest.stems;

            const publicPath =
              compilation.outputOptions.publicPath &&
              String(compilation.outputOptions.publicPath) !== 'auto'
                ? compilation.outputOptions.publicPath.replace(/\/$/, '')
                : '';

            const entries = [];
            for (const [filename] of Object.entries(compilation.assets)) {
              if (!filename.endsWith('.woff2')) continue;
              const lower = filename.toLowerCase();
              if (
                Array.from(preloadStems).some((stem) => lower.includes(stem))
              ) {
                const href = publicPath
                  ? `${publicPath}/${filename}`
                  : `/${filename}`;
                entries.push({ href, type: 'font/woff2' });
                if (entries.length >= MAX_PRELOADS) break;
              }
            }

            const publicDir = pathResolver.resolveAppPath('public');
            if (!pathResolver.pathExists(publicDir)) {
              try {
                pathResolver.ensureDirSync(publicDir);
              } catch (e) {
                logger.debug(
                  `Font preload: could not create public dir: ${e?.message}`
                );
                return callback();
              }
            }
            const manifestPath = pathResolver.resolvePath(
              MANIFEST_FILENAME,
              publicDir
            );
            pathResolver.writeSync(
              manifestPath,
              JSON.stringify(entries, null, 0),
              { overwrite: true }
            );
            logger.debug(
              `Font preload: wrote ${entries.length} entries to ${MANIFEST_FILENAME}`
            );
          } catch (err) {
            logger.debug(`Font preload manifest: ${err?.message}`);
          }
          callback();
        }
      );
    },
  };
}
