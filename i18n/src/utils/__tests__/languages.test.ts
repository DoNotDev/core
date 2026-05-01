import { describe, it, expect } from 'vitest';

import { getLanguageName } from '../languages';

describe('getLanguageName', () => {
  it('returns English for en', () => {
    expect(getLanguageName('en')).toBe('English');
  });

  it('returns French for fr', () => {
    expect(getLanguageName('fr')).toBe('French');
  });

  it('returns German for de', () => {
    expect(getLanguageName('de')).toBe('German');
  });

  it('returns Japanese for ja', () => {
    expect(getLanguageName('ja')).toBe('Japanese');
  });

  it('returns Arabic for ar', () => {
    expect(getLanguageName('ar')).toBe('Arabic');
  });

  it('returns code itself for unknown language', () => {
    expect(getLanguageName('xyz')).toBe('xyz');
  });
});
