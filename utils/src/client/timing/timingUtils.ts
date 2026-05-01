// packages/core/utils/src/client/timing/timingUtils.ts

/**
 * @fileoverview Timing utilities
 * @description Debounce, throttle, and cooldown utilities for function execution control
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @param immediate Whether to invoke the function on the leading edge instead of trailing
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;

    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every specified wait milliseconds.
 *
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @param trailing Whether to invoke on the trailing edge of the wait
 * @returns A throttled version of the function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300,
  trailing: boolean = true
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime: number = 0;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;
    const now = Date.now();
    const remaining = wait - (now - lastCallTime);

    lastArgs = args;

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      lastCallTime = now;
      func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        lastCallTime = Date.now();
        timeout = null;
        if (lastArgs) {
          func.apply(context, lastArgs);
        }
      }, remaining);
    }
  };
}

/**
 * Creates a function that executes once and then ignores subsequent calls
 * for the specified amount of time.
 *
 * @param func The function to rate-limit
 * @param wait The number of milliseconds to cool down
 * @returns A rate-limited function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function cooldown<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 1000
): (...args: Parameters<T>) => void {
  let onCooldown = false;

  return function (this: any, ...args: Parameters<T>): void {
    if (onCooldown) return;

    onCooldown = true;
    func.apply(this, args);

    setTimeout(() => {
      onCooldown = false;
    }, wait);
  };
}

/**
 * Execute a function after a specified delay
 *
 * @param func Function to execute
 * @param delay Delay in milliseconds
 * @returns A function that when called will execute after the delay
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function delay<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  return function (this: any, ...args: Parameters<T>): void {
    const context = this;
    setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

/**
 * Index of all timing utility functions for easy reference
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const timingUtils = {
  debounce,
  throttle,
  cooldown,
  delay,
};
