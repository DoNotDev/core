// packages/core/hooks/src/core/useViewportVisibility.ts

/**
 * @fileoverview useViewportVisibility Hook - Advanced Viewport Detection
 * @description High-performance hook for advanced viewport visibility tracking with item-level detection
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Item-level visibility tracking
 * - Scroll listener for dynamic updates
 * - Re-triggering support for complex animations
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React and framework utils
 *
 * Performance:
 * - Uses native IntersectionObserver API
 * - RequestAnimationFrame batching for smooth updates
 * - Passive scroll listeners for optimal performance
 * - Automatic cleanup prevents memory leaks
 * - Minimal re-renders with optimized state management
 */

import { useRef, useEffect, useState, useCallback } from 'react';

import { observeElement, createViewportHandler } from '@donotdev/utils';

import { useEventListener } from './useEventListener';

/**
 * Options for useViewportVisibility hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseViewportVisibilityOptions {
  /**
   * Intersection threshold (0-1)
   * @default 0.1
   */
  threshold?: number;

  /**
   * Root margin for intersection observer
   * @default '50px'
   */
  rootMargin?: string;

  /**
   * Whether to trigger only once
   * @default false
   */
  once?: boolean;

  /**
   * Whether to track individual items
   * @default true
   */
  trackItems?: boolean;

  /**
   * Whether to enable scroll listener for item tracking
   * @default true
   */
  enableScrollListener?: boolean;
}

/**
 * Return type for useViewportVisibility hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseViewportVisibilityReturn {
  /**
   * Ref to attach to the container element
   */
  ref: React.RefObject<HTMLDivElement | null>;

  /**
   * Whether the container is visible
   */
  isVisible: boolean;

  /**
   * Whether the container has been triggered at least once
   */
  hasTriggered: boolean;

  /**
   * Set of visible item indices
   */
  visibleItems: Set<number>;

  /**
   * Whether a specific item is visible
   */
  isItemVisible: (index: number) => boolean;
}

/**
 * useViewportVisibility - Advanced Viewport Detection Hook
 *
 * High-performance hook for advanced viewport visibility tracking with item-level detection.
 * Perfect for complex animations, staggered reveals, and dynamic scroll-based effects.
 *
 * @param options - Configuration options for viewport visibility tracking
 * @returns Object containing ref, visibility state, and item tracking utilities
 *
 * @example Staggered animations (Reveal component)
 * ```tsx
 * function StaggeredAnimation() {
 *   const { ref, isVisible, visibleItems, isItemVisible } = useViewportVisibility({
 *     threshold: 0.1,
 *     trackItems: true,
 *     enableScrollListener: true
 *   });
 *
 *   return (
 *     <div>
 *       {items.map((item, index) => (
 *         <div
 *           key={index}
 *           className={`transition-all duration-500 ${
 *             isItemVisible(index) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
 *           }`}
 *           style={{ transitionDelay: `${index * 100}ms` }}
 *         >
 *           {item}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Progressive reveal (StackedCards)
 * ```tsx
 * function ProgressiveReveal() {
 *   const { ref, visibleItems } = useViewportVisibility({
 *     threshold: 0.3,
 *     rootMargin: '-70% 0px -30% 0px',
 *     trackItems: true
 *   });
 *
 *   return (
 *     <div>
 *       {cards.map((card, index) => (
 *         <div
 *           key={index}
 *           className={`card ${visibleItems.has(index) ? 'revealed' : 'hidden'}`}
 *         >
 *           {card}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Lazy loading with scroll optimization
 * ```tsx
 * function LazyLoadSection() {
 *   const { ref, isVisible, visibleItems } = useViewportVisibility({
 *     threshold: 0.1,
 *     trackItems: true,
 *     enableScrollListener: true,
 *     once: false // Allow re-triggering
 *   });
 *
 *   return (
 *     <div>
 *       {isVisible ? (
 *         <ExpensiveComponent />
 *       ) : (
 *         <div className="h-96 bg-gray-200 dndev-animate-pulse" />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Scroll-triggered effects
 * ```tsx
 * function ScrollTrigger() {
 *   const { ref, isVisible, visibleItems } = useViewportVisibility({
 *     threshold: 0.5,
 *     rootMargin: '50px',
 *     trackItems: false,
 *     enableScrollListener: true
 *   });
 *
 *   return (
 *     <div className="scroll-trigger">
 *       {isVisible && <AnimatedContent />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useViewportVisibility(
  options: UseViewportVisibilityOptions = {}
): UseViewportVisibilityReturn {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    once = false,
    trackItems = true,
    enableScrollListener = true,
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  // Create viewport handler
  const viewportHandler = useCallback(() => {
    return createViewportHandler({
      threshold,
      rootMargin,
      once,
      trackItems,
    });
  }, [threshold, rootMargin, once, trackItems]);

  // Intersection observer callback
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const handler = viewportHandler();
        const result = handler.handleIntersection(
          entry,
          containerRef.current || undefined
        );

        setIsVisible(result.isVisible);
        setHasTriggered(result.hasTriggered);
        setVisibleItems(result.visibleItems);
      });
    },
    [viewportHandler]
  );

  // Scroll handler for item visibility tracking
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !isVisible) return;

    const handler = viewportHandler();
    const result = handler.handleScroll(containerRef.current);

    setVisibleItems(result.visibleItems);
  }, [isVisible, viewportHandler]);

  // Set up intersection observer
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const cleanup = observeElement(element, handleIntersection, {
      threshold,
      rootMargin,
    });

    return cleanup;
  }, [handleIntersection, threshold, rootMargin]);

  // Set up scroll listener for item tracking
  useEventListener('scroll', handleScroll, {
    enabled: enableScrollListener && trackItems,
    options: { passive: true },
  });

  // Check if specific item is visible
  const isItemVisible = useCallback(
    (index: number): boolean => {
      return visibleItems.has(index);
    },
    [visibleItems]
  );

  return {
    ref: containerRef,
    isVisible,
    hasTriggered,
    visibleItems,
    isItemVisible,
  };
}
