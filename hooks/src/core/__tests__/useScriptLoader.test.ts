import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from '../../__tests__/testUtils';
import { useScriptLoader } from '../useScriptLoader';

describe('useScriptLoader', () => {
  beforeEach(() => {
    // Clean up any scripts added during tests
    document.querySelectorAll('script[src*="test"]').forEach((s) => s.remove());
  });

  it('starts in idle state when enabled', () => {
    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/script.js', {
        manual: true,
      })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.loadTriggered).toBe(false);
  });

  it('exposes load, retry, reset functions', () => {
    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/script.js', {
        manual: true,
      })
    );

    expect(typeof result.current.load).toBe('function');
    expect(typeof result.current.retry).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('does not load when disabled', () => {
    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/script.js', {
        enabled: false,
      })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoaded).toBe(false);
  });

  it('detects already loaded script', () => {
    // Add a script to the DOM
    const script = document.createElement('script');
    script.src = 'https://test.example.com/existing.js';
    document.head.appendChild(script);

    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/existing.js')
    );

    expect(result.current.isLoaded).toBe(true);

    document.head.removeChild(script);
  });

  it('reset clears all state', () => {
    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/script.js', {
        manual: true,
      })
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.loadTriggered).toBe(false);
  });

  it('uses custom isLoaded check', () => {
    const { result } = renderHook(() =>
      useScriptLoader('https://test.example.com/custom.js', {
        isLoaded: () => true,
      })
    );

    expect(result.current.isLoaded).toBe(true);
  });
});
