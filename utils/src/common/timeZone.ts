// packages/core/utils/src/common/timeZone.ts

/**
 * @fileoverview The app's time zone
 * @description One time zone per app (IANA name): the build config option `i18n.timeZone`
 * (`defineViteConfig` / `defineNextConfig`; default `'Europe/Paris'`, set it to override
 * it per app), registered on `globalThis._DNDEV_CONFIG_.i18n.timeZone` by the generated i18n config
 * (Vite: `virtual:i18n` and the prerender; Next: `src/config/dndev-config-i18n.js`,
 * imported by ClientLayout). Every framework date formatter and the date pickers read
 * it, so the server render and the browser print the same date and time for the same
 * instant, whatever the machine's own zone (Vercel servers run in UTC).
 *
 * @version 0.1.0
 * @since 0.3.8
 * @author AMBROISE PARK Consulting
 */

/**
 * The app's time zone (IANA name), as the generated i18n config carries it (the build
 * option `i18n.timeZone`, default `'Europe/Paris'`).
 *
 * @returns The IANA time zone, e.g. `'Europe/Paris'`
 * @throws When the generated i18n config is not loaded in this runtime (a wiring bug; fail
 *   loud: never the machine's zone)
 *
 * @example
 * ```ts
 * new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: getAppTimeZone() });
 * ```
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function getAppTimeZone(): string {
  const timeZone = globalThis._DNDEV_CONFIG_?.i18n?.timeZone;
  if (typeof timeZone !== 'string' || timeZone === '') {
    throw new Error(
      '[dndev] The app time zone is not loaded in this runtime: the generated i18n config (it carries i18n.timeZone, default Europe/Paris) must load before dates are formatted (Vite: virtual:i18n; Next: ClientLayout imports src/config/dndev-config-i18n.js).'
    );
  }
  return timeZone;
}

/** `YYYY-MM-DD`: a calendar date, no time and no zone (a `date` field's value). */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a value is a calendar date (`YYYY-MM-DD`): a day, not an instant. A calendar
 * date reads the same everywhere: it is formatted as written (`timeZone: 'UTC'` on its
 * UTC midnight), never shifted into the app's zone.
 *
 * @param value - A stored date value
 * @returns `true` for a `YYYY-MM-DD` string
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && CALENDAR_DATE.test(value);
}

/**
 * The zone that formats a date value: `'UTC'` for a calendar date (`YYYY-MM-DD`, parsed
 * as UTC midnight: the day as written), else the app's zone ({@link getAppTimeZone}).
 *
 * @param value - A stored date value (ISO string, Date, timestamp)
 * @returns The `timeZone` option for `Intl.DateTimeFormat`
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function formatTimeZoneFor(value: unknown): string {
  return isCalendarDate(value) ? 'UTC' : getAppTimeZone();
}
