import { describe, it, expect } from 'vitest';

import { getProviderColor } from '../getProviderColor';

describe('getProviderColor', () => {
  it('returns override color for facebook', () => {
    expect(getProviderColor('facebook')).toBe('#1877F2');
  });

  it('returns override color for apple', () => {
    expect(getProviderColor('apple')).toBe('#000000');
  });

  it('returns override color for microsoft', () => {
    expect(getProviderColor('microsoft')).toBe('#F25022');
  });

  it('returns override color for yahoo', () => {
    expect(getProviderColor('yahoo')).toBe('#6001D2');
  });

  it('returns override color for twitter', () => {
    expect(getProviderColor('twitter')).toBe('#000000');
  });

  it('returns a string for google (from schema or default)', () => {
    const color = getProviderColor('google');
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns a hex color string for any provider', () => {
    const color = getProviderColor('github');
    expect(typeof color).toBe('string');
    expect(color.startsWith('#')).toBe(true);
  });
});
