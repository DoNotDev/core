// packages/core/server.ts

/**
 * @donotdev/core/server - DoNotDev Framework Server-Side Exports
 *
 * This module exports server-only utilities and schemas.
 * ONLY use this import in server-side code (Node.js, Firebase Functions, API routes, etc.)
 *
 * Includes:
 * - Browser-shared code (types, schemas, common utils): `./shared`, built once to
 *   `shared.js` and imported from there by both this entry and the browser root
 * - Server-only utils (date math, env/URL/metadata validation, cookie parsing)
 *
 * Note: Firestore validators are provided by @donotdev/firebase/server
 *
 * DO NOT import this in client-side code - it will fail or bloat your bundle.
 *
 * @packageDocumentation
 */

// Browser-shared code (types, schemas, common utils)
export * from './shared';

// Server-only utilities (also re-exports the common utils, same bindings)
export * from '@donotdev/utils/server';

// Optionally re-export with namespaces for clarity
export * as ServerUtils from '@donotdev/utils/server';
