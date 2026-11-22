import { describe, expect, it } from 'vitest';

import { routeSeo, routeTitle } from '../headTags';

const TEXTS: Record<string, string> = {
  'home:title': 'Inicio',
  'home:description': 'Bienvenida',
  'home:meta.fullTitle': 'Tienda | Inicio',
  'press:title': 'Prensa',
  'contact:title': 'Contact',
  'press:meta.fullTitle': 'Prensa | Boutique (i18n)',
};
const t = ((key: string, options?: { defaultValue?: string }) =>
  TEXTS[key] ?? options?.defaultValue ?? key) as never;

const seoOf = (meta: object, ns: string | null) =>
  routeSeo({ meta, ns, defaultNs: 'home', t, siteName: 'Boutique', baseUrl: '', url: null, defaultImage: '/og.png', authOnly: false });

describe('routeSeo title (AutoMetaTags, Vite pages, metadata manifest)', () => {
  // REGRESSION: the namespace's meta.fullTitle beat the page's own seo.fullTitle
  it('seo.fullTitle wins over the namespace meta.fullTitle', () => {
    expect(seoOf({ seo: { fullTitle: 'Presse Boutique' } }, 'press').title).toBe('Presse Boutique');
    expect(seoOf({}, 'press').title).toBe('Prensa | Boutique (i18n)');
  });

  // REGRESSION: a page without namespace got the home page's title ("Tienda | Inicio")
  it('a page without its own namespace takes the site defaults, never their title', () => {
    expect(seoOf({ seo: { fullTitle: 'Mentions légales' } }, null)).toMatchObject({
      title: 'Mentions légales',
      description: 'Bienvenida',
    });
    expect(seoOf({ seo: { title: 'Questions' } }, null).title).toBe('Questions | Boutique');
    expect(seoOf({}, null).title).toBe('Boutique');
  });

  // REGRESSION: the metadata manifest put the i18n title before seo.title (getMetadataForPath
  // titled the page "Contact | Boutique" while AutoMetaTags rendered "Nous écrire | Boutique")
  it('seo.title wins over the i18n title', () => {
    expect(seoOf({ seo: { title: 'Nous écrire' } }, 'contact').title).toBe('Nous écrire | Boutique');
    expect(seoOf({}, 'contact').title).toBe('Contact | Boutique');
  });

  it('the 404 document (no namespace, no site defaults) is the site name', () => {
    expect(
      routeSeo({ meta: {}, ns: null, defaultNs: null, t, siteName: 'Boutique', baseUrl: '', url: null, defaultImage: '/og.png', authOnly: false })
    ).toMatchObject({ title: 'Boutique' });
  });

  it('routeTitle: the page\'s own title (pageTitle) beside its <title>', () => {
    const titleOf = (meta: object, ns: string | null) =>
      routeTitle({ meta, ns, defaultNs: 'home', t, siteName: 'Boutique' });
    expect(titleOf({}, 'press')).toEqual({ title: 'Prensa | Boutique (i18n)', pageTitle: 'Prensa' });
    expect(titleOf({ seo: { title: 'Nous écrire' } }, 'contact')).toEqual({
      title: 'Nous écrire | Boutique',
      pageTitle: 'Nous écrire',
    });
    expect(titleOf({ seo: { title: null } }, 'contact')).toEqual({ title: 'Boutique' });
    expect(titleOf({ seo: { fullTitle: 'Mentions légales' } }, null)).toEqual({ title: 'Mentions légales' });
    expect(routeTitle({ meta: {}, ns: null, defaultNs: null, t, siteName: 'Boutique' })).toEqual({ title: 'Boutique' });
  });
});
