/**
 * @fileoverview What the app's themes render text in: font stacks and weights per theme
 * @description Pure first step of the font plan (fonts/buildFontPlan.js). Reads the
 * framework's design-token CSS and the app's CSS (ThemeDiscovery `fontCss`), cascades
 * them per theme (framework root → app root → framework theme → app theme, the root
 * scope being the default theme) and returns, per theme:
 *
 * - the font stack of each rendered role (FONT_ROLE_TOKENS: body, headline, mono), every
 *   family in order with `var()` resolved, plus the declaration that writes its first
 *   family (where a missing `'<Family> Fallback'` is reported);
 * - the resolved value of every `--font-weight-*` token (the weights text is set in),
 *   with its declaration.
 *
 * A `var()` in a rendered stack that no scanned CSS defines (and that has no fallback)
 * fails the build: the framework cannot know which font it names.
 */

import { createBuildError } from '../utils/buildError.js';

/**
 * Font tokens the framework's CSS sets text in, by role: `--font-family` (body,
 * base.css), `--font-headline` (headings: base.css, Text.css, HeroSection.css),
 * `--font-mono` (code). `--font-sans` / `--font-serif` count only through these.
 */
export const FONT_ROLE_TOKENS = Object.freeze({
  body: '--font-family',
  headline: '--font-headline',
  mono: '--font-mono',
});

/** Prefix of the weight tokens (`--font-weight-normal`, `--font-weight-bold`, …). */
export const FONT_WEIGHT_TOKEN_PREFIX = '--font-weight-';

/** Scope key of `:root` / `html` declarations (the default theme). */
export const ROOT_SCOPE = ':root';

/** Source label of the framework's token CSS in messages. */
const FRAMEWORK_SOURCE = '@donotdev/components/styles';

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
/** Innermost rule blocks: `selector { declarations }` (nested @media bodies included). */
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const ROOT_SELECTOR_RE = /^(?::root|html|:where\(:root\))$/;
const THEME_SELECTOR_RE = /^(?::root|html)?\.([a-z][\w-]*)$/i;
const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;
/** CSS weight keywords with a fixed numeric value. */
const WEIGHT_KEYWORDS = { normal: 400, bold: 700 };

/**
 * Split a CSS value on top-level commas (ignores commas inside () and quotes).
 * @param {string} value
 * @returns {string[]} Trimmed parts
 */
export function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Family name of one font-family list entry, quotes removed (`'Inter Fallback'` →
 * `Inter Fallback`).
 * @param {string} entry
 * @returns {string}
 */
export function unquoteFamily(entry) {
  return entry.replace(/^['"]|['"]$/g, '').trim();
}

/**
 * Scope of one selector: ':root' for the root scope, the class name for a theme
 * class (`.luxury`, `:root.dark`, `html.dark`), null for any other rule.
 * @param {string} selector
 * @returns {string|null}
 */
function scopeOf(selector) {
  if (ROOT_SELECTOR_RE.test(selector)) return ROOT_SCOPE;
  const theme = THEME_SELECTOR_RE.exec(selector);
  return theme ? theme[1] : null;
}

/**
 * Custom-property declarations of a stylesheet, per scope (root + theme classes).
 * Later declarations win, as in the cascade.
 *
 * @param {string} css - Stylesheet text
 * @param {string} [source] - File the CSS comes from (reported in build errors)
 * @returns {Map<string, Map<string, { value: string, source: string, scope: string }>>}
 *   scope → (custom property → declaration)
 */
export function collectThemeTokens(css, source = '') {
  const scopes = new Map();
  const clean = css.replace(COMMENT_RE, '');
  for (const [, rawSelector, body] of clean.matchAll(RULE_RE)) {
    // Text before the selector may hold statements (`@import …;`): keep the last part
    const selectorText = rawSelector.split(';').pop();
    const keys = splitTopLevel(selectorText)
      .map(scopeOf)
      .filter((key) => key !== null);
    if (keys.length === 0) continue;

    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      const name = declaration.slice(0, colon).trim();
      if (!name.startsWith('--')) continue;
      const value = declaration
        .slice(colon + 1)
        .replace(/!important\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      for (const key of keys) {
        if (!scopes.has(key)) scopes.set(key, new Map());
        scopes.get(key).set(name, { value, source, scope: key });
      }
    }
  }
  return scopes;
}

/**
 * Merge per-scope token maps, later maps winning per custom property.
 * @param {Array<Map<string, Map<string, Object>>>} maps
 * @returns {Map<string, Map<string, Object>>}
 */
function mergeScopes(maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [scope, tokens] of map) {
      if (!merged.has(scope)) merged.set(scope, new Map());
      for (const [name, declaration] of tokens) {
        merged.get(scope).set(name, declaration);
      }
    }
  }
  return merged;
}

/**
 * Where a build error names a declaration: `src/themes.css (.luxury)`.
 * @param {{ source: string, scope: string }} declaration
 * @returns {string}
 */
export function declarationLocation({ source, scope }) {
  return `${source || 'CSS'} (${scope === ROOT_SCOPE ? ':root' : `.${scope}`})`;
}

/**
 * Families of a font-family value, in order, `var()` resolved against `tokens`.
 *
 * @param {string} token - Custom property being resolved (for messages)
 * @param {string} value
 * @param {Map<string, Object>} tokens - The scope's cascaded tokens
 * @param {Set<string>} seen - Custom properties already followed (cycle guard)
 * @returns {string[]} Family names, unquoted
 * @throws {Error} Build error on a var() defined nowhere without a fallback
 */
