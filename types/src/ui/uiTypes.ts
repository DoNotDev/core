// packages/core/types/src/ui/uiTypes.ts

/**
 * @fileoverview UI Types
 * @description Type definitions for UI system. Defines UI-related interfaces and form field types.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';

import type { AppConfig } from '../layout/layoutTypes';
import type { AuthPartnerId, OAuthPartnerId } from '../partners/schemas';

/**
 * Theme information structure with enhanced metadata
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ThemeInfo {
  /** Unique theme identifier */
  name: string;

  /** User-friendly display name */
  displayName: string;

  /** Theme description */
  description?: string;

  /** Whether this is a dark theme */
  isDark: boolean;

  /** CSS variables for this theme */
  variables?: Record<string, string>;

  /** Enhanced theme metadata */
  meta: {
    /** Icon identifier for UI (e.g., 'SunIcon', 'MoonIcon') */
    icon: string;

    /** Optional theme description for UI */
    description?: string;

    /** Optional category for grouping themes */
    category?: string;

    /** Optional author information */
    author?: string;

    /** Additional metadata */
    [key: string]: any;
  };
}

/**
 * Theme mode setting
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme state in the store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ThemeState {
  /** Currently active theme */
  currentTheme: string;

  /** List of available themes */
  availableThemes: ThemeInfo[];

  /** Whether dark mode is currently active */
  isDarkMode: boolean;

  /** User's theme mode preference */
  themeMode: ThemeMode;

  /** Loading state for theme operations */
  isLoading: boolean;

  /** Error state for theme operations */
  error: string | null;
}

/**
 * Enhanced theme actions for the store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ThemeActions {
  /** Set the current theme with DOM application and persistence */
  setTheme: (theme: string) => Promise<void>;

  /** Update the list of available themes */
  setAvailableThemes: (themes: ThemeInfo[]) => void;

  /** Set dark mode state */
  setDarkMode: (isDark: boolean) => void;

  /** Set theme mode preference */
  setThemeMode: (mode: ThemeMode) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set error state */
  setError: (error: string | null) => void;

  /** Clear error */
  clearError: () => void;

  /** Check if a theme is available */
  isThemeAvailable: (themeName: string) => boolean;

  /** Reset theme settings to defaults */
  resetTheme: () => void;

  /** Get theme info for the current theme */
  getCurrentThemeInfo: () => ThemeInfo | null;

  /** Switch to the next available theme */
  switchToNextTheme: () => void;

  /** Toggle between light and dark theme variants */
  toggleDarkMode: () => void;

  /**
   * Initialize theme system with discovery data and user config
   * @param appConfig - Full AppConfig from AppConfigProvider (store extracts what it needs)
   */
  initialize: (appConfig?: AppConfig) => Promise<boolean>;
}

/**
 * Modal state and actions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ModalState {
  /** Whether the modal is currently open */
  isOpen: boolean;

  /** Modal content */
  content: ReactNode | null;
}

/**
 * Modal actions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ModalActions {
  /** Open the modal with content */
  openModal: (content: ReactNode) => void;

  /** Close the modal */
  closeModal: () => void;
}

// =============================================================================
// Redirect Overlay Types
// =============================================================================

