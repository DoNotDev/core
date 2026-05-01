// packages/core/utils/src/server/index.ts

/**
 * @fileoverview Server-side utilities
 * @description Server-safe utilities that can be used in server environments
 *
 * This module exports only utilities that are safe to use in server contexts:
 * - Common utilities (no client-specific code)
 * - Server-specific utilities
 * - Error handling
 * - Platform detection (server-aware)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Common/Shared utilities (server-safe)
export * from '../common';

// Server-specific utilities
// Removed EDA - PayloadEventBridge no longer needed
export * from './dateUtils';
export * from './validation';
// Logger requires explicit import: import { logger } from '@donotdev/utils/server/logger'
export * from './cookieUtils';
