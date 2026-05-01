// packages/core/hooks/src/core/useEventListener.ts

/**
 * @fileoverview useEventListener Hook - Event Listener Management
 * @description Enterprise-grade hook using React's battle-tested patterns
 *
 * Architecture: Events are side effects → useEffect
 * No custom useSyncExternalStore (Zustand handles that)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useEffect, useRef, useCallback } from 'react';

import { isClient } from '@donotdev/utils';

/**
 * Options for useEventListener hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseEventListenerOptions<TTarget extends EventTarget = Window> {
  /**
   * Whether the event listener is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Event listener options
   * @default { passive: true }
   */
  options?: AddEventListenerOptions;

  /**
   * Element to attach listener to
   * @default window
   */
  target?: TTarget | null;
}

/**
 * Return type for useEventListener hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseEventListenerReturn {
  /**
   * Whether the event listener is active
   */
  isActive: boolean;
}

/**
 * useEventListener - Enterprise-Grade Event Listener Hook
 *
 * Uses React's battle-tested useEffect pattern.
 * Boring code that just works.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param eventType - Type of event to listen for
 * @param handler - Event handler function
 * @param options - Configuration options for event listener
 * @returns Object containing listener state
 *
 * @example Basic usage
 * ```tsx
 * function WindowEvent() {
 *   const [scrollY, setScrollY] = useState(0);
 *
 *   useEventListener('scroll', () => {
 *     setScrollY(window.scrollY);
 *   });
 *
 *   return <p>Scroll position: {scrollY}px</p>;
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useEventListener<
  TEvent extends Event = Event,
  TTarget extends EventTarget = Window,
>(
  eventType: string,
  handler: (event: TEvent) => void,
  options: UseEventListenerOptions<TTarget> = {}
): UseEventListenerReturn {
  const {
    enabled = true,
    options: eventOptions = { passive: true },
    target = isClient() ? window : null,
  } = options;

  // Stable handler ref to prevent recreation
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Stable event handler that uses ref
  // Empty deps intentional: reads from handlerRef which is always current, prevents listener re-registration
  const stableHandler = useCallback((event: Event) => {
    handlerRef.current(event as TEvent);
  }, []);

  // Enterprise-grade: useEffect + addEventListener (React's pattern)
  useEffect(() => {
    if (!enabled || !target) return;

    target.addEventListener(
      eventType,
      stableHandler as EventListenerOrEventListenerObject,
      eventOptions
    );

    return () => {
      target.removeEventListener(
        eventType,
        stableHandler as EventListenerOrEventListenerObject
      );
    };
  }, [eventType, stableHandler, enabled, target, eventOptions]);

  return {
    isActive: enabled,
  };
}
