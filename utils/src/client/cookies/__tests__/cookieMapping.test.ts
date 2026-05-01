import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../features/featureDetection', () => ({
  isFeatureAvailable: vi.fn(() => false),
}));

import { isFeatureAvailable } from '../../features/featureDetection';
import {
  getActiveCookies,
  getCookiesByCategory,
  hasOptionalCookies,
  formatCookieList,
  getCookieExamples,
} from '../cookieMapping';

import type { CookieInfo } from '../cookieMapping';

const mockIsFeatureAvailable = vi.mocked(isFeatureAvailable);

describe('getActiveCookies', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('always includes framework cookies', () => {
    const cookies = getActiveCookies();
    const names = cookies.map((c) => c.name);

    expect(names).toContain('dndev-cookie-consent');
    expect(names).toContain('dndev-theme');
    expect(names).toContain('dndev-lang');
  });

  it('returns exactly 3 cookies when no features are active', () => {
    const cookies = getActiveCookies();
    expect(cookies).toHaveLength(3);
  });

  it('includes auth cookies when auth feature is available', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'auth');

    const cookies = getActiveCookies();
    const names = cookies.map((c) => c.name);

    expect(names).toContain('__session');
    expect(names).toContain('__Secure-*');
  });

  it('includes billing cookies when billing feature is available', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'billing');

    const cookies = getActiveCookies();
    const names = cookies.map((c) => c.name);

    expect(names).toContain('__stripe_mid');
    expect(names).toContain('__stripe_sid');
  });

  it('includes oauth cookies when oauth feature is available', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'oauth');

    const cookies = getActiveCookies();
    const names = cookies.map((c) => c.name);

    expect(names).toContain('oauth_state');
  });

  it('includes cookies from multiple active features', () => {
    mockIsFeatureAvailable.mockImplementation(
      (f) => f === 'auth' || f === 'billing'
    );

    const cookies = getActiveCookies();
    // 3 framework + 2 auth + 2 billing = 7
    expect(cookies).toHaveLength(7);
  });

  it('adds no cookies for features with empty cookie arrays', () => {
    mockIsFeatureAvailable.mockImplementation(
      (f) => f === 'i18n' || f === 'routes' || f === 'crud' || f === 'themes'
    );

    const cookies = getActiveCookies();
    // Only framework cookies; i18n, routes, crud, themes have empty arrays
    expect(cookies).toHaveLength(3);
  });

  it('all framework cookies are category necessary', () => {
    const cookies = getActiveCookies();
    cookies.forEach((c) => {
      expect(c.category).toBe('necessary');
    });
  });

  it('all framework cookies have provider DoNotDev Framework', () => {
    const cookies = getActiveCookies();
    cookies.forEach((c) => {
      expect(c.provider).toBe('DoNotDev Framework');
    });
  });
});

describe('getCookiesByCategory', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('returns necessary cookies', () => {
    const cookies = getCookiesByCategory('necessary');
    expect(cookies.length).toBeGreaterThan(0);
    cookies.forEach((c) => {
      expect(c.category).toBe('necessary');
    });
  });

  it('returns empty array for analytics category when none exist', () => {
    const cookies = getCookiesByCategory('analytics');
    expect(cookies).toEqual([]);
  });

  it('returns empty array for marketing category when none exist', () => {
    const cookies = getCookiesByCategory('marketing');
    expect(cookies).toEqual([]);
  });

  it('returns empty array for functional category when none exist', () => {
    const cookies = getCookiesByCategory('functional');
    expect(cookies).toEqual([]);
  });

  it('filters correctly with features active', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'auth');

    const necessary = getCookiesByCategory('necessary');
    // 3 framework + 2 auth = 5
    expect(necessary).toHaveLength(5);
  });
});

describe('hasOptionalCookies', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('returns false when only necessary cookies exist', () => {
    expect(hasOptionalCookies()).toBe(false);
  });

  it('returns false when all feature cookies are necessary', () => {
    mockIsFeatureAvailable.mockReturnValue(true);
    // All defined cookies in FEATURE_COOKIES are 'necessary'
    expect(hasOptionalCookies()).toBe(false);
  });
});

