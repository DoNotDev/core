// packages/core/utils/src/client/errors/index.ts

/**
 * @fileoverview Client Error Utilities Barrel Exports
 * @description Re-exports error handling utilities from common for backwards compatibility.
 * All error handling is now universal and lives in /common/errors.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export from common for backwards compatibility
export * from '../../common/errors';

// Client-specific Sentry utilities
export * from './sentryUtils';
