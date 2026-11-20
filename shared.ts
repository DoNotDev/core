// packages/core/shared.ts

/**
 * Code shared by `@donotdev/core` (browser) and `@donotdev/core/server`: types,
 * schemas and the client-free common utils. Built once to `dist/shared.js`; both
 * entries import it from there (one `DoNotDevError` class, one schema registry, one
 * provider registry per app). Internal build entry, not a published subpath.
 *
 * Server-only code (`@donotdev/utils/server`) stays out: it ships in `server.js`.
 *
 * @packageDocumentation
 */

export * from '@donotdev/types';
export * from '@donotdev/schemas';
export * from './utils/src/common';
