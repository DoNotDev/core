import { describe, it, expect } from 'vitest';

import { renderHook } from '../../__tests__/testUtils';
import { useViewportVisibility } from '../useViewportVisibility';

describe('useViewportVisibility', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useViewportVisibility());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasTriggered).toBe(false);
    expect(result.current.visibleItems).toBeInstanceOf(Set);
    expect(result.current.visibleItems.size).toBe(0);
  });

  it('returns a ref object', () => {
    const { result } = renderHook(() => useViewportVisibility());

    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  it('isItemVisible returns false for unobserved items', () => {
    const { result } = renderHook(() => useViewportVisibility());

    expect(result.current.isItemVisible(0)).toBe(false);
    expect(result.current.isItemVisible(5)).toBe(false);
  });

  it('accepts custom options', () => {
    const { result } = renderHook(() =>
      useViewportVisibility({
        threshold: 0.5,
        rootMargin: '100px',
        once: true,
        trackItems: false,
        enableScrollListener: false,
      })
    );

    expect(result.current.isVisible).toBe(false);
    expect(result.current.ref).toBeDefined();
  });
});
