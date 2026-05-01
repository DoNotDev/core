// packages/core/utils/src/common/maybeTranslate.ts

/**
 * @fileoverview Smart translation helper
 * @description Auto-detects translation keys vs raw strings
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Smart translation helper - auto-detects translation keys vs raw strings
 *
 * **How it works:**
 * - If string has no dots/colons → return as-is (plain string)
 * - If string has namespace prefix (e.g. "purchase:products.x") → try to translate
 * - If string has dots but no namespace → try to translate (i18next fallback returns original if missing)
 *
 * **Namespace handling:**
 * - "purchase:products.earlyBird.name" → translates from purchase namespace
 * - "products.earlyBird.name" → translates from current namespace
 * - "Early Bird Lifetime" → returns as-is
 *
 * **Use cases:**
 * 1. Simple apps: Pass plain strings, they render as-is
 * 2. i18n apps: Pass translation keys with namespace prefix
 * 3. Edge cases: "Dr. Smith" with dot → tries t(), fallback returns original ✅
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * @example
 * ```tsx
 * // Simple app
 * maybeTranslate(t, "Early Bird Lifetime") // → "Early Bird Lifetime"
 *
 * // i18n app with namespace
 * maybeTranslate(t, "purchase:products.earlyBird.name") // → "Accès Anticipé à Vie" (if FR)
 *
 * // i18n app without namespace
 * maybeTranslate(t, "products.earlyBird.name") // → "Accès Anticipé à Vie" (if FR)
 *
 * // Missing translation
 * maybeTranslate(t, "products.missing.key") // → "products.missing.key" (debug!)
 * ```
 */
export function maybeTranslate(t: any, value?: string): string {
  if (!value) return '';

  // If no dot or colon, definitely not a translation key
  if (!value.includes('.') && !value.includes(':')) return value;

  // Has namespace:key format or key.path format, try to translate
  // i18next returns original string if key not found (perfect for debugging)
  return t(value);
}
