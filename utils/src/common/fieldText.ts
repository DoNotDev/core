// packages/core/utils/src/common/fieldText.ts

/**
 * @fileoverview Field values as text
 * @description How an entity field value reads as plain text: the text CRUD cards show
 * (title, subtitle) and entity-derived SEO uses (`deriveEntitySeo`). One implementation
 * for both: `@donotdev/crud` display formatters delegate their text output here. Pure,
 * no React: same output on the server (Next route handlers) and in the browser.
 *
 * Order (same as the CRUD display): entity `options.displayValue` (needs the record),
 * empty value, type formatter, then `options.displayKey` interpolation.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import type {
  EntityField,
  FieldOption,
  FieldOptionVariant,
} from '@donotdev/types';

import { formatCurrency } from './currencyFormat';
import { formatTimeZoneFor } from './timeZone';

/**
 * Translation function used for field text. Pass an i18next `t` bound to the entity
 * namespace first, then `crud` (what CRUD cards use: `useTranslation([entity.namespace, 'crud'])`).
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export type FieldTextTranslate = (
  key: string,
  options?: Record<string, unknown>
) => string;

/**
 * Formats one non-empty field value as text.
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export type FieldTextFormatter = (
  value: unknown,
  field: EntityField,
  t: FieldTextTranslate,
  options: { locale?: string }
) => string;

/**
 * Options of {@link formatFieldText}.
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export interface FieldTextOptions {
  /** Locale for dates and numbers (i18next language) */
  locale?: string;
  /** The whole record: enables the field's `options.displayValue` resolver */
  item?: Record<string, unknown>;
  /**
   * Type formatter to use instead of the built-in one ({@link FIELD_TEXT_FORMATTERS}).
   * `@donotdev/crud` passes its field type registry formatter (custom field types).
   */
  formatter?: FieldTextFormatter;
}

