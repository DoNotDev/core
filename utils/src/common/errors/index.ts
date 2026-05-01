// packages/core/utils/src/common/errors/index.ts

/**
 * @fileoverview Common Error Utilities Barrel Exports
 * @description Barrel exports for universal error handling utilities.
 * Works on both client and server environments.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export * from './doNotDevError';
export * from './handleError';
export * from './internal/errorDetection';
export * from './internal/errorMapper';
export * from './internal/sentryCapture';
export * from './internal/serviceErrorHandler';
