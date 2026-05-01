// packages/core/utils/src/client/viewportDetection.ts

/**
 * @fileoverview Viewport Detection Utilities
 * @description Reusable viewport detection logic for the framework
 * @package @donotdev/utils
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Viewport detection options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ViewportDetectionOptions {
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
}

/**
 * Viewport detection result
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ViewportDetectionResult {
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
}

/**
 * Viewport handler class
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class ViewportHandler {
  private options: Required<ViewportDetectionOptions>;
  private visibleItems: Set<number> = new Set();
  private hasTriggered: boolean = false;

  constructor(options: ViewportDetectionOptions = {}) {
    this.options = {
      threshold: 0.1,
      rootMargin: '50px',
      once: false,
      trackItems: true,
      ...options,
    };
  }

  /**
   * Handle intersection observer entry
   */
  handleIntersection(
    entry: IntersectionObserverEntry,
    container?: Element
  ): ViewportDetectionResult {
    const isVisible = entry.isIntersecting;

    if (isVisible && !this.hasTriggered) {
      this.hasTriggered = true;
    }

    if (this.options.trackItems && container) {
      this.updateVisibleItems(container);
    }

    return {
      isVisible,
      hasTriggered: this.hasTriggered,
      visibleItems: new Set(this.visibleItems),
    };
  }

  /**
   * Handle scroll event for item tracking
   */
  handleScroll(container: Element): ViewportDetectionResult {
    if (!this.options.trackItems) {
      return {
        isVisible: this.visibleItems.size > 0,
        hasTriggered: this.hasTriggered,
        visibleItems: new Set(this.visibleItems),
      };
    }

    this.updateVisibleItems(container);

    return {
      isVisible: this.visibleItems.size > 0,
      hasTriggered: this.hasTriggered,
      visibleItems: new Set(this.visibleItems),
    };
  }

  /**
   * Update visible items based on container children
   */
  private updateVisibleItems(container: Element): void {
    if (!this.options.trackItems) return;

    const children = Array.from(container.children);
    const newVisibleItems = new Set<number>();

    children.forEach((child, index) => {
      const rect = child.getBoundingClientRect();
      const isInViewport = this.isElementInViewport(rect);

      if (isInViewport) {
        newVisibleItems.add(index);
      }
    });

    this.visibleItems = newVisibleItems;
  }

  /**
   * Check if element is in viewport
   */
  private isElementInViewport(rect: DOMRect): boolean {
    const threshold = this.options.threshold;
    const elementHeight = rect.height;
    const visibleHeight =
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

    return visibleHeight >= elementHeight * threshold;
  }
}

/**
 * Create a viewport handler instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createViewportHandler(
  options: ViewportDetectionOptions = {}
): ViewportHandler {
  return new ViewportHandler(options);
}

/**
 * Check if element is in viewport
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isElementInViewport(
  element: Element,
  threshold: number = 0.1
): boolean {
  const rect = element.getBoundingClientRect();
  const elementHeight = rect.height;
  const visibleHeight =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

  return visibleHeight >= elementHeight * threshold;
}

/**
 * Get visible items from a container
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getVisibleItems(
  container: Element,
  threshold: number = 0.1
): Set<number> {
  const children = Array.from(container.children);
  const visibleItems = new Set<number>();

  children.forEach((child, index) => {
    if (isElementInViewport(child, threshold)) {
      visibleItems.add(index);
    }
  });

  return visibleItems;
}
