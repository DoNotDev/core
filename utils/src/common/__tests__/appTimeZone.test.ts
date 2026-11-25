// packages/core/utils/src/common/__tests__/appTimeZone.test.ts

/**
 * @fileoverview App time zone (owner decision 2026-11-25 T1, amended: default
 * Europe/Paris, override per app): one IANA zone per app. The same instant formats to the same text whatever the machine's zone
 * (process.env.TZ: the Vercel server runs in UTC, the browser in the visitor's zone).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { EntityField } from '@donotdev/types';

import { formatDate } from '../dateUtils';
import { formatFieldText } from '../fieldText';
import { formatTimeZoneFor, getAppTimeZone, isCalendarDate } from '../timeZone';

const field = (type: string) =>
  ({ name: 'f', label: 'f', type, visibility: 'guest' }) as EntityField;
const t = (key: string) => key;

/** Runs `fn` with the process in `tz` (Node re-reads TZ on assignment). */
function inProcessZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

const MACHINE_ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati'];
/** The audit's instant: 24 Nov 23:30 in UTC, 25 Nov 00:30 in Paris. */
const INSTANT = '2026-11-24T23:30:00.000Z';

let previousConfig: typeof globalThis._DNDEV_CONFIG_;
beforeEach(() => {
  previousConfig = globalThis._DNDEV_CONFIG_;
});
afterEach(() => {
  globalThis._DNDEV_CONFIG_ = previousConfig;
});

function setAppZone(timeZone: string | undefined) {
  // why: tests register only the i18n key the accessor reads
  globalThis._DNDEV_CONFIG_ = { i18n: { timeZone } } as unknown as typeof globalThis._DNDEV_CONFIG_;
}

describe('getAppTimeZone', () => {
  it('returns the configured zone', () => {
    setAppZone('Europe/Paris');
    expect(getAppTimeZone()).toBe('Europe/Paris');
  });

  it('throws, naming the generated config, when it is not loaded (never the machine zone)', () => {
    globalThis._DNDEV_CONFIG_ = undefined;
    expect(() => getAppTimeZone()).toThrow(/generated i18n config/);
    setAppZone(undefined);
    expect(() => getAppTimeZone()).toThrow(/generated i18n config/);
  });
});

describe('calendar dates', () => {
  it('are YYYY-MM-DD only, formatted in UTC (as written)', () => {
    setAppZone('Europe/Paris');
    expect(isCalendarDate('2026-11-24')).toBe(true);
    expect(isCalendarDate('2026-11-24T00:00:00Z')).toBe(false);
    expect(formatTimeZoneFor('2026-11-24')).toBe('UTC');
    expect(formatTimeZoneFor(INSTANT)).toBe('Europe/Paris');
  });
});

describe('same instant, same text, whatever the machine zone', () => {
  it('the machine zone really changes between runs (control)', () => {
    const hours = MACHINE_ZONES.map((tz) =>
      inProcessZone(tz, () => new Date(INSTANT).getHours())
    );
    expect(new Set(hours).size).toBeGreaterThan(1);
  });

  it('formatFieldText timestamp / datetime-local / date / time', () => {
    setAppZone('Europe/Paris');
    for (const type of ['timestamp', 'datetime-local', 'date', 'time']) {
      const texts = MACHINE_ZONES.map((tz) =>
        inProcessZone(tz, () =>
          formatFieldText(INSTANT, field(type), t, { locale: 'fr' })
        )
      );
      expect(new Set(texts).size, type).toBe(1);
    }
    // Paris wall time: 25 Nov, 00:30
    const stamp = formatFieldText(INSTANT, field('timestamp'), t, { locale: 'fr' });
    expect(stamp).toContain('25 nov.');
    expect(stamp).toContain('00:30');
  });

  it('formatDate', () => {
    setAppZone('Europe/Paris');
    const texts = MACHINE_ZONES.map((tz) =>
      inProcessZone(tz, () => formatDate(INSTANT, 'en', 'datetime'))
    );
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toContain('Nov 25, 2026');
    expect(texts[0]).toContain('12:30');
  });

  it('a calendar date reads as written in every machine zone and app zone', () => {
    for (const appZone of ['Europe/Paris', 'America/New_York', 'Pacific/Kiritimati']) {
      setAppZone(appZone);
      const texts = MACHINE_ZONES.map((tz) =>
        inProcessZone(tz, () => [
          formatFieldText('2026-11-24', field('date'), t, { locale: 'en' }),
          formatDate('2026-11-24', 'en', 'long'),
        ])
      );
      for (const [fieldText, dateText] of texts) {
        expect(fieldText).toBe('11/24/2026');
        expect(dateText).toBe('November 24, 2026');
      }
    }
  });

  it('the app zone decides the day: Paris vs New York', () => {
    setAppZone('America/New_York');
    expect(formatDate(INSTANT, 'en', 'long')).toBe('November 24, 2026');
    setAppZone('Europe/Paris');
    expect(formatDate(INSTANT, 'en', 'long')).toBe('November 25, 2026');
  });

  it('an explicit format.timeZone overrides the app zone for one call', () => {
    setAppZone('Europe/Paris');
    expect(formatDate(INSTANT, 'en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })).toBe(
      'November 24, 2026'
    );
  });
});
