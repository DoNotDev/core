// packages/core/stores/src/templates/languageStore.ts

/**
 * @fileoverview Language store template
 * @description Zustand store for managing language state (current language, RTL, available languages)
 *
 * Keeps @donotdev/stores independent of @donotdev/i18n at the package level.
 * The i18n instance is injected via initialize() and stored in a module-level closure.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { LanguageData } from '@donotdev/types';
import { getGlobalSingleton } from '@donotdev/utils';

import { createDoNotDevStore } from '../createDoNotDevStore';

/**
 * RTL language codes (inlined to avoid @donotdev/components dependency)
 * @internal
 */
const RTL_LANGUAGES = [
  'ar',
  'he',
  'fa',
  'ur',
  'ps',
  'sd',
  'yi',
  'ku',
  'dv',
] as const;

/**
 * Minimal i18n instance interface — avoids i18next type dependency.
 * Only the subset used by the store.
 * @internal
 */
interface I18nLike {
  language: string;
  changeLanguage(lng: string): Promise<any>;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
}

/** i18n instance holder (globalThis-backed, not serializable - never stored in zustand state) */
interface I18nHolder {
  instance: I18nLike | null;
}
function getI18nHolder(): I18nHolder {
  return getGlobalSingleton<I18nHolder>('i18n-holder', () => ({
    instance: null,
  }));
}

/**
 * Check if a language code is RTL
 * @internal
 */
function isRTL(lng: string): boolean {
  const base = lng.split('-')[0];
  return RTL_LANGUAGES.includes(base as (typeof RTL_LANGUAGES)[number]);
}

/**
 * Apply language-related DOM attributes
 * @internal
 */
function applyDOMAttributes(lng: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = isRTL(lng) ? 'rtl' : 'ltr';
}

/**
 * Language state interface
 */
interface LanguageState {
  /** Current BCP-47 language code */
  currentLanguage: string;
  /** Available languages from config */
  availableLanguages: LanguageData[];
  /** Whether current language is RTL */
  isRTL: boolean;
}

/**
 * Language actions interface
 */
interface LanguageActions {
  /** Change the current language — validates, syncs i18next, updates DOM */
  setLanguage: (lng: string) => Promise<void>;
  /** Set available languages (called during init) */
  setAvailableLanguages: (languages: LanguageData[]) => void;
}

