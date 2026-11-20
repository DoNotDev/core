/**
 * @fileoverview App base URL
 * @description One normalization of the app's absolute URL (`NEXT_PUBLIC_APP_URL` or
 * `seo.baseUrl`), shared by the SEO handler at build and by the generated sitemap and
 * llms.txt routes at request time. The generated routes read the env var when they run,
 * so their source never holds a URL and is identical after `dev` and `build`.
 *
 * @version 0.3.1
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Normalize an app URL: trimmed, no trailing slash, `https://` added when it has no scheme.
 * @param {string | undefined | null} raw - `NEXT_PUBLIC_APP_URL` or `seo.baseUrl`
 * @returns {string | null} Absolute URL, or null when unset or blank
 */
export function normalizeAppUrl(raw) {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/**
 * Base URL of the generated sitemap / llms.txt routes.
 * @param {string | undefined} raw - `process.env.NEXT_PUBLIC_APP_URL` (or the app's `seo.baseUrl`)
 * @returns {string} Absolute URL, no trailing slash
 * @throws {Error} When the URL is unset
 */
export function appBaseUrl(raw) {
  const url = normalizeAppUrl(raw);
  if (!url) {
    throw new Error(
      '[dndev] Set NEXT_PUBLIC_APP_URL: the sitemap and llms.txt publish absolute URLs.'
    );
  }
  return url;
}
