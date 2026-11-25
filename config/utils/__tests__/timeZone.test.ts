// @vitest-environment node
// packages/core/config/utils/__tests__/timeZone.test.ts

/**
 * @fileoverview Build option i18n.timeZone (owner decision 2026-11-25 T1, amended): an
 * IANA name, default Europe/Paris (an app sets it only to override it); an invalid value
 * fails, naming the field.
 */

import { describe, expect, it } from 'vitest';

import { I18nDiscovery } from '../../discovery/I18nDiscovery.js';
import { DEFAULT_APP_TIME_ZONE, resolveAppTimeZone } from '../timeZone.js';

describe('resolveAppTimeZone', () => {
  it('accepts IANA names', () => {
    expect(resolveAppTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(resolveAppTimeZone('UTC')).toBe('UTC');
    expect(resolveAppTimeZone('America/Argentina/Buenos_Aires')).toBe(
      'America/Argentina/Buenos_Aires'
    );
  });

  it.each([undefined, null, ''])('gives the default Europe/Paris when not set (%s)', (value) => {
    expect(DEFAULT_APP_TIME_ZONE).toBe('Europe/Paris');
    expect(resolveAppTimeZone(value)).toBe('Europe/Paris');
  });

  it.each(['Europe/Pariss', 'Mars/Olympus'])('fails on an unknown zone (%s)', (value) => {
    expect(() => resolveAppTimeZone(value)).toThrow(/\[dndev-i18n\] i18n\.timeZone "[^"]+" is not a known IANA time zone/);
  });

  it.each(['+01:00', 'UTC+1 ', 42, { tz: 'UTC' }])('fails on a non-IANA value (%s)', (value) => {
    expect(() => resolveAppTimeZone(value)).toThrow(/i18n\.timeZone must be an IANA time zone name/);
  });
});

describe('i18n discovery carries the zone to the generated config', () => {
  it('returns timeZone with the languages (Vite virtual:i18n, Next dndev-config-i18n.js, prerender)', () => {
    const discovery = new I18nDiscovery(
      { resolveAppPath: (p: string) => p },
      { timeZone: 'Europe/Paris', fallbackLanguage: 'fr' }
    );
    expect(discovery._getEmptyResult()).toMatchObject({
      fallbackLanguage: 'fr',
      timeZone: 'Europe/Paris',
    });
  });
});