/**
 * Whether a field value is empty (`null`, `undefined` or `''`).
 *
 * @param value - Field value
 * @returns true when the value has nothing to show
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export function isEmptyFieldValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * The price a `price` field value shows: `amount × (1 − discountPercent / 100)` when
 * `discountPercent` (a number or numeric text) is above 0, clamped to 100 (never a
 * negative price), else `amount`. One computation for the price text (`fieldText`), the
 * CRUD price display, the list sort (EntityList's `sortValue` on price columns) and the
 * Functions aggregate (`sum` / `avg` of a price field). Accepts the stored value:
 * `{ amount, discountPercent? }` (`FieldTypeToValue['price']`, `@donotdev/types`;
 * `amount` may be a numeric string) or a legacy bare number.
 *
 * @param value - Price field value
 * @returns The effective price, or null when there is no numeric amount
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function effectivePrice(value: unknown): number | null {
  const price = typeof value === 'number' ? { amount: value } : value;
  if (price === null || typeof price !== 'object') return null;
  const { amount } = price as { amount?: unknown };
  if (isEmptyFieldValue(amount)) return null;
  const base = Number(amount);
  if (!Number.isFinite(base)) return null;
  const discount = priceDiscountPercent(price);
  return discount > 0 ? base * (1 - discount / 100) : base;
}

/**
 * The discount a `price` field value applies, as {@link effectivePrice} applies it:
 * `discountPercent` (a number or numeric text) clamped to 0-100; 0 when there is none
 * (missing, empty, not a finite number) or the value is not a price object. Formatters
 * show the discount clue ("-15%") when this is above 0.
 *
 * @param value - Price field value
 * @returns The applied discount in percent, 0 for none
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function priceDiscountPercent(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0;
  const { discountPercent } = value as { discountPercent?: unknown };
  const percent = isEmptyFieldValue(discountPercent)
    ? NaN
    : Number(discountPercent);
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
}

/**
 * Translates a label with `namespace:key` support (option labels, field labels).
 * `ns:status.*` keys try the `t` default namespaces first (entity overrides), then `ns`.
 *
 * @param label - Label or i18n key (`'crud:status.draft'`, `'status.available'`)
 * @param t - Translation function (entity namespace first, then `crud`)
 * @returns Translated label
 *
 * @example
 * ```ts
 * translateEntityLabel('crud:status.draft', t); // entity "status.draft" if any, else crud's
 * ```
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export function translateEntityLabel(
  label: string,
  t: FieldTextTranslate
): string {
  if (!label.includes(':')) return t(label);
  const [namespace, key = label] = label.split(':');
  if (key.startsWith('status.')) {
    // Entity namespace first (user overrides), then the named one (framework defaults)
    const entityTranslation = t(key);
    if (entityTranslation !== key && entityTranslation !== `${namespace}:${key}`) {
      return entityTranslation;
    }
  }
  return t(key, { ns: namespace });
}

/**
 * Plain text of an HTML string: tags become spaces, whitespace collapsed.
 *
 * @param value - HTML
 * @returns Text content
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionsOf(field: EntityField): FieldOption[] | undefined {
  const options = field.validation?.options;
  return Array.isArray(options) ? (options as FieldOption[]) : undefined;
}

/**
 * Badge colour of the built-in and common status values, for `select` fields whose
 * option declares no `variant`. Values not listed show as plain text.
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export const STATUS_OPTION_VARIANTS: Readonly<Record<string, FieldOptionVariant>> = {
  draft: 'muted',
  published: 'success',
  available: 'success',
  active: 'success',
  deleted: 'destructive',
  archived: 'destructive',
};

/**
 * Badge colour of a `select` value: its option's `variant`, else the built-in status
 * colour ({@link STATUS_OPTION_VARIANTS}), else none (plain text).
 *
 * @param value - Field value
 * @param field - Entity field (its `validation.options`)
 * @returns The variant, or undefined for a value shown as plain text
 *
 * @example
 * ```ts
 * fieldOptionVariant('draft', statusField); // 'muted'
 * fieldOptionVariant('shipped', { ...field, validation: { options: [{ value: 'shipped', label: 'Shipped', variant: 'success' }] } }); // 'success'
 * ```
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function fieldOptionVariant(
  value: unknown,
  field: EntityField
): FieldOptionVariant | undefined {
  const declared = optionsOf(field)?.find((opt) => opt.value === value)?.variant;
  if (declared) return declared;
  return typeof value === 'string' && Object.hasOwn(STATUS_OPTION_VARIANTS, value)
    ? STATUS_OPTION_VARIANTS[value]
    : undefined;
}

/**
 * Whether a `price` field's prices include VAT, as the field declares it:
 * `options.fieldSpecific.vatIncluded: true` (VAT-inclusive, "TTC"), `false` or absent
 * (no VAT claim: pre-tax or undeclared). The column title, the default of each value
 * and the form's VAT toggle default follow it.
 *
 * @param field - Entity field
 * @returns `true` only when the field declares VAT-inclusive prices
 *
 * @example
 * ```ts
 * fieldVatIncluded({ type: 'price', options: { fieldSpecific: { vatIncluded: true } } }); // true
 * ```
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function fieldVatIncluded(field: EntityField): boolean {
  const fieldSpecific = field.options?.fieldSpecific as
    | { vatIncluded?: unknown }
    | undefined;
  return fieldSpecific?.vatIncluded === true;
}

/**
 * Whether one price value includes VAT: the value's own `vatIncluded` when it states
 * one, else the field's declaration ({@link fieldVatIncluded}).
 *
 * @param value - Price field value (`{ amount, vatIncluded?, ... }` or a legacy number)
 * @param field - Entity field
 * @returns Whether the value's amount includes VAT
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function priceVatIncluded(value: unknown, field: EntityField): boolean {
  const own =
    value !== null && typeof value === 'object'
      ? (value as { vatIncluded?: unknown }).vatIncluded
      : undefined;
  return typeof own === 'boolean' ? own : fieldVatIncluded(field);
}

/**
 * Title of a list column showing `field`: its label, with the note its cells leave
 * out. Price cells show the amount only, so the column of a price field declaring
 * VAT-inclusive prices ({@link fieldVatIncluded}) reads "Price (VAT incl.)"
 * (`crud:price.columnTitle`); any other price column and other fields keep their label.
 *
 * @param label - The field's translated label (`translateFieldLabel`)
 * @param field - Entity field
 * @param t - Translation function (entity namespace first, then `crud`)
 * @returns The column title
 *
 * @example
 * ```ts
 * // price: { type: 'price', options: { fieldSpecific: { vatIncluded: true } } }
 * fieldColumnTitle('Price', entity.fields.price, t); // "Price (VAT incl.)"
 * // priceExclVat: { type: 'price' } (or vatIncluded: false)
 * fieldColumnTitle('Price', entity.fields.priceExclVat, t); // "Price"
 * ```
 *
 * @version 0.2.0
 * @since 0.3.8
 */
export function fieldColumnTitle(
  label: string,
  field: EntityField,
  t: FieldTextTranslate
): string {
  return field.type === 'price' && fieldVatIncluded(field)
    ? t('crud:price.columnTitle', { label })
    : label;
}

function optionLabel(
  value: unknown,
  field: EntityField,
  t: FieldTextTranslate
): string {
  const label = optionsOf(field)?.find((opt) => opt.value === value)?.label;
  return label ? translateEntityLabel(label, t) : String(value);
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string | number);
}

/**
 * A date value as text, in the app's zone (`getAppTimeZone`): the same text on the
 * server and in the browser. A calendar date (`YYYY-MM-DD`) reads as written
 * (`formatTimeZoneFor`).
 */
function formatDateValue(
  value: unknown,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleString(locale, {
    ...options,
    timeZone: formatTimeZoneFor(value),
  });
}

