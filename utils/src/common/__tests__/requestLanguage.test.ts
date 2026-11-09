import { describe, expect, it } from 'vitest';

import {
  parseAcceptLanguage,
  readCookieValue,
  resolveLanguage,
} from '../requestLanguage';

describe('readCookieValue', () => {
  it('reads and decodes one cookie of a Cookie header', () => {
    expect(readCookieValue('a=1; dndev-lang=fr; b=2', 'dndev-lang')).toBe('fr');
    expect(readCookieValue('x=caf%C3%A9', 'x')).toBe('café');
  });

  it('returns null when absent or header empty', () => {
    expect(readCookieValue('a=1', 'dndev-lang')).toBeNull();
    expect(readCookieValue('', 'dndev-lang')).toBeNull();
    expect(readCookieValue(undefined, 'dndev-lang')).toBeNull();
  });

  it('does not match a cookie whose name only ends with the name', () => {
    expect(readCookieValue('old-dndev-lang=de', 'dndev-lang')).toBeNull();
  });
});

describe('parseAcceptLanguage', () => {
  it('orders by quality, then by position', () => {
    expect(parseAcceptLanguage('en;q=0.8, fr-FR, fr;q=0.9, de;q=0.8')).toEqual([
      'fr-FR',
      'fr',
      'en',
      'de',
    ]);
  });

  it('drops wildcards and q=0', () => {
    expect(parseAcceptLanguage('*, it;q=0, es')).toEqual(['es']);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe('resolveLanguage', () => {
  const supported = ['fr', 'en', 'ko'];

  it('prefers the stored choice when supported', () => {
    expect(
      resolveLanguage({ supported, fallback: 'fr', stored: 'ko', preferred: ['en'] })
    ).toBe('ko');
  });

  it('ignores an unsupported stored choice', () => {
    expect(
      resolveLanguage({ supported, fallback: 'fr', stored: 'de', preferred: ['en'] })
    ).toBe('en');
  });

  it('matches a browser region tag on its base language', () => {
    expect(
      resolveLanguage({ supported, fallback: 'fr', preferred: ['de-DE', 'ko-KR'] })
    ).toBe('ko');
  });

  it('falls back when nothing matches', () => {
    expect(resolveLanguage({ supported, fallback: 'fr', preferred: ['de'] })).toBe(
      'fr'
    );
  });
});
