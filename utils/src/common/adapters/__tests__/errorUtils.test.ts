import { describe, it, expect } from 'vitest';

import { DoNotDevError } from '../../errors';
import { wrapCrudError, wrapStorageError, wrapAuthError } from '../errorUtils';

// =============================================================================
// wrapCrudError
// =============================================================================

describe('wrapCrudError', () => {
  it('wraps a standard Error into DoNotDevError', () => {
    const original = new Error('connection refused');
    const result = wrapCrudError(
      original,
      'TestAdapter',
      'get',
      'users',
      '123'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('connection refused');
    expect(result.message).toContain('TestAdapter');
    expect(result.message).toContain('get');
    expect(result.message).toContain('users');
    expect(result.message).toContain('123');
  });

  it('wraps string errors', () => {
    const result = wrapCrudError('timeout', 'Adapter', 'query', 'posts');

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('timeout');
  });

  it('works without optional id', () => {
    const result = wrapCrudError(
      new Error('fail'),
      'Adapter',
      'query',
      'collection'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('query');
    expect(result.message).toContain('collection');
  });

  it('passes through existing DoNotDevError', () => {
    const original = new DoNotDevError('already wrapped', 'not-found');
    const result = wrapCrudError(original, 'Adapter', 'get', 'users');

    expect(result).toBeInstanceOf(DoNotDevError);
    // mapToDoNotDevError returns DoNotDevError as-is
    expect(result).toBe(original);
  });

  it('handles unknown error types', () => {
    const result = wrapCrudError(42, 'Adapter', 'add', 'items');

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('42');
  });
});

// =============================================================================
// wrapStorageError
// =============================================================================

describe('wrapStorageError', () => {
  it('wraps a standard Error into DoNotDevError', () => {
    const original = new Error('file not found');
    const result = wrapStorageError(
      original,
      'S3Adapter',
      'upload',
      '/bucket/file.png'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('file not found');
    expect(result.message).toContain('S3Adapter');
    expect(result.message).toContain('upload');
    expect(result.message).toContain('/bucket/file.png');
  });

  it('wraps string errors', () => {
    const result = wrapStorageError(
      'access denied',
      'StorageAdapter',
      'delete',
      '/path'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('access denied');
  });

  it('passes through existing DoNotDevError', () => {
    const original = new DoNotDevError('already wrapped', 'permission-denied');
    const result = wrapStorageError(original, 'Adapter', 'getUrl', '/path');

    expect(result).toBe(original);
  });

  it('handles unknown error types', () => {
    const result = wrapStorageError(
      { code: 'ENOENT' },
      'Adapter',
      'download',
      '/missing'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
  });
});

// =============================================================================
// wrapAuthError
// =============================================================================

describe('wrapAuthError', () => {
  it('wraps a standard Error into DoNotDevError', () => {
    const original = new Error('invalid credentials');
    const result = wrapAuthError(original, 'FirebaseAuth', 'signInWithEmail', {
      email: 'test@test.com',
    });

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('invalid credentials');
    expect(result.message).toContain('FirebaseAuth');
    expect(result.message).toContain('signInWithEmail');
  });

  it('works without optional details', () => {
    const result = wrapAuthError(
      new Error('session expired'),
      'AuthAdapter',
      'refreshToken'
    );

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('session expired');
  });

  it('passes through existing DoNotDevError', () => {
    const original = new DoNotDevError('already wrapped', 'unauthenticated');
    const result = wrapAuthError(original, 'Auth', 'signIn');

    expect(result).toBe(original);
  });

  it('wraps string errors', () => {
    const result = wrapAuthError('token expired', 'Auth', 'verify');

    expect(result).toBeInstanceOf(DoNotDevError);
    expect(result.message).toContain('token expired');
  });

  it('preserves original error code in details when mapping misses', () => {
    const original = Object.assign(new Error('custom'), {
      code: 'CUSTOM_AUTH_CODE',
    });
    const result = wrapAuthError(original, 'Auth', 'custom');

    expect(result).toBeInstanceOf(DoNotDevError);
    // If the code mapped to 'unknown', the original code should be in details
    if (result.code === 'unknown') {
      expect(result.details?.originalCode).toBe('CUSTOM_AUTH_CODE');
    }
  });

  it('handles unknown error types', () => {
    const result = wrapAuthError(null, 'Auth', 'signOut');

    expect(result).toBeInstanceOf(DoNotDevError);
  });
});
