import { describe, it, expect } from 'vitest';

import {
  BREAKPOINT_THRESHOLDS,
  BREAKPOINT_RANGES,
  getBreakpointFromWidth,
  isBreakpoint,
  getBreakpointUtils,
} from '../layout/breakpoint';

describe('BREAKPOINT_THRESHOLDS', () => {
  it('has correct threshold values', () => {
    expect(BREAKPOINT_THRESHOLDS.mobile).toBe(0);
    expect(BREAKPOINT_THRESHOLDS.tablet).toBe(768);
    expect(BREAKPOINT_THRESHOLDS.laptop).toBe(1024);
    expect(BREAKPOINT_THRESHOLDS.desktop).toBe(1440);
  });
});

describe('BREAKPOINT_RANGES', () => {
  it('has correct ranges for each breakpoint', () => {
    expect(BREAKPOINT_RANGES.mobile).toEqual({ min: 0, max: 767 });
    expect(BREAKPOINT_RANGES.tablet).toEqual({ min: 768, max: 1023 });
    expect(BREAKPOINT_RANGES.laptop).toEqual({ min: 1024, max: 1439 });
    expect(BREAKPOINT_RANGES.desktop).toEqual({ min: 1440, max: Infinity });
  });

  it('ranges are contiguous (no gaps)', () => {
    expect(BREAKPOINT_RANGES.mobile.max + 1).toBe(BREAKPOINT_RANGES.tablet.min);
    expect(BREAKPOINT_RANGES.tablet.max + 1).toBe(BREAKPOINT_RANGES.laptop.min);
    expect(BREAKPOINT_RANGES.laptop.max + 1).toBe(
      BREAKPOINT_RANGES.desktop.min
    );
  });
});

describe('getBreakpointFromWidth', () => {
  it('returns mobile for small widths', () => {
    expect(getBreakpointFromWidth(0)).toBe('mobile');
    expect(getBreakpointFromWidth(320)).toBe('mobile');
    expect(getBreakpointFromWidth(767)).toBe('mobile');
  });

  it('returns tablet at 768px', () => {
    expect(getBreakpointFromWidth(768)).toBe('tablet');
    expect(getBreakpointFromWidth(900)).toBe('tablet');
    expect(getBreakpointFromWidth(1023)).toBe('tablet');
  });

  it('returns laptop at 1024px', () => {
    expect(getBreakpointFromWidth(1024)).toBe('laptop');
    expect(getBreakpointFromWidth(1200)).toBe('laptop');
    expect(getBreakpointFromWidth(1439)).toBe('laptop');
  });

  it('returns desktop at 1440px+', () => {
    expect(getBreakpointFromWidth(1440)).toBe('desktop');
    expect(getBreakpointFromWidth(1920)).toBe('desktop');
    expect(getBreakpointFromWidth(3840)).toBe('desktop');
  });
});

describe('isBreakpoint', () => {
  it('matches mobile range', () => {
    expect(isBreakpoint(320, 'mobile')).toBe(true);
    expect(isBreakpoint(767, 'mobile')).toBe(true);
    expect(isBreakpoint(768, 'mobile')).toBe(false);
  });

  it('matches tablet range', () => {
    expect(isBreakpoint(767, 'tablet')).toBe(false);
    expect(isBreakpoint(768, 'tablet')).toBe(true);
    expect(isBreakpoint(1023, 'tablet')).toBe(true);
    expect(isBreakpoint(1024, 'tablet')).toBe(false);
  });

  it('matches laptop range', () => {
    expect(isBreakpoint(1024, 'laptop')).toBe(true);
    expect(isBreakpoint(1439, 'laptop')).toBe(true);
    expect(isBreakpoint(1440, 'laptop')).toBe(false);
  });

  it('matches desktop range (no upper bound)', () => {
    expect(isBreakpoint(1440, 'desktop')).toBe(true);
    expect(isBreakpoint(5000, 'desktop')).toBe(true);
  });
});

describe('getBreakpointUtils', () => {
  it('returns correct utils for mobile', () => {
    const utils = getBreakpointUtils(400, 800);
    expect(utils.current).toBe('mobile');
    expect(utils.width).toBe(400);
    expect(utils.height).toBe(800);
    expect(utils.isMobile).toBe(true);
    expect(utils.isTablet).toBe(false);
    expect(utils.isLaptop).toBe(false);
    expect(utils.isDesktop).toBe(false);
    expect(utils.isMobileOrTablet).toBe(true);
    expect(utils.isLaptopOrDesktop).toBe(false);
  });

  it('returns correct utils for tablet', () => {
    const utils = getBreakpointUtils(900, 600);
    expect(utils.current).toBe('tablet');
    expect(utils.isMobile).toBe(false);
    expect(utils.isTablet).toBe(true);
    expect(utils.isMobileOrTablet).toBe(true);
    expect(utils.isLaptopOrDesktop).toBe(false);
  });

  it('returns correct utils for laptop', () => {
    const utils = getBreakpointUtils(1200, 800);
    expect(utils.current).toBe('laptop');
    expect(utils.isLaptop).toBe(true);
    expect(utils.isMobileOrTablet).toBe(false);
    expect(utils.isLaptopOrDesktop).toBe(true);
  });

  it('returns correct utils for desktop', () => {
    const utils = getBreakpointUtils(1920, 1080);
    expect(utils.current).toBe('desktop');
    expect(utils.isDesktop).toBe(true);
    expect(utils.isMobileOrTablet).toBe(false);
    expect(utils.isLaptopOrDesktop).toBe(true);
  });
});
