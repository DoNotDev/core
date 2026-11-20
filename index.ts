// packages/core/index.ts

/// <reference path="./config/global.d.ts" />

/**
 * @donotdev/core - DoNotDev Framework Core Package
 *
 * This package bundles all foundational framework modules for easier consumption.
 * Users can import everything they need from @donotdev/core.
 *
 * Includes:
 * - types (TypeScript definitions)
 * - utils (helpers, validators)
 * - stores (Zustand factory + patterns)
 * - schemas (validation + entity definitions)
 * - hooks (app initialization)
 * - i18n (translations + flags)
 *
 * Features (@donotdev/auth, @donotdev/billing, etc.) are separate packages.
 * UI layer (@donotdev/ui, @donotdev/templates, @donotdev/components) are separate packages.
 * Providers (@donotdev/firebase, etc.) are separate packages.
 *
 * Named exports only (no namespace objects), so consumer bundlers tree-shake unused
 * code. Types, schemas and common utils come from the shared bundle (`shared.js`);
 * lazy modules (flags) ship as separate chunks loaded on first use.
 *
 * @packageDocumentation
 */

// Re-export all core foundation packages
export * from '@donotdev/types';
export * from '@donotdev/utils';
export * from '@donotdev/stores';
export * from '@donotdev/schemas';
export * from '@donotdev/hooks';
export * from '@donotdev/i18n';