/**
 * Language store for managing language state as a first-class zustand concern.
 *
 * **Architecture:**
 * - Bidirectional sync with i18next: store → i18n via setLanguage(), i18n → store via languageChanged listener
 * - Persist: only `currentLanguage` is persisted (replaces async getUserLanguage/saveUserLanguage flow)
 * - RTL detection: inlined, no @donotdev/components dependency
 * - i18n instance: injected via initialize(), stored in module-level closure
 *
 * @example
 * ```tsx
 * // Fine-grained hook
 * const currentLanguage = useLanguage('currentLanguage');
 * const isRTL = useLanguage('isRTL');
 *
 * // Change language
 * useLanguageStore.getState().setLanguage('fr');
 *
 * // Check readiness
 * const isReady = useLanguageReady();
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useLanguageStore = createDoNotDevStore<
  LanguageState & LanguageActions
>({
  name: 'language',

  createStore: (set, get) => ({
    currentLanguage: 'en',
    availableLanguages: [],
    isRTL: false,

    /**
     * Change the current language
     *
     * Validates the language code, delegates to i18next for namespace loading,
     * then updates DOM attributes and store state.
     *
     * @param lng - BCP-47 language code
     */
    setLanguage: async (lng: string) => {
      const state = get();

      // Validate against available languages
      if (
        state.availableLanguages.length > 0 &&
        !state.availableLanguages.some((l) => l.id === lng)
      ) {
        console.warn('[language-store] setLanguage: invalid language', lng);
        return;
      }

      if (lng === state.currentLanguage) return;

      console.log('[language-store] setLanguage:', lng, {
        hasI18n: !!getI18nHolder().instance,
      });
      set({ isLoading: true });

      try {
        const i18n = getI18nHolder().instance;
        if (i18n) {
          await i18n.changeLanguage(lng);
        }

        applyDOMAttributes(lng);
        set({ currentLanguage: lng, isRTL: isRTL(lng), isLoading: false });
      } catch (error) {
        console.error('[language-store] setLanguage error:', error);
        set({ isLoading: false });
        throw error;
      }
    },

    /**
     * Set available languages
     *
     * @param languages - Array of language data objects
     */
    setAvailableLanguages: (languages: LanguageData[]) => {
      set({ availableLanguages: languages });
    },
  }),

  /**
   * Initialize language store
   *
   * - Stores i18n instance in module-level closure
   * - Populates available languages
   * - Resolves initial language (persisted > i18n detected > fallback)
   * - Syncs persisted language back to i18next if needed
   * - Subscribes to i18next languageChanged as safety net
   * - Applies DOM attributes
   */
  initialize: async (data?: Record<string, unknown>): Promise<boolean> => {
    try {
      const initData = data as
        | {
            i18n?: I18nLike;
            supportedLanguages?: LanguageData[];
            fallbackLanguage?: string;
          }
        | undefined;

      console.log('[language-store] Initializing...', {
        hasI18n: !!initData?.i18n,
        supportedCount: initData?.supportedLanguages?.length ?? 0,
        fallback: initData?.fallbackLanguage,
      });

      // Store i18n instance in module-level closure
      if (initData?.i18n) {
        getI18nHolder().instance = initData.i18n;
      }

      const state = useLanguageStore.getState();

      // Set available languages
      if (initData?.supportedLanguages) {
        state.setAvailableLanguages(initData.supportedLanguages);
      }

      const supportedCodes = (initData?.supportedLanguages || []).map(
        (l) => l.id
      );
      const i18nLanguage = getI18nHolder().instance?.language;
      const fallback = initData?.fallbackLanguage || 'en';

      // Check if zustand persist has a stored preference
      let hasPersistedPreference = false;
      if (typeof localStorage !== 'undefined') {
        try {
          hasPersistedPreference =
            localStorage.getItem('dndev-language-store') !== null;
        } catch {
          // localStorage not available (SSR, private browsing)
        }
      }

      let targetLanguage: string;
      const persistedLanguage = state.currentLanguage;

      if (
        hasPersistedPreference &&
        supportedCodes.includes(persistedLanguage)
      ) {
        // Persisted preference is valid — sync to i18next
        targetLanguage = persistedLanguage;
        const i18nRef = getI18nHolder().instance;
        if (i18nRef && i18nRef.language !== persistedLanguage) {
          await i18nRef.changeLanguage(persistedLanguage);
        }
      } else if (i18nLanguage && supportedCodes.includes(i18nLanguage)) {
        // Use i18next detected language
        targetLanguage = i18nLanguage;
      } else {
        targetLanguage = fallback;
      }

      console.log('[language-store] Resolved language:', {
        target: targetLanguage,
        persisted: persistedLanguage,
        hasPersistedPreference,
        i18nLanguage,
        supportedCodes,
      });

      // Apply DOM attributes
      applyDOMAttributes(targetLanguage);

      useLanguageStore.setState({
        currentLanguage: targetLanguage,
        isRTL: isRTL(targetLanguage),
      });

      // Subscribe to i18next languageChanged as safety net for external changes
      const i18nSub = getI18nHolder().instance;
      if (i18nSub) {
        i18nSub.on('languageChanged', (lng: string) => {
          const current = useLanguageStore.getState().currentLanguage;
          if (lng !== current) {
            console.log('[language-store] i18next languageChanged:', lng);
            applyDOMAttributes(lng);
            useLanguageStore.setState({
              currentLanguage: lng,
              isRTL: isRTL(lng),
            });
          }
        });
      }

      console.log('[language-store] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[language-store] Initialization error:', error);
      return false;
    }
  },

  /**
   * Persist configuration
   * Only persists currentLanguage — runtime state (availableLanguages, isRTL) is derived
   */
  persistOptions: {
    name: 'dndev-language-store',
    partialize: (state) => ({
      currentLanguage: state.currentLanguage,
    }),
  },
});

// ============================================================================
// FINE-GRAINED HOOKS
// ============================================================================

/**
 * Language API type — complete interface for useLanguage
 */
export type LanguageAPI = LanguageState & LanguageActions;

/**
 * Hook for accessing language state and actions
 * Fine-grained selectors — subscribe only to the property you need
 *
 * @param key - Property key from LanguageAPI to subscribe to
 * @returns The value of the requested property
 *
 * @example
 * ```typescript
 * const currentLanguage = useLanguage('currentLanguage');
 * const isRTL = useLanguage('isRTL');
 * const setLanguage = useLanguage('setLanguage');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useLanguage<K extends keyof LanguageAPI>(
  key: K
): LanguageAPI[K] {
  return useLanguageStore((state) => state[key]);
}

/**
 * Convenience hook to check if LanguageStore is ready
 * Consistent with useThemeReady() / useConsentReady() pattern
 *
 * @returns true when LanguageStore has finished initialization
 *
 * @example
 * ```tsx
 * const isReady = useLanguageReady();
 * if (!isReady) return <Loading />;
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useLanguageReady = () =>
  useLanguageStore((state) => state.isReady);
