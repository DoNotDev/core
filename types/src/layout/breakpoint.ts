// packages/core/types/src/layout/breakpoint.ts

/**
 * @fileoverview Breakpoint Types
 * @description Breakpoint type definitions for responsive design. Defines the standard breakpoints used throughout the framework for responsive layout and component behavior.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Breakpoint type definition for responsive design
 *
 * Defines the standard breakpoints used throughout the framework
 * for responsive layout and component behavior.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Breakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop';

/**
 * Breakpoint pixel values
 *
 * Standard breakpoint thresholds used for responsive design.
 * These values match the CSS variables in layout-variables.css
 * and are used by the theme store and layout system.
 */
/**
 * Breakpoint threshold values for calculation
 *
 * These are the actual breakpoint boundaries used for responsive logic.
 * Each value represents the minimum width for that breakpoint.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const BREAKPOINT_THRESHOLDS = {
  mobile: 0, // Mobile starts at 0px
  tablet: 768, // Tablet starts at 768px
  laptop: 1024, // Laptop starts at 1024px (key layout split)
  desktop: 1440, // Desktop starts at 1440px
} as const;

// Removed legacy BREAKPOINT_PIXELS in favor of BREAKPOINT_THRESHOLDS and BREAKPOINT_RANGES

/**
 * Breakpoint pixel ranges
 *
 * Defines the pixel ranges for each breakpoint to help with
 * responsive design calculations and media queries.
 * These ranges match the CSS media queries and store logic.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const BREAKPOINT_RANGES: Record<
  Breakpoint,
  { min: number; max: number }
> = {
  mobile: { min: 0, max: 767 }, // < 768px
  tablet: { min: 768, max: 1023 }, // 768px - 1023px
  laptop: { min: 1024, max: 1439 }, // 1024px - 1439px (key layout split)
  desktop: { min: 1440, max: Infinity }, // 1440px+
} as const;

/**
 * Breakpoint utilities interface
 *
 * Provides computed breakpoint state and helper methods
 * for responsive design logic.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BreakpointUtils {
  /** Current active breakpoint */
  current: Breakpoint;
  /** Current window width in pixels */
  width: number;
  /** Current window height in pixels */
  height: number;
  /** Whether current viewport is mobile (0-767px) */
  isMobile: boolean;
  /** Whether current viewport is tablet (768-1023px) */
  isTablet: boolean;
  /** Whether current viewport is laptop (1024-1439px) */
  isLaptop: boolean;
  /** Whether current viewport is desktop (1440px+) */
  isDesktop: boolean;
  /** Whether current viewport is mobile OR tablet (< 1024px) */
  isMobileOrTablet: boolean;
  /** Whether current viewport is laptop OR desktop (>= 1024px) */
  isLaptopOrDesktop: boolean;
}

/**
 * Get breakpoint from window width
 *
 * @param width - Window width in pixels
 * @returns The corresponding breakpoint
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getBreakpointFromWidth(width: number): Breakpoint {
  // Optimized: Check from highest to lowest for early returns
  if (width >= BREAKPOINT_THRESHOLDS.desktop) return 'desktop'; // ≥ 1440px
  if (width >= BREAKPOINT_THRESHOLDS.laptop) return 'laptop'; // 1024px - 1439px
  if (width >= BREAKPOINT_THRESHOLDS.tablet) return 'tablet'; // 768px - 1023px
  return 'mobile'; // < 768px
}

/**
 * Check if a breakpoint matches the current width
 *
 * @param width - Window width in pixels
 * @param breakpoint - Target breakpoint to check
 * @returns Whether the width matches the breakpoint
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isBreakpoint(width: number, breakpoint: Breakpoint): boolean {
  const range = BREAKPOINT_RANGES[breakpoint];
  return width >= range.min && width <= range.max;
}

/**
 * Get breakpoint utilities from window dimensions
 *
 * @param width - Window width in pixels
 * @param height - Window height in pixels
 * @returns Computed breakpoint utilities
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getBreakpointUtils(
  width: number,
  height: number
): BreakpointUtils {
  const current = getBreakpointFromWidth(width);

  return {
    current,
    width,
    height,
    isMobile: current === 'mobile',
    isTablet: current === 'tablet',
    isLaptop: current === 'laptop',
    isDesktop: current === 'desktop',
    isMobileOrTablet: current === 'mobile' || current === 'tablet',
    isLaptopOrDesktop: current === 'laptop' || current === 'desktop',
  };
}
