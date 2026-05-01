// packages/core/utils/src/client/browserDetection.ts

import { isClient } from './platformDetection';

/**
 * @fileoverview Browser Detection and Compatibility Utilities
 * @description Comprehensive browser detection, feature support, and compatibility checking
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export type BrowserType =
  | 'chrome'
  | 'firefox'
  | 'safari'
  | 'edge'
  | 'opera'
  | 'ie'
  | 'unknown';

/**
 * Browser engine type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type BrowserEngine =
  | 'blink'
  | 'gecko'
  | 'webkit'
  | 'trident'
  | 'edgehtml'
  | 'unknown';

/**
 * Operating system type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type OS = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

/**
 * Browser information interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BrowserInfo {
  type: BrowserType;
  version: string;
  engine: BrowserEngine;
  os: OS;
  isMobile: boolean;
  isTablet: boolean;
  isLaptop: boolean;
  userAgent: string;
  language: string;
  languages: string[];
  cookieEnabled: boolean;
  onLine: boolean;
  doNotTrack: boolean;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  deviceMemory?: number;
  connection?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

/**
 * Feature support interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FeatureSupport {
  // Modern JavaScript features
  es6: boolean;
  es2017: boolean;
  es2020: boolean;
  modules: boolean;
  dynamicImport: boolean;

  // Web APIs
  webWorkers: boolean;
  serviceWorkers: boolean;
  pushNotifications: boolean;
  geolocation: boolean;
  webRTC: boolean;
  webGL: boolean;
  webGL2: boolean;

  // Storage APIs
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;

  // Media APIs
  webAudio: boolean;
  webVideo: boolean;
  getUserMedia: boolean;

  // CSS features
  cssGrid: boolean;
  cssFlexbox: boolean;
  cssCustomProperties: boolean;
  cssContainerQueries: boolean;

  // Image formats
  webp: boolean;
  avif: boolean;
  webpLossless: boolean;
  webpAnimation: boolean;

  // Modern web features
  intersectionObserver: boolean;
  resizeObserver: boolean;
  mutationObserver: boolean;
  performanceObserver: boolean;

  // PWA features
  manifest: boolean;
  beforeInstallPrompt: boolean;
  standalone: boolean;

  // Security features
  crypto: boolean;
  subtleCrypto: boolean;
  secureContext: boolean;
}

/**
 * Compatibility report interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CompatibilityReport {
  browser: BrowserInfo;
  features: FeatureSupport;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  score: number; // 0-100
}

/**
 * Detect browser information from user agent and navigator
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return getFallbackBrowserInfo();
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;

  // Browser detection
  let type: BrowserType = 'unknown';
  let version = '';
  let engine: BrowserEngine = 'unknown';

  // Chrome/Chromium
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    type = 'chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match?.[1] || '';
    engine = 'blink';
  }
  // Edge (Chromium-based)
  else if (userAgent.includes('Edg')) {
    type = 'edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match?.[1] || '';
    engine = 'blink';
  }
  // Firefox
  else if (userAgent.includes('Firefox')) {
    type = 'firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match?.[1] || '';
    engine = 'gecko';
  }
  // Safari
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    type = 'safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match?.[1] || '';
    engine = 'webkit';
  }
  // Opera
  else if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
    type = 'opera';
    const match = userAgent.match(/(?:OPR|Opera)\/(\d+)/);
    version = match?.[1] || '';
    engine = 'blink';
  }
  // Internet Explorer
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
    type = 'ie';
    const match = userAgent.match(/(?:MSIE |rv:)(\d+)/);
    version = match?.[1] || '';
    engine = 'trident';
  }

  // OS detection
  let os: OS = 'unknown';
  if (userAgent.includes('Windows')) {
    os = 'windows';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macos';
  } else if (userAgent.includes('Linux')) {
    os = 'linux';
  } else if (userAgent.includes('Android')) {
    os = 'android';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'ios';
  }

  // Device type detection
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );
  const isTablet = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(
    userAgent
  );
  const isLaptop = !isMobile && !isTablet;

  return {
    type,
    version,
    engine,
    os,
    isMobile,
    isTablet,
    isLaptop,
    userAgent,
    language: navigator.language || 'en',
    languages: Array.from(navigator.languages || ['en']),
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    doNotTrack: navigator.doNotTrack === '1',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    deviceMemory: (navigator as any).deviceMemory,
    connection: (navigator as any).connection
      ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
        }
      : undefined,
  };
}

/**
 * Detect feature support
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function detectFeatures(): FeatureSupport {
  if (!isClient()) {
    return getFallbackFeatureSupport();
  }

  const features: FeatureSupport = {
    // Modern JavaScript features
    es6: typeof Symbol !== 'undefined' && typeof Map !== 'undefined',
    es2017: typeof Object.entries === 'function',
    es2020: typeof BigInt !== 'undefined',
    modules: true, // ES modules are supported in modern environments
    dynamicImport: true, // Dynamic import is supported in modern environments

    // Web APIs
    webWorkers: typeof Worker !== 'undefined',
    serviceWorkers: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window,
    geolocation: 'geolocation' in navigator,
    webRTC: typeof RTCPeerConnection !== 'undefined',
    webGL: typeof WebGLRenderingContext !== 'undefined',
    webGL2: typeof WebGL2RenderingContext !== 'undefined',

    // Storage APIs
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',

    // Media APIs
    webAudio: typeof AudioContext !== 'undefined',
    webVideo: typeof HTMLVideoElement !== 'undefined',
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',

    // CSS features
    cssGrid: CSS.supports('display', 'grid'),
    cssFlexbox: CSS.supports('display', 'flex'),
    cssCustomProperties: CSS.supports('--custom-property', 'value'),
    cssContainerQueries: CSS.supports('container-type', 'inline-size'),

    // Image formats
    webp: testImageFormat('webp'),
    avif: testImageFormat('avif'),
    webpLossless: testImageFormat('webp', 'lossless'),
    webpAnimation: testImageFormat('webp', 'animation'),

    // Modern web features
    intersectionObserver: typeof IntersectionObserver !== 'undefined',
    resizeObserver: typeof ResizeObserver !== 'undefined',
    mutationObserver: typeof MutationObserver !== 'undefined',
    performanceObserver: typeof PerformanceObserver !== 'undefined',

    // PWA features
    manifest: 'manifest' in document.createElement('link'),
    beforeInstallPrompt: 'onbeforeinstallprompt' in window,
    standalone: window.matchMedia('(display-mode: standalone)').matches,

    // Security features
    crypto: typeof crypto !== 'undefined',
    subtleCrypto: typeof crypto?.subtle !== 'undefined',
    secureContext: window.isSecureContext,
  };

  return features;
}

/**
 * Generate compatibility report
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function generateCompatibilityReport(): CompatibilityReport {
  const browser = detectBrowser();
  const features = detectFeatures();

  const issues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for critical issues
  if (!features.es6) {
    issues.push('ES6 support required for modern JavaScript features');
  }

  if (!features.localStorage) {
    issues.push('LocalStorage required for data persistence');
  }

  if (!features.cssFlexbox) {
    issues.push('CSS Flexbox required for layout');
  }

  // Check for warnings
  if (browser.type === 'ie') {
    warnings.push(
      'Internet Explorer is deprecated and may have compatibility issues'
    );
  }

  if (!features.serviceWorkers) {
    warnings.push('Service Workers not supported - PWA features limited');
  }

  if (!features.webp) {
    warnings.push('WebP not supported - using fallback image formats');
  }

  // Generate recommendations
  if (browser.type === 'unknown') {
    recommendations.push('Consider updating to a modern browser');
  }

  if (!features.secureContext) {
    recommendations.push('Use HTTPS for secure features');
  }

  if (!features.intersectionObserver) {
    recommendations.push(
      'Consider polyfilling IntersectionObserver for performance'
    );
  }

  // Calculate compatibility score
  const criticalFeatures = [
    features.es6,
    features.localStorage,
    features.cssFlexbox,
    features.cssCustomProperties,
  ];

  const importantFeatures = [
    features.serviceWorkers,
    features.webp,
    features.intersectionObserver,
    features.secureContext,
  ];

  const criticalScore =
    (criticalFeatures.filter(Boolean).length / criticalFeatures.length) * 60;
  const importantScore =
    (importantFeatures.filter(Boolean).length / importantFeatures.length) * 40;
  const score = Math.round(criticalScore + importantScore);

  return {
    browser,
    features,
    issues,
    warnings,
    recommendations,
    score,
  };
}

/**
 * Test image format support
 */