// Medium date + short time: no seconds (an admin reads minutes)
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};
// toLocaleDateString / toLocaleTimeString defaults: numeric date, time with seconds
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
};
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};
const dateTime: FieldTextFormatter = (value, _field, _t, { locale }) =>
  formatDateValue(value, locale, DATE_TIME_FORMAT);

/** `HH:mm` or `HH:mm:ss[.sss]`: a wall-clock time (a `time` field's value, `<input type="time">`). */
const WALL_CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/;

/**
 * A `time` value as text. A wall-clock time (`HH:mm`, `HH:mm:ss`) is a time of day, not
 * an instant: shown as written, in the reader's language ("14:30", "2:30 PM"), never
 * shifted by a zone; seconds only when stored. Anything else (an instant) is a date
 * value: its time in the app's zone.
 */
const timeOfDay: FieldTextFormatter = (value, _field, _t, { locale }) => {
  const wall = typeof value === 'string' ? WALL_CLOCK_TIME.exec(value) : null;
  if (!wall) return formatDateValue(value, locale, TIME_FORMAT);
  const [, hour, minute, second] = wall;
  return new Date(
    Date.UTC(1970, 0, 1, Number(hour), Number(minute), Number(second ?? 0))
  ).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: 'numeric',
    ...(second !== undefined && { second: 'numeric' }),
    timeZone: 'UTC',
  });
};
const raw: FieldTextFormatter = (value) => String(value);
const yesNo: FieldTextFormatter = (value, _field, t) =>
  t(value ? 'crud:boolean.yes' : 'crud:boolean.no');
const localeNumber: FieldTextFormatter = (value, _field, _t, { locale }) =>
  typeof value === 'number' ? value.toLocaleString(locale) : String(value);

