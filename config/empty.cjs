/**
 * @fileoverview CJS empty module for optional dep aliasing
 * @description Bundlers (esbuild, Turbopack, Rollup) statically analyze ESM exports.
 * Named imports like `import { CrudCard } from '@donotdev/crud'` fail against an ESM
 * empty module because the export doesn't exist. CJS has dynamic exports — bundlers
 * allow any named import to resolve. Used as alias target by all bundlers.
 * No framework code imports this directly.
 */
const handler = {
  get(_, prop) {
    if (prop === 'then') return undefined;
    return undefined;
  },
  apply() {
    return undefined;
  },
};
const noop = new Proxy(function () {}, handler);
module.exports = noop;
module.exports.default = noop;
module.exports.__esModule = true;
