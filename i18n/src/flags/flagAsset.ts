// packages/core/i18n/src/flags/flagAsset.ts

/**
 * @fileoverview Flag files: their public URL and a language's flag code
 * @description The one place both sides of a flag agree on: `Flag` renders
 * `<img src={flagSrc(code)}>` and the build (asset discovery) copies the flags of the
 * app's languages (and every country flag when an entity has a `tel` field:
 * {@link telFieldFlagCodes}) to `public/flags/<code>.svg`. `bun run bpr` compiles this file into
 * `config/utils/flagAsset.js`, the copy the plain-Node build imports. Edit this file,
 * never the `.js`.
 *
 * The artwork is one SVG file per flag code in `packages/core/i18n/flags/`, published as
 * `@donotdev/core/i18n/flags/<code>.svg`.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { COUNTRIES, LANGUAGES } from '../utils/constants';

/**
 * Public URL folder of the flag files (`public/flags/` in the app): root-absolute, like
 * the other framework public files (`/dndev-fonts.css`, `/logo.svg`).
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export const FLAGS_PUBLIC_PATH = '/flags';

/**
 * File name of a flag: its code in lower case, `.svg` (`GB-SCT` → `gb-sct.svg`), in the
 * framework artwork folder and in the app's `public/flags/`.
 *
 * @param code - Flag code (`fr`, `gb`, `gb-sct`), any case
 * @returns File name
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function flagFileName(code: string): string {
  return `${code.toLowerCase()}.svg`;
}

/**
 * Public URL of a flag (`fr` → `/flags/fr.svg`).
 *
 * @param code - Flag code, any case
 * @returns Root-absolute URL
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function flagSrc(code: string): string {
  return `${FLAGS_PUBLIC_PATH}/${flagFileName(code)}`;
}

/**
 * Flag code of a language, as the language pickers render it: its `LANGUAGES` entry's
 * `flagCode`, else the language id (`en` → `gb`, `fr` → `fr`, an id missing from
 * `LANGUAGES` → itself).
 *
 * @param languageId - Language id (`en`, `pt`, `br-fr`)
 * @returns Flag code
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function languageFlagCode(languageId: string): string {
  const language = LANGUAGES.find((lang) => lang.id === languageId);
  return language?.flagCode || languageId;
}

/**
 * Flag codes a `tel` field can show: the crud phone field (`PhoneNumberComponent`)
 * lists every `COUNTRIES` entry (no `countries` prop) and opens on `FR`, one of them.
 * Unique, in `COUNTRIES` order. The build copies them when an entity has a `tel` field.
 *
 * @returns Flag codes (`us`, `gb`, `fr`, ...)
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function telFieldFlagCodes(): string[] {
  return [...new Set(COUNTRIES.map((country) => country.flagCode))];
}
