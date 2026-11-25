/**
 * @fileoverview The app's time zone (build side)
 * @description Resolves the build option `i18n.timeZone` of `defineViteConfig` /
 * `defineNextConfig`: an IANA time zone name (`'Europe/Paris'`, `'UTC'`), default
 * {@link DEFAULT_APP_TIME_ZONE} (the one place the default is written); an app sets it
 * only to override it. Discovery carries the resolved zone to the generated i18n config
 * (`_DNDEV_CONFIG_.i18n.timeZone`: Vite `virtual:i18n` and the prerender, Next
 * `src/config/dndev-config-i18n.js`), read at runtime by `getAppTimeZone()`
 * (`@donotdev/core`): every date the framework formats is in this zone, on the server
 * and in the browser.
 *
 * @version 0.2.0
 * @since 0.3.8
 * @author AMBROISE PARK Consulting
 */

import { createBuildError } from './buildError.js';

/**
 * The framework's default app time zone, used when an app sets no `i18n.timeZone`.
 *
 * @since 0.3.8
 */
export const DEFAULT_APP_TIME_ZONE = 'Europe/Paris';

/** IANA shape: `Area/Location[/Sub]` or a single name (`UTC`); no UTC offsets (`+01:00`). */
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/**
 * The app's time zone: the `i18n.timeZone` build option, validated (an IANA name the
 * runtime's `Intl` knows), or {@link DEFAULT_APP_TIME_ZONE} when the app sets none.
 *
 * @param {unknown} timeZone - The `i18n.timeZone` build option (`undefined`, `null` or `''`: not set)
 * @returns {string} The time zone
 * @throws {Error} `[dndev-i18n] i18n.timeZone ...` when it is set and not a valid IANA zone
 *
 * @example
 * resolveAppTimeZone(undefined); // 'Europe/Paris'
 * resolveAppTimeZone('Asia/Seoul'); // 'Asia/Seoul'
 *
 * @since 0.3.8
 */
export function resolveAppTimeZone(timeZone) {
  if (timeZone === undefined || timeZone === null || timeZone === '') {
    return DEFAULT_APP_TIME_ZONE;
  }
  const fix = `Set an IANA name in vite.config.ts / next.config.ts: define*Config({ appConfig, i18n: { timeZone: 'Asia/Seoul' } }), or remove it for the default (${DEFAULT_APP_TIME_ZONE}).`;
  if (typeof timeZone !== 'string' || !IANA_NAME.test(timeZone)) {
    throw createBuildError(
      'dndev-i18n',
      `i18n.timeZone must be an IANA time zone name. Got ${JSON.stringify(timeZone)}. ${fix}`,
      'invalid-option'
    );
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    throw createBuildError(
      'dndev-i18n',
      `i18n.timeZone "${timeZone}" is not a known IANA time zone. ${fix}`,
      'invalid-option'
    );
  }
  return timeZone;
}
