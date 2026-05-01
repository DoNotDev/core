import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { debounce, throttle, cooldown, delay } from '../timingUtils';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default 300ms wait', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);

    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(150);
    debounced();
    vi.advanceTimersByTime(150);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a', 'b');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('immediate mode calls on leading edge', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200, true);

    debounced();
    expect(fn).toHaveBeenCalledTimes(1);

    // Subsequent calls during wait should not fire
    debounced();
    debounced();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores calls during wait period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows call after wait period expires', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled();
    vi.advanceTimersByTime(200);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('executes trailing call when trailing is true', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200, true);

    throttled('first');
    throttled('second');

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes immediately on first call', () => {
    const fn = vi.fn();
    const cooled = cooldown(fn, 500);

    cooled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores calls during cooldown period', () => {
    const fn = vi.fn();
    const cooled = cooldown(fn, 500);

    cooled();
    cooled();
    cooled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows call after cooldown expires', () => {
    const fn = vi.fn();
    const cooled = cooldown(fn, 500);

    cooled();
    vi.advanceTimersByTime(500);
    cooled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes arguments to the function', () => {
    const fn = vi.fn();
    const cooled = cooldown(fn, 500);

    cooled('arg1', 42);
    expect(fn).toHaveBeenCalledWith('arg1', 42);
  });
});

describe('delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes function after specified delay', () => {
    const fn = vi.fn();
    const delayed = delay(fn, 200);

    delayed();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default 300ms delay', () => {
    const fn = vi.fn();
    const delayed = delay(fn);

    delayed();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the function', () => {
    const fn = vi.fn();
    const delayed = delay(fn, 100);

    delayed('x', 'y');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('x', 'y');
  });
});
