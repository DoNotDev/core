// packages/core/utils/src/common/entitySeo.ts

/**
 * @fileoverview Entity-derived SEO
 * @description Builds a page's SEO identity (title, description, image, JSON-LD) from an
 * entity definition and one of its records. The entity already says which fields are the
 * card title (listCardFields), which are long text, images and prices, so pages do not
 * repeat that mapping. Title and description text is formatted like the CRUD card shows
 * it (`formatFieldText`, the same implementation the card uses); the entity's `seo`
 * option overrides it. Pure: same output on the server (Next SSR) and in the browser (Vite).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import type {
  AnyEntity,
  EntityField,
  SchemaOrgAvailability,
} from '@donotdev/types';

import { formatFieldText, stripHtmlTags } from './fieldText';
import type { FieldTextTranslate } from './fieldText';

/** Max description length: the snippet length search engines display. */
const DESCRIPTION_MAX_LENGTH = 160;

/** Default currency of `currency` fields (same default as the CRUD display formatter). */
const DEFAULT_CURRENCY = 'EUR';

const LONG_TEXT_TYPES = new Set(['textarea', 'richtext']);
const IMAGE_TYPES = new Set(['image', 'images']);
const PRICE_TYPES = new Set(['price', 'currency']);

/** Separator between the card subtitle and content texts in a derived description. */
const DESCRIPTION_SEPARATOR = ' · ';

/**
 * schema.org availability of the base statuses (`available` is the published status of
 * every entity, see DEFAULT_STATUS_OPTIONS). Entities map their own with `seo.availability`.
 */
const BASE_AVAILABILITY: Readonly<Record<string, SchemaOrgAvailability>> = {
  available: 'InStock',
};

/** Record shape accepted by {@link deriveEntitySeo}. */
export type EntitySeoRecord = Record<string, unknown>;

/** SEO identity of one record. */
export interface EntitySeo {
  /** Record title (no site name) */
  title?: string;
  /** Plain-text description, at most 160 characters */
  description?: string;
  /** Absolute or root-relative URL of the main image */
  image?: string;
  /** All image URLs, main first */
  images: string[];
  /** Price, when the entity has a price/currency field with a positive value */
  price?: { amount: number; currency: string };
  /**
   * schema.org availability URL (`https://schema.org/InStock`) of the record's `status`,
   * from `entity.seo.availability` over `{ available: 'InStock' }`; absent when unmapped
   */
  availability?: string;
}

/**
 * How {@link deriveEntitySeo} formats text.
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export interface EntitySeoOptions {
  /**
   * Translation function with the entity namespace first, then `crud`, in the page
   * language (what the CRUD card uses: `useTranslation([entity.namespace, 'crud'])`)
   */
  t: FieldTextTranslate;
  /** Locale for dates and numbers (i18next language) */
  locale?: string;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** URLs of an image/images field value (Picture, Picture[], string, string[]). */
function imageUrls(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (typeof item === 'string') return nonEmptyString(item);
      if (item && typeof item === 'object' && 'fullUrl' in item) {
        return nonEmptyString(item.fullUrl);
      }
      return undefined;
    })
    .filter((url): url is string => url !== undefined);
}

/** Field names in card order (title, subtitle, content, footer), then the remaining fields. */
function orderedFieldNames(entity: AnyEntity): string[] {
  const lcf = entity.listCardFields;
  const cardOrder = !lcf
    ? []
    : Array.isArray(lcf)
      ? lcf
      : [
          ...(lcf.title ?? []),
          ...(lcf.subtitle ?? []),
          ...(lcf.content ?? []),
          ...(lcf.footer ?? []),
        ];
  return [...new Set([...cardOrder, ...Object.keys(entity.fields)])];
}

/** Card text of fields (images skipped, empty values dropped), formatted like the card. */
function fieldTexts(
  entity: AnyEntity,
  data: EntitySeoRecord,
  names: readonly string[],
  options: EntitySeoOptions
): string[] {
  return names.flatMap((name) => {
    const field = entity.fields[name];
    if (!field || IMAGE_TYPES.has(field.type)) return [];
    const text = formatFieldText(data[name], field, options.t, {
      item: data,
      locale: options.locale,
    });
    return text ? [text] : [];
  });
}

function titleOf(
  entity: AnyEntity,
  data: EntitySeoRecord,
  options: EntitySeoOptions
): string | undefined {
  const override = entity.seo?.title;
  if (override) return nonEmptyString(override(data, options.t));
  const lcf = entity.listCardFields;
  if (lcf && !Array.isArray(lcf) && lcf.title?.length) {
    const parts = fieldTexts(entity, data, lcf.title, options);
    return parts.length > 0 ? parts.join(lcf.titleSeparator ?? ' ') : undefined;
  }
  // Array form / no listCardFields: first text field in card order (CrudCard convention)
  const first = orderedFieldNames(entity).find(
    (name) => entity.fields[name]?.type === 'text'
  );
  return first
    ? nonEmptyString(fieldTexts(entity, data, [first], options)[0])
    : undefined;
}

/**
 * First long-text field with a value (card order first), else the card subtitle
 * (joined like the card) and content texts.
 */
