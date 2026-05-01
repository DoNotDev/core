// packages/core/hooks/src/__tests__/useIsClient.test.ts

/**
 * @fileoverview Tests for useIsClient hook
 * @description Unit tests verifying client detection via useSyncExternalStore.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect } from 'vitest';

import { renderHook } from './testUtils';
import { useIsClient } from '../core/useIsClient';

describe('useIsClient', () => {
  it('returns true in browser environment (jsdom)', () => {
    const { result } = renderHook(() => useIsClient());
    expect(result.current).toBe(true);
  });

  it('returns a boolean', () => {
    const { result } = renderHook(() => useIsClient());
    expect(typeof result.current).toBe('boolean');
  });

  it('returns consistent value across rerenders', () => {
    const { result, rerender } = renderHook(() => useIsClient());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
