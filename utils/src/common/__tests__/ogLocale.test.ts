import { describe, expect, it } from 'vitest';

import { ogLocale, siteHeadTags } from '../headTags';

describe('ogLocale (Open Graph ll_TT of a language tag)', () => {
  it.each([
    ['fr', 'fr_FR'],
    ['en', 'en_US'],
    ['de', 'de_DE'],
    ['pl', 'pl_PL'],
  ])('%s → %s (likely region)', (language, locale) => {
    expect(ogLocale(language)).toBe(locale);
  });

  it('keeps the region of a tag that has one', () => {
    expect(ogLocale('fr-BE')).toBe('fr_BE');
    expect(ogLocale('en-GB')).toBe('en_GB');
  });

  it('no two-letter region: none', () => {
    // Esperanto's likely region is 001 (World), es-419 is Latin America: no OG territory
    expect(ogLocale('eo')).toBeNull();
    expect(ogLocale('es-419')).toBeNull();
  });

  it('throws on a malformed tag', () => {
    expect(() => ogLocale('not a tag')).toThrow(RangeError);
  });
});

const localeTags = (tags: ReturnType<typeof siteHeadTags>) =>
  tags
    .filter((tag) => tag.attributes.property?.startsWith('og:locale'))
    .map((tag) => [tag.attributes.property, tag.attributes.content]);

describe('siteHeadTags: og:locale', () => {
  const alternates = { fr: 'https://x.test/a', en: 'https://x.test/en/a', de: 'https://x.test/de/a' };
  const site = { url: 'https://x.test/en/a', siteName: 'Shop', defaultLanguage: 'fr' };

  it('the page language, then each other language with hreflang alternates', () => {
    expect(localeTags(siteHeadTags({ ...site, language: 'en', alternates }))).toEqual([
      ['og:locale', 'en_US'],
      ['og:locale:alternate', 'fr_FR'],
      ['og:locale:alternate', 'de_DE'],
    ]);
  });

  it('one language or hreflang off (no alternates): og:locale only', () => {
    expect(localeTags(siteHeadTags({ ...site, language: 'fr', alternates: null }))).toEqual([
      ['og:locale', 'fr_FR'],
    ]);
  });

  it('no page language (404 document): none', () => {
    expect(localeTags(siteHeadTags({ ...site, language: null, alternates: null }))).toEqual([]);
  });

  it('a language without an Open Graph locale emits no tag', () => {
    expect(
      localeTags(
        siteHeadTags({ ...site, language: 'eo', alternates: { eo: 'https://x.test/a', fr: 'https://x.test/fr/a' } })
      )
    ).toEqual([['og:locale:alternate', 'fr_FR']]);
  });
});
