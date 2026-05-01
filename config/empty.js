/**
 * @fileoverview ESM empty module for Vite browser serving ONLY (via absolute file path)
 * @description Proxy-based noop that silently absorbs any property access or function call.
 * Used ONLY by Vite's resolveId hook (absolute path from PathResolver.getEmptyModulePath()).
 * NOT used via the @donotdev/core/empty package export — that resolves to empty.cjs
 * because bundlers (Turbopack, esbuild) statically analyze ESM and reject unknown named imports.
 * For all bundler alias targets, see empty.cjs (CJS = dynamic exports = any named import resolves).
 */
const handler = {
  get(_, prop) {
    // Prevent Promise detection (awaiting a noop should resolve immediately)
    if (prop === 'then') return undefined;
    // Return undefined for all property access — consumers' truthiness checks
    // (e.g. `if (module.useAuth)`) correctly detect the module as empty.
    return undefined;
  },
  apply() {
    return undefined;
  },
};
const noop = new Proxy(function () {}, handler);
export default noop;
export { noop as __esModule };
