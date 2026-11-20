// packages/core/rsc.ts

/// <reference path="./config/global.d.ts" />

/**
 * @donotdev/core/rsc - React Server Components entry
 *
 * Server implementations of framework hooks for server components. Resolves only
 * under the `react-server` export condition (Next's RSC graph): anywhere else the
 * import fails to resolve, so a client or Functions bundle cannot pick it up.
 * Separate from `@donotdev/core/server`, which Functions and edge bundles use.
 *
 * Includes:
 * - `useTranslation`: own i18next instance over the generated inline translations
 * - `setRequestLanguage`: request-scoped language (`React.cache`)
 *
 * @packageDocumentation
 */

export {
  setRequestLanguage,
  useTranslation,
} from './i18n/src/server/serverTranslation';
export type { ServerTranslationOptions } from './i18n/src/server/serverTranslation';
