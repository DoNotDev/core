// packages/core/utils/src/common/entityTranslations.ts

/**
 * @fileoverview Translated entity fields
 * @description A field defined with `i18n: true` keeps the default language in its own
 * column and every other language in a companion map field `<name>I18n`
 * (`{ en: '…', de: '…' }`, jsonb column `<name>_i18n` on Supabase). Reads swap in the
 * current language; a missing or empty translation keeps the default-language value.
 * Shared by the schema builder (companion schemas), the SQL generator (companion
 * columns) and the crud read hooks (resolution).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

/**
 * Field types that can be translated (`i18n: true`).
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export const TRANSLATABLE_FIELD_TYPES: readonly string[] = [
  'text',
  'textarea',
  'richtext',
  'field-array',
];

/**
 * Name of the companion field holding the translations of `field`.
 *
 * @param field - Translated field name (`description`)
 * @returns Companion field name (`descriptionI18n`)
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function i18nFieldName(field: string): string {
  return `${field}I18n`;
}

/**
 * Names of the translated fields (`i18n: true`) of an entity field map.
 *
 * @param fields - Entity field map
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function getTranslatedFieldNames(
  fields: Record<string, { i18n?: boolean }>
): string[] {
  return Object.keys(fields).filter((name) => fields[name]?.i18n === true);
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Row with its translated fields in `language`. A field keeps its stored value when its
 * companion has no non-empty entry for `language` (the default language never has one).
 * Returns the same object when nothing changes.
 *
 * @param row - Stored row (companion fields included)
 * @param fieldNames - Translated field names ({@link getTranslatedFieldNames})
 * @param language - Language to show
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */
export function translateRow<T extends Record<string, unknown>>(
  row: T,
  fieldNames: readonly string[],
  language: string
): T {
  let out: Record<string, unknown> | null = null;
  for (const name of fieldNames) {
    const translations = row[i18nFieldName(name)];
    if (!translations || typeof translations !== 'object') continue;
    const value = (translations as Record<string, unknown>)[language];
    if (!hasContent(value)) continue;
    out ??= { ...row };
    out[name] = value;
  }
  return (out as T | null) ?? row;
}