describe('formatCookieList', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('returns formatted string for necessary cookies', () => {
    const result = formatCookieList('necessary');
    expect(result).toContain('dndev-cookie-consent');
    expect(result).toContain('DoNotDev Framework');
    expect(result).toContain('Stores cookie preferences');
  });

  it('returns empty string for category with no cookies', () => {
    expect(formatCookieList('analytics')).toBe('');
    expect(formatCookieList('marketing')).toBe('');
    expect(formatCookieList('functional')).toBe('');
  });

  it('formats each cookie as name (provider): purpose', () => {
    const result = formatCookieList('necessary');
    // Check format pattern
    expect(result).toMatch(
      /dndev-cookie-consent \(DoNotDev Framework\): Stores cookie preferences/
    );
  });

  it('joins multiple cookies with comma separator', () => {
    const result = formatCookieList('necessary');
    // 3 framework cookies joined by ', '
    const parts = result.split(', ');
    expect(parts).toHaveLength(3);
  });

  it('includes feature cookies when features are active', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'billing');

    const result = formatCookieList('necessary');
    expect(result).toContain('__stripe_mid');
    expect(result).toContain('Stripe');
  });
});

describe('getCookieExamples', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('returns empty string for category with no cookies', () => {
    expect(getCookieExamples('analytics')).toBe('');
    expect(getCookieExamples('marketing')).toBe('');
    expect(getCookieExamples('functional')).toBe('');
  });

  it('groups cookies by provider', () => {
    const result = getCookieExamples('necessary');
    expect(result).toContain('DoNotDev Framework:');
  });

  it('includes all framework cookie names under provider', () => {
    const result = getCookieExamples('necessary');
    expect(result).toContain('dndev-cookie-consent');
    expect(result).toContain('dndev-theme');
    expect(result).toContain('dndev-lang');
  });

  it('separates providers with bullet separator', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'auth');

    const result = getCookieExamples('necessary');
    // Should have DoNotDev Framework and Firebase Auth separated by ' • '
    expect(result).toContain(' • ');
  });

  it('groups multiple cookies from same provider', () => {
    mockIsFeatureAvailable.mockImplementation((f) => f === 'billing');

    const result = getCookieExamples('necessary');
    // Stripe cookies should be grouped: "Stripe: __stripe_mid, __stripe_sid"
    expect(result).toMatch(/Stripe: __stripe_mid, __stripe_sid/);
  });
});

describe('CookieInfo structure', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('every cookie has required fields', () => {
    mockIsFeatureAvailable.mockReturnValue(true);

    const cookies = getActiveCookies();
    cookies.forEach((cookie: CookieInfo) => {
      expect(cookie.name).toBeDefined();
      expect(typeof cookie.name).toBe('string');
      expect(cookie.name.length).toBeGreaterThan(0);

      expect(cookie.category).toBeDefined();
      expect(['necessary', 'functional', 'analytics', 'marketing']).toContain(
        cookie.category
      );

      expect(cookie.purpose).toBeDefined();
      expect(typeof cookie.purpose).toBe('string');
      expect(cookie.purpose.length).toBeGreaterThan(0);

      expect(cookie.provider).toBeDefined();
      expect(typeof cookie.provider).toBe('string');
      expect(cookie.provider.length).toBeGreaterThan(0);
    });
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    mockIsFeatureAvailable.mockReset();
    mockIsFeatureAvailable.mockReturnValue(false);
  });

  it('getActiveCookies returns new array each call', () => {
    const a = getActiveCookies();
    const b = getActiveCookies();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('changing feature availability changes returned cookies', () => {
    mockIsFeatureAvailable.mockReturnValue(false);
    const before = getActiveCookies();

    mockIsFeatureAvailable.mockImplementation((f) => f === 'auth');
    const after = getActiveCookies();

    expect(after.length).toBeGreaterThan(before.length);
  });

  it('all features active returns all defined cookies', () => {
    mockIsFeatureAvailable.mockReturnValue(true);

    const cookies = getActiveCookies();
    // 3 framework + 2 auth + 2 billing + 1 oauth = 8
    // (i18n, routes, crud, themes, components, forms, realtime, storage have empty arrays)
    expect(cookies).toHaveLength(8);
  });

  it('getCookiesByCategory with all features returns correct count', () => {
    mockIsFeatureAvailable.mockReturnValue(true);

    const necessary = getCookiesByCategory('necessary');
    // All cookies in the system are 'necessary'
    expect(necessary).toHaveLength(8);
  });
});
