import { describe, expect, it } from 'vitest';

import {
  languageUrls,
  localizePath,
  resolveLanguageRoute,
  splitLanguagePath,
} from '../languagePath';

const multi = { languages: ['fr', 'en', 'ko'], defaultLanguage: 'fr' };
const single = { languages: ['fr'], defaultLanguage: 'fr' };

describe('splitLanguagePath', () => {
  it('reads the language prefix and the route path behind it', () => {
    expect(splitLanguagePath('/en/produits/x', multi)).toEqual({
      language: 'en',
      path: '/produits/x',
      prefixed: true,
    });
    expect(splitLanguagePath('/ko', multi)).toEqual({
      language: 'ko',
      path: '/',
      prefixed: true,
    });
  });

  it('treats an unprefixed path as the default language', () => {
    expect(splitLanguagePath('/produits', multi)).toEqual({
      language: 'fr',
      path: '/produits',
      prefixed: false,
    });
    expect(splitLanguagePath('/english', multi).prefixed).toBe(false);
  });

  it('never strips in a one-language app', () => {
    expect(splitLanguagePath('/fr/x', single)).toEqual({
      language: 'fr',
      path: '/fr/x',
      prefixed: false,
    });
  });
});

describe('localizePath', () => {
  it('prefixes other languages, keeps the default at the root', () => {
    expect(localizePath('/produits', 'en', multi)).toBe('/en/produits');
    expect(localizePath('/', 'en', multi)).toBe('/en');
    expect(localizePath('/produits', 'fr', multi)).toBe('/produits');
  });

  it('keeps query and hash', () => {
    expect(localizePath('/p?page=2#top', 'ko', multi)).toBe('/ko/p?page=2#top');
    expect(localizePath('/?q=1', 'en', multi)).toBe('/en?q=1');
  });

  it('keeps an explicit language prefix, drops the default one', () => {
    expect(localizePath('/en/x', 'ko', multi)).toBe('/en/x');
    expect(localizePath('/fr/x', 'en', multi)).toBe('/x');
  });

  it('leaves relative, hash and external paths alone', () => {
    expect(localizePath('#cookie-settings', 'en', multi)).toBe('#cookie-settings');
    expect(localizePath('../x', 'en', multi)).toBe('../x');
    expect(localizePath('//cdn.example/x', 'en', multi)).toBe('//cdn.example/x');
    expect(localizePath('https://a.b/x', 'en', multi)).toBe('https://a.b/x');
  });

  it('changes nothing in a one-language app', () => {
    expect(localizePath('/produits', 'fr', single)).toBe('/produits');
  });
});

describe('resolveLanguageRoute', () => {
  const none = {};

  it('serves an unprefixed URL as the default language (rewrite)', () => {
    expect(resolveLanguageRoute('/produits', none, multi)).toEqual({
      type: 'rewrite',
      language: 'fr',
      path: '/produits',
      destination: '/fr/produits',
    });
    expect(resolveLanguageRoute('/', none, multi)).toMatchObject({
      type: 'rewrite',
      destination: '/fr',
    });
  });

  it('redirects a first visit to the visitor language: cookie, then browser', () => {
    expect(
      resolveLanguageRoute('/produits', { preferred: ['ko-KR', 'en'] }, multi)
    ).toEqual({
      type: 'redirect',
      language: 'ko',
      path: '/produits',
      location: '/ko/produits',
      permanent: false,
    });
    expect(
      resolveLanguageRoute(
        '/produits',
        { stored: 'en', preferred: ['ko'] },
        multi
      )
    ).toMatchObject({ type: 'redirect', location: '/en/produits' });
    // A stored default language wins over the browser: no redirect
    expect(
      resolveLanguageRoute('/produits', { stored: 'fr', preferred: ['ko'] }, multi)
        .type
    ).toBe('rewrite');
  });

  it('serves prefixed URLs of other languages as is', () => {
    expect(
      resolveLanguageRoute('/en/produits', { stored: 'ko' }, multi)
    ).toEqual({ type: 'pass', language: 'en', path: '/produits' });
  });

  it('redirects the default language prefix to the root URL (one URL per page)', () => {
    expect(resolveLanguageRoute('/fr/produits', none, multi)).toEqual({
      type: 'redirect',
      language: 'fr',
      path: '/produits',
      location: '/produits',
      permanent: true,
    });
  });

  it('always passes in a one-language app', () => {
    expect(
      resolveLanguageRoute('/produits', { preferred: ['en'] }, single)
    ).toEqual({ type: 'pass', language: 'fr', path: '/produits' });
  });
});

describe('languageUrls', () => {
  it('gives the absolute URL of a path in every language', () => {
    expect(languageUrls('/produits', 'https://x.example', multi)).toEqual({
      fr: 'https://x.example/produits',
      en: 'https://x.example/en/produits',
      ko: 'https://x.example/ko/produits',
    });
    expect(languageUrls('/', 'https://x.example', single)).toEqual({
      fr: 'https://x.example/',
    });
  });
});
