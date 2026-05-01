import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getPlatformEnvVar } from '../../appConfig';
import { getEnabledAuthPartners } from '../../partners';
import {
  FRAMEWORK_FEATURES,
  isFeatureAvailable,
  getAvailableFeatures,
  areFeaturesAvailable,
  getFeatureSummary,
  clearFeatureCache,
} from '../featureDetection';

// Mock dependencies (hoisted by vitest automatically)
vi.mock('../../appConfig', () => ({
  getPlatformEnvVar: vi.fn(() => undefined),
}));

vi.mock('../../partners', () => ({
  getEnabledAuthPartners: vi.fn(() => []),
}));

const mockedGetPlatformEnvVar = vi.mocked(getPlatformEnvVar);
const mockedGetEnabledAuthPartners = vi.mocked(getEnabledAuthPartners);

beforeEach(() => {
  clearFeatureCache();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// FRAMEWORK_FEATURES constant
// ---------------------------------------------------------------------------
describe('FRAMEWORK_FEATURES', () => {
  it('contains all expected feature keys', () => {
    const keys = Object.keys(FRAMEWORK_FEATURES);
    expect(keys).toContain('AUTH');
    expect(keys).toContain('OAUTH');
    expect(keys).toContain('I18N');
    expect(keys).toContain('BILLING');
    expect(keys).toContain('ROUTES');
    expect(keys).toContain('THEMES');
    expect(keys).toContain('COMPONENTS');
    expect(keys).toContain('CRUD');
    expect(keys).toContain('FORMS');
    expect(keys).toContain('REALTIME');
    expect(keys).toContain('STORAGE');
  });

  it('maps keys to lowercase string values', () => {
    expect(FRAMEWORK_FEATURES.AUTH).toBe('auth');
    expect(FRAMEWORK_FEATURES.OAUTH).toBe('oauth');
    expect(FRAMEWORK_FEATURES.BILLING).toBe('billing');
    expect(FRAMEWORK_FEATURES.REALTIME).toBe('realtime');
    expect(FRAMEWORK_FEATURES.STORAGE).toBe('storage');
  });
});

// ---------------------------------------------------------------------------
// Always-available features (no env vars needed)
// ---------------------------------------------------------------------------
describe('always-available features', () => {
  it.each([
    FRAMEWORK_FEATURES.I18N,
    FRAMEWORK_FEATURES.ROUTES,
    FRAMEWORK_FEATURES.THEMES,
    FRAMEWORK_FEATURES.COMPONENTS,
    FRAMEWORK_FEATURES.CRUD,
    FRAMEWORK_FEATURES.FORMS,
  ])('%s is always available', (feature) => {
    expect(isFeatureAvailable(feature)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AUTH feature detection
// ---------------------------------------------------------------------------
describe('AUTH feature detection', () => {
  it('returns false when no auth partners are enabled', () => {
    mockedGetEnabledAuthPartners.mockReturnValue([]);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.AUTH)).toBe(false);
  });

  it('returns true when auth partners are enabled', () => {
    mockedGetEnabledAuthPartners.mockReturnValue(['firebase' as any]);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.AUTH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OAUTH feature detection
// ---------------------------------------------------------------------------
describe('OAUTH feature detection', () => {
  it('returns false when no OAuth env vars are set', () => {
    mockedGetPlatformEnvVar.mockReturnValue(undefined);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
  });

  it('returns true when VITE_GOOGLE_CLIENT_ID is set', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'VITE_GOOGLE_CLIENT_ID' ? 'some-client-id' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(true);
  });

  it('returns true when VITE_GITHUB_CLIENT_ID is set', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'VITE_GITHUB_CLIENT_ID' ? 'gh-id' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(true);
  });

  it('returns false when OAuth env var is empty string', () => {
    mockedGetPlatformEnvVar.mockReturnValue('');
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
  });

  it('returns false when OAuth env var is whitespace only', () => {
    mockedGetPlatformEnvVar.mockReturnValue('   ');
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BILLING feature detection
// ---------------------------------------------------------------------------
describe('BILLING feature detection', () => {
  it('returns false when no billing env vars are set', () => {
    mockedGetPlatformEnvVar.mockReturnValue(undefined);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(false);
  });

  it('returns true when STRIPE_PUBLISHABLE_KEY is set', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'STRIPE_PUBLISHABLE_KEY' ? 'pk_test_123' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(true);
  });

  it('returns true when BILLING_ENABLED is "true"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'BILLING_ENABLED' ? 'true' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(true);
  });

  it('returns false when BILLING_ENABLED is "false"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'BILLING_ENABLED' ? 'false' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(false);
  });

  it('returns false when BILLING_ENABLED is non-empty but not "true"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'BILLING_ENABLED' ? 'yes' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REALTIME feature detection
// ---------------------------------------------------------------------------
describe('REALTIME feature detection', () => {
  it('returns false when no realtime env vars are set', () => {
    mockedGetPlatformEnvVar.mockReturnValue(undefined);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.REALTIME)).toBe(false);
  });

  it('returns true when REALTIME_ENABLED is "true"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'REALTIME_ENABLED' ? 'true' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.REALTIME)).toBe(true);
  });

  it('returns true when FIREBASE_CONFIG is set', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'FIREBASE_CONFIG' ? '{"apiKey":"abc"}' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.REALTIME)).toBe(true);
  });

  it('returns false when REALTIME_ENABLED is "false"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'REALTIME_ENABLED' ? 'false' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.REALTIME)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STORAGE feature detection
// ---------------------------------------------------------------------------
describe('STORAGE feature detection', () => {
  it('returns false when no storage env vars are set', () => {
    mockedGetPlatformEnvVar.mockReturnValue(undefined);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.STORAGE)).toBe(false);
  });

  it('returns true when STORAGE_ENABLED is "true"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'STORAGE_ENABLED' ? 'true' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.STORAGE)).toBe(true);
  });

  it('returns true when FIREBASE_CONFIG is set', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'FIREBASE_CONFIG' ? '{"apiKey":"abc"}' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.STORAGE)).toBe(true);
  });

  it('returns false when STORAGE_ENABLED is "false"', () => {
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'STORAGE_ENABLED' ? 'false' : undefined
    );
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.STORAGE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Feature cache
// ---------------------------------------------------------------------------
describe('feature cache', () => {
  it('caches results and does not call detector twice', () => {
    mockedGetEnabledAuthPartners.mockReturnValue(['firebase' as any]);

    isFeatureAvailable(FRAMEWORK_FEATURES.AUTH);
    isFeatureAvailable(FRAMEWORK_FEATURES.AUTH);

    expect(mockedGetEnabledAuthPartners).toHaveBeenCalledTimes(1);
  });

  it('clearFeatureCache resets the cache', () => {
    mockedGetEnabledAuthPartners.mockReturnValue(['firebase' as any]);
    isFeatureAvailable(FRAMEWORK_FEATURES.AUTH);

    clearFeatureCache();
    mockedGetEnabledAuthPartners.mockReturnValue([]);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.AUTH)).toBe(false);
    expect(mockedGetEnabledAuthPartners).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getAvailableFeatures
// ---------------------------------------------------------------------------
describe('getAvailableFeatures', () => {
  it('returns always-on features when nothing is configured', () => {
    const features = getAvailableFeatures();

    expect(features).toContain(FRAMEWORK_FEATURES.I18N);
    expect(features).toContain(FRAMEWORK_FEATURES.ROUTES);
    expect(features).toContain(FRAMEWORK_FEATURES.THEMES);
    expect(features).toContain(FRAMEWORK_FEATURES.COMPONENTS);
    expect(features).toContain(FRAMEWORK_FEATURES.CRUD);
    expect(features).toContain(FRAMEWORK_FEATURES.FORMS);
  });

  it('does not include env-dependent features when not configured', () => {
    const features = getAvailableFeatures();

    expect(features).not.toContain(FRAMEWORK_FEATURES.AUTH);
    expect(features).not.toContain(FRAMEWORK_FEATURES.OAUTH);
    expect(features).not.toContain(FRAMEWORK_FEATURES.BILLING);
    expect(features).not.toContain(FRAMEWORK_FEATURES.REALTIME);
    expect(features).not.toContain(FRAMEWORK_FEATURES.STORAGE);
  });

  it('includes AUTH when auth partners are configured', () => {
    mockedGetEnabledAuthPartners.mockReturnValue(['firebase' as any]);
    const features = getAvailableFeatures();
    expect(features).toContain(FRAMEWORK_FEATURES.AUTH);
  });
});

// ---------------------------------------------------------------------------
// areFeaturesAvailable
// ---------------------------------------------------------------------------
describe('areFeaturesAvailable', () => {
  it('returns true when all requested features are available', () => {
    expect(
      areFeaturesAvailable([
        FRAMEWORK_FEATURES.I18N,
        FRAMEWORK_FEATURES.ROUTES,
        FRAMEWORK_FEATURES.THEMES,
      ])
    ).toBe(true);
  });

  it('returns false when any requested feature is unavailable', () => {
    expect(
      areFeaturesAvailable([
        FRAMEWORK_FEATURES.I18N,
        FRAMEWORK_FEATURES.BILLING,
      ])
    ).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(areFeaturesAvailable([])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFeatureSummary
// ---------------------------------------------------------------------------
describe('getFeatureSummary', () => {
  it('returns a record with all framework features', () => {
    const summary = getFeatureSummary();
    const allFeatures = Object.values(FRAMEWORK_FEATURES);

    for (const feature of allFeatures) {
      expect(typeof summary[feature]).toBe('boolean');
    }
  });

  it('reflects current config state', () => {
    mockedGetEnabledAuthPartners.mockReturnValue(['firebase' as any]);
    mockedGetPlatformEnvVar.mockImplementation((name: string) =>
      name === 'STRIPE_PUBLISHABLE_KEY' ? 'pk_test_123' : undefined
    );

    const summary = getFeatureSummary();

    expect(summary[FRAMEWORK_FEATURES.AUTH]).toBe(true);
    expect(summary[FRAMEWORK_FEATURES.BILLING]).toBe(true);
    expect(summary[FRAMEWORK_FEATURES.REALTIME]).toBe(false);
    expect(summary[FRAMEWORK_FEATURES.I18N]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('handles undefined env var values gracefully', () => {
    mockedGetPlatformEnvVar.mockReturnValue(undefined);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(false);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.REALTIME)).toBe(false);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.STORAGE)).toBe(false);
  });

  it('handles empty string env var values', () => {
    mockedGetPlatformEnvVar.mockReturnValue('');
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.BILLING)).toBe(false);
  });

  it('handles whitespace-only env var values', () => {
    mockedGetPlatformEnvVar.mockReturnValue('   ');
    expect(isFeatureAvailable(FRAMEWORK_FEATURES.OAUTH)).toBe(false);
  });

  it('getAvailableFeatures returns only FrameworkFeature values', () => {
    const features = getAvailableFeatures();
    const validValues = Object.values(FRAMEWORK_FEATURES);
    for (const f of features) {
      expect(validValues).toContain(f);
    }
  });
});
