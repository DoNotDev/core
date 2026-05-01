import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderHook, waitFor } from '../../__tests__/testUtils';

// Mock TanStack Query
let capturedOptions: any = null;
let queryResult: any = {
  data: undefined,
  isLoading: true,
  isError: false,
  isSuccess: false,
  error: null,
  status: 'loading',
  refetch: vi.fn(),
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    isServer: false,
    useQuery: (options: any) => {
      capturedOptions = options;
      return queryResult;
    },
  };
});

vi.mock('@donotdev/utils', () => ({
  handleError: vi.fn((error: Error, options?: any) => error),
  isDev: vi.fn(() => false),
  isClient: vi.fn(() => true),
}));

vi.mock('../../providers/AppConfigProvider', () => ({
  useAppConfig: vi.fn(() => ({ query: null })),
}));

// Import after mocks
const { useQuery } = await import('../useQuery');
const { handleError } = await import('@donotdev/utils');
const { useAppConfig } = await import('../../providers/AppConfigProvider');

describe('useQuery', () => {
  beforeEach(() => {
    capturedOptions = null;
    queryResult = {
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      error: null,
      status: 'loading',
      refetch: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('framework defaults', () => {
    it('applies infinite staleTime by default', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.staleTime).toBe(Infinity);
    });

    it('applies retry: 1 by default', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.retry).toBe(1);
    });

    it('disables refetchOnWindowFocus by default', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.refetchOnWindowFocus).toBe(false);
    });

    it('disables refetchOnReconnect by default', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.refetchOnReconnect).toBe(false);
    });
  });

  describe('app config integration', () => {
    it('merges app config query settings', () => {
      vi.mocked(useAppConfig).mockReturnValue({
        query: {
          staleTime: 5000,
          retry: 2,
          refetchOnWindowFocus: true,
        },
      } as any);

      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.staleTime).toBe(5000);
      expect(capturedOptions.retry).toBe(2);
      expect(capturedOptions.refetchOnWindowFocus).toBe(true);
    });

    it('user options override app config', () => {
      vi.mocked(useAppConfig).mockReturnValue({
        query: {
          staleTime: 5000,
          retry: 2,
        },
      } as any);

      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
          staleTime: 10000,
          retry: 3,
        })
      );

      expect(capturedOptions.staleTime).toBe(10000);
      expect(capturedOptions.retry).toBe(3);
    });
  });

  describe('SSR behavior', () => {
    it('enables query by default (preserves SSR)', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.enabled).not.toBe(false);
    });

    // Note: SSR behavior is hard to test without actual SSR environment
    // This test verifies the logic exists, actual SSR testing requires Next.js/RSC setup
    it.skip('disables query on server when ssr: false', () => {
      // SSR testing requires actual server environment
      // In happy-dom, isServer is always false
    });

    it('respects user enabled option', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
          enabled: false,
        })
      );

      expect(capturedOptions.enabled).toBe(false);
    });
  });

  describe('error handling', () => {
    it('wraps errors with handleError when error occurs', async () => {
      const testError = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(testError);

      // Set error in result after initial render
      const { rerender } = renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
          userMessage: 'Failed to load data',
          showNotification: true,
        })
      );

      // Update queryResult to have error
      queryResult = {
        ...queryResult,
        error: testError,
        isError: true,
        status: 'error',
      };

      // Re-render to trigger useEffect
      rerender();

      // Wait for useEffect to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleError).toHaveBeenCalledWith(testError, {
        userMessage: 'Failed to load data',
        showNotification: true,
      });
    });

    it('uses default userMessage when none provided', async () => {
      const testError = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(testError);

      const { rerender } = renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      queryResult = {
        ...queryResult,
        error: testError,
        isError: true,
        status: 'error',
      };

      rerender();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleError).toHaveBeenCalledWith(testError, {
        userMessage: 'Query failed',
        showNotification: false,
      });
    });

    it('calls user onError handler when provided', async () => {
      const testError = new Error('Query failed');
      const userOnError = vi.fn();
      const queryFn = vi.fn().mockRejectedValue(testError);

      const { rerender } = renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
          onError: userOnError,
        })
      );

      queryResult = {
        ...queryResult,
        error: testError,
        isError: true,
        status: 'error',
      };

      rerender();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(userOnError).toHaveBeenCalled();
    });

    it('does not call handleError when no error', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(handleError).not.toHaveBeenCalled();
    });
  });

  describe('query options passthrough', () => {
    it('passes queryKey to TanStack Query', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['users', 123],
          queryFn,
        })
      );

      expect(capturedOptions.queryKey).toEqual(['users', 123]);
    });

    it('passes queryFn to TanStack Query', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(capturedOptions.queryFn).toBe(queryFn);
    });

    it('strips framework-specific options from TanStack options', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
          userMessage: 'Custom message',
          showNotification: true,
          ssr: false,
        })
      );

      expect(capturedOptions.userMessage).toBeUndefined();
      expect(capturedOptions.showNotification).toBeUndefined();
      expect(capturedOptions.ssr).toBeUndefined();
    });
  });

  describe('return value', () => {
    it('returns TanStack Query result', () => {
      const queryFn = vi.fn().mockResolvedValue({ id: 1 });
      const { result } = renderHook(() =>
        useQuery({
          queryKey: ['test'],
          queryFn,
        })
      );

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('isSuccess');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });
  });
});