function descriptionTextOf(
  entity: AnyEntity,
  data: EntitySeoRecord,
  names: readonly string[],
  options: EntitySeoOptions
): string | undefined {
  const override = entity.seo?.description;
  if (override) return nonEmptyString(override(data, options.t));
  const longText = names.find(
    (name) =>
      LONG_TEXT_TYPES.has(entity.fields[name]?.type ?? '') &&
      nonEmptyString(data[name]) !== undefined
  );
  if (longText) return stripHtmlTags(String(data[longText]));
  const lcf = entity.listCardFields;
  if (!lcf || Array.isArray(lcf)) return undefined;
  const subtitle = fieldTexts(entity, data, lcf.subtitle ?? [], options).join(' ');
  const parts = [
    subtitle,
    ...fieldTexts(entity, data, lcf.content ?? [], options),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(DESCRIPTION_SEPARATOR) : undefined;
}

function availabilityOf(
  entity: AnyEntity,
  data: EntitySeoRecord
): string | undefined {
  if (typeof data.status !== 'string') return undefined;
  const mapping = { ...BASE_AVAILABILITY, ...entity.seo?.availability };
  const availability = mapping[data.status];
  return availability ? `https://schema.org/${availability}` : undefined;
}

function priceOf(
  field: EntityField,
  value: unknown
): { amount: number; currency: string } | undefined {
  if (field.type === 'price' && value && typeof value === 'object') {
    const { amount, currency } = value as {
      amount?: unknown;
      currency?: unknown;
    };
    return typeof amount === 'number' && amount > 0
      ? { amount, currency: nonEmptyString(currency) ?? DEFAULT_CURRENCY }
      : undefined;
  }
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !(amount > 0)) return undefined;
  const fieldSpecific = field.options?.fieldSpecific as
    { currency?: string } | undefined;
  return { amount, currency: fieldSpecific?.currency ?? DEFAULT_CURRENCY };
}

/**
 * Derive a record's SEO identity from its entity definition.
 *
 * - title: `entity.seo.title`, else the `listCardFields.title` texts formatted like the
 *   card (joined with `titleSeparator`), else the first text field
 * - description: `entity.seo.description`, else the first long-text field
 *   (textarea/richtext, HTML stripped, card order first), else the card subtitle and
 *   content texts (joined with ` · `); at most 160 characters
 * - images: first image/images field with a value, card order first
 * - price: first price/currency field with a positive value
 * - availability: schema.org URL of the record `status` (`entity.seo.availability`
 *   over `{ available: 'InStock' }`); absent for an unmapped status
 *
 * @param entity - Entity definition (from defineEntity)
 * @param data - One record of that entity
 * @param options - Translation function (entity namespace, then `crud`) and locale
 * @returns The record's SEO identity; fields without a value are omitted
 *
 * @example
 * ```ts
 * const { t, i18n } = useTranslation([productEntity.namespace, 'crud']);
 * deriveEntitySeo(productEntity, product, { t, locale: i18n.language });
 * // { title: 'Bakuchiol Ampoule Cream', description: 'Crème…', image: 'https://…', images: [...], price: { amount: 32, currency: 'EUR' }, availability: 'https://schema.org/InStock' }
 * ```
 */
export function deriveEntitySeo(
  entity: AnyEntity,
  data: EntitySeoRecord,
  options: EntitySeoOptions
): EntitySeo {
  const names = orderedFieldNames(entity);
  const fieldOf = (name: string): EntityField | undefined =>
    entity.fields[name];

  const descriptionText = descriptionTextOf(entity, data, names, options);
  const description = descriptionText
    ? truncate(descriptionText, DESCRIPTION_MAX_LENGTH)
    : undefined;

  const imageField = names.find(
    (name) =>
      IMAGE_TYPES.has(fieldOf(name)?.type ?? '') &&
      imageUrls(data[name]).length > 0
  );
  const images = imageField ? imageUrls(data[imageField]) : [];

  let price: EntitySeo['price'];
  for (const name of names) {
    const field = fieldOf(name);
    if (!field || !PRICE_TYPES.has(field.type)) continue;
    price = priceOf(field, data[name]);
    if (price) break;
  }

  return {
    title: titleOf(entity, data, options),
    description: description || undefined,
    image: images[0],
    images,
    price,
    availability: availabilityOf(entity, data),
  };
}

/**
 * schema.org Product JSON-LD for a record.
 * `offers` only when a positive price exists (an Offer needs a price); its
 * `availability` only when the record status is mapped ({@link EntitySeo.availability}).
 *
 * @param seo - Output of {@link deriveEntitySeo}
 * @param url - Absolute canonical URL of the page
 * @returns JSON-LD object, or null when the record has no title
 */
export function buildProductJsonLd(
  seo: EntitySeo,
  url: string
): Record<string, unknown> | null {
  if (!seo.title) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: seo.title,
    ...(seo.description && { description: seo.description }),
    ...(seo.images.length > 0 && { image: seo.images }),
    url,
    ...(seo.price && {
      offers: {
        '@type': 'Offer',
        price: seo.price.amount,
        priceCurrency: seo.price.currency,
        ...(seo.availability && { availability: seo.availability }),
        url,
      },
    }),
  };
}
