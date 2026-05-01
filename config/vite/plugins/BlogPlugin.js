/**
 * @fileoverview Blog Plugin - Vite Virtual Module
 * @description Resolves `virtual:donotdev/blog` to an inline module that
 * eagerly imports all `src/content/blog/*.md` files as raw strings.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { VIRTUAL_MODULES } from '../../constants.js';

const VIRTUAL_ID = VIRTUAL_MODULES.blog;
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/**
 * Minimal Vite plugin that serves `virtual:donotdev/blog`.
 * No HMR watching — blog files are static build-time content.
 *
 * @returns {import('vite').Plugin}
 */
export function createViteBlogPlugin() {
  return {
    name: 'dndev-vite-blog',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      // Glob must be absolute (project-root prefixed with '/') because this
      // module is virtual — Vite has no source file to resolve relative paths
      // against. See vite:import-glob: "In virtual modules, all globs must
      // start with '/'".
      return `
const files = import.meta.glob('/src/content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export default files;
`;
    },
  };
}
