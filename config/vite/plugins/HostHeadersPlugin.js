/**
 * @fileoverview Host headers plugin (Vite)
 * @description A Vite build is static: its HTTP response headers come from the host config.
 * At every dev/build start this plugin writes the framework header policy (headerPolicy.js)
 * into the `headers` key of the app's vercel.json, so that file is never hand-edited.
 * On CI (CI / VERCEL env) it only checks: a stale committed file fails the build, since the
 * host reads the committed file. No vercel.json: the app is not on Vercel, nothing to do.
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */

import {
  detectHeaderProviders,
  resolveHeaderRules,
  syncVercelHeaders,
} from '../../headerPolicy.js';
import { createLogger } from '../../utils/debugLog.js';

/**
 * @param {Object} options
 * @param {Object} options.appConfig - App config (`headers`, `seo`)
 * @param {boolean} [options.pwa] - PWA enabled
 * @param {boolean} [options.debug]
 * @param {boolean} [options.verbose]
 * @returns {import('vite').Plugin}
 */
export function createViteHostHeadersPlugin({ appConfig, pwa, debug, verbose }) {
  const logger = createLogger('host-headers', debug, verbose);
  return {
    name: 'dndev-host-headers',
    configResolved(config) {
      syncVercelHeaders({
        appRoot: config.root,
        rules: resolveHeaderRules({
          appConfig,
          target: 'vite',
          providers: detectHeaderProviders(config.root),
          pwa: pwa === true,
        }),
        ci: Boolean(process.env.CI || process.env.VERCEL),
        logger,
      });
    },
  };
}