function testImageFormat(format: string, variant?: string): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    let mimeType = `image/${format}`;
    if (variant) {
      mimeType += `;${variant}`;
    }

    const dataURL = canvas.toDataURL(mimeType);
    return dataURL.indexOf(`data:image/${format}`) === 0;
  } catch {
    return false;
  }
}

/**
 * Get fallback browser info for SSR
 */
function getFallbackBrowserInfo(): BrowserInfo {
  return {
    type: 'unknown',
    version: '',
    engine: 'unknown',
    os: 'unknown',
    isMobile: false,
    isTablet: false,
    isLaptop: true,
    userAgent: '',
    language: 'en',
    languages: ['en'],
    cookieEnabled: false,
    onLine: false,
    doNotTrack: false,
    hardwareConcurrency: 0,
    maxTouchPoints: 0,
  };
}

/**
 * Get fallback feature support for SSR
 */
function getFallbackFeatureSupport(): FeatureSupport {
  return {
    es6: false,
    es2017: false,
    es2020: false,
    modules: false,
    dynamicImport: false,
    webWorkers: false,
    serviceWorkers: false,
    pushNotifications: false,
    geolocation: false,
    webRTC: false,
    webGL: false,
    webGL2: false,
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
    webAudio: false,
    webVideo: false,
    getUserMedia: false,
    cssGrid: false,
    cssFlexbox: false,
    cssCustomProperties: false,
    cssContainerQueries: false,
    webp: false,
    avif: false,
    webpLossless: false,
    webpAnimation: false,
    intersectionObserver: false,
    resizeObserver: false,
    mutationObserver: false,
    performanceObserver: false,
    manifest: false,
    beforeInstallPrompt: false,
    standalone: false,
    crypto: false,
    subtleCrypto: false,
    secureContext: false,
  };
}

