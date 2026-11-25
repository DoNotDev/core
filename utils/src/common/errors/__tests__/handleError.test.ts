import { describe, it, expect, vi } from 'vitest';

import {
  handleError,
  withErrorHandling,
  showNotification,
} from '../handleError';
import { wrapCrudError } from '../../adapters/errorUtils';

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

describe('handleError logging', () => {
  it('logs the original message as cause when the user message replaces it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = handleError(
      new Error('[dndev] Direct adapter cannot access "products"'),
      { userMessage: 'Query failed', reportToSentry: false }
    );
    expect(result.message).toBe('Query failed');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Query failed'),
      expect.objectContaining({
        cause: '[dndev] Direct adapter cannot access "products"',
      })
    );
    spy.mockRestore();
  });

  it("logs an adapter error's original message as cause", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapterError = wrapCrudError(
      new Error('Missing or insufficient permissions.'),
      'FirestoreAdapter',
      'query',
      'products'
    );
    handleError(adapterError, { userMessage: 'Query failed', reportToSentry: false });
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cause: 'Missing or insufficient permissions.' })
    );
    spy.mockRestore();
  });

  it('logs no cause when the message is the original one', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleError(new Error('Specific failure reading products'), {
      reportToSentry: false,
    });
    const info = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(info).not.toHaveProperty('cause');
    spy.mockRestore();
  });
});