/**
 * Phase of the redirect overlay progression
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type RedirectOverlayPhase =
  | 'connecting'
  | 'preparing'
  | 'redirecting'
  | 'timeout';

/**
 * Billing-specific redirect operations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BillingRedirectOperation = 'stripe-checkout' | 'stripe-portal';

/**
 * Auth partner redirect operations - DRY derived from AUTH_PARTNERS schema
 * Format: `oauth-${partnerId}` for OAuth partners, `auth-${partnerId}` for auth-only
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthRedirectOperation =
  | `oauth-${AuthPartnerId}`
  | `auth-${AuthPartnerId}`;

/**
 * OAuth partner redirect operations - DRY derived from OAUTH_PARTNERS schema
 * Format: `oauth-api-${partnerId}` for API-only OAuth partners
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OAuthRedirectOperation = `oauth-api-${OAuthPartnerId}`;

/**
 * All redirect operations - Union of billing, auth, and OAuth operations
 * Extensible via string intersection for custom operations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type RedirectOperation =
  | BillingRedirectOperation
  | AuthRedirectOperation
  | OAuthRedirectOperation
  | (string & {});

/**
 * Configuration for redirect overlay (optional overrides)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RedirectOverlayConfig {
  /** i18n namespace to use (default: inferred from operation) */
  namespace?: string;
  /** Custom title (overrides i18n) */
  title?: string;
  /** Custom message (overrides i18n) */
  message?: string;
  /** Custom subtitle (overrides i18n) */
  subtitle?: string;
  /** Icon type: 'lock' for payments, 'shield' for auth (default: inferred) */
  icon?: 'lock' | 'shield' | 'none';
  /** Timeout in ms before showing cancel button (default: 10000) */
  cancelTimeout?: number;
}

/**
 * Redirect overlay state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RedirectOverlayState {
  /** Whether the redirect overlay is visible */
  isRedirectOverlayOpen: boolean;
  /** Current operation being performed */
  redirectOperation: RedirectOperation | null;
  /** Current phase of the redirect */
  redirectPhase: RedirectOverlayPhase;
  /** Whether cancel button should be shown */
  showCancelButton: boolean;
  /** Configuration overrides */
  redirectConfig: RedirectOverlayConfig | null;
  /** Timestamp when overlay was shown (for phase progression) */
  redirectStartTime: number | null;
}

/**
 * Redirect overlay actions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RedirectOverlayActions {
  /** Show the redirect overlay */
  showRedirectOverlay: (
    operation: RedirectOperation,
    config?: RedirectOverlayConfig
  ) => void;
  /** Hide the redirect overlay */
  hideRedirectOverlay: () => void;
  /** Update the current phase (internal use) */
  setRedirectPhase: (phase: RedirectOverlayPhase) => void;
  /** Show/hide cancel button (internal use) */
  setShowCancelButton: (show: boolean) => void;
}

/**
 * Loading state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LoadingState {
  /** Whether a data fetch operation is in progress */
  isLoading: boolean;

  /** Whether a background fetch operation is in progress */
  isFetching: boolean;
}

/**
 * Loading actions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LoadingActions {
  /** Set the loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set the fetching state */
  setFetching: (isFetching: boolean) => void;
}

/**
 * Cookie options for setting cookies
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CookieOptions {
  /** Cookie expiration in days (default: 365) */
  expires?: number;
  /** Cookie path (default: '/') */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag (default: true) */
  secure?: boolean;
  /** SameSite attribute (default: 'strict') */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Cookie priority (Chrome 99+) */
  priority?: 'low' | 'medium' | 'high';
  /** Partitioned flag (Chrome 114+) */
  partitioned?: boolean;
}

/**
 * Consent category constants - DRY single source of truth
 * Use these instead of hardcoded strings throughout the codebase
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CONSENT_CATEGORY = {
  NECESSARY: 'necessary',
  FUNCTIONAL: 'functional',
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
} as const;

/**
 * Consent category type - auto-derived from constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type ConsentCategory =
  (typeof CONSENT_CATEGORY)[keyof typeof CONSENT_CATEGORY];

/**
 * Density constants - DRY single source of truth
 * Used for spacing and typography presets via data-density attribute
 * CSS uses these string values directly, but TypeScript code should use constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const DENSITY = {
  COMPACT: 'compact',
  STANDARD: 'standard',
  EXPRESSIVE: 'expressive',
} as const;

/**
 * Density type - auto-derived from constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Density = (typeof DENSITY)[keyof typeof DENSITY];

/**
 * Cookie consent categories
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DoNotDevCookieCategories {
  /** Always granted, cannot be declined - core functionality */
  necessary: boolean;
  /** Requires consent - Firebase Auth, user preferences */
  functional: boolean;
  /** Requires consent - analytics, performance monitoring */
  analytics: boolean;
  /** Requires consent - marketing, ads, remarketing */
  marketing: boolean;
}

