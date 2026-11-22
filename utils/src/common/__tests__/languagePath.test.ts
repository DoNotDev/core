import { describe, expect, it } from 'vitest';

import {
  formatTrailingSlash,
  languageUrl,
  languageUrls,
  localizePath,
  publicPathname,
  resolveLanguageRoute,
  splitLanguagePath,
  stripTrailingSlash,
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
    expect(languageUrls('/produits', 'https://x.example', multi, false)).toEqual({
      fr: 'https://x.example/produits',
      en: 'https://x.example/en/produits',
      ko: 'https://x.example/ko/produits',
    });
    expect(languageUrls('/', 'https://x.example', single, false)).toEqual({
      fr: 'https://x.example/',
    });
  });

  it('ends every page URL with `/` under trailingSlash, language homes included', () => {
    expect(languageUrls('/', 'https://x.example', multi, true)).toEqual({
      fr: 'https://x.example/',
      en: 'https://x.example/en/',
      ko: 'https://x.example/ko/',
    });
    expect(languageUrls('/produits', 'https://x.example', multi, true)).toEqual({
      fr: 'https://x.example/produits/',
      en: 'https://x.example/en/produits/',
      ko: 'https://x.example/ko/produits/',
    });
  });
});

describe('languageUrl', () => {
  it('is the localized path on the base URL, in the trailing-slash form', () => {
    expect(languageUrl('/about', 'en', 'https://x.example', multi, false)).toBe(
      'https://x.example/en/about'
    );
    expect(languageUrl('/', 'en', 'https://x.example', multi, false)).toBe(
      'https://x.example/en'
    );
    expect(languageUrl('/', 'en', 'https://x.example', multi, true)).toBe(
      'https://x.example/en/'
    );
    expect(languageUrl('/about', 'fr', 'https://x.example', multi, true)).toBe(
      'https://x.example/about/'
    );
  });
});

describe('formatTrailingSlash', () => {
  it('leaves every path unchanged without trailingSlash', () => {
    expect(formatTrailingSlash('/about', false)).toBe('/about');
    expect(formatTrailingSlash('/about/', false)).toBe('/about/');
    expect(formatTrailingSlash('/fr', false)).toBe('/fr');
  });

  it('adds `/` to page paths, as Next serves them', () => {
    expect(formatTrailingSlash('/about', true)).toBe('/about/');
    expect(formatTrailingSlash('/fr', true)).toBe('/fr/');
    expect(formatTrailingSlash('/a/b', true)).toBe('/a/b/');
    expect(formatTrailingSlash('/about/', true)).toBe('/about/');
    expect(formatTrailingSlash('/', true)).toBe('/');
  });

  it('keeps the query and hash after the slash', () => {
    expect(formatTrailingSlash('/search?q={term}', true)).toBe('/search/?q={term}');
    expect(formatTrailingSlash('/a#b', true)).toBe('/a/#b');
  });

  it('leaves file paths alone (Next redirects them to the bare form)', () => {
    expect(formatTrailingSlash('/rss.xml', true)).toBe('/rss.xml');
    expect(formatTrailingSlash('/media/logo.svg', true)).toBe('/media/logo.svg');
  });
});

describe('stripTrailingSlash', () => {
  it('gives the route form of a pathname', () => {
    expect(stripTrailingSlash('/about-us/')).toBe('/about-us');
    expect(stripTrailingSlash('/fr/a-propos/')).toBe('/fr/a-propos');
    expect(stripTrailingSlash('/about-us')).toBe('/about-us');
    expect(stripTrailingSlash('/')).toBe('/');
  });
});

describe('publicPathname', () => {
  it('drops the session segment, first or after the language', () => {
    expect(publicPathname('/dndev-session/produits')).toBe('/produits');
    expect(publicPathname('/en/dndev-session/produits')).toBe('/en/produits');
  });

  it("maps Next's root prerender path `/index` to the root", () => {
    expect(publicPathname('/index')).toBe('/');
    expect(publicPathname('/dndev-session/index')).toBe('/');
  });

  it('leaves any other pathname unchanged, slugs named index included', () => {
    expect(publicPathname('/')).toBe('/');
    expect(publicPathname('/produits')).toBe('/produits');
    expect(publicPathname('/en/index')).toBe('/en/index');
    expect(publicPathname('/apartments/index')).toBe('/apartments/index');
    expect(publicPathname('/en/dndev-session/index')).toBe('/en/index');
    expect(publicPathname('/produits/index-foo')).toBe('/produits/index-foo');
    expect(publicPathname('/index/x')).toBe('/index/x');
  });
});
