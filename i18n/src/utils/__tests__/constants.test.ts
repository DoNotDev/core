import { describe, it, expect } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  STORAGE_KEYS,
  TIME,
  ERROR_MESSAGES,
  LANGUAGES,
  getCountries,
} from '../constants';

describe('i18n constants', () => {
  it('DEFAULT_LANGUAGE is "en"', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('STORAGE_KEYS has required keys', () => {
    expect(STORAGE_KEYS.LANGUAGE_PREFERENCE).toBe('i18n_user_language');
    expect(STORAGE_KEYS.TRANSLATIONS_PREFIX).toBe('i18n_translations_');
    expect(STORAGE_KEYS.CACHE_ALL).toBe('i18n_cache_all');
  });

  it('TIME constants are positive numbers', () => {
    expect(TIME.ERROR_CACHE_TTL).toBeGreaterThan(0);
    expect(TIME.HEALTH_CHECK_INTERVAL).toBeGreaterThan(0);
    expect(TIME.CACHE_PERSISTENCE_DELAY).toBeGreaterThan(0);
    expect(TIME.INITIALIZATION_TIMEOUT).toBeGreaterThan(0);
  });

  it('ERROR_MESSAGES are non-empty strings', () => {
    for (const msg of Object.values(ERROR_MESSAGES)) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

describe('LANGUAGES', () => {
  it('contains English as first entry', () => {
    expect(LANGUAGES[0]?.id).toBe('en');
    expect(LANGUAGES[0]?.name).toBe('English');
  });

  it('all entries have id, name, and nativeName', () => {
    for (const lang of LANGUAGES) {
      expect(lang.id).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
    }
  });

  it('has no duplicate IDs', () => {
    const ids = LANGUAGES.map((l) => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('contains common languages', () => {
    const ids = LANGUAGES.map((l) => l.id);
    expect(ids).toContain('en');
    expect(ids).toContain('fr');
    expect(ids).toContain('es');
    expect(ids).toContain('de');
    expect(ids).toContain('ja');
    expect(ids).toContain('zh');
    expect(ids).toContain('ar');
  });
});

describe('getCountries', () => {
  it('returns array of countries with required fields', () => {
    const countries = getCountries();

    expect(countries.length).toBeGreaterThan(0);
    for (const country of countries) {
      expect(country.code).toBeTruthy();
      expect(country.dialCode).toBeTruthy();
      expect(country.flagCode).toBeTruthy();
      expect(country.name).toBeTruthy();
    }
  });

  it('includes common countries', () => {
    const countries = getCountries();
    const codes = countries.map((c) => c.code);

    expect(codes).toContain('US');
    expect(codes).toContain('FR');
    expect(codes).toContain('DE');
    expect(codes).toContain('JP');
  });

  it('uses country name labels when available', () => {
    const countries = getCountries();
    const us = countries.find((c) => c.code === 'US');
    const fr = countries.find((c) => c.code === 'FR');

    expect(us?.name).toBe('United States');
    expect(fr?.name).toBe('France');
  });
});
