import { describe, it, expect, vi } from 'vitest';

import { renderHook, act } from '../../__tests__/testUtils';
import { useClickOutside } from '../useClickOutside';

describe('useClickOutside', () => {
  it('returns a ref object', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useClickOutside(callback));

    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  it('calls callback when clicking outside', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useClickOutside(callback));

    // Create an element and attach it to the ref
    const element = document.createElement('div');
    document.body.appendChild(element);

    // Simulate ref assignment (can't directly set .current on readonly ref)
    Object.defineProperty(result.current.ref, 'current', {
      value: element,
      writable: true,
    });

    // Click outside the element
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideElement });
      document.dispatchEvent(event);
    });

    expect(callback).toHaveBeenCalled();

    document.body.removeChild(element);
    document.body.removeChild(outsideElement);
  });

  it('does not call callback when clicking inside', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useClickOutside(callback));

    const element = document.createElement('div');
    const child = document.createElement('span');
    element.appendChild(child);
    document.body.appendChild(element);

    Object.defineProperty(result.current.ref, 'current', {
      value: element,
      writable: true,
    });

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: child });
      document.dispatchEvent(event);
    });

    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(element);
  });

  it('does not fire when disabled', () => {
    const callback = vi.fn();
    renderHook(() => useClickOutside(callback, { enabled: false }));

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
      });
      document.dispatchEvent(event);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const callback = vi.fn();

    const { unmount } = renderHook(() => useClickOutside(callback));
    unmount();

    // Should have removed mousedown and touchstart listeners
    const removedEvents = removeSpy.mock.calls.map(([event]) => event);
    expect(removedEvents).toContain('mousedown');
    expect(removedEvents).toContain('touchstart');
  });
});
