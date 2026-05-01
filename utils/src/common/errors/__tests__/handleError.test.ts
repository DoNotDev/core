import { describe, it, expect, vi } from 'vitest';

import {
  handleError,
  withErrorHandling,
  showNotification,
} from '../handleError';

describe('handleError', () => {
  it('returns a DoNotDevError', () => {
    const result = handleError(new Error('test'), {
      log: false,
      reportToSentry: false,
    });
    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.code).toBeDefined();
  });

  it('accepts string as options shorthand for userMessage', () => {
    const result = handleError(new Error('test'), 'Custom message');
    expect(result).toBeDefined();
  });

  it('detects auth errors', () => {
    const authError = {
      code: 'auth/user-not-found',
      message: 'User not found',
    };
    const result = handleError(authError, {
      log: false,
      reportToSentry: false,
    });
    expect(result.code).toBe('not-found');
  });

  it('preserves existing DoNotDevError', () => {
    // First create one through handleError
    const original = handleError(new Error('inner'), {
      log: false,
      reportToSentry: false,
    });
    const result = handleError(original, { log: false, reportToSentry: false });
    expect(result).toBe(original);
  });

  it('handles null error gracefully', () => {
    const result = handleError(null, { log: false, reportToSentry: false });
    expect(result).toBeDefined();
    expect(result.code).toBeDefined();
  });

  it('handles string error', () => {
    const result = handleError('something went wrong', {
      log: false,
      reportToSentry: false,
    });
    expect(result).toBeDefined();
  });
});

describe('withErrorHandling', () => {
  it('wraps a successful function', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const safe = withErrorHandling(fn, { log: false, reportToSentry: false });

    const result = await safe();
    expect(result).toBe('result');
  });

  it('wraps an erroring function and throws DoNotDevError', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const safe = withErrorHandling(fn, { log: false, reportToSentry: false });

    await expect(safe()).rejects.toThrow();
  });

  it('passes arguments to wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const safe = withErrorHandling(fn, { log: false, reportToSentry: false });

    await safe('a', 'b');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });
});

describe('showNotification', () => {
  it('returns a string ID', () => {
    const id = showNotification('test');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('accepts severity parameter', () => {
    const id = showNotification('test', 'warning');
    expect(typeof id).toBe('string');
  });
});
