import { describe, it, expect } from 'vitest';

import { detectErrorSource } from '../errorDetection';

describe('detectErrorSource', () => {
  it('returns source from error with source property', () => {
    const error = new Error('test');
    (error as any).source = 'auth';
    expect(detectErrorSource(error)).toBe('auth');
  });

  it('detects Firebase Auth errors (auth/ prefix)', () => {
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    expect(detectErrorSource(error)).toBe('auth');
  });

  it('detects OAuth errors (oauth/ prefix)', () => {
    const error = { code: 'oauth/invalid-token', message: 'Invalid token' };
    expect(detectErrorSource(error)).toBe('oauth');
  });

  it('detects Firebase errors by known codes', () => {
    const codes = [
      'permission-denied',
      'unavailable',
      'not-found',
      'already-exists',
      'unauthenticated',
      'invalid-argument',
      'failed-precondition',
      'resource-exhausted',
    ];

    for (const code of codes) {
      expect(detectErrorSource({ code })).toBe('firebase');
    }
  });

  it('detects Valibot validation errors', () => {
    const error = {
      name: 'ValiError',
      issues: [{ path: ['field'], message: 'invalid' }],
    };
    expect(detectErrorSource(error)).toBe('validation');
  });

  it('detects EntityHookError', () => {
    const error = new Error('Entity error');
    error.name = 'EntityHookError';
    expect(detectErrorSource(error)).toBe('entity');
  });

  it('detects API errors with response property', () => {
    const error = { response: { status: 404 } };
    expect(detectErrorSource(error)).toBe('api');
  });

  it('detects API errors with status property', () => {
    const error = { status: 500 };
    expect(detectErrorSource(error)).toBe('api');
  });

  it('detects API errors with statusText property', () => {
    const error = { statusText: 'Not Found' };
    expect(detectErrorSource(error)).toBe('api');
  });

  it('detects React UI errors with componentStack', () => {
    const error = { componentStack: '\n    in App' };
    expect(detectErrorSource(error)).toBe('ui');
  });

  it('returns unknown for plain Error', () => {
    expect(detectErrorSource(new Error('generic'))).toBe('unknown');
  });

  it('returns unknown for string', () => {
    expect(detectErrorSource('some error')).toBe('unknown');
  });

  it('returns unknown for null', () => {
    expect(detectErrorSource(null)).toBe('unknown');
  });

  it('returns unknown for undefined', () => {
    expect(detectErrorSource(undefined)).toBe('unknown');
  });
});
