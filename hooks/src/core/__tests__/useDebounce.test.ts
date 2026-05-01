import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from '../../__tests__/testUtils';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello'));

    expect(result.current).toBe('hello');
  });

  it('debounces value changes with default 500ms delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'initial' },
    });

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('respects custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 200 }),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('resets timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 300 }),
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
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });

  it('immediate option fires first value immediately', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 300, immediate: true }),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('second');
  });

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 100 }),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(42);
  });

  it('works with object values', () => {
    const obj1 = { name: 'a' };
    const obj2 = { name: 'b' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 100 }),
      { initialProps: { value: obj1 } }
    );

    rerender({ value: obj2 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toEqual({ name: 'b' });
  });

  it('cleans up timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, { delay: 500 }),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    unmount();

    // Should not throw or update after unmount
    act(() => {
      vi.advanceTimersByTime(500);
    });
  });
});