/**
 * App cookie categories type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AppCookieCategories = Partial<DoNotDevCookieCategories> & {
  necessary: boolean;
};

/**
 * Consent state interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ConsentState {
  /** Whether user has made a consent choice */
  hasConsented: boolean;
  /** Individual category permissions - only includes categories that are actually required */
  categories: AppCookieCategories;
  /** When consent was last updated */
  timestamp: string | null;
  /** Consent version for future migrations */
  version: string;
}

/**
 * Consent actions interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ConsentActions {
  /** Accept all optional categories */
  acceptAll: () => void;
  /** Decline all optional categories */
  declineAll: () => void;
  /** Update specific category */
  updateCategory: (
    category: keyof DoNotDevCookieCategories,
    value: boolean
  ) => void;
  /** Check if category is granted */
  hasCategory: (category: keyof DoNotDevCookieCategories) => boolean;
  /** Reset consent (for testing) */
  reset: () => void;
  /** Save consent to cookie */
  saveConsent: () => void;
  /** Show cookie banner (for cookie settings link) */
  showCookieBanner: () => void;
}

/**
 * Consent API - All available properties and methods from consent store
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ConsentAPI extends ConsentState, ConsentActions {
  /** Whether banner should be shown */
  showBanner: boolean;
}

/**
 * Feature/Consent Matrix
 *
 * Single source of truth for:
 * - Which features exist in the framework
 * - What consent each feature requires
 * - Type-safe feature names across codebase
 *
 * Uses CONSENT_CATEGORY constants for DRY compliance
 *
 * @example
 * ```typescript
 * // SaaS app (Auth + Billing)
 * features: ['auth', 'billing'] // No consent required (both necessary)
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FEATURE_CONSENT_MATRIX = {
  /** Authentication - Firebase Auth, user sessions */
  auth: { requiresConsent: null },

  /** OAuth - Third-party authentication (Google, GitHub, etc.) */
  oauth: { requiresConsent: null },

  /** Billing - Stripe subscriptions, payments */
  billing: { requiresConsent: null },

  /** Analytics - Usage tracking, performance monitoring */
  analytics: { requiresConsent: CONSENT_CATEGORY.ANALYTICS },

  /** Marketing - Advertising, retargeting */
  marketing: { requiresConsent: CONSENT_CATEGORY.MARKETING },
} as const satisfies Record<
  string,
  { requiresConsent: ConsentCategory | null }
>;

/**
 * Feature name type - auto-derived from matrix
 * TypeScript ensures only valid features are used
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeatureName = keyof typeof FEATURE_CONSENT_MATRIX;

/**
 * Get consent requirement for a specific feature
 *
 * @example
 * ```typescript
 * type AuthConsent = FeatureConsentRequirement<'auth'>; // 'functional'
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeatureConsentRequirement<F extends FeatureName> =
  (typeof FEATURE_CONSENT_MATRIX)[F]['requiresConsent'];

/**
 * Get all features requiring a specific consent category
 *
 * @example
 * ```typescript
 * type FunctionalFeatures = FeaturesRequiringConsent<'functional'>;
 * // 'auth' | 'oauth' | 'billing'
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeaturesRequiringConsent<C extends keyof DoNotDevCookieCategories> =
  {
    [K in FeatureName]: FeatureConsentRequirement<K> extends C ? K : never;
  }[FeatureName];

/**
 * Features that require any consent (excludes null)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeaturesRequiringAnyConsent = {
  [K in FeatureName]: FeatureConsentRequirement<K> extends null ? never : K;
}[FeatureName];

/**
 * Features that don't require consent
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeaturesWithoutConsent = {
  [K in FeatureName]: FeatureConsentRequirement<K> extends null ? K : never;
}[FeatureName];
