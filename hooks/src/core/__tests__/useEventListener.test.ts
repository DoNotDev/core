import { describe, it, expect, vi, afterEach } from 'vitest';

import { renderHook } from '../../__tests__/testUtils';
import { useEventListener } from '../useEventListener';

describe('useEventListener', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isActive true when enabled', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useEventListener('click', handler));

    expect(result.current.isActive).toBe(true);
  });

  it('returns isActive false when disabled', () => {
    const handler = vi.fn();
    const { result } = renderHook(() =>
      useEventListener('click', handler, { enabled: false })
    );

    expect(result.current.isActive).toBe(false);
  });

  it('attaches listener to window by default', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const handler = vi.fn();

    renderHook(() => useEventListener('resize', handler));

    expect(addSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
  });

  it('removes listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();

    const { unmount } = renderHook(() => useEventListener('resize', handler));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('attaches listener to custom target', () => {
    const target = document.createElement('div');
    const addSpy = vi.spyOn(target, 'addEventListener');
    const handler = vi.fn();

    renderHook(() => useEventListener('click', handler, { target }));

    expect(addSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
  });

  it('does not attach listener when enabled is false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const callCountBefore = addSpy.mock.calls.length;
    const handler = vi.fn();

    renderHook(() => useEventListener('click', handler, { enabled: false }));

    // No new addEventListener calls should have been made for 'click'
    const clickCalls = addSpy.mock.calls
      .slice(callCountBefore)
      .filter(([event]) => event === 'click');
    expect(clickCalls.length).toBe(0);
  });

  it('calls handler when event fires', () => {
    const handler = vi.fn();

    renderHook(() => useEventListener('click', handler, { target: window }));

    const event = new Event('click');
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
