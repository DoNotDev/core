// packages/core/utils/src/client/intersectionObserver.ts

import { isClient } from './platformDetection';

/**
 * @fileoverview Intersection Observer Utilities
 * @description Reusable intersection observer logic for the framework
 * @package @donotdev/utils
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Intersection Observer options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface IntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

/**
 * Intersection observer callback function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type IntersectionObserverCallback = (
  entries: IntersectionObserverEntry[]
) => void;

/**
 * Cleanup function returned by observeElement
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type CleanupFunction = () => void;

/**
 * Polyfill for IntersectionObserver if not available
 */
function createIntersectionObserverPolyfill() {
  if (!isClient()) return null;

  // @ts-ignore
  if (window.IntersectionObserver) return window.IntersectionObserver;

  // Simple polyfill for SSR compatibility
  return class IntersectionObserverPolyfill {
    constructor(
      callback: IntersectionObserverCallback,
      options: IntersectionObserverOptions = {}
    ) {
      // No-op for SSR
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * Observe an element with intersection observer
 *
 * @param element - Element to observe
 * @param callback - Callback when intersection changes
 * @param options - Intersection observer options
 * @returns Cleanup function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function observeElement(
  element: Element,
  callback: IntersectionObserverCallback,
  options: IntersectionObserverOptions = {}
): CleanupFunction {
  if (!isClient()) {
    // SSR fallback
    return () => {};
  }

  const ObserverClass = createIntersectionObserverPolyfill();
  if (!ObserverClass) {
    return () => {};
  }

  const observer = new ObserverClass(callback, options);
  observer.observe(element);

  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
}

/**
 * Check if IntersectionObserver is supported
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isIntersectionObserverSupported(): boolean {
  if (!isClient()) return false;
  return 'IntersectionObserver' in window;
}
