// packages/core/stores/src/templates/consentStore.ts

/**
 * @fileoverview Consent store template
 * @description Zustand store for managing user consent preferences
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { CONSENT_CATEGORY } from '@donotdev/types';
import type {
  AppConfig,
  AppCookieCategories,
  ConsentAPI,
  ConsentState,
  DoNotDevCookieCategories,
} from '@donotdev/types';
import {
  deleteCookie,
  getCookie,
  handleError,
  setCookie,
  isClient,
  isDev,
  isFeatureAvailable,
  FRAMEWORK_FEATURES,
  type FrameworkFeature,
} from '@donotdev/utils';

import {
  createDoNotDevStore,
  type DoNotDevStore,
} from '../createDoNotDevStore';

const FRAMEWORK_FEATURES_SET = new Set(Object.values(FRAMEWORK_FEATURES));
const CONSENT_COOKIE_NAME = 'dndev-cookie-consent';
const CONSENT_COOKIE_EXPIRY = 365;

const defaultState: ConsentState = {
  hasConsented: false,
  categories: { necessary: true },
  timestamp: null,
  version: '1.0',
};

function readConsentCookie(
  cookieValue: string | null
): Partial<ConsentState> | null {
  if (cookieValue && !isClient()) {
    try {
      const parsed = JSON.parse(cookieValue);
      if (typeof parsed === 'object' && parsed !== null) {
        const categories: AppCookieCategories = {
          necessary: true,
        };
        if (parsed.categories?.[CONSENT_CATEGORY.FUNCTIONAL] !== undefined) {
          categories[CONSENT_CATEGORY.FUNCTIONAL] = Boolean(
            parsed.categories[CONSENT_CATEGORY.FUNCTIONAL]
          );
        }
        if (parsed.categories?.[CONSENT_CATEGORY.ANALYTICS] !== undefined) {
          categories[CONSENT_CATEGORY.ANALYTICS] = Boolean(
            parsed.categories[CONSENT_CATEGORY.ANALYTICS]
          );
        }
        if (parsed.categories?.[CONSENT_CATEGORY.MARKETING] !== undefined) {
          categories[CONSENT_CATEGORY.MARKETING] = Boolean(
            parsed.categories[CONSENT_CATEGORY.MARKETING]
          );
        }
        // C-NEW-3 fix: return the parsed SSR result instead of falling through
        return {
          hasConsented: Boolean(parsed.hasConsented),
          categories,
          timestamp: parsed.timestamp || null,
          version: parsed.version || '1.0',
        };
      }
    } catch (error) {
      handleError(error, {
        userMessage: 'Failed to parse SSR cookie value',
        context: { operation: 'consent_cookie_parsing' },
        severity: 'warning',
        log: true,
        reportToSentry: false,
        showNotification: false,
      });
    }
    // SSR with a cookie value that failed to parse — return null
    return null;
  }

  if (!isClient()) return null;

  try {
    const value = getCookie(CONSENT_COOKIE_NAME);
    if (!value) return null;

    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      const categories: AppCookieCategories = {
        necessary: true,
      };
      if (parsed.categories?.[CONSENT_CATEGORY.FUNCTIONAL] !== undefined) {
        categories[CONSENT_CATEGORY.FUNCTIONAL] = Boolean(
          parsed.categories[CONSENT_CATEGORY.FUNCTIONAL]
        );
      }
      if (parsed.categories?.[CONSENT_CATEGORY.ANALYTICS] !== undefined) {
        categories[CONSENT_CATEGORY.ANALYTICS] = Boolean(
          parsed.categories[CONSENT_CATEGORY.ANALYTICS]
        );
      }
      if (parsed.categories?.[CONSENT_CATEGORY.MARKETING] !== undefined) {
        categories[CONSENT_CATEGORY.MARKETING] = Boolean(
          parsed.categories[CONSENT_CATEGORY.MARKETING]
        );
      }
      return {
        hasConsented: Boolean(parsed.hasConsented),
        categories,
        timestamp: parsed.timestamp || null,
        version: parsed.version || '1.0',
      };
    }
  } catch (error) {
    handleError(error, {
      userMessage: 'Failed to parse consent cookie',
      context: { operation: 'consent_cookie_parsing' },
      severity: 'warning',
      log: true,
      reportToSentry: false,
      showNotification: false,
    });
  }

  return null;
}

function saveConsentCookie(state: ConsentState): void {
  if (!isClient()) return;

  try {
    const consentData = {
      hasConsented: state.hasConsented,
      categories: state.categories,
      timestamp: state.timestamp,
      version: state.version,
    };

    setCookie(CONSENT_COOKIE_NAME, JSON.stringify(consentData), {
      expires: CONSENT_COOKIE_EXPIRY,
      secure: window.location.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
    });

    // Verify cookie was set (for debugging incognito issues)
    const verifyCookie = getCookie(CONSENT_COOKIE_NAME);
    if (!verifyCookie && isDev()) {
      console.warn(
        '[ConsentStore] Cookie may not have been set (incognito mode?)'
      );
    }
  } catch (error) {
    handleError(error, {
      userMessage: 'Failed to save cookie preferences',
      context: { operation: 'save_consent_cookie' },
      severity: 'warning',
      log: true,
      reportToSentry: false,
      showNotification: false,
    });
  }
}

function updateConsentState(
  set: (state: Partial<ConsentState>) => void,
  get: () => ConsentState,
  updates: Partial<AppCookieCategories>
): void {
  const currentState = get();
  const newState: ConsentState = {
    ...currentState,
    hasConsented: true,
    categories: {
      ...currentState.categories,
      ...updates,
    },
    timestamp: new Date().toISOString(),
  };

  set(newState);
  saveConsentCookie(newState);
}

/**
 * Consent store hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useConsentStore = createDoNotDevStore<ConsentAPI>({
  name: 'consent-store',
  createStore: (set, get) => ({
    ...defaultState,
    showBanner: false,

    showCookieBanner: () => {
      set({ showBanner: true });
    },

    acceptAll: () => {
      updateConsentState(set, get, {
        functional: true,
        analytics: true,
        marketing: true,
      });
      set({ showBanner: false });
    },

    declineAll: () => {
      updateConsentState(set, get, {
        functional: false,
        analytics: false,
        marketing: false,
      });
      set({ showBanner: false });
    },

    updateCategory: (
      category: keyof DoNotDevCookieCategories,
      value: boolean
    ) => {
      if (category === CONSENT_CATEGORY.NECESSARY) {
        handleError(new Error('Cannot modify necessary category'), {
          userMessage: 'Cannot modify necessary category',
          context: { operation: 'consent_category_update', category },
          severity: 'warning',
          log: true,
          reportToSentry: false,
          showNotification: false,
        });
        return;
      }

      const currentState = get();
      const newState: ConsentState = {
        ...currentState,
        hasConsented: true,
        categories: {
          ...currentState.categories,
          [category]: value,
        },
        timestamp: new Date().toISOString(),
      };

      set({ ...newState, showBanner: false });
      saveConsentCookie(newState);
    },

    hasCategory: (category: keyof DoNotDevCookieCategories) => {
      const state = get();
      return state.categories[category] ?? false;
    },

    reset: () => {
      if (isClient()) {
        // Delete cookie - try both secure and non-secure to handle localhost edge cases
        const isSecure = window.location.protocol === 'https:';
        deleteCookie(CONSENT_COOKIE_NAME, {
          path: '/',
          secure: isSecure,
          sameSite: 'lax',
        });
        // Also try non-secure deletion in case cookie was set differently
        if (!isSecure) {
          deleteCookie(CONSENT_COOKIE_NAME, {
            path: '/',
            secure: false,
            sameSite: 'lax',
          });
        }
        // Verify cookie was deleted
        const verifyCookie = getCookie(CONSENT_COOKIE_NAME);
        if (verifyCookie && isDev()) {
          console.warn(
            '[ConsentStore] Cookie deletion may have failed, cookie still exists'
          );
        }
      }
      const resetState = { ...defaultState, isReady: true };
      set(resetState);
    },

    saveConsent: () => {
      saveConsentCookie(get());
    },
  }),
  initialize: async (data?: Record<string, unknown>) => {
    try {
      const initData = data as {
        cookieValue?: string | null;
        appConfig?: AppConfig;
      };

      const featuresConfig = initData?.appConfig?.features;
      const savedConsent = readConsentCookie(initData?.cookieValue ?? null);

      const categories: AppCookieCategories = {
        necessary: true,
      };

      // Initialize consent categories from saved consent or defaults
      if (savedConsent?.categories) {
        if (
          savedConsent.categories[CONSENT_CATEGORY.FUNCTIONAL] !== undefined
        ) {
          categories[CONSENT_CATEGORY.FUNCTIONAL] =
            savedConsent.categories[CONSENT_CATEGORY.FUNCTIONAL];
        }
        if (savedConsent.categories[CONSENT_CATEGORY.ANALYTICS] !== undefined) {
          categories[CONSENT_CATEGORY.ANALYTICS] =
            savedConsent.categories[CONSENT_CATEGORY.ANALYTICS];
        }
        if (savedConsent.categories[CONSENT_CATEGORY.MARKETING] !== undefined) {
          categories[CONSENT_CATEGORY.MARKETING] =
            savedConsent.categories[CONSENT_CATEGORY.MARKETING];
        }
      }

      const initialState: ConsentState = {
        ...defaultState,
        // Only merge savedConsent if it exists and has valid data
        // If cookie was deleted (savedConsent is null), ensure hasConsented is false
        ...(savedConsent && savedConsent.hasConsented !== undefined
          ? savedConsent
          : { hasConsented: false }),
        categories,
      };

      useConsentStore.setState(initialState);
    } catch (error) {
      handleError(error, {
        userMessage: 'Consent store initialization failed',
        context: { store: 'consent' },
        severity: 'error',
        log: true,
        reportToSentry: true,
        showNotification: false,
      });
    } finally {
      useConsentStore.setState({ isReady: true });
    }

    return true;
  },
});

/**
 * Hook for accessing consent store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
/**
 * React hook for consent with property-based access
 *
 * Single entry point for all consent operations.
 * Follows the same pattern as useAuth and useStripeBilling.
 *
 * **Property-based access:**
 * ```typescript
 * // ✅ State from store (reactive, re-renders on change)
 * const hasConsented = useConsent('hasConsented');
 * const categories = useConsent('categories');
 * const showBanner = useConsent('showBanner');
 *
 * // ✅ Methods from store (stable, never re-renders)
 * const acceptAll = useConsent('acceptAll');
 * const showCookieBanner = useConsent('showCookieBanner');
 * ```
 *
 * @template K - The property key from ConsentAPI
 * @param key - Property name to access
 * @returns The value of the specified property
 *
 * @example
 * ```typescript
 * // Get consent state (re-renders when consent changes)
 * const hasConsented = useConsent('hasConsented');
 * if (!hasConsented) return <ConsentBanner />;
 *
 * // Get show banner method (stable, never re-renders)
 * const showBanner = useConsent('showCookieBanner');
 * <button onClick={showBanner}>Cookie Settings</button>
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
const degradedConsent: ConsentAPI = {
  hasConsented: false,
  categories: { necessary: true },
  timestamp: null,
  version: '1.0',
  showBanner: false,
  hasCategory: () => false,
  acceptAll: () => {},
  declineAll: () => {},
  updateCategory: () => {},
  reset: () => {},
  saveConsent: () => {},
  showCookieBanner: () => {},
};

export function useConsent<K extends keyof ConsentAPI>(key: K): ConsentAPI[K] {
  // C-NEW-4 fix: hook must be called unconditionally (Rules of Hooks).
  // On SSR the store exists but we return degraded values via the selector.
  const storeValue = useConsentStore((state: ConsentStoreState) => state[key]);

  if (!isClient()) {
    return degradedConsent[key];
  }

  return storeValue;
}

type ConsentStoreState = ConsentAPI & DoNotDevStore;

/**
 * Hook to check if consent store is ready
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useConsentReady = () =>
  useConsentStore((state: ConsentStoreState) => state.isReady);

/**
 * Hook to get functional consent status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useFunctionalConsent = () =>
  useConsentStore(
    (state: ConsentStoreState) =>
      state.categories[CONSENT_CATEGORY.FUNCTIONAL] ?? false
  );

/**
 * Hook to get analytics consent status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useAnalyticsConsent = () =>
  useConsentStore(
    (state: ConsentStoreState) =>
      state.categories[CONSENT_CATEGORY.ANALYTICS] ?? false
  );

/**
 * Hook to get marketing consent status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useMarketingConsent = () =>
  useConsentStore(
    (state: ConsentStoreState) =>
      state.categories[CONSENT_CATEGORY.MARKETING] ?? false
  );

/**
 * Hook to check if user has consented
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useHasConsented = () =>
  useConsentStore((state: ConsentStoreState) => state.hasConsented);

/**
 * Hook for checking feature availability
 *
 * Now only checks if feature is available via env vars/package installation.
 * Consent is separate - only for cookies/tracking (GDPR).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useFeatureConsent(feature: string): boolean {
  // Feature availability is now purely based on detection (env vars, packages)
  // not consent. Consent is only for cookies/tracking.
  if (FRAMEWORK_FEATURES_SET.has(feature as FrameworkFeature)) {
    return isFeatureAvailable(feature as FrameworkFeature);
  }
  // Unknown features default to available (no gating)
  return true;
}
