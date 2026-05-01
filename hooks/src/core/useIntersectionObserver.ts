// packages/core/hooks/src/core/useIntersectionObserver.ts

/**
 * @fileoverview useIntersectionObserver Hook - Basic Intersection Observation
 * @description Lightweight hook for basic intersection observation with optimal performance
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Intersection Observer API with automatic cleanup
 * - Once-only triggering option
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React and framework utils
 *
 * Performance:
 * - Uses native IntersectionObserver API
 * - React 19 useSyncExternalStore pattern for optimal performance
 * - Prevents tearing in concurrent rendering
 * - Automatic cleanup prevents memory leaks
 * - Minimal state updates with proper change detection
 */

import { useRef, useEffect, useSyncExternalStore, useMemo } from 'react';

import { isClient } from '@donotdev/utils';

/**
 * Options for useIntersectionObserver hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  once?: boolean;
  fallbackIntersecting?: boolean;
}

/**
 * Return type for useIntersectionObserver hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseIntersectionObserverReturn<T extends Element = Element> {
  ref: React.RefObject<T | null>;
  isIntersecting: boolean;
  hasTriggered: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * useIntersectionObserver - Basic Intersection Observation Hook (React 19 Optimized)
 *
 * Lightweight hook for basic intersection observation with optimal performance.
 * Uses React 19's useSyncExternalStore pattern for automatic cleanup, proper
 * SSR handling, and tearing prevention in concurrent rendering.
 *
 * @param options - Configuration options for intersection observation
 * @returns Object containing ref, isIntersecting state, and entry
 *
 * @example Basic intersection detection
 * ```tsx
 * function IntersectionComponent() {
 *   const { ref, isIntersecting } = useIntersectionObserver();
 *
 *   return (
 *     <div ref={ref} className={isIntersecting ? 'visible' : 'hidden'}>
 *       Content that appears when intersecting
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With custom threshold
 * ```tsx
 * function ThresholdComponent() {
 *   const { ref, isIntersecting } = useIntersectionObserver({
 *     threshold: 0.5,
 *     rootMargin: '50px'
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {isIntersecting ? '50% visible' : 'Not visible enough'}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Once-only triggering (React 19 optimized)
 * ```tsx
 * function OnceComponent() {
 *   const { ref, isIntersecting } = useIntersectionObserver({ once: true });
 *
 *   return (
 *     <div ref={ref}>
 *       {isIntersecting && <ExpensiveComponent />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example SSR-safe implementation
 * ```tsx
 * function SSRComponent() {
 *   const { ref, isIntersecting } = useIntersectionObserver({
 *     fallbackIntersecting: true // Shows content during SSR
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {isIntersecting ? 'Client-side' : 'SSR fallback'}
 *     </div>
 *   );
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useIntersectionObserver<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn<T> {
  const {
    threshold = 0,
    root = null,
    rootMargin = '0px',
    once = false,
    fallbackIntersecting = true,
  } = options;

  const ref = useRef<T | null>(null);

  // Create intersection observer using React 19 patterns
  const observer = useMemo(() => {
    return createIntersectionObserver({
      threshold,
      root,
      rootMargin,
      once,
      fallbackIntersecting,
    });
  }, [threshold, root, rootMargin, once, fallbackIntersecting]);

  // Use useSyncExternalStore for optimal performance and proper tearing prevention
  const state = useSyncExternalStore(
    observer.subscribe,
    observer.getSnapshot,
    observer.getServerSnapshot
  );

  // Update observer when ref element changes
  // Empty deps intentional: observer is stable from useMemo, ref updates are tracked internally
  useEffect(() => {
    if (ref.current) {
      observer.setElement(ref.current);
    }
    return () => observer.setElement(null);
  }, [observer]);

  return {
    ref,
    isIntersecting: state.isIntersecting,
    hasTriggered: state.hasTriggered,
    entry: state.entry,
  };
}

/**
 * Create an intersection observer with React 19 patterns
 * Follows same pattern as createLocalStorageObserver for consistency
 */
function createIntersectionObserver(options: {
  threshold: number | number[];
  root: Element | null;
  rootMargin: string;
  once: boolean;
  fallbackIntersecting: boolean;
}) {
  const { threshold, root, rootMargin, once, fallbackIntersecting } = options;

  let currentState = {
    isIntersecting: fallbackIntersecting,
    hasTriggered: false,
    entry: null as IntersectionObserverEntry | null,
  };
  let listeners = new Set<() => void>();
  let intersectionObserver: IntersectionObserver | null = null;
  let currentElement: Element | null = null;
  let hasTriggered = false;

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (!entry) return;

    const isIntersecting = entry.isIntersecting;

    // Handle once option - disconnect after first intersection
    if (once && isIntersecting && !hasTriggered) {
      hasTriggered = true;
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
    }

    // Update hasTriggered if intersecting for first time
    if (isIntersecting && !hasTriggered) {
      hasTriggered = true;
    }

    const newState = {
      isIntersecting,
      hasTriggered,
      entry,
    };

    // Only update if state actually changed
    if (
      newState.isIntersecting !== currentState.isIntersecting ||
      newState.hasTriggered !== currentState.hasTriggered ||
      newState.entry !== currentState.entry
    ) {
      currentState = newState;
      listeners.forEach((listener) => listener());
    }
  };

  const getSnapshot = () => {
    return currentState;
  };

  const subscribe = (callback: () => void) => {
    listeners.add(callback);

    // If element is already set and we're on client, start observing
    if (currentElement && !intersectionObserver && isClient()) {
      intersectionObserver = new IntersectionObserver(handleIntersection, {
        threshold,
        root,
        rootMargin,
      });
      intersectionObserver.observe(currentElement);
    }

    return () => {
      listeners.delete(callback);
      // Cleanup observer when last listener is removed
      if (listeners.size === 0 && intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
    };
  };

  const setElement = (element: Element | null) => {
    // Disconnect existing observer
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }

    currentElement = element;

    // Observe new element if we have listeners and we're on client
    if (element && listeners.size > 0 && isClient()) {
      intersectionObserver = new IntersectionObserver(handleIntersection, {
        threshold,
        root,
        rootMargin,
      });
      intersectionObserver.observe(element);
    }
  };

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: () => ({
      isIntersecting: fallbackIntersecting,
      hasTriggered: false,
      entry: null,
    }),
    setElement,
  };
}
