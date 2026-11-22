/**
 * @fileoverview Meta Extractor
 * @description Extracts meta exports from TypeScript/JavaScript files using regex with JSX support. Works with both Vite and Next.js builds.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createBuildError } from './buildError.js';

/** Bare identifier: the only PageMeta `entity` value discovery resolves (`productEntity`). */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Literal `entity` values, evaluated as written (discovery rejects all but `undefined`). */
const LITERAL =
  /^(?:'[^'\\]*'|"[^"\\]*"|`[^`\\$]*`|-?\d[\w.]*|null|undefined|true|false)$/;

/**
 * End of the `entity` value starting at `start` in a PageMeta object literal: the next
 * `,`, closing bracket or comment at its own nesting level (strings skipped).
 */
function entityValueEnd(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === "'" || char === '"' || char === '`') {
      for (i++; i < source.length && source[i] !== char; i++) {
        if (source[i] === '\\') i++;
      }
      continue;
    }
    if (depth === 0 && (char === ',' || (char === '/' && /[/*]/.test(source[i + 1] ?? '')))) {
      return i;
    }
    if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return source.length;
}

/**
 * Rewrites each PageMeta `entity` value so evaluating the meta never touches it: a bare
 * identifier becomes `{ identifier: 'productEntity' }`, a literal stays as written, any
 * other expression (`entities.productEntity`, a call) becomes `{ expression: '…' }`.
 * {@link resolvePageEntity} then resolves the identifier or fails the build on the rest.
 * Evaluated as is, an unresolvable expression would make the whole PageMeta unreadable
 * (build error naming the expression instead of the entity-specific one).
 *
 * @param {string} objectString - PageMeta object literal source
 * @returns {string}
 */
function markEntityReference(objectString) {
  const key = /(^|[{,\s])entity\s*:\s*/gm;
  let output = '';
  let copied = 0;
  let match;
  while ((match = key.exec(objectString))) {
    const start = match.index + match[0].length;
    const end = entityValueEnd(objectString, start);
    const value = objectString.slice(start, end).trimEnd();
    if (!value) continue;
    const reference = LITERAL.test(value)
      ? value
      : IDENTIFIER.test(value)
        ? `{ identifier: '${value}' }`
        : `{ expression: ${JSON.stringify(value)} }`;
    output += objectString.slice(copied, start) + reference;
    copied = start + value.length;
    key.lastIndex = copied;
  }
  return output + objectString.slice(copied);
}

/**
 * Why a PageMeta object literal could not be evaluated, naming the offending value
 * when the engine does (`ADMIN_ONLY is not defined` → `` `ADMIN_ONLY` ``).
 *
 * @param {unknown} error - Error thrown evaluating the object literal
 * @returns {string}
 */
function unreadableMetaReason(error) {
  const message = error instanceof Error ? error.message : String(error);
  const undefinedName = /^(\S+) is not defined$/.exec(message)?.[1];
  if (undefinedName) {
    return `\`${undefinedName}\` is not a literal value (an import, a variable or a call)`;
  }
  return `it is not a plain object literal (${message})`;
}

/**
 * Extract meta export from file content using enhanced regex parsing
 * @param {string} code - The source code to parse
 * @param {string} filePath - The page path, named in the build error
 * @returns {object|null} - The extracted meta object or null if the file exports none. A PageMeta
 *   `entity: productEntity` (an imported entity definition) comes back as
 *   `entity: { identifier: 'productEntity' }`, which route discovery resolves to the
 *   entity's collection (`resolvePageEntity`); any other non-literal entity value
 *   (`entities.productEntity`) as `entity: { expression: 'entities.productEntity' }`,
 *   which discovery rejects (build error).
 * @throws {Error} Build error ({@link createBuildError}, `[dndev-routes] <file>: ...`) when
 *   the PageMeta cannot be evaluated (a value that is not a literal: `auth: ADMIN_ONLY`).
 *   Returning nothing would drop the page's route, auth guard and seo silently.
 */
export function extractMeta(code, filePath = 'unknown') {
  // PageMeta must be a self-contained, plain-text object literal, not DRY variables.
  // Imports/object constants (e.g. auth: ADMIN_ONLY) are not resolved here: evaluation
  // fails and the build fails with the offending value (dropping the meta would lose
  // route overrides and auth guards). JSX icons and `entity` are handled explicitly below.
  // Enhanced regex to find meta export with JSX support
  const metaRegex = /export\s+const\s+meta\s*[^=]*=\s*(\{[\s\S]*?\});/;
  const match = code.match(metaRegex);

  if (!match) {
    return null;
  }

  // Extract the object string
  let objectString = match[1];

  // Handle JSX icons by extracting component names
  // Extract name between < and first space or /, then consume rest of tag: <Rocket />, <Rocket/>, <Icon className="..." />
  objectString = objectString.replace(
    /icon:\s*<(\w+)[\s\/][^>]*\/?>/g,
    (match, componentName) => {
      return `icon: '${componentName}'`;
    }
  );

  // PageMeta entity: kept as a reference for discovery to resolve (resolvePageEntity),
  // never evaluated: an unresolvable value here would make the whole meta unreadable
  objectString = markEntityReference(objectString);

  // Resolve variable references (like NAMESPACE)
  // Match both exported and non-exported const declarations
  const constRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g;
  const constMatches = [...code.matchAll(constRegex)];

  constMatches.forEach((match) => {
    const varName = match[1];
    const varValue = match[2];
    objectString = objectString.replace(
      new RegExp(`\\b${varName}\\b`, 'g'),
      `'${varValue}'`
    );
  });

  // Execute the resolved object string
  try {
    return Function(`return ${objectString}`)();
  } catch (error) {
    throw createBuildError(
      'dndev-routes',
      `${filePath}: PageMeta cannot be read at build: ${unreadableMetaReason(error)}. ` +
        'Without it the page would lose its route, auth and seo. The build reads PageMeta ' +
        'statically: write every value as a literal in the object (strings, numbers, booleans, ' +
        "null, arrays and objects of those, icon: <Icon />, a string constant declared in the " +
        "page file: const NAMESPACE = 'home'), except entity, the defineEntity identifier " +
        "imported from 'entities'. Example: auth: { required: true, role: 'admin' } instead " +
        'of auth: ADMIN_ONLY.',
      'invalid-configuration'
    );
  }
}

/**
 * Whether a page module exports Next's `generateMetadata` (`export async function
 * generateMetadata`, `export function`, `export const`, or a re-export
 * `export { generateMetadata } from`). Same static scan as {@link extractMeta}: the
 * Next route generator re-exports it from the generated page, and the page's identity
 * then comes from it instead of AutoMetaTags. Lines that are comments do not count.
 *
 * @param {string} code - Page module source
 * @returns {boolean}
 * @since 0.3.2
 *
 * @example
 * hasGenerateMetadataExport('export async function generateMetadata({ params }) {}'); // true
 */
export function hasGenerateMetadataExport(code) {
  return /^[ \t]*export\s+(?:(?:async\s+)?function\s*\*?\s*generateMetadata\b|(?:const|let)\s+generateMetadata\b|\{[^}]*\bgenerateMetadata\b[^}]*\})/m.test(
    code
  );
}

/**
 * Extract auth configuration from meta object
 * @param {object} meta - The meta object
 * @returns {object} - The auth configuration
 */
export function extractAuthFromMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return { required: false };
  }

  // Handle different auth formats
  if (meta.auth === true) {
    return { required: true };
  } else if (meta.auth === false) {
    return { required: false };
  } else if (meta.auth && typeof meta.auth === 'object') {
    return meta.auth;
  }

  return { required: false };
}
