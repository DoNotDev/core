// packages/core/utils/src/common/schema/getListCardFieldNames.ts

/**
 * @fileoverview Extract flat field names for card queries/schemas.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ListCardLayout } from '@donotdev/types';

/**
 * SSOT for card field resolution. Returns a flat, deduplicated field name list.
 *
 * Fallback chain: `listCardFields` → `listFields` → all entity field keys.
 *
 * - `string[]` → returned as-is
 * - `ListCardLayout` → all slot arrays merged (deduplicated)
 * - `undefined` → falls back to `listFields`, then `Object.keys(fields)`
 */
export function getListCardFieldNames(entity: {
  listCardFields?: string[] | ListCardLayout;
  listFields?: string[];
  fields?: Record<string, unknown>;
}): string[] {
  const lcf = entity.listCardFields;

  // Explicit listCardFields — array or layout object
  if (lcf) {
    if (Array.isArray(lcf)) return lcf;

    const layout = lcf as ListCardLayout;
    const all = [
      ...(layout.title ?? []),
      ...(layout.subtitle ?? []),
      ...(layout.content ?? []),
      ...(layout.footer ?? []),
    ];
    return [...new Set(all)];
  }

  // Fallback: listFields
  if (entity.listFields && entity.listFields.length > 0) {
    return entity.listFields;
  }

  // Last resort: all entity field keys
  if (entity.fields) {
    return Object.keys(entity.fields);
  }

  return [];
}
