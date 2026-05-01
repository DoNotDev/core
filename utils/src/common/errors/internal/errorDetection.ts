// packages/core/utils/src/common/errors/internal/errorDetection.ts

/**
 * @fileoverview Error source detection module
 * @description Automatically detects the source of errors to apply appropriate handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ErrorSource } from '@donotdev/types';

/**
 * Detects the source of an error based on its properties and structure
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param error - The error to analyze
 * @returns The detected error source
 */
export function detectErrorSource(error: unknown): ErrorSource {
  // Already has a source specified
  if (
    error instanceof Error &&
    'source' in error &&
    typeof (error as any).source === 'string'
  ) {
    return (error as any).source as ErrorSource;
  }

  // Check for Firebase Auth errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    (error as any).code.startsWith('auth/')
  ) {
    return 'auth';
  }

  // Check for OAuth errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    (error as any).code.startsWith('oauth/')
  ) {
    return 'oauth';
  }

  // Check for Firebase errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    [
      'permission-denied',
      'unavailable',
      'not-found',
      'already-exists',
      'unauthenticated',
      'invalid-argument',
      'failed-precondition',
      'resource-exhausted',
    ].includes((error as any).code)
  ) {
    return 'firebase';
  }

  // Check for Valibot validation errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as any).issues) &&
    'name' in error &&
    (error as any).name === 'ValiError'
  ) {
    return 'validation';
  }

  // Check for Entity errors
  if (error instanceof Error && error.name === 'EntityHookError') {
    return 'entity';
  }

  // Check for API errors (axios/fetch)
  if (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'status' in error || 'statusText' in error)
  ) {
    return 'api';
  }

  // Check for React errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'componentStack' in error
  ) {
    return 'ui';
  }

  // Default to unknown
  return 'unknown';
}
