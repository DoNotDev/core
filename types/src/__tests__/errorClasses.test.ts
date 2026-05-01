import { describe, it, expect } from 'vitest';

import {
  DoNotDevError,
  EntityHookError,
  FIREBASE_ERROR_MAP,
} from '../errors/errorClasses';

describe('EntityHookError', () => {
  it('creates error with type and message', () => {
    const error = new EntityHookError('VALIDATION_ERROR', 'Invalid input');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EntityHookError);
    expect(error.name).toBe('EntityHookError');
    expect(error.type).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
    expect(error.originalError).toBeUndefined();
  });

  it('preserves original error', () => {
    const original = new Error('network failed');
    const error = new EntityHookError(
      'NETWORK_ERROR',
      'Request failed',
      original
    );

    expect(error.originalError).toBe(original);
    expect(error.type).toBe('NETWORK_ERROR');
  });

  it('supports all entity hook error types', () => {
    const types = [
      'INTERNAL_ERROR',
      'VALIDATION_ERROR',
      'PERMISSION_DENIED',
      'NOT_FOUND',
      'ALREADY_EXISTS',
      'NETWORK_ERROR',
    ] as const;

    for (const type of types) {
      const error = new EntityHookError(type, `${type} message`);
      expect(error.type).toBe(type);
    }
  });
});

describe('DoNotDevError', () => {
  it('creates error with message and default code', () => {
    const error = new DoNotDevError('Something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DoNotDevError);
    expect(error.name).toBe('DoNotDevError');
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('internal');
    expect(error.displayable).toBe(true);
  });

  it('creates error with explicit code', () => {
    const error = new DoNotDevError('Not found', 'not-found');

    expect(error.code).toBe('not-found');
    expect(error.message).toBe('Not found');
  });

  it('creates error with all options', () => {
    const original = new Error('root cause');
    const error = new DoNotDevError('User error', 'validation-failed', {
      details: { field: 'email' },
      source: 'validation',
      originalError: original,
      context: { operation: 'create' },
      displayable: false,
      userMessageProvided: true,
    });

    expect(error.code).toBe('validation-failed');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.source).toBe('validation');
    expect(error.originalError).toBe(original);
    expect(error.context).toEqual({ operation: 'create' });
    expect(error.displayable).toBe(false);
    expect(error.userMessageProvided).toBe(true);
  });

  describe('toString', () => {
    it('formats as Name [code]: message', () => {
      const error = new DoNotDevError('Bad request', 'invalid-argument');

      expect(error.toString()).toBe(
        'DoNotDevError [invalid-argument]: Bad request'
      );
    });
  });

  describe('toJSON', () => {
    it('serializes all fields', () => {
      const error = new DoNotDevError('Test', 'unknown', {
        details: { key: 'val' },
        source: 'api',
        displayable: true,
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'DoNotDevError',
        code: 'unknown',
        message: 'Test',
        details: { key: 'val' },
        source: 'api',
        originalError: undefined,
        context: undefined,
        displayable: true,
        userMessageProvided: undefined,
      });
    });

    it('is JSON-serializable', () => {
      const error = new DoNotDevError('Serializable', 'internal');
      const serialized = JSON.stringify(error.toJSON());
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('DoNotDevError');
      expect(parsed.code).toBe('internal');
      expect(parsed.message).toBe('Serializable');
    });
  });

  it('has correct prototype chain (instanceof works)', () => {
    const error = new DoNotDevError('test');

    expect(error instanceof DoNotDevError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('FIREBASE_ERROR_MAP', () => {
  it('maps permission-denied', () => {
    expect(FIREBASE_ERROR_MAP['permission-denied']).toEqual({
      type: 'PERMISSION_DENIED',
      message: 'You do not have permission to perform this action',
    });
  });

  it('maps not-found', () => {
    expect(FIREBASE_ERROR_MAP['not-found']?.type).toBe('NOT_FOUND');
  });

  it('maps already-exists', () => {
    expect(FIREBASE_ERROR_MAP['already-exists']?.type).toBe('ALREADY_EXISTS');
  });

  it('maps invalid-argument', () => {
    expect(FIREBASE_ERROR_MAP['invalid-argument']?.type).toBe(
      'VALIDATION_ERROR'
    );
  });

  it('returns undefined for unknown codes', () => {
    expect(FIREBASE_ERROR_MAP['some-unknown-code']).toBeUndefined();
  });
});
