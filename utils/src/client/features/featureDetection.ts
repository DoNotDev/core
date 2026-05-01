// packages/core/utils/src/client/features/featureDetection.ts

/**
 * @fileoverview Feature Detection System for DoNotDev Framework
 * @description Detects which features are available and configured, enabling conditional loading
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getPlatformEnvVar } from '../appConfig';
import { getEnabledAuthPartners } from '../partners';

// Feature availability cache
const featureCache = new Map<string, boolean>();

/**
 * Available framework features
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FRAMEWORK_FEATURES = {
  // Authentication
  AUTH: 'auth',
  OAUTH: 'oauth',

  // Internationalization
  I18N: 'i18n',

  // Billing/Subscriptions
  BILLING: 'billing',

  // Routing
  ROUTES: 'routes',

  // UI/Components
  THEMES: 'themes',
  COMPONENTS: 'components',

  // Data Management
  CRUD: 'crud',
  FORMS: 'forms',

  // Real-time
  REALTIME: 'realtime',

  // Storage
  STORAGE: 'storage',

  // AI
  AI: 'ai',
} as const;

/**
 * Framework feature type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FrameworkFeature =
  (typeof FRAMEWORK_FEATURES)[keyof typeof FRAMEWORK_FEATURES];

/**
 * Feature availability map
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type FeatureAvailability = Record<FrameworkFeature, boolean>;

/**
 * Check if an environment variable is set (exists and non-empty)
 * @param value Environment variable value
 * @returns True if set
 */
function hasEnvVar(value: string | undefined): boolean {
  return !!value && value.trim() !== '';
}

/**
 * Feature detection functions
 */
const FEATURE_DETECTORS: Record<FrameworkFeature, () => boolean> = {
  [FRAMEWORK_FEATURES.AUTH]: () => {
    const enabledPartners = getEnabledAuthPartners();
    return enabledPartners.length > 0;
  },

  [FRAMEWORK_FEATURES.OAUTH]: () => {
    // Convention: VITE_{PROVIDER}_CLIENT_ID
    const oauthVars = [
      'VITE_GOOGLE_CLIENT_ID',
      'VITE_GITHUB_CLIENT_ID',
      'VITE_FACEBOOK_CLIENT_ID',
      'VITE_TWITTER_CLIENT_ID',
      'VITE_LINKEDIN_CLIENT_ID',
      'VITE_DISCORD_CLIENT_ID',
      'VITE_SLACK_CLIENT_ID',
      'VITE_MICROSOFT_CLIENT_ID',
      'VITE_APPLE_CLIENT_ID',
    ];

    return oauthVars.some((varName) => hasEnvVar(getPlatformEnvVar(varName)));
  },

  [FRAMEWORK_FEATURES.I18N]: () => {
    // i18n is always available - falls back to plain labels when no translations configured
    return true;
  },

  [FRAMEWORK_FEATURES.BILLING]: () => {
    return !!(
      hasEnvVar(getPlatformEnvVar('STRIPE_PUBLISHABLE_KEY')) ||
      (hasEnvVar(getPlatformEnvVar('BILLING_ENABLED')) &&
        getPlatformEnvVar('BILLING_ENABLED') === 'true')
    );
  },

  [FRAMEWORK_FEATURES.ROUTES]: () => {
    // Routes are always available (basic routing)
    return true;
  },

  [FRAMEWORK_FEATURES.THEMES]: () => {
    // Themes are always available (basic theming)
    return true;
  },

  [FRAMEWORK_FEATURES.COMPONENTS]: () => {
    // Components are always available
    return true;
  },

  [FRAMEWORK_FEATURES.CRUD]: () => {
    // CRUD is always available if package is installed
    // Safe hooks handle graceful degradation
    return true;
  },

  [FRAMEWORK_FEATURES.FORMS]: () => {
    // Forms are always available (basic form handling)
    return true;
  },

  [FRAMEWORK_FEATURES.REALTIME]: () => {
    return !!(
      (hasEnvVar(getPlatformEnvVar('REALTIME_ENABLED')) &&
        getPlatformEnvVar('REALTIME_ENABLED') === 'true') ||
      hasEnvVar(getPlatformEnvVar('FIREBASE_CONFIG'))
    );
  },

  [FRAMEWORK_FEATURES.STORAGE]: () => {
    return !!(
      (hasEnvVar(getPlatformEnvVar('STORAGE_ENABLED')) &&
        getPlatformEnvVar('STORAGE_ENABLED') === 'true') ||
      hasEnvVar(getPlatformEnvVar('FIREBASE_CONFIG'))
    );
  },

  [FRAMEWORK_FEATURES.AI]: () => {
    // Only check public flags - never check API keys on client (they're server-only)
    return !!(
      hasEnvVar(getPlatformEnvVar('AI_ENABLED')) &&
      getPlatformEnvVar('AI_ENABLED') === 'true'
    );
  },
};

/**
 * Check if a specific feature is available and configured
 * @param feature The feature to check
 * @returns True if the feature is available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isFeatureAvailable(feature: FrameworkFeature): boolean {
  // Check cache first
  if (featureCache.has(feature)) {
    return featureCache.get(feature)!;
  }

  // Run detector
  const isAvailable = FEATURE_DETECTORS[feature]();

  // Cache result
  featureCache.set(feature, isAvailable);

  return isAvailable;
}

/**
 * Get all available features
 * @returns Array of available feature names
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAvailableFeatures(): FrameworkFeature[] {
  return Object.values(FRAMEWORK_FEATURES).filter(isFeatureAvailable);
}

/**
 * Check if multiple features are available
 * @param features Array of features to check
 * @returns True if all features are available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function areFeaturesAvailable(features: FrameworkFeature[]): boolean {
  return features.every(isFeatureAvailable);
}

/**
 * Get feature availability summary
 * @returns Object with feature availability status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getFeatureSummary(): Record<FrameworkFeature, boolean> {
  const summary: Record<FrameworkFeature, boolean> = {} as any;

  Object.values(FRAMEWORK_FEATURES).forEach((feature) => {
    summary[feature] = isFeatureAvailable(feature);
  });

  return summary;
}

/**
 * Clear feature cache (useful for testing or dynamic config changes)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function clearFeatureCache(): void {
  featureCache.clear();
}
