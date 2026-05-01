// packages/core/utils/src/common/uuid.ts

/**
 * @fileoverview Safari-safe UUID v4 generator
 * @description Generates RFC 4122 compliant v4 UUIDs using `crypto.getRandomValues()`,
 * which is available in ALL modern browsers (Safari 11+, Chrome 11+, Firefox 26+).
 *
 * `crypto.randomUUID()` requires Safari 15.4+ and a secure context.
 * This utility works everywhere `crypto.getRandomValues()` is available,
 * which covers every browser we support.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/**
 * Generate a cryptographically random UUID v4.
 *
 * Uses `crypto.getRandomValues()` (universal) instead of `crypto.randomUUID()`
 * (Safari 15.4+ only) for maximum browser compatibility.
 *
 * @returns UUID v4 string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 *
 * @version 0.1.0
 * @since 0.1.0
 */
export function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version 4 (0100 in bits 6-7 of byte 6)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // Set variant 1 (10xx in bits 6-7 of byte 8)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
