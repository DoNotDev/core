/**
 * @fileoverview Build-time `t` over translation JSON
 * @description The i18next `t` the shared head rules (`routeSeo` of `./headTags.js`) read,
 * over translations the build already holds (i18n discovery content), for the plain-Node
 * build: the Next metadata manifest and llms.txt.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

/**
 * `t` over translations of one language: `ns:key.path` → the string at `key.path` in
 * namespace `ns`, else `options.defaultValue` (else the key), as i18next answers a
 * missing key.
 *
 * @param {Record<string, Object | null | undefined>} byNamespace - Namespace → its translations in the language
 * @returns {(key: string, options?: { defaultValue?: string }) => string}
 * @since 0.3.2
 */
export function translationT(byNamespace) {
  return (key, options) => {
    const separator = key.indexOf(':');
    let value = byNamespace[key.slice(0, separator)];
    for (const part of key.slice(separator + 1).split('.')) {
      value = value && typeof value === 'object' && part in value ? value[part] : undefined;
    }
    return typeof value === 'string' ? value : (options?.defaultValue ?? key);
  };
}
