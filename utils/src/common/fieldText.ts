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

import type { EntityField } from '@donotdev/types';

import { formatCurrency } from './currencyFormat';

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

type FieldOption = { value: unknown; label: string };

function optionsOf(field: EntityField): FieldOption[] | undefined {
  const options = field.validation?.options;
  return Array.isArray(options) ? (options as FieldOption[]) : undefined;
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

const dateTime: FieldTextFormatter = (value, _field, _t, { locale }) =>
  toDate(value).toLocaleString(locale);
const raw: FieldTextFormatter = (value) => String(value);
const yesNo: FieldTextFormatter = (value) => (value ? 'Yes' : 'No');
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
    toDate(value).toLocaleDateString(locale),
  time: (value, _field, _t, { locale }) =>
    toDate(value).toLocaleTimeString(locale),
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
    return value ? 'Yes' : 'No';
  },

  // Numeric
  year: raw,
  number: localeNumber,
  range: localeNumber,
  currency: (value, field) => {
    if (Number.isNaN(Number(value))) return '';
    const fieldSpecific = field.options?.fieldSpecific as
      | { currency?: string }
      | undefined;
    return formatCurrency(Number(value), fieldSpecific?.currency || 'EUR');
  },
  price: (value, _field, t) => {
    // Legacy rows store the price as a bare number
    const price =
      typeof value === 'number'
        ? { amount: value, currency: 'EUR', vatIncluded: true, discountPercent: 0 }
        : (value as {
            amount?: unknown;
            currency?: string;
            vatIncluded?: boolean;
            discountPercent?: number;
          } | null);
    if (!price || typeof price !== 'object') return '';
    const amount = price.amount;
    if (isEmptyFieldValue(amount) || Number.isNaN(Number(amount))) return '';
    const currencyCode = price.currency || 'EUR';
    const discountPercent = price.discountPercent ?? 0;
    const vatLabel =
      (price.vatIncluded ?? true)
        ? ` ${t('crud:price.vatIncluded', { defaultValue: 'VAT Incl.' })}`
        : '';
    if (discountPercent > 0) {
      const effective = Number(amount) * (1 - discountPercent / 100);
      const discountClue = ` ${t('crud:price.discountPercent', {
        percent: Math.round(discountPercent),
        defaultValue: '-{{percent}}%',
      })}`;
      return `${formatCurrency(effective, currencyCode)}${vatLabel}${discountClue}`;
    }
    return `${formatCurrency(Number(amount), currencyCode)}${vatLabel}`;
  },
  duration: (value, _field, t) => {
    const minutes =
      typeof value === 'number' ? value : parseInt(String(value), 10);
    if (Number.isNaN(minutes)) return '';
    if (minutes === 0) return t('crud:duration.zero', { defaultValue: '—' });
    if (minutes < 60) {
      return t('crud:duration.minutes', {
        count: minutes,
        defaultValue: `${minutes} min`,
      });
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return t('crud:duration.hoursMinutes', {
      hours: h,
      minutes: m,
      defaultValue: m === 0 ? `${h}h` : `${h}h ${m}min`,
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
      return t('crud:gdprConsent.display.no', { defaultValue: 'Not consented' });
    }
    const parts = [
      t('crud:gdprConsent.display.yes', { defaultValue: 'Consented' }),
    ];
    if (consent.gdprConsentDate) {
      parts.push(new Date(consent.gdprConsentDate).toLocaleDateString(locale));
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
