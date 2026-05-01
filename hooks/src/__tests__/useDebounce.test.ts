// packages/core/hooks/src/__tests__/useDebounce.test.ts

/**
 * @fileoverview Tests for useDebounce hook
 * @description Unit tests using renderHook from testUtils.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from './testUtils';
import { useDebounce } from '../core/useDebounce';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', { delay: 300 }));
    expect(result.current).toBe('hello');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebounce(props.value, { delay: 300 }),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebounce(props.value, { delay: 300 }),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('uses default delay of 500ms', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebounce(props.value),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('resets timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      (props: { value: string }) => useDebounce(props.value, { delay: 300 }),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 'b' should have been cancelled, 'c' not yet fired
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('c');
  });

  it('updates immediately when immediate option is true on first render', () => {
    const { result } = renderHook(() =>
      useDebounce('first', { delay: 300, immediate: true })
    );

    expect(result.current).toBe('first');
  });

  it('cleans up timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = renderHook(
      (props: { value: string }) => useDebounce(props.value, { delay: 300 }),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      (props: { value: number }) => useDebounce(props.value, { delay: 200 }),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);
  });

  it('handles object values', () => {
    const obj1 = { count: 1 };
    const obj2 = { count: 2 };

    const { result, rerender } = renderHook(
      (props: { value: typeof obj1 }) =>
        useDebounce(props.value, { delay: 200 }),
      { initialProps: { value: obj1 } }
    );

    rerender({ value: obj2 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({ count: 2 });
  });
});
