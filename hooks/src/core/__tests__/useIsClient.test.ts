import { describe, it, expect } from 'vitest';

import { renderHook } from '../../__tests__/testUtils';
import { useIsClient } from '../useIsClient';

describe('useIsClient', () => {
  it('returns true in browser environment (happy-dom)', () => {
    const { result } = renderHook(() => useIsClient());

    // happy-dom provides window, so this should be true
    expect(result.current).toBe(true);
  });

  it('returns consistent value across re-renders', () => {
    const { result, rerender } = renderHook(() => useIsClient());

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