/**
 * Built-in text formatters, by field type. Types that only render visually
 * (images, files, rating, map) have none.
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export const FIELD_TEXT_FORMATTERS: Readonly<
  Record<string, FieldTextFormatter>
> = {
  // Date/time
  timestamp: dateTime,
  'datetime-local': dateTime,
  date: (value, _field, _t, { locale }) =>
    formatDateValue(value, locale, DATE_FORMAT),
  time: timeOfDay,
  week: raw,
  month: raw,

  // Boolean
  boolean: yesNo,
  checkbox: yesNo,
  switch: (value, field, t) => {
    const fieldSpecific = field.options?.fieldSpecific as
      | {
          uncheckedLabel?: string;
          checkedLabel?: string;
          uncheckedValue?: string | boolean;
          checkedValue?: string | boolean;
        }
      | undefined;
    if (fieldSpecific) {
      const uncheckedValue = fieldSpecific.uncheckedValue ?? false;
      const checkedValue = fieldSpecific.checkedValue ?? true;
      if (value === checkedValue && fieldSpecific.checkedLabel) {
        return translateEntityLabel(fieldSpecific.checkedLabel, t);
      }
      if (value === uncheckedValue && fieldSpecific.uncheckedLabel) {
        return translateEntityLabel(fieldSpecific.uncheckedLabel, t);
      }
    }
    return yesNo(value, field, t, {});
  },

  // Numeric
  year: raw,
  number: localeNumber,
  range: localeNumber,
  currency: (value, field, _t, { locale }) => {
    if (Number.isNaN(Number(value))) return '';
    const fieldSpecific = field.options?.fieldSpecific as
      | { currency?: string }
      | undefined;
    return formatCurrency(
      Number(value),
      fieldSpecific?.currency || 'EUR',
      {},
      locale
    );
  },
  price: (value, field, t, { locale }) => {
    // Legacy rows store the price as a bare number
    const price =
      typeof value === 'number'
        ? { amount: value, currency: 'EUR', discountPercent: 0 }
        : (value as {
            amount?: unknown;
            currency?: string;
            vatIncluded?: boolean;
            discountPercent?: number;
          } | null);
    if (!price || typeof price !== 'object') return '';
    const effective = effectivePrice(price);
    if (effective === null) return '';
    const currencyCode = price.currency || 'EUR';
    const discountPercent = priceDiscountPercent(price);
    const vatLabel = priceVatIncluded(price, field)
      ? ` ${t('crud:price.vatIncluded')}`
      : '';
    if (discountPercent > 0) {
      const discountClue = ` ${t('crud:price.discountPercent', {
        percent: Math.round(discountPercent),
      })}`;
      return `${formatCurrency(effective, currencyCode, {}, locale)}${vatLabel}${discountClue}`;
    }
    return `${formatCurrency(effective, currencyCode, {}, locale)}${vatLabel}`;
  },
  duration: (value, _field, t) => {
    const minutes =
      typeof value === 'number' ? value : parseInt(String(value), 10);
    if (Number.isNaN(minutes)) return '';
    if (minutes === 0) return t('crud:duration.zero');
    if (minutes < 60) {
      return t('crud:duration.minutes', {
        count: minutes,
      });
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return t('crud:duration.hours', { hours: h });
    return t('crud:duration.hoursMinutes', {
      hours: h,
      minutes: m,
    });
  },
  gdprConsent: (value, _field, t, { locale }) => {
    if (!value || typeof value !== 'object') return '';
    const consent = value as {
      gdprConsent?: boolean;
      gdprConsentDate?: string;
      gdprConsentVersion?: string;
    };
    if (consent.gdprConsent !== true) {
      return t('crud:gdprConsent.display.no');
    }
    const parts = [t('crud:gdprConsent.display.yes')];
    if (consent.gdprConsentDate) {
      parts.push(formatDateValue(consent.gdprConsentDate, locale, DATE_FORMAT));
    }
    if (consent.gdprConsentVersion) parts.push(`v${consent.gdprConsentVersion}`);
    return parts.join(' · ');
  },

  // Selection
  select: optionLabel,
  radio: optionLabel,
  combobox: optionLabel,
  multiselect: (value, field, t) =>
    Array.isArray(value) && optionsOf(field)
      ? value.map((v) => optionLabel(v, field, t)).join(', ')
      : String(value),

  // Complex
  reference: (value) => {
    if (value && typeof value === 'object') {
      const ref = value as { displayName?: unknown; name?: unknown; id?: unknown };
      return String(ref.displayName || ref.name || ref.id || value);
    }
    return String(value);
  },
  geopoint: (value) => {
    if (value && typeof value === 'object' && 'lat' in value && 'lng' in value) {
      const { lat, lng } = value as { lat: number; lng: number };
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    return '';
  },
  address: (value) =>
    value && typeof value === 'object' && 'formatted_address' in value
      ? String((value as { formatted_address: unknown }).formatted_address)
      : String(value),
  array: (value) => (Array.isArray(value) ? value.join(', ') : ''),
  'field-array': (value, field) => {
    if (!Array.isArray(value)) return '';
    const subFields = (
      field.options?.fieldSpecific as { fields?: { name: string }[] } | undefined
    )?.fields;
    return value
      .map((row) => {
        if (typeof row !== 'object' || row == null) return '';
        const obj = row as Record<string, unknown>;
        const keys = subFields ? subFields.map((sf) => sf.name) : Object.keys(obj);
        return keys
          .map((k) => obj[k])
          .filter((v) => v != null && v !== '')
          .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
          .join(' · ');
      })
      .filter(Boolean)
      .join(', ');
  },

  // Text
  password: () => '••••••••',
  text: raw,
  textarea: raw,
  email: raw,
  tel: raw,
  url: raw,
  color: raw,
  iban: raw,
  richtext: (value) => stripHtmlTags(String(value)),
};

/**
 * A field value as text, formatted like the CRUD card shows it.
 *
 * 1. `options.displayValue(value, item, t)` when `item` is given (`null` hides the field)
 * 2. empty value → `null`
 * 3. type formatter: `options.formatter`, else {@link FIELD_TEXT_FORMATTERS}; a type
 *    without one shows its primitive value as is (objects: `null`). `''` → `null`
 * 4. `options.displayKey` → `t(displayKey, { value: <formatted> })`
 *
 * @param value - Field value
 * @param field - Entity field definition
 * @param t - Translation function (entity namespace first, then `crud`)
 * @param options - Locale, record, formatter override
 * @returns The text, or `null` when the field has nothing to show
 *
 * @example
 * ```ts
 * // size: { type: 'number', options: { displayKey: 'fields.size_display' } }, "{{value}}m²"
 * formatFieldText(16, entity.fields.size, t); // "16m²"
 * ```
 *
 * @version 0.1.0
 * @since 0.2.3
 */
export function formatFieldText(
  value: unknown,
  field: EntityField,
  t: FieldTextTranslate,
  options: FieldTextOptions = {}
): string | null {
  const displayValue = field.options?.displayValue;
  if (displayValue && options.item) return displayValue(value, options.item, t);
  if (isEmptyFieldValue(value)) return null;

  const formatter = options.formatter ?? FIELD_TEXT_FORMATTERS[field.type];
  const formatted = formatter
    ? formatter(value, field, t, { locale: options.locale })
    : typeof value === 'object'
      ? null
      : String(value);
  if (formatted === null || formatted === '') return null;

  const displayKey = field.options?.displayKey;
  if (!displayKey) return formatted;
  const keys = (Array.isArray(displayKey) ? displayKey : [displayKey]).map(
    (key) => key.replace('{{value}}', formatted)
  );
  // why: i18next resolves a key array as fallbacks; FieldTextTranslate types `key` as string
  return t(keys as unknown as string, { value: formatted });
}
