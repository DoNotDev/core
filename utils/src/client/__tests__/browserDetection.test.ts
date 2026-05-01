import { describe, it, expect } from 'vitest';

import {
  detectBrowser,
  detectFeatures,
  generateCompatibilityReport,
} from '../browserDetection';

describe('detectBrowser', () => {
  it('returns BrowserInfo object with all fields', () => {
    const info = detectBrowser();

    expect(info).toHaveProperty('type');
    expect(info).toHaveProperty('version');
    expect(info).toHaveProperty('engine');
    expect(info).toHaveProperty('os');
    expect(info).toHaveProperty('isMobile');
    expect(info).toHaveProperty('isTablet');
    expect(info).toHaveProperty('isLaptop');
    expect(info).toHaveProperty('userAgent');
    expect(info).toHaveProperty('language');
    expect(info).toHaveProperty('languages');
    expect(info).toHaveProperty('cookieEnabled');
    expect(info).toHaveProperty('onLine');
    expect(info).toHaveProperty('doNotTrack');
    expect(info).toHaveProperty('hardwareConcurrency');
    expect(info).toHaveProperty('maxTouchPoints');
  });

  it('detects language as string', () => {
    const info = detectBrowser();
    expect(typeof info.language).toBe('string');
  });

  it('languages is an array', () => {
    const info = detectBrowser();
    expect(Array.isArray(info.languages)).toBe(true);
  });

  it('device flags are booleans', () => {
    const info = detectBrowser();
    expect(typeof info.isMobile).toBe('boolean');
    expect(typeof info.isTablet).toBe('boolean');
    expect(typeof info.isLaptop).toBe('boolean');
  });
});

describe('detectFeatures', () => {
  it('returns FeatureSupport object', () => {
    const features = detectFeatures();

    expect(typeof features.es6).toBe('boolean');
    expect(typeof features.localStorage).toBe('boolean');
    expect(typeof features.intersectionObserver).toBe('boolean');
    expect(typeof features.crypto).toBe('boolean');
  });

  it('detects ES6 support in test env', () => {
    const features = detectFeatures();
    expect(features.es6).toBe(true);
  });
});

describe('generateCompatibilityReport', () => {
  it('returns report with all sections', () => {
    const report = generateCompatibilityReport();

    expect(report.browser).toBeDefined();
    expect(report.features).toBeDefined();
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(typeof report.score).toBe('number');
  });

  it('score is between 0 and 100', () => {
    const report = generateCompatibilityReport();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
