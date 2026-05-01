// packages/core/utils/src/client/errors/internal/index.ts

/**
 * @fileoverview Internal Error Utilities Barrel Exports
 * @description Re-exports internal error handling utilities from common for backwards compatibility.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Re-export from common
export * from '../../../common/errors/internal/errorDetection';
export * from '../../../common/errors/internal/errorMapper';
export * from '../../../common/errors/internal/sentryCapture';
export * from '../../../common/errors/internal/serviceErrorHandler';