/**
 * Check if browser supports a specific feature
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function supportsFeature(feature: keyof FeatureSupport): boolean {
  const features = detectFeatures();
  return features[feature];
}

/**
 * Get browser recommendations
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getBrowserRecommendations(): string[] {
  const browser = detectBrowser();
  const features = detectFeatures();

  const recommendations: string[] = [];

  switch (browser.type) {
    case 'chrome':
      if (parseInt(browser.version) < 80) {
        recommendations.push(
          'Consider updating Chrome for better performance and security'
        );
      }
      break;

    case 'firefox':
      if (parseInt(browser.version) < 75) {
        recommendations.push(
          'Consider updating Firefox for better performance and security'
        );
      }
      break;

    case 'safari':
      if (parseInt(browser.version) < 13) {
        recommendations.push(
          'Consider updating Safari for better performance and security'
        );
      }
      break;

    case 'edge':
      if (parseInt(browser.version) < 80) {
        recommendations.push(
          'Consider updating Edge for better performance and security'
        );
      }
      break;

    case 'ie':
      recommendations.push(
        'Internet Explorer is deprecated. Consider using a modern browser'
      );
      break;

    case 'unknown':
      recommendations.push(
        'Browser not detected. Consider using a modern browser'
      );
      break;
  }

  if (!features.secureContext) {
    recommendations.push(
      'Use HTTPS for secure features and better performance'
    );
  }

  return recommendations;
}
