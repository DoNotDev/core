import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { UseMutationOptionsWithErrorHandling } from '../useMutation';

/**
 * useMutation is a thin wrapper around TanStack Query's useMutation.
 * Since the hook requires QueryClientProvider, we mock @tanstack/react-query
 * and verify that the wrapper applies framework defaults correctly.
 */

// Track what gets passed to TanStack's useMutation
let capturedOptions: any = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => {
    capturedOptions = options;
    return {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isIdle: true,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
      reset: vi.fn(),
      status: 'idle',
    };
  },
}));

vi.mock('@donotdev/utils', () => ({
  handleError: vi.fn((error: Error, _options?: any) => error),
}));

// Import after mocks are set up
const { useMutation } = await import('../useMutation');
const { handleError } = await import('@donotdev/utils');

describe('useMutation', () => {
  beforeEach(() => {
    capturedOptions = null;
    vi.clearAllMocks();
  });

  it('applies framework defaults (retry: 1, exponential retryDelay)', () => {
    const mutationFn = vi.fn();
    useMutation({ mutationFn });

    expect(capturedOptions).not.toBeNull();
    expect(capturedOptions.retry).toBe(1);
    expect(typeof capturedOptions.retryDelay).toBe('function');
  });

  it('retryDelay uses exponential backoff capped at 30s', () => {
    const mutationFn = vi.fn();
    useMutation({ mutationFn });

    const retryDelay = capturedOptions.retryDelay;
    expect(retryDelay(0)).toBe(1000); // 1s
    expect(retryDelay(1)).toBe(2000); // 2s
    expect(retryDelay(2)).toBe(4000); // 4s
    expect(retryDelay(3)).toBe(8000); // 8s
    expect(retryDelay(10)).toBe(30000); // capped at 30s
  });

  it('user options override framework defaults', () => {
    const mutationFn = vi.fn();
    useMutation({ mutationFn, retry: 3 });

    expect(capturedOptions.retry).toBe(3);
  });

  it('wraps onError with handleError', () => {
    const userOnError = vi.fn();
    const mutationFn = vi.fn();

    useMutation({
      mutationFn,
      onError: userOnError,
      userMessage: 'Custom error message',
      showNotification: true,
    });

    expect(capturedOptions.onError).toBeDefined();

    // Simulate TanStack calling onError
    const testError = new Error('test error');
    const testVariables = { id: 1 };
    capturedOptions.onError(testError, testVariables, undefined, {});

    // handleError should have been called with framework options
    expect(handleError).toHaveBeenCalledWith(testError, {
      userMessage: 'Custom error message',
      showNotification: true,
    });

    // User's onError should also have been called
    expect(userOnError).toHaveBeenCalled();
  });

  it('uses default userMessage "Mutation failed" when none provided', () => {
    const mutationFn = vi.fn();

    useMutation({ mutationFn });

    const testError = new Error('test');
    capturedOptions.onError(testError, undefined, undefined, {});

    expect(handleError).toHaveBeenCalledWith(testError, {
      userMessage: 'Mutation failed',
      showNotification: false,
    });
  });

  it('does not call user onError when none provided', () => {
    const mutationFn = vi.fn();

    useMutation({ mutationFn });

    // Should not throw when calling onError without a user handler
    expect(() => {
      capturedOptions.onError(new Error('test'), undefined, undefined, {});
    }).not.toThrow();
  });

  it('passes through mutationFn correctly', () => {
    const mutationFn = vi.fn().mockResolvedValue({ id: 1 });

    useMutation({ mutationFn });

    expect(capturedOptions.mutationFn).toBe(mutationFn);
  });

  it('strips userMessage and showNotification from options passed to TanStack', () => {
    const mutationFn = vi.fn();

    useMutation({
      mutationFn,
      userMessage: 'test',
      showNotification: true,
    });

    // These framework-specific options should not be passed through
    expect(capturedOptions.userMessage).toBeUndefined();
    expect(capturedOptions.showNotification).toBeUndefined();
  });

  it('returns the TanStack mutation result', () => {
    const mutationFn = vi.fn();
    const result = useMutation({ mutationFn });

    expect(result).toHaveProperty('mutate');
    expect(result).toHaveProperty('mutateAsync');
    expect(result).toHaveProperty('isPending');
    expect(result).toHaveProperty('isError');
    expect(result).toHaveProperty('isSuccess');
    expect(result.status).toBe('idle');
  });

  it('handles mutation without onError gracefully', () => {
    const mutationFn = vi.fn();
    useMutation({ mutationFn });

    // Should not throw when onError is called without user handler
    expect(() => {
      if (capturedOptions.onError) {
        capturedOptions.onError(new Error('test'), undefined, undefined, {});
      }
    }).not.toThrow();
  });

  it('preserves all TanStack Query options', () => {
    const mutationFn = vi.fn();
    useMutation({
      mutationFn,
      mutationKey: ['test-mutation'],
      onSuccess: vi.fn(),
      onSettled: vi.fn(),
    });

    expect(capturedOptions.mutationKey).toEqual(['test-mutation']);
    expect(capturedOptions.onSuccess).toBeDefined();
    expect(capturedOptions.onSettled).toBeDefined();
  });

  it('applies exponential backoff correctly for retries', () => {
    const mutationFn = vi.fn();
    useMutation({ mutationFn });

    const retryDelay = capturedOptions.retryDelay;
    expect(retryDelay(0)).toBe(1000); // 1s
    expect(retryDelay(1)).toBe(2000); // 2s
    expect(retryDelay(2)).toBe(4000); // 4s
    expect(retryDelay(3)).toBe(8000); // 8s
    expect(retryDelay(4)).toBe(16000); // 16s
    expect(retryDelay(5)).toBe(30000); // capped at 30s
    expect(retryDelay(10)).toBe(30000); // still capped
  });
});
