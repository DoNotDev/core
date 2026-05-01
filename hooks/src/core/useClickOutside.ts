// packages/core/hooks/src/core/useClickOutside.ts

/**
 * @fileoverview useClickOutside Hook - Outside Click Detection
 * @description High-performance hook for detecting clicks outside of elements
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Multiple element support
 * - Configurable event types
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React
 *
 * Performance:
 * - Efficient event listener management
 * - Automatic cleanup prevents memory leaks
 * - Minimal re-renders with optimized callbacks
 */

import { useEffect, useRef, useCallback } from 'react';

import { useEventListener } from './useEventListener';

/**
 * Options for useClickOutside hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseClickOutsideOptions {
  /**
   * Event types to listen for
   * @default ['mousedown', 'touchstart']
   */
  events?: string[];

  /**
   * Whether the hook is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Additional elements to ignore (e.g., triggers)
   */
  ignoreElements?: (Element | null)[];
}

/**
 * Return type for useClickOutside hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseClickOutsideReturn {
  /**
   * Ref to attach to the element to monitor
   */
  ref: React.RefObject<HTMLElement | null>;

  /**
   * Whether the element is currently being clicked outside
   */
  isClickOutside: boolean;
}

/**
 * useClickOutside - Outside Click Detection Hook
 *
 * High-performance hook for detecting clicks outside of elements with support
 * for multiple elements and configurable event types. Perfect for dropdowns,
 * modals, and popover components.
 *
 * @param callback - Function to call when clicking outside
 * @param options - Configuration options for click outside detection
 * @returns Object containing ref and click outside state
 *
 * @example Basic dropdown
 * ```tsx
 * function Dropdown() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const { ref } = useClickOutside(() => setIsOpen(false));
 *
 *   return (
 *     <div className="relative">
 *       <button onClick={() => setIsOpen(!isOpen)}>
 *         Toggle
 *       </button>
 *       {isOpen && (
 *         <div className="absolute top-full left-0 bg-white shadow-lg">
 *           Dropdown content
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Modal with outside click
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const { ref } = useClickOutside(onClose, {
 *     enabled: isOpen
 *   });
 *
 *   if (!isOpen) return null;
 *
 *   return (
 *     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
 *       <div className="bg-white p-6 rounded-lg">
 *         {children}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Multiple elements
 * ```tsx
 * function ComplexComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const triggerRef = useRef<HTMLButtonElement>(null);
 *   const { ref } = useClickOutside(() => setIsOpen(false), {
 *     ignoreElements: [triggerRef.current]
 *   });
 *
 *   return (
 *     <div>
 *       <button ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
 *         Toggle
 *       </button>
 *       {isOpen && (
 *         <div className="popover">
 *           Content
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Custom events
 * ```tsx
 * function CustomEvents() {
 *   const { ref } = useClickOutside(() => console.log('Outside click'), {
 *     events: ['mousedown', 'keydown'],
 *     enabled: true
 *   });
 *
 *   return (
 *     <div>
 *       Click outside or press any key
 *     </div>
 *   );
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useClickOutside(
  callback: () => void,
  options: UseClickOutsideOptions = {}
): UseClickOutsideReturn {
  const {
    events = ['mousedown', 'touchstart'],
    enabled = true,
    ignoreElements,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const callbackRef = useRef(callback);
  const ignoreElementsRef = useRef(ignoreElements);

  // Update refs
  useEffect(() => {
    callbackRef.current = callback;
    ignoreElementsRef.current = ignoreElements;
  }, [callback, ignoreElements]);

  // Handle outside click
  const handleClickOutside = useCallback(
    (event: Event) => {
      if (!enabled) return;

      const target = event.target as Element;
      if (!target) return;

      // Check if click is inside the monitored element
      if (ref.current && ref.current.contains(target)) {
        return;
      }

      // Check if click is inside ignored elements
      const currentIgnore = ignoreElementsRef.current;
      if (currentIgnore) {
        for (const ignoreElement of currentIgnore) {
          if (ignoreElement && ignoreElement.contains(target)) {
            return;
          }
        }
      }

      // Click is outside, call callback
      callbackRef.current();
    },
    [enabled]
  );

  // Set up event listeners manually (can't use hooks in loops)
  useEffect(() => {
    if (!enabled) return;

    const addListeners = () => {
      events.forEach((eventType) => {
        document.addEventListener(eventType, handleClickOutside, {
          capture: true,
        });
      });
    };

    const removeListeners = () => {
      events.forEach((eventType) => {
        document.removeEventListener(eventType, handleClickOutside, {
          capture: true,
        });
      });
    };

    addListeners();
    return removeListeners;
  }, [events, enabled, handleClickOutside]);

  return {
    ref,
    isClickOutside: false, // This could be enhanced to track actual state
  };
}
