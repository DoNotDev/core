import * as v from 'valibot';
import { describe, it, expect, beforeEach } from 'vitest';

import { DoNotDevError } from '@donotdev/types';
import type { ErrorCode, ErrorSource } from '@donotdev/types';

import { mapToDoNotDevError, DEFAULT_ERROR_MESSAGES } from '../errorMapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Firebase-style error with code and message
 */
function createFirebaseError(code: string, message: string) {
  const error = new Error(message);
  (error as any).code = code;
  return error;
}

/**
 * Creates a mock entity error with type property
 */
function createEntityError(type: string, message: string) {
  const error = new Error(message);
  (error as any).type = type;
  return error;
}

/**
 * Creates a real ValiError by triggering valibot validation
 */
function createValiError(): v.ValiError<any> {
  const schema = v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    email: v.pipe(v.string(), v.email()),
  });

  try {
    v.parse(schema, { name: '', email: 'not-an-email' });
  } catch (error) {
    if (error instanceof v.ValiError) return error;
  }

  throw new Error('Failed to create ValiError');
}

// ---------------------------------------------------------------------------
// DEFAULT_ERROR_MESSAGES completeness
// ---------------------------------------------------------------------------

describe('DEFAULT_ERROR_MESSAGES', () => {
  const ALL_ERROR_CODES: ErrorCode[] = [
    'already-exists',
    'cancelled',
    'deadline-exceeded',
    'DELETE_ACCOUNT_REQUIRES_SERVER',
    'internal',
    'invalid-argument',
    'not-found',
    'permission-denied',
    'rate-limit-exceeded',
    'timeout',
    'unauthenticated',
    'unavailable',
    'unimplemented',
    'unknown',
    'validation-failed',
  ];

  it('has an entry for every ErrorCode', () => {
    for (const code of ALL_ERROR_CODES) {
      expect(DEFAULT_ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof DEFAULT_ERROR_MESSAGES[code]).toBe('string');
      expect(DEFAULT_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('has no extra keys beyond ErrorCode values', () => {
    const keys = Object.keys(DEFAULT_ERROR_MESSAGES);
    expect(keys.sort()).toEqual([...ALL_ERROR_CODES].sort());
  });
});

// ---------------------------------------------------------------------------
// mapToDoNotDevError — passthrough
// ---------------------------------------------------------------------------

describe('mapToDoNotDevError', () => {
  describe('DoNotDevError passthrough', () => {
    it('returns the same DoNotDevError instance unchanged', () => {
      const original = new DoNotDevError('already handled', 'not-found', {
        source: 'auth',
      });
      const result = mapToDoNotDevError(original, 'unknown');
      expect(result).toBe(original);
    });

    it('does not re-wrap even when source differs', () => {
      const original = new DoNotDevError('test', 'internal', {
        source: 'firebase',
      });
      const result = mapToDoNotDevError(original, 'auth');
      expect(result).toBe(original);
      expect(result.source).toBe('firebase');
    });
  });

  // -------------------------------------------------------------------------
  // Auth source
  // -------------------------------------------------------------------------

  describe('auth source', () => {
    it('maps auth/user-not-found to not-found', () => {
      const error = createFirebaseError(
        'auth/user-not-found',
        'User not found'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('not-found');
      expect(result.message).toBe('No account found with this email address.');
    });

    it('maps auth/email-already-in-use to already-exists', () => {
      const error = createFirebaseError(
        'auth/email-already-in-use',
        'Email in use'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('already-exists');
    });

    it('maps auth/too-many-requests to rate-limit-exceeded', () => {
      const error = createFirebaseError(
        'auth/too-many-requests',
        'Rate limited'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('rate-limit-exceeded');
    });

    it('maps auth/requires-recent-login to unauthenticated', () => {
      const error = createFirebaseError(
        'auth/requires-recent-login',
        'Reauth needed'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('unauthenticated');
    });

    it('maps auth/user-disabled to permission-denied', () => {
      const error = createFirebaseError('auth/user-disabled', 'Disabled');
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('permission-denied');
    });

    it('maps auth/operation-not-allowed to unimplemented', () => {
      const error = createFirebaseError(
        'auth/operation-not-allowed',
        'Not allowed'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('unimplemented');
    });

    it('maps auth/internal-error to internal', () => {
      const error = createFirebaseError('auth/internal-error', 'Internal');
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('internal');
    });

    it('uses friendly message for known auth codes', () => {
      const error = createFirebaseError('auth/weak-password', 'Weak');
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.message).toBe(
        'Password is too weak. It should be at least 6 characters.'
      );
    });

    it('falls back to default code for unknown auth codes', () => {
      const error = createFirebaseError('auth/completely-unknown', 'Unknown');
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('unknown');
    });

    it('uses userMessage when provided', () => {
      const error = createFirebaseError('auth/user-not-found', 'Not found');
      const result = mapToDoNotDevError(error, 'auth', 'Custom user message');
      expect(result.message).toBe('Custom user message');
    });

    it('maps oauth/unauthorized-app in auth handler', () => {
      const error = createFirebaseError(
        'oauth/unauthorized-app',
        'Unauthorized'
      );
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('permission-denied');
    });

    it('includes common Firebase mappings (permission-denied)', () => {
      const error = createFirebaseError('permission-denied', 'Denied');
      const result = mapToDoNotDevError(error, 'auth');
      expect(result.code).toBe('permission-denied');
    });
  });

  // -------------------------------------------------------------------------
  // OAuth source
  // -------------------------------------------------------------------------

  describe('oauth source', () => {
    it('maps oauth/invalid-token to unauthenticated', () => {
      const error = createFirebaseError('oauth/invalid-token', 'Invalid token');
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.code).toBe('unauthenticated');
    });

    it('maps oauth/access-denied to permission-denied', () => {
      const error = createFirebaseError('oauth/access-denied', 'Denied');
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.code).toBe('permission-denied');
    });

    it('maps oauth/server-error to unavailable', () => {
      const error = createFirebaseError('oauth/server-error', 'Server error');
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.code).toBe('unavailable');
    });

    it('maps oauth/rate-limit-exceeded to rate-limit-exceeded', () => {
      const error = createFirebaseError(
        'oauth/rate-limit-exceeded',
        'Too many'
      );
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.code).toBe('rate-limit-exceeded');
    });

    it('uses friendly message for oauth codes', () => {
      const error = createFirebaseError('oauth/expired-token', 'Expired');
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.message).toBe('The access token has expired.');
    });

    it('includes common Firebase mappings', () => {
      const error = createFirebaseError('resource-exhausted', 'Exhausted');
      const result = mapToDoNotDevError(error, 'oauth');
      expect(result.code).toBe('rate-limit-exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // API source
  // -------------------------------------------------------------------------

  describe('api source', () => {
    it('maps axios-like 404 to not-found', () => {
      const error = { response: { status: 404, data: { msg: 'Not found' } } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('not-found');
    });

    it('maps axios-like 401 to unauthenticated', () => {
      const error = { response: { status: 401 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('unauthenticated');
    });

    it('maps axios-like 403 to permission-denied', () => {
      const error = { response: { status: 403 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('permission-denied');
    });

    it('maps axios-like 422 to validation-failed', () => {
      const error = { response: { status: 422 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('validation-failed');
    });

    it('maps axios-like 429 to rate-limit-exceeded', () => {
      const error = { response: { status: 429 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('rate-limit-exceeded');
    });

    it('maps axios-like 500 to internal', () => {
      const error = { response: { status: 500 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('internal');
    });

    it('maps axios-like 503 to unavailable', () => {
      const error = { response: { status: 503 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('unavailable');
    });

    it('maps axios-like 504 to timeout', () => {
      const error = { response: { status: 504 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('timeout');
    });

    it('maps fetch-like error with status property', () => {
      const error = { status: 404, statusText: 'Not Found' };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('not-found');
    });

    it('includes statusCode in metadata for axios-like errors', () => {
      const error = {
        response: { status: 500, data: { error: 'Server Error' } },
      };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.details?.statusCode).toBe(500);
      expect(result.details?.responseData).toEqual({ error: 'Server Error' });
    });

    it('includes statusCode in metadata for fetch-like errors', () => {
      const error = { status: 403 };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.details?.statusCode).toBe(403);
    });

    it('falls back to unknown for unmapped status codes', () => {
      const error = { response: { status: 418 } };
      const result = mapToDoNotDevError(error, 'api');
      expect(result.code).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Firebase source
  // -------------------------------------------------------------------------

  describe('firebase source', () => {
    it('maps permission-denied via common mappings', () => {
      const error = createFirebaseError('permission-denied', 'Denied');
      const result = mapToDoNotDevError(error, 'firebase');
      expect(result.code).toBe('permission-denied');
    });

    it('maps not-found via common mappings', () => {
      const error = createFirebaseError('not-found', 'Not found');
      const result = mapToDoNotDevError(error, 'firebase');
      expect(result.code).toBe('not-found');
    });

    it('maps deadline-exceeded to timeout via common mappings', () => {
      const error = createFirebaseError('deadline-exceeded', 'Timeout');
      const result = mapToDoNotDevError(error, 'firebase');
      expect(result.code).toBe('timeout');
    });

    it('falls back to unknown for unrecognized firebase codes', () => {
      const error = createFirebaseError('some-unknown-code', 'Unknown');
      const result = mapToDoNotDevError(error, 'firebase');
      expect(result.code).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Validation source (Valibot)
  // -------------------------------------------------------------------------

  describe('validation source', () => {
    it('extracts field-level errors from ValiError', () => {
      const valiError = createValiError();
      const result = mapToDoNotDevError(valiError, 'validation');

      expect(result.code).toBe('validation-failed');
      expect(result.source).toBe('validation');
      expect(result.details?.validationErrors).toBeDefined();
      expect(Array.isArray(result.details?.validationErrors)).toBe(true);
      expect(result.details?.validationErrors.length).toBeGreaterThan(0);
    });

    it('includes path and message for each validation issue', () => {
      const valiError = createValiError();
      const result = mapToDoNotDevError(valiError, 'validation');

      for (const ve of result.details?.validationErrors ?? []) {
        expect(typeof ve.path).toBe('string');
        expect(typeof ve.message).toBe('string');
      }
    });

    it('preserves the original ValiError', () => {
      const valiError = createValiError();
      const result = mapToDoNotDevError(valiError, 'validation');
      expect(result.details?.originalError).toBe(valiError);
    });

    it('uses default validation-failed message', () => {
      const valiError = createValiError();
      const result = mapToDoNotDevError(valiError, 'validation');
      expect(result.message).toBe(DEFAULT_ERROR_MESSAGES['validation-failed']);
    });

    it('falls back to standard handler for non-ValiError', () => {
      const error = new Error('Not a valibot error');
      const result = mapToDoNotDevError(error, 'validation');

      expect(result.code).toBe('validation-failed');
      expect(result.details?.validationErrors).toBeUndefined();
    });

    it('falls back to standard handler for string error', () => {
      const result = mapToDoNotDevError('bad input', 'validation');
      expect(result.code).toBe('validation-failed');
    });
  });

  // -------------------------------------------------------------------------
  // Entity source
  // -------------------------------------------------------------------------

  describe('entity source', () => {
    it('maps entity error with VALIDATION_ERROR type', () => {
      const error = createEntityError('VALIDATION_ERROR', 'Invalid data');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('validation-failed');
      expect(result.source).toBe('entity');
    });

    it('maps entity error with PERMISSION_DENIED type', () => {
      const error = createEntityError('PERMISSION_DENIED', 'No access');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('permission-denied');
    });

    it('maps entity error with NOT_FOUND type', () => {
      const error = createEntityError('NOT_FOUND', 'Missing');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('not-found');
    });

    it('maps entity error with ALREADY_EXISTS type', () => {
      const error = createEntityError('ALREADY_EXISTS', 'Duplicate');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('already-exists');
    });

    it('maps entity error with INTERNAL_ERROR type', () => {
      const error = createEntityError('INTERNAL_ERROR', 'Server problem');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('internal');
    });

    it('maps entity error with NETWORK_ERROR type', () => {
      const error = createEntityError('NETWORK_ERROR', 'Offline');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('unavailable');
    });

    it('uses the entity error message', () => {
      const error = createEntityError('NOT_FOUND', 'Document xyz not found');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.message).toBe('Document xyz not found');
    });

    it('maps Firebase error code via FIREBASE_ERROR_MAP', () => {
      const error = { code: 'permission-denied', message: 'Firebase denied' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('permission-denied');
      expect(result.source).toBe('entity');
      expect(result.details?.originalCode).toBe('permission-denied');
    });

    it('maps Firebase not-found via FIREBASE_ERROR_MAP', () => {
      const error = { code: 'not-found', message: 'Firebase not found' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('not-found');
    });

    it('maps Firebase already-exists via FIREBASE_ERROR_MAP', () => {
      const error = { code: 'already-exists', message: 'Firebase exists' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('already-exists');
    });

    it('maps Firebase invalid-argument via FIREBASE_ERROR_MAP', () => {
      const error = { code: 'invalid-argument', message: 'Firebase invalid' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.code).toBe('validation-failed');
    });

    it('uses FIREBASE_ERROR_MAP message', () => {
      const error = { code: 'permission-denied', message: '' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result.message).toBe(
        'You do not have permission to perform this action'
      );
    });

    it('falls back to standard handler for unmapped entity errors', () => {
      const error = new Error('Generic entity error');
      const result = mapToDoNotDevError(error, 'entity');
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.code).toBeDefined();
    });

    it('falls back for non-Error objects without type or code', () => {
      const error = { foo: 'bar' };
      const result = mapToDoNotDevError(error, 'entity');
      expect(result).toBeInstanceOf(DoNotDevError);
    });
  });

  // -------------------------------------------------------------------------
  // UI source
  // -------------------------------------------------------------------------

  describe('ui source', () => {
    it('defaults to internal error code', () => {
      const error = new Error('Render crash');
      const result = mapToDoNotDevError(error, 'ui');
      expect(result.code).toBe('internal');
    });

    it('extracts componentStack from React errors', () => {
      const error = new Error('Component crash');
      (error as any).componentStack = '\n    in App\n    in Root';
      const result = mapToDoNotDevError(error, 'ui');
      expect(result.details?.componentStack).toBe('\n    in App\n    in Root');
    });

    it('preserves original error in metadata', () => {
      const error = new Error('UI error');
      const result = mapToDoNotDevError(error, 'ui');
      expect(result.details?.originalError).toBe(error);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown source
  // -------------------------------------------------------------------------

  describe('unknown source', () => {
    it('maps TypeError to invalid-argument', () => {
      const error = new TypeError('Cannot read property x');
      const result = mapToDoNotDevError(error, 'unknown');
      expect(result.code).toBe('invalid-argument');
    });

    it('maps RangeError to invalid-argument', () => {
      const error = new RangeError('Out of range');
      const result = mapToDoNotDevError(error, 'unknown');
      expect(result.code).toBe('invalid-argument');
    });

    it('maps ReferenceError to internal', () => {
      const error = new ReferenceError('x is not defined');
      const result = mapToDoNotDevError(error, 'unknown');
      expect(result.code).toBe('internal');
    });

    it('uses default unknown code for generic Error', () => {
      const error = new Error('Something failed');
      const result = mapToDoNotDevError(error, 'unknown');
      expect(result.code).toBe('unknown');
    });

    it('uses error.name as code extraction', () => {
      const error = new Error('custom');
      error.name = 'TypeError';
      const result = mapToDoNotDevError(error, 'unknown');
      expect(result.code).toBe('invalid-argument');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles null error', () => {
      const result = mapToDoNotDevError(null, 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.code).toBeDefined();
    });

    it('handles undefined error', () => {
      const result = mapToDoNotDevError(undefined, 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.code).toBeDefined();
    });

    it('handles string error', () => {
      const result = mapToDoNotDevError('something broke', 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.message).toBe('something broke');
    });

    it('handles number error', () => {
      const result = mapToDoNotDevError(42, 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
    });

    it('handles boolean error', () => {
      const result = mapToDoNotDevError(false, 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
    });

    it('handles empty object', () => {
      const result = mapToDoNotDevError({}, 'auth');
      expect(result).toBeInstanceOf(DoNotDevError);
    });

    it('handles object with only message (no code)', () => {
      const result = mapToDoNotDevError(
        { message: 'Just a message' },
        'firebase'
      );
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.message).toBe('Just a message');
    });

    it('handles circular reference in error object', () => {
      const error: any = { message: 'circular' };
      error.self = error;

      expect(() => {
        mapToDoNotDevError(error, 'unknown');
      }).not.toThrow();

      const result = mapToDoNotDevError(error, 'unknown');
      expect(result).toBeInstanceOf(DoNotDevError);
    });

    it('handles error with non-string code', () => {
      const error = { code: 123, message: 'Numeric code' };
      const result = mapToDoNotDevError(error, 'firebase');
      expect(result).toBeInstanceOf(DoNotDevError);
      expect(result.code).toBe('unknown');
    });

    it('handles error with null code', () => {
      const error = { code: null, message: 'Null code' };
      const result = mapToDoNotDevError(error, 'auth');
      expect(result).toBeInstanceOf(DoNotDevError);
    });

    it('preserves original error in details', () => {
      const original = new Error('original');
      const result = mapToDoNotDevError(original, 'unknown');
      expect(result.details?.originalError).toBe(original);
    });

    it('handles all ErrorSource values without throwing', () => {
      const sources: ErrorSource[] = [
        'auth',
        'oauth',
        'firebase',
        'api',
        'validation',
        'entity',
        'ui',
        'unknown',
      ];
      const error = new Error('test');

      for (const source of sources) {
        expect(() => mapToDoNotDevError(error, source)).not.toThrow();
        const result = mapToDoNotDevError(error, source);
        expect(result).toBeInstanceOf(DoNotDevError);
      }
    });

    it('result is always instanceof DoNotDevError', () => {
      const inputs: unknown[] = [
        null,
        undefined,
        '',
        0,
        false,
        new Error('e'),
        { code: 'auth/user-not-found' },
        'string error',
      ];

      for (const input of inputs) {
        const result = mapToDoNotDevError(input, 'unknown');
        expect(result).toBeInstanceOf(DoNotDevError);
      }
    });
  });
});
