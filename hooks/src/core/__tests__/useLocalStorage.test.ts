import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from '../../__tests__/testUtils';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns default value when key does not exist', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'default' })
    );

    expect(result.current.value).toBe('default');
  });

  it('reads existing value from localStorage', async () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'default' })
    );

    // After mount effect runs, value should be loaded
    await vi.waitFor(() => {
      expect(result.current.value).toBe('stored-value');
    });
  });

  it('sets isLoaded to true after initialization', async () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'default' })
    );

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });
  });

  it('updates value with setValue', async () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'initial' })
    );

    act(() => {
      result.current.setValue('updated');
    });

    expect(result.current.value).toBe('updated');
  });

  it('persists value to localStorage on setValue', async () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'initial' })
    );

    // Wait for initial load
    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.setValue('persisted');
    });

    await vi.waitFor(() => {
      const stored = localStorage.getItem('test-key');
      expect(stored).toBe(JSON.stringify('persisted'));
    });
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() =>
      useLocalStorage('counter', { defaultValue: 0 })
    );

    act(() => {
      result.current.setValue((prev: number) => prev + 1);
    });

    expect(result.current.value).toBe(1);
  });

  it('removes value from localStorage', async () => {
    localStorage.setItem('test-key', JSON.stringify('to-remove'));

    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: 'default' })
    );

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    act(() => {
      result.current.removeValue();
    });

    expect(result.current.value).toBe('default');
    // Hook may persist default value or remove key — just verify state reset
    const stored = localStorage.getItem('test-key');
    expect(stored === null || stored === JSON.stringify('default')).toBe(true);
  });

  it('reports isAvailable as true in browser (happy-dom)', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { defaultValue: '' })
    );

    expect(result.current.isAvailable).toBe(true);
  });

  it('handles complex object values', async () => {
    const obj = { name: 'Test', count: 42, nested: { a: 1 } };

    const { result } = renderHook(() =>
      useLocalStorage('obj-key', { defaultValue: obj })
    );

    const newObj = { name: 'Updated', count: 0, nested: { a: 2 } };
    act(() => {
      result.current.setValue(newObj);
    });

    expect(result.current.value).toEqual(newObj);
  });

  it('handles localStorage read errors gracefully', async () => {
    // Set invalid JSON
    localStorage.setItem('bad-key', '{invalid json');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useLocalStorage('bad-key', { defaultValue: 'fallback' })
    );

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    // Should fall back to default
    expect(result.current.value).toBe('fallback');
  });
});
