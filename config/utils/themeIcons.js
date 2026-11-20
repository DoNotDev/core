/**
 * @fileoverview Theme icon registry
 * @description Lucide icons named by the themes' `--theme-icon` (`'Sun'`, `'Gem'`). The
 * generated theme modules (Vite `virtual:themes`, Next `src/config/dndev-config-theme.js`)
 * import exactly these icons by name and publish them as `_DNDEV_CONFIG_.themes.icons`, so
 * the theme toggle renders them statically (server-rendered on Next) instead of pulling the
 * whole lucide-react namespace. Any other icon name string is loaded per icon at runtime
 * (`@donotdev/ui` `Icon`).
 *
 * @version 0.1.0
 * @since 0.3.1
 * @author AMBROISE PARK Consulting
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Identifier prefix of the imported icons in the generated module (no clash with its own names). */
const IMPORT_PREFIX = 'ThemeIcon_';

/** lucide-react export names, read once per process. @type {Set<string> | undefined} */
let lucideExportNames;

/**
 * Export names of the installed lucide-react (`Sun`, `SunIcon`, `LucideSun`, ...).
 * @returns {Set<string>}
 */
function getLucideExportNames() {
  lucideExportNames ??= new Set(Object.keys(require('lucide-react')));
  return lucideExportNames;
}

/**
 * Icon names declared by the themes (`meta.icon`, from `--theme-icon`), kept when they
 * are lucide-react exports. Unknown names are reported: the theme toggle shows the
 * Palette icon for them.
 *
 * @param {Array<{ name: string, meta?: { icon?: string } }>} themes - Discovered themes
 * @param {{ warn: (message: string) => void }} logger - Discovery logger
 * @returns {string[]} Sorted, unique lucide-react export names
 */
export function getThemeIconNames(themes, logger) {
  const lucide = getLucideExportNames();
  const names = new Set();
  for (const theme of themes) {
    const raw = theme.meta?.icon;
    if (!raw) continue;
    const name = String(raw).replace(/['"]/g, '').trim();
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(name) && lucide.has(name)) {
      names.add(name);
    } else {
      logger.warn(
        `🎨 Theme "${theme.name}": --theme-icon '${name}' is not a lucide-react icon name (theme toggle shows the Palette icon)`
      );
    }
  }
  return [...names].sort();
}

/**
 * Import statement of the theme icons for a generated module (empty without icons).
 *
 * @param {string[]} names - From {@link getThemeIconNames}
 * @returns {string} `import { Sun as ThemeIcon_Sun, ... } from 'lucide-react';\n`
 */
export function renderThemeIconImports(names) {
  if (names.length === 0) return '';
  const specifiers = names.map((name) => `${name} as ${IMPORT_PREFIX}${name}`);
  return `import { ${specifiers.join(', ')} } from 'lucide-react';\n`;
}

/**
 * Object literal mapping each theme icon name to its imported component.
 *
 * @param {string[]} names - From {@link getThemeIconNames}
 * @returns {string} `{ "Sun": ThemeIcon_Sun, ... }`
 */
export function renderThemeIconMap(names) {
  const entries = names.map(
    (name) => `${JSON.stringify(name)}: ${IMPORT_PREFIX}${name}`
  );
  return `{ ${entries.join(', ')} }`;
}
