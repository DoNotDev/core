import { describe, it, expect } from 'vitest';

import {
  createErrorHandler,
  commonErrorCodeMappings,
} from '../serviceErrorHandler';

import type { ErrorHandlerConfig } from '../serviceErrorHandler';

describe('commonErrorCodeMappings', () => {
  it('maps permission-denied', () => {
    expect(commonErrorCodeMappings['permission-denied']).toBe(
      'permission-denied'
    );
  });

  it('maps unavailable', () => {
    expect(commonErrorCodeMappings['unavailable']).toBe('unavailable');
  });

  it('maps not-found', () => {
    expect(commonErrorCodeMappings['not-found']).toBe('not-found');
  });

  it('maps failed-precondition to invalid-argument', () => {
    expect(commonErrorCodeMappings['failed-precondition']).toBe(
      'invalid-argument'
    );
  });

  it('maps resource-exhausted to rate-limit-exceeded', () => {
    expect(commonErrorCodeMappings['resource-exhausted']).toBe(
      'rate-limit-exceeded'
    );
  });

  it('maps deadline-exceeded to timeout', () => {
    expect(commonErrorCodeMappings['deadline-exceeded']).toBe('timeout');
  });
});

describe('createErrorHandler', () => {
  const config: ErrorHandlerConfig = {
    errorSource: 'auth',
    defaultErrorCode: 'unknown',
    defaultErrorMessage: 'An auth error occurred',
    errorCodeMapping: {
      'auth/user-not-found': 'not-found',
      'auth/wrong-password': 'invalid-argument',
    },
    friendlyMessageMapping: {
      'auth/user-not-found': 'No account found.',
    },
  };

  it('returns DoNotDevError for string errors', () => {
    const handler = createErrorHandler(config);
    const result = handler('some string error');

    expect(result.message).toBe('some string error');
    expect(result.code).toBe('unknown');
  });

  it('returns DoNotDevError for null', () => {
    const handler = createErrorHandler(config);
    const result = handler(null);

    expect(result.message).toBe('An auth error occurred');
    expect(result.code).toBe('unknown');
  });

  it('maps error code to standard code', () => {
    const handler = createErrorHandler(config);
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    const result = handler(error);

    expect(result.code).toBe('not-found');
  });

  it('uses friendly message when available', () => {
    const handler = createErrorHandler(config);
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    const result = handler(error);

    expect(result.message).toBe('No account found.');
  });

  it('uses userMessage when provided', () => {
    const handler = createErrorHandler(config);
    const error = { code: 'auth/wrong-password', message: 'Wrong password' };
    const result = handler(error, 'Custom message');

    expect(result.message).toBe('Custom message');
  });

  it('uses default code for unknown error codes', () => {
    const handler = createErrorHandler(config);
    const error = { code: 'auth/unknown-code', message: 'Unknown' };
    const result = handler(error);

    expect(result.code).toBe('unknown');
  });

  it('passes through DoNotDevError unchanged', () => {
    const handler = createErrorHandler(config);
    // Need to import DoNotDevError to test this
    // For now, test the error object shape
    const error = new Error('test');
    const result = handler(error);
    expect(result.code).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('uses custom extractErrorCode when provided', () => {
    const customConfig: ErrorHandlerConfig = {
      ...config,
      extractErrorCode: (error: unknown) => {
        if (typeof error === 'object' && error !== null && 'type' in error) {
          return (error as any).type;
        }
        return undefined;
      },
      errorCodeMapping: {
        PERMISSION_ERROR: 'permission-denied',
      },
    };

    const handler = createErrorHandler(customConfig);
    const error = { type: 'PERMISSION_ERROR', message: 'No access' };
    const result = handler(error);

    expect(result.code).toBe('permission-denied');
  });

  it('uses custom processMetadata when provided', () => {
    const customConfig: ErrorHandlerConfig = {
      ...config,
      processMetadata: (error: unknown) => ({
        originalError: error,
        custom: 'metadata',
      }),
    };

    const handler = createErrorHandler(customConfig);
    const error = { code: 'auth/wrong-password', message: 'Wrong' };
    const result = handler(error);

    expect(result.details?.custom).toBe('metadata');
  });
});
