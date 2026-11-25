import i18next from 'i18next';
import { describe, it, expect } from 'vitest';

import type { AnyEntity } from '@donotdev/types';
import { productEntity, rentalEntity } from '@dndev/test-entities';

import { buildProductJsonLd, deriveEntitySeo } from '../entitySeo';
import type { EntitySeoOptions } from '../entitySeo';

/** Real i18next, entity namespace first then crud (what CRUD cards use). */
function translator(
  namespace: string,
  resources: Record<string, Record<string, unknown>>
): EntitySeoOptions {
  const instance = i18next.createInstance();
  instance.init({
    lng: 'fr',
    resources: { fr: resources },
    ns: Object.keys(resources),
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return { t: instance.getFixedT('fr', [namespace, 'crud']), locale: 'fr-FR' };
}

const NO_TRANSLATIONS = translator('entity-product', {});

// The shared catalogue product: its card (listCardFields) gives the SEO text.
const product = productEntity;

describe('deriveEntitySeo', () => {
  it('derives title, description, images and price from entity fields', () => {
    const seo = deriveEntitySeo(product, {
      name: 'Bakuchiol Ampoule Cream',
      size: '50 ml',
      images: [
        { fullUrl: 'https://cdn/a.webp', thumbUrl: 'https://cdn/a_t.webp' },
        { fullUrl: 'https://cdn/b.webp', thumbUrl: 'https://cdn/b_t.webp' },
      ],
      shortDescription: 'Crème au bakuchiol.',
      rrpInclVat: 32,
    }, NO_TRANSLATIONS);

    expect(seo).toEqual({
      title: 'Bakuchiol Ampoule Cream',
      description: 'Crème au bakuchiol.',
      image: 'https://cdn/a.webp',
      images: ['https://cdn/a.webp', 'https://cdn/b.webp'],
      price: { amount: 32, currency: 'EUR' },
    });
  });

  it('falls back to the next long-text field and strips HTML', () => {
    const seo = deriveEntitySeo(product, {
      name: 'X',
      shortDescription: '',
      description: '<p>Rich <b>text</b></p>',
    }, NO_TRANSLATIONS);
    expect(seo.description).toBe('Rich text');
  });

  it('truncates long descriptions to 160 characters on a word boundary', () => {
    const seo = deriveEntitySeo(product, {
      name: 'X',
      shortDescription: 'word '.repeat(60),
    }, NO_TRANSLATIONS);
    expect(seo.description!.length).toBeLessThanOrEqual(160);
    expect(seo.description!.endsWith('…')).toBe(true);
    expect(seo.description).not.toMatch(/wor…$/);
  });

  it('omits price when zero or missing, and image when empty', () => {
    const seo = deriveEntitySeo(
      product,
      { name: 'X', rrpInclVat: 0 },
      NO_TRANSLATIONS
    );
    expect(seo.price).toBeUndefined();
    expect(seo.image).toBeUndefined();
    expect(seo.images).toEqual([]);
  });

  it('uses the currency declared on the field', () => {
    const usd = {
      ...product,
      fields: {
        ...product.fields,
        rrpInclVat: {
          name: 'rrpInclVat',
          type: 'currency',
          options: { fieldSpecific: { currency: 'USD' } },
        },
      },
    } as unknown as AnyEntity;
    expect(deriveEntitySeo(usd, { name: 'X', rrpInclVat: 10 }, NO_TRANSLATIONS).price).toEqual(
      { amount: 10, currency: 'USD' }
    );
  });

  it('uses the first text field when listCardFields has no title', () => {
    const plain = {
      ...product,
      listCardFields: undefined,
    } as unknown as AnyEntity;
    expect(deriveEntitySeo(plain, { name: 'First', size: 'S' }, NO_TRANSLATIONS).title).toBe(
      'First'
    );
  });
});

// Same shape as a real rental entity: number with displayKey, select status,
// date with a displayValue resolver, currency subtitle
const apartment = rentalEntity;

const APARTMENT_FR = translator('entity-apartment', {
  'entity-apartment': {
    fields: { size_display: '{{value}}m²' },
    kind: { studio: 'Studio', t2: 'T2' },
    status: { available_now: 'Disponible' },
    seo: { title: 'Appartement {{size}}m²' },
  },
  crud: {},
});

describe('deriveEntitySeo formatting (same text as the CRUD card)', () => {
  it('formats title fields like the card: select label, number + displayKey', () => {
    const seo = deriveEntitySeo(
      apartment,
      { status: 'available', kind: 'studio', size: 1250.5 },
      APARTMENT_FR
    );
    expect(seo.title).toBe('Studio - 1\u202f250,5m²');
  });

  it('drops empty title fields instead of showing a dash', () => {
    const seo = deriveEntitySeo(apartment, { kind: 't2' }, APARTMENT_FR);
    expect(seo.title).toBe('T2');
  });

  it('applies displayValue with the whole record', () => {
    const available = deriveEntitySeo(
      apartment,
      { status: 'available', kind: 't2', availableOn: '2025-06-01' },
      APARTMENT_FR
    );
    expect(available.description).toBe('Disponible');

    const reserved = deriveEntitySeo(
      apartment,
      { status: 'reserved', kind: 't2', availableOn: '2025-06-01' },
      APARTMENT_FR
    );
    expect(reserved.description).toBeUndefined();
  });

  it('derives the description from subtitle then content when no long text has a value', () => {
    const seo = deriveEntitySeo(
      apartment,
      {
        status: 'available',
        kind: 't2',
        rent: 1250,
        availableOn: '2025-06-01',
        pictures: [{ fullUrl: 'https://cdn/p.webp' }],
        notes: 'Calme, lumineux',
        description: '',
      },
      APARTMENT_FR
    );
    // Money: the currency's standard fraction digits (EUR: 2)
    expect(seo.description).toBe('1\u202f250,00\u00a0€ Disponible · Calme, lumineux');
  });

  it('prefers a long-text field over the card text', () => {
    const seo = deriveEntitySeo(
      apartment,
      { kind: 't2', rent: 900, description: 'Bel appartement' },
      APARTMENT_FR
    );
    expect(seo.description).toBe('Bel appartement');
  });

  it('uses the entity seo overrides for title and description', () => {
    const withSeo = {
      ...apartment,
      seo: {
        title: (item: Record<string, unknown>, t: (k: string, o?: Record<string, unknown>) => string) =>
          t('seo.title', { size: item.size }),
        description: () => null,
      },
    } as unknown as AnyEntity;
    const seo = deriveEntitySeo(
      withSeo,
      { kind: 't2', size: 40, notes: 'Calme' },
      APARTMENT_FR
    );
    expect(seo.title).toBe('Appartement 40m²');
    expect(seo.description).toBeUndefined();
  });
});

describe('deriveEntitySeo availability', () => {
  const mapped = {
    ...apartment,
    seo: {
      availability: {
        promoted: 'InStock',
        reserved: 'SoldOut',
        signed: 'SoldOut',
      },
    },
  } as unknown as AnyEntity;

  it('maps the base available status to InStock by default', () => {
    expect(
      deriveEntitySeo(apartment, { status: 'available' }, APARTMENT_FR)
        .availability
    ).toBe('https://schema.org/InStock');
  });

  it('maps custom statuses from entity.seo.availability', () => {
    expect(
      deriveEntitySeo(mapped, { status: 'reserved' }, APARTMENT_FR).availability
    ).toBe('https://schema.org/SoldOut');
    expect(
      deriveEntitySeo(mapped, { status: 'promoted' }, APARTMENT_FR).availability
    ).toBe('https://schema.org/InStock');
    expect(
      deriveEntitySeo(mapped, { status: 'available' }, APARTMENT_FR).availability
    ).toBe('https://schema.org/InStock');
  });

  it('omits availability for an unmapped status', () => {
    expect(
      deriveEntitySeo(apartment, { status: 'reserved' }, APARTMENT_FR)
        .availability
    ).toBeUndefined();
    expect(
      deriveEntitySeo(apartment, {}, APARTMENT_FR).availability
    ).toBeUndefined();
  });
});

describe('buildProductJsonLd', () => {
  it('emits an Offer only with a price', () => {
    const withPrice = buildProductJsonLd(
      {
        title: 'P',
        images: ['https://cdn/a.webp'],
        price: { amount: 32, currency: 'EUR' },
      },
      'https://shop/produits/p'
    );
    expect(withPrice).toMatchObject({
      '@type': 'Product',
      name: 'P',
      image: ['https://cdn/a.webp'],
      offers: { '@type': 'Offer', price: 32, priceCurrency: 'EUR' },
    });

    const noPrice = buildProductJsonLd(
      { title: 'P', images: [] },
      'https://shop/produits/p'
    );
    expect(noPrice).not.toHaveProperty('offers');
    expect(noPrice).not.toHaveProperty('image');
  });

  it('puts the availability on the Offer, and omits it when unmapped', () => {
    const offer = (availability?: string) =>
      buildProductJsonLd(
        {
          title: 'P',
          images: [],
          price: { amount: 900, currency: 'EUR' },
          availability,
        },
        'https://shop/x'
      )?.offers as Record<string, unknown>;
    expect(offer('https://schema.org/SoldOut')).toMatchObject({
      availability: 'https://schema.org/SoldOut',
    });
    expect(offer(undefined)).not.toHaveProperty('availability');
  });

  it('returns null without a title', () => {
    expect(buildProductJsonLd({ images: [] }, 'https://shop/x')).toBeNull();
  });
});
