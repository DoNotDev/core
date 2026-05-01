// packages/core/utils/src/common/withTimeout.ts

/**
 * @fileoverview Timeout and abort utilities for async operations
 * @description Wraps promises with timeout and AbortSignal support.
 * Used by CRUD and storage adapters to enforce operation deadlines.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Constants
// =============================================================================

/** Default timeout for upload operations (30 seconds) */
export const DEFAULT_UPLOAD_TIMEOUT = 30_000;

/** Default timeout for CRUD operations (15 seconds) */
export const DEFAULT_CRUD_TIMEOUT = 15_000;

// =============================================================================
// withTimeout
// =============================================================================

/**
 * Wrap a promise with a timeout and optional AbortSignal.
 *
 * - If timeout expires: rejects with a TimeoutError
 * - If signal aborts: rejects with an AbortError
 * - If promise resolves/rejects first: returns that result
 * - Cleans up all listeners on completion
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (0 or negative = no timeout)
 * @param signal - Optional AbortSignal
 * @returns The promise result
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  // Fast path: already aborted
  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal.reason));
  }

  // No timeout and no signal - return original promise
  const hasTimeout = timeoutMs > 0;
  if (!hasTimeout && !signal) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function cleanup(): void {
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }

    function onAbort(): void {
      if (settled) return;
      cleanup();
      reject(createAbortError(signal?.reason));
    }

    // Set up abort listener
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    // Set up timeout
    if (hasTimeout) {
      timer = setTimeout(() => {
        if (settled) return;
        cleanup();
        reject(createTimeoutError(timeoutMs));
      }, timeoutMs);
    }

    // Race against the original promise
    promise.then(
      (value) => {
        if (settled) return;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        cleanup();
        reject(error);
      }
    );
  });
}

// =============================================================================
// Error Factories
// =============================================================================

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Operation timed out after ${timeoutMs}ms`);
  error.name = 'TimeoutError';
  return error;
}

function createAbortError(reason?: unknown): Error {
  if (reason instanceof Error) {
    const error = new Error(reason.message);
    error.name = 'AbortError';
    return error;
  }
  const error = new Error(
    typeof reason === 'string' ? reason : 'Operation was aborted'
  );
  error.name = 'AbortError';
  return error;
}
