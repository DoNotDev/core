// packages/core/utils/src/client/cookies/cookieMapping.ts

/**
 * @fileoverview Runtime cookie mapping for consent banner
 * @description Maps detected features to actual cookies used, for transparency
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { isFeatureAvailable } from '../features/featureDetection';

import type { FrameworkFeature } from '../features/featureDetection';

/** Metadata for a single cookie used by the consent banner. */
export interface CookieInfo {
  name: string;
  category: 'necessary' | 'functional' | 'analytics' | 'marketing';
  purpose: string;
  provider: string;
}

/**
 * Cookie definitions by feature
 */
const FEATURE_COOKIES: Record<FrameworkFeature, CookieInfo[]> = {
  auth: [
    {
      name: '__session',
      category: 'necessary',
      purpose: 'Authentication session',
      provider: 'Firebase Auth',
    },
    {
      name: '__Secure-*',
      category: 'necessary',
      purpose: 'Security tokens',
      provider: 'Firebase Auth',
    },
  ],
  billing: [
    {
      name: '__stripe_mid',
      category: 'necessary',
      purpose: 'Fraud prevention',
      provider: 'Stripe',
    },
    {
      name: '__stripe_sid',
      category: 'necessary',
      purpose: 'Checkout session',
      provider: 'Stripe',
    },
  ],
  oauth: [
    {
      name: 'oauth_state',
      category: 'necessary',
      purpose: 'OAuth security',
      provider: 'OAuth providers',
    },
  ],
  i18n: [], // i18n uses dndev-lang, listed in framework cookies
  routes: [], // No cookies
  crud: [], // No cookies
  themes: [], // themes use dndev-theme, listed in framework cookies
  components: [], // No cookies
  forms: [], // No cookies
  realtime: [], // No cookies
  storage: [], // No cookies
  ai: [], // No cookies - API calls only
};

/**
 * Framework core cookies (always present)
 */
const FRAMEWORK_COOKIES: CookieInfo[] = [
  {
    name: 'dndev-cookie-consent',
    category: 'necessary',
    purpose: 'Stores cookie preferences',
    provider: 'DoNotDev Framework',
  },
  {
    name: 'dndev-theme',
    category: 'necessary',
    purpose: 'Theme preference (dark/light mode)',
    provider: 'DoNotDev Framework',
  },
  {
    name: 'dndev-lang',
    category: 'necessary',
    purpose: 'Language preference',
    provider: 'DoNotDev Framework',
  },
];

/**
 * Get all cookies being used based on detected features
 */
export function getActiveCookies(): CookieInfo[] {
  const cookies: CookieInfo[] = [...FRAMEWORK_COOKIES];

  // Add feature cookies if features are detected
  (Object.keys(FEATURE_COOKIES) as FrameworkFeature[]).forEach((feature) => {
    if (isFeatureAvailable(feature)) {
      cookies.push(...FEATURE_COOKIES[feature]);
    }
  });

  return cookies;
}

/**
 * Get cookies by category
 */
export function getCookiesByCategory(
  category: 'necessary' | 'functional' | 'analytics' | 'marketing'
): CookieInfo[] {
  return getActiveCookies().filter((cookie) => cookie.category === category);
}

/**
 * Check if app uses any optional cookies (functional/analytics/marketing)
 */
export function hasOptionalCookies(): boolean {
  const cookies = getActiveCookies();
  return cookies.some((c) => c.category !== 'necessary');
}

/**
 * Get human-readable cookie list for a category
 */
export function formatCookieList(
  category: 'necessary' | 'functional' | 'analytics' | 'marketing'
): string {
  const cookies = getCookiesByCategory(category);
  if (cookies.length === 0) return '';

  return cookies
    .map((c) => `${c.name} (${c.provider}): ${c.purpose}`)
    .join(', ');
}

/**
 * Get cookie examples for banner display (short version)
 */
export function getCookieExamples(
  category: 'necessary' | 'functional' | 'analytics' | 'marketing'
): string {
  const cookies = getCookiesByCategory(category);
  if (cookies.length === 0) return '';

  // Show cookie names grouped by provider
  const byProvider = cookies.reduce(
    (acc, cookie) => {
      if (!acc[cookie.provider]) acc[cookie.provider] = [];
      acc[cookie.provider]!.push(cookie.name);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return Object.entries(byProvider)
    .map(([provider, names]) => `${provider}: ${names?.join(', ') ?? ''}`)
    .join(' • ');
}
