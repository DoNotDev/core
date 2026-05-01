import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { validateUrl, validateMetadata, validateEnvVar } from '../validation';

// =============================================================================
// validateUrl
// =============================================================================

describe('validateUrl', () => {
  it('accepts valid HTTP URLs', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('accepts valid HTTPS URLs', () => {
    expect(validateUrl('https://example.com')).toBe('https://example.com');
    expect(validateUrl('https://sub.domain.com/path?q=1')).toBe(
      'https://sub.domain.com/path?q=1'
    );
  });

  it('rejects non-HTTP protocols', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow('Invalid');
    expect(() => validateUrl('ws://example.com')).toThrow('Invalid');
    expect(() => validateUrl('file:///etc/passwd')).toThrow('Invalid');
  });

  it('rejects invalid URL formats', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid');
    expect(() => validateUrl('')).toThrow('Invalid');
    expect(() => validateUrl('://missing-scheme')).toThrow('Invalid');
  });

  it('uses custom name in error message', () => {
    expect(() => validateUrl('bad', 'Callback URL')).toThrow('Callback URL');
  });

  it('uses default name "URL" in error message', () => {
    expect(() => validateUrl('bad')).toThrow('URL');
  });
});

// =============================================================================
// validateMetadata
// =============================================================================

describe('validateMetadata', () => {
  it('passes valid string metadata through', () => {
    const input = { key1: 'value1', key2: 'value2' };
    expect(validateMetadata(input)).toEqual(input);
  });

  it('returns empty object for empty input', () => {
    expect(validateMetadata({})).toEqual({});
  });

  it('rejects non-string values', () => {
    expect(() => validateMetadata({ num: 42 as any })).toThrow(
      'must be a string'
    );
    expect(() => validateMetadata({ bool: true as any })).toThrow(
      'must be a string'
    );
    expect(() => validateMetadata({ obj: {} as any })).toThrow(
      'must be a string'
    );
    expect(() => validateMetadata({ arr: [] as any })).toThrow(
      'must be a string'
    );
  });

  it('rejects values containing HTML', () => {
    expect(() =>
      validateMetadata({ xss: '<script>alert("xss")</script>' })
    ).toThrow('must not contain HTML');
    expect(() => validateMetadata({ tag: '<div>hello</div>' })).toThrow(
      'must not contain HTML'
    );
  });

  it('rejects values exceeding 1000 characters', () => {
    const longValue = 'a'.repeat(1001);
    expect(() => validateMetadata({ long: longValue })).toThrow('too long');
  });

  it('accepts values at exactly 1000 characters', () => {
    const maxValue = 'a'.repeat(1000);
    expect(validateMetadata({ ok: maxValue })).toEqual({ ok: maxValue });
  });

  it('rejects keys exceeding 100 characters', () => {
    const longKey = 'k'.repeat(101);
    expect(() => validateMetadata({ [longKey]: 'value' })).toThrow('too long');
  });

  it('accepts keys at exactly 100 characters', () => {
    const maxKey = 'k'.repeat(100);
    expect(validateMetadata({ [maxKey]: 'value' })).toEqual({
      [maxKey]: 'value',
    });
  });

  it('includes offending key name in error', () => {
    expect(() => validateMetadata({ badField: 123 as any })).toThrow(
      'badField'
    );
  });
});

// =============================================================================
// validateEnvVar
// =============================================================================

describe('validateEnvVar', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns value when env var is set', () => {
    process.env.TEST_VAR = 'hello';
    expect(validateEnvVar('TEST_VAR')).toBe('hello');
  });

  it('throws when required env var is missing', () => {
    delete process.env.MISSING_VAR;
    expect(() => validateEnvVar('MISSING_VAR')).toThrow(
      "Required environment variable 'MISSING_VAR' is not set"
    );
  });

  it('throws when required env var is empty string', () => {
    process.env.EMPTY_VAR = '';
    expect(() => validateEnvVar('EMPTY_VAR')).toThrow(
      "Required environment variable 'EMPTY_VAR' is not set"
    );
  });

  it('returns empty string for optional missing var', () => {
    delete process.env.OPT_VAR;
    expect(validateEnvVar('OPT_VAR', false)).toBe('');
  });

  it('returns empty string for optional empty var', () => {
    process.env.OPT_EMPTY = '';
    expect(validateEnvVar('OPT_EMPTY', false)).toBe('');
  });

  it('returns value for optional present var', () => {
    process.env.OPT_SET = 'present';
    expect(validateEnvVar('OPT_SET', false)).toBe('present');
  });
});