function flattenStack(token, value, tokens, seen) {
  const families = [];
  for (const entry of splitTopLevel(value)) {
    const ref = VAR_RE.exec(entry);
    if (!ref) {
      families.push(unquoteFamily(entry));
      continue;
    }
    const [, name, fallback] = ref;
    if (tokens.has(name) && !seen.has(name)) {
      families.push(
        ...flattenStack(name, tokens.get(name).value, tokens, new Set([...seen, name]))
      );
    } else if (fallback !== undefined) {
      families.push(...flattenStack(token, fallback, tokens, seen));
    } else {
      throw createBuildError(
        'dndev-fonts',
        `${token}: ${value} uses var(${name}), which no theme CSS defines (src/**/*.css and the framework tokens). ` +
          `Name the font family in the stack itself, e.g. ${token}: Manrope, 'Manrope Fallback', sans-serif; ` +
          '(a next/font or other runtime class variable is not a framework font).',
        'configuration-error'
      );
    }
  }
  return families;
}

/**
 * The declaration that writes the first family of a token's stack (follows `var()` in
 * first position), with that value split.
 *
 * @param {string} token
 * @param {Map<string, Object>} tokens
 * @returns {{ token: string, declaration: Object, entries: string[] } | null} null when
 *   the first entry is a var() resolved through its fallback
 */
function firstFamilyOrigin(token, tokens) {
  const seen = new Set();
  let name = token;
  while (tokens.has(name) && !seen.has(name)) {
    seen.add(name);
    const declaration = tokens.get(name);
    const entries = splitTopLevel(declaration.value);
    const ref = entries[0] && VAR_RE.exec(entries[0]);
    if (!ref) return { token: name, declaration, entries };
    name = ref[1];
  }
  return null;
}

/**
 * Numeric value of a weight token, `var()` and the `normal` / `bold` keywords resolved.
 *
 * @param {string} token
 * @param {Map<string, Object>} tokens
 * @param {Set<string>} [seen]
 * @returns {number}
 * @throws {Error} Build error when the value is not a weight
 */
function resolveWeight(token, tokens, seen = new Set()) {
  const { value } = tokens.get(token);
  const ref = VAR_RE.exec(value);
  if (ref) {
    const [, name, fallback] = ref;
    if (tokens.has(name) && !seen.has(name)) {
      return resolveWeight(name, tokens, new Set([...seen, token]));
    }
    if (fallback !== undefined) {
      return resolveWeight(token, new Map([[token, { value: fallback.trim() }]]), seen);
    }
  }
  if (value in WEIGHT_KEYWORDS) return WEIGHT_KEYWORDS[value];
  const weight = Number(value);
  if (Number.isFinite(weight) && weight >= 1 && weight <= 1000) return weight;
  throw createBuildError(
    'dndev-fonts',
    `${token}: ${value} is not a font weight (a number from 1 to 1000, normal or bold): the font plan ships the weights the --font-weight-* tokens name.`,
    'configuration-error'
  );
}

/**
 * Font stacks and weights of every theme.
 *
 * @param {Object} params
 * @param {string} params.frameworkCss - The framework's design-token CSS (@donotdev/components styles)
 * @param {Array<{ file: string, css: string }>} params.appCss - The app's CSS files (themes.css, globals.css…), in order
 * @returns {Array<{
 *   scope: string,
 *   roles: Record<'body'|'headline'|'mono', { stack: string[], origin: { token: string, declaration: Object, entries: string[] } | null } | undefined>,
 *   weights: Map<string, { weight: number, declaration: Object }>,
 * }>} One entry per theme, the root scope first
 * @throws {Error} Build error on an undefined var() in a rendered stack or a weight token that is no weight
 */
export function resolveThemeFonts({ frameworkCss, appCss }) {
  if (typeof frameworkCss !== 'string' || !Array.isArray(appCss)) {
    throw new Error(
      'resolveThemeFonts: frameworkCss (string) and appCss ({ file, css }[]) are required (ThemeDiscovery fontCss)'
    );
  }
  const framework = collectThemeTokens(frameworkCss, FRAMEWORK_SOURCE);
  const app = mergeScopes(appCss.map(({ file, css }) => collectThemeTokens(css, file)));
  const scopes = [ROOT_SCOPE, ...new Set([...framework.keys(), ...app.keys()])].filter(
    (scope, index, all) => all.indexOf(scope) === index
  );

  return scopes.map((scope) => {
    const tokens = new Map([
      ...(framework.get(ROOT_SCOPE) ?? []),
      ...(app.get(ROOT_SCOPE) ?? []),
      ...(scope === ROOT_SCOPE ? [] : (framework.get(scope) ?? [])),
      ...(scope === ROOT_SCOPE ? [] : (app.get(scope) ?? [])),
    ]);

    const roles = {};
    for (const [role, token] of Object.entries(FONT_ROLE_TOKENS)) {
      if (!tokens.has(token)) continue;
      roles[role] = {
        stack: flattenStack(token, tokens.get(token).value, tokens, new Set([token])),
        origin: firstFamilyOrigin(token, tokens),
      };
    }

    const weights = new Map();
    for (const name of tokens.keys()) {
      if (name.startsWith(FONT_WEIGHT_TOKEN_PREFIX)) {
        weights.set(name, { weight: resolveWeight(name, tokens), declaration: tokens.get(name) });
      }
    }
    return { scope, roles, weights };
  });
}
