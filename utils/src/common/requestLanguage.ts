// packages/core/utils/src/common/requestLanguage.ts

/**
 * @fileoverview Request language resolution
 * @description One rule for the language of a render, shared by the server (cookie
 * header + Accept-Language) and the browser (document.cookie + navigator.languages),
 * so a server-rendered page and its hydration pick the same language.
 *
 * Order: the visitor's stored choice (language cookie) > their browser languages >
 * the app's fallback language.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */

/**
 * Cookie holding the visitor's language (BCP-47 code). Written by the language store
 * on every resolution and change; read by the server to render in that language.
 * Functional cookie (interface preference), no consent required.
 */
export const LANGUAGE_COOKIE = 'dndev-lang';

/**
 * Value of one cookie in a `Cookie` header string (`a=1; b=2`).
 *
 * @returns The decoded value, or `null` when the cookie is absent
 */
export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Language codes of an `Accept-Language` header, most preferred first
 * (`fr-FR,fr;q=0.9,en;q=0.8` → `['fr-FR', 'fr', 'en']`).
 */
export function parseAcceptLanguage(
  header: string | null | undefined
): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((e) => e.tag !== '' && e.tag !== '*' && e.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((e) => e.tag);
}

/**
 * The language to render in.
 *
 * @param supported - Language codes the app ships
 * @param fallback - App fallback language (used when nothing else matches)
 * @param stored - The visitor's stored choice (language cookie), if any
 * @param preferred - The visitor's browser languages, most preferred first
 */
export function resolveLanguage({
  supported,
  fallback,
  stored,
  preferred,
}: {
  supported: readonly string[];
  fallback: string;
  stored?: string | null;
  preferred?: readonly string[];
}): string {
  if (stored && supported.includes(stored)) return stored;
  for (const tag of preferred ?? []) {
    if (supported.includes(tag)) return tag;
    const base = tag.split('-')[0];
    if (base && supported.includes(base)) return base;
  }
  return fallback;
}
