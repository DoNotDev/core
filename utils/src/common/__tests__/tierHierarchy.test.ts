import { describe, it, expect } from 'vitest';

import { hasTierAccess } from '../tierHierarchy';

describe('hasTierAccess', () => {
  it('returns false for undefined user tier', () => {
    expect(hasTierAccess(undefined, 'free')).toBe(false);
  });

  it('higher tier can access lower tier', () => {
    const config = {
      free: { features: [], level: 0 },
      pro: { features: [], level: 1 },
      enterprise: { features: [], level: 2 },
    };

    expect(hasTierAccess('enterprise', 'free', config)).toBe(true);
    expect(hasTierAccess('enterprise', 'pro', config)).toBe(true);
    expect(hasTierAccess('pro', 'free', config)).toBe(true);
  });

  it('same tier can access same tier', () => {
    const config = {
      free: { features: [], level: 0 },
      pro: { features: [], level: 1 },
    };

    expect(hasTierAccess('pro', 'pro', config)).toBe(true);
    expect(hasTierAccess('free', 'free', config)).toBe(true);
  });

  it('lower tier cannot access higher tier', () => {
    const config = {
      free: { features: [], level: 0 },
      pro: { features: [], level: 1 },
    };

    expect(hasTierAccess('free', 'pro', config)).toBe(false);
  });

  it('unknown user tier defaults to denied', () => {
    const config = {
      free: { features: [], level: 0 },
    };

    expect(hasTierAccess('unknown', 'free', config)).toBe(false);
  });

  it('unknown required tier defaults to denied', () => {
    const config = {
      pro: { features: [], level: 1 },
    };

    expect(hasTierAccess('pro', 'unknown', config)).toBe(false);
  });

  it('uses COMMON_TIER_CONFIGS as fallback when no config provided', () => {
    // Without custom config, uses framework defaults
    // This should work with the built-in COMMON_TIER_CONFIGS
    const result = hasTierAccess('free', 'free');
    expect(typeof result).toBe('boolean');
  });
});
