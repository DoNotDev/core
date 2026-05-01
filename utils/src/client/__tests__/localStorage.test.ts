import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  getLocalStorageItem,
  setLocalStorageItem,
  removeLocalStorageItem,
  clearLocalStorage,
  detectStorageError,
  isLocalStorageAvailable,
} from '../localStorage';

describe('getLocalStorageItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default value when key does not exist', () => {
    expect(getLocalStorageItem('missing', 'default')).toBe('default');
  });

  it('returns stored string value', () => {
    localStorage.setItem('key', 'hello');
    expect(getLocalStorageItem('key', '')).toBe('hello');
  });

  it('parses JSON values', () => {
    localStorage.setItem('obj', JSON.stringify({ a: 1 }));
    expect(getLocalStorageItem('obj', {})).toEqual({ a: 1 });
  });

  it('returns string when JSON parse fails', () => {
    localStorage.setItem('plain', 'not-json');
    expect(getLocalStorageItem('plain', '')).toBe('not-json');
  });
});

describe('setLocalStorageItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns true on success', () => {
    expect(setLocalStorageItem('key', 'value')).toBe(true);
  });

  it('stores string values directly', () => {
    setLocalStorageItem('key', 'hello');
    expect(localStorage.getItem('key')).toBe('hello');
  });

  it('serializes non-string values as JSON', () => {
    setLocalStorageItem('obj', { a: 1 });
    expect(localStorage.getItem('obj')).toBe('{"a":1}');
  });
});

describe('removeLocalStorageItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns true on success', () => {
    localStorage.setItem('key', 'val');
    expect(removeLocalStorageItem('key')).toBe(true);
  });

  it('removes the item', () => {
    localStorage.setItem('key', 'val');
    removeLocalStorageItem('key');
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('returns true even when key does not exist', () => {
    expect(removeLocalStorageItem('nonexistent')).toBe(true);
  });
});

describe('clearLocalStorage', () => {
  it('returns true on success', () => {
    localStorage.setItem('a', '1');
    expect(clearLocalStorage()).toBe(true);
  });

  it('clears all items', () => {
    localStorage.setItem('a', '1');
    localStorage.setItem('b', '2');
    clearLocalStorage();
    expect(localStorage.length).toBe(0);
  });
});

describe('detectStorageError', () => {
  it('detects quota exceeded error', () => {
    const error = new DOMException('Quota exceeded', 'QuotaExceededError');
    const result = detectStorageError(error);
    expect(result.type).toBe('quota_exceeded');
    expect(result.originalError).toBe(error);
  });

  it('detects security error', () => {
    const error = new DOMException('Access denied', 'SecurityError');
    const result = detectStorageError(error);
    expect(result.type).toBe('security_error');
    expect(result.originalError).toBe(error);
  });

  it('returns unknown for generic errors', () => {
    const error = new Error('generic');
    const result = detectStorageError(error);
    expect(result.type).toBe('unknown');
  });
});

describe('isLocalStorageAvailable', () => {
  it('returns true in test environment (happy-dom)', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });
});
