// packages/core/i18n/src/utils/i18nBackend.ts

/**
 * @fileoverview Unified i18next backend
 * @description Single backend class for translation loading — replaces PatternBackend + PatternBasedLoader + TranslationCache.
 *
 * Handles:
 * - Inline content (eager namespaces) → returned synchronously from config
 * - Lazy content → loaded via import() loaders from virtual module
 * - In-flight dedup → prevents duplicate requests for same ns+lang
 * - Error TTL caching → prevents retry-storm on broken chunks (5min circuit breaker)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getTranslationContent, getTranslationLoaders } from './config';

interface ReadCallback {
  (error: Error | null, data: any): void;
}

/**
 * Unified i18next backend for pattern-based translation loading
 *
 * Used by both Vite and Next.js instance files. Registered via `instance.use(backend)`.
 * i18next calls `read(language, namespace, callback)` when it needs translations
 * that aren't in the initial `resources` bundle.
 */
export class I18nBackend {
  type: 'backend' = 'backend';

  private loading = new Map<string, Promise<any>>();
  private errors = new Map<string, { error: Error; ts: number }>();

  /** Required by i18next backend protocol — called during instance.init() */
  init() {}

  /**
   * Load translations for a namespace+language pair
   *
   * Resolution order:
   * 1. Error cache (5min TTL) — fast-fail for known-broken chunks
   * 2. Inline content — eager namespaces already in config.content
   * 3. In-flight dedup — join existing load for same ns+lang
   * 4. Lazy loader — import() call from virtual module → async chunk
   */
  read(language: string, namespace: string, callback: ReadCallback) {
    if (!language || !namespace) {
      return callback(
        new Error(`Invalid params: ${namespace}_${language}`),
        {}
      );
    }

    // 1. Check error cache (5min TTL circuit breaker)
    const key = `${language}:${namespace}`;
    const cached = this.errors.get(key);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return callback(cached.error, {});
    }

    // 2. Check inline content (eager namespaces)
    const inline = getTranslationContent()?.[namespace]?.[language];
    if (inline) return callback(null, inline);

    // 3. Deduplicate in-flight requests
    const existing = this.loading.get(key);
    if (existing) {
      existing.then((d) => callback(null, d)).catch((e) => callback(e, {}));
      return;
    }

    // 4. Load from lazy loaders (import() calls from virtual module)
    const loader = getTranslationLoaders()?.[namespace]?.[language];
    if (!loader || typeof loader !== 'function') return callback(null, {});

    const promise = loader()
      .then((m: any) => {
        const data = m.default || m;
        this.loading.delete(key);
        callback(null, data);
        return data;
      })
      .catch((error: Error) => {
        this.loading.delete(key);
        this.errors.set(key, { error, ts: Date.now() });
        callback(error, {});
      });

    this.loading.set(key, promise);
  }
}
