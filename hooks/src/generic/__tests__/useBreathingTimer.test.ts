import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderHook, act } from '../../__tests__/testUtils';
import { useBreathingTimer } from '../useBreathingTimer';

describe('useBreathingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle status', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 60, onComplete })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.timeRemaining).toBe(60);
  });

  it('start() sets status to active and resets time', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 60, onComplete })
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.status).toBe('active');
    expect(result.current.timeRemaining).toBe(60);
  });

  it('counts down each second when active', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 5, onComplete })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timeRemaining).toBe(4);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.timeRemaining).toBe(2);
  });

  it('togglePause switches between active and paused', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 60, onComplete })
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.status).toBe('active');

    act(() => {
      result.current.togglePause();
    });
    expect(result.current.status).toBe('paused');

    act(() => {
      result.current.togglePause();
    });
    expect(result.current.status).toBe('active');
  });

  it('restart() resets to idle', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 60, onComplete })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.restart();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.timeRemaining).toBe(60);
  });

  it('formatTime formats correctly', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 60, onComplete })
    );

    expect(result.current.formatTime(0)).toBe('0:00');
    expect(result.current.formatTime(5)).toBe('0:05');
    expect(result.current.formatTime(60)).toBe('1:00');
    expect(result.current.formatTime(125)).toBe('2:05');
  });

  it('reaches complete status when timer hits 0', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 3, onComplete })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.status).toBe('complete');
    expect(result.current.timeRemaining).toBe(0);
  });

  it('onComplete is called automatically when timer completes', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useBreathingTimer({ duration: 2, onComplete })
    );

    // Not called when idle
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe('complete');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
