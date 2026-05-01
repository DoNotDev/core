// packages/core/server.ts

/**
 * @donotdev/core/server - DoNotDev Framework Server-Side Exports
 *
 * This module exports server-only utilities and schemas.
 * ONLY use this import in server-side code (Node.js, Firebase Functions, API routes, etc.)
 *
 * Includes:
 * - Server-safe utils (error handling, logging, validation, cookies, dates)
 *
 * Note: Firestore validators are provided by @donotdev/firebase/server
 *
 * DO NOT import this in client-side code - it will fail or bloat your bundle.
 *
 * @packageDocumentation
 */

// Re-export server-side utilities
export * from '@donotdev/utils/server';
export * from '@donotdev/types';
export * from '@donotdev/schemas';

// Optionally re-export with namespaces for clarity
export * as ServerUtils from '@donotdev/utils/server';
