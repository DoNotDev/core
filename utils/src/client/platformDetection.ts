// packages/core/utils/src/client/platformDetection.ts

import type {
  DndevFrameworkConfig,
  Platform,
  EnvironmentMode,
  Context,
} from '@donotdev/types';
import {
  PLATFORMS,
  ENVIRONMENTS,
  CONTEXTS,
  CONFIDENCE_LEVELS,
} from '@donotdev/types';

import { getDndevConfig } from './configUtils';

/**
 * Platform information interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PlatformInfo {
  platform: Platform;
  version?: string;
  mode: EnvironmentMode;
  context: Context;
  metadata?: {
    nextjsRuntime?: string;
    viteHmrPort?: number;
    detectedAt?: number;
  };
}

interface DetectionStrategy {
  platform: Platform;
  confidence: number; // 0-1, higher = more confident
  context: PlatformInfo['context'];
  metadata?: PlatformInfo['metadata'];
}

let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * @fileoverview Platform detection utilities
 * @description Simple platform detection for Vite and Next.js
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Simple platform detection
 *
 * Detects the current platform (Vite or Next.js) and environment mode.
 * Provides cached results for performance.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function detectPlatform(): Platform {
  const info = detectPlatformInfo();
  return info.platform;
}

/**
 * Detailed platform detection with unified config integration
 * Cached after first call for optimal performance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function detectPlatformInfo(): PlatformInfo {
  if (cachedPlatformInfo) {
    return cachedPlatformInfo;
  }

  const config = getDndevConfig();
  if (config?.platform) {
    cachedPlatformInfo = {
      platform: config.platform,
      mode: config.mode,
      context: config.context,
      version: config.version,
      metadata: { detectedAt: config.timestamp },
    };
    return cachedPlatformInfo;
  }

  const strategies: DetectionStrategy[] = [];
  strategies.push(...getViteDetectionStrategies());
  strategies.push(...getNextjsDetectionStrategies());
  strategies.push(...getExpoDetectionStrategies());

  const bestStrategy = strategies.sort(
    (a, b) => b.confidence - a.confidence
  )[0];

  if (!bestStrategy || bestStrategy.confidence < CONFIDENCE_LEVELS.MINIMUM) {
    cachedPlatformInfo = {
      platform: PLATFORMS.UNKNOWN,
      mode: getEnvironmentMode(),
      context: getContext(),
      metadata: { detectedAt: Date.now() },
    };
    return cachedPlatformInfo;
  }

  cachedPlatformInfo = {
    platform: bestStrategy.platform,
    mode: getEnvironmentMode(),
    context: bestStrategy.context,
    version: getVersionInfo(bestStrategy.platform),
    metadata: {
      ...bestStrategy.metadata,
      detectedAt: Date.now(),
    },
  };

  return cachedPlatformInfo;
}

/**
 * Check if running on a specific platform
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param targetPlatform - Platform to check for
 * @returns True if running on the specified platform
 */
/**
 * Check if current platform matches target platform
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
/**
 * Check if current platform matches target
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isPlatform(targetPlatform: Platform): boolean {
  return detectPlatform() === targetPlatform;
}

// Cached platform flags (set after first successful detection)
let cachedIsVite: boolean | null = null;
let cachedIsNextJs: boolean | null = null;

/**
 * Check if running on Next.js platform
 * Checks config first (source of truth), then falls back to detection
 * Caches result after first successful detection
 *
 * Enhanced detection for SSR/client reliability:
 * - Checks Next.js environment variables (NEXT_RUNTIME)
 * - Checks Next.js globals (__NEXT_DATA__)
 * - Falls back to config and full platform detection
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running on Next.js
 */
export function isNextJs(): boolean {
  // Always check __NEXT_DATA__ first (most reliable, available after hydration)
  // Don't rely on cache if __NEXT_DATA__ becomes available later
  if (typeof globalThis !== 'undefined' && (globalThis as any).__NEXT_DATA__) {
    cachedIsNextJs = true;
    return true;
  }

  // Check NEXT_RUNTIME (server-side)
  if (typeof process !== 'undefined' && process.env?.NEXT_RUNTIME) {
    cachedIsNextJs = true;
    return true;
  }

  // If we have a cached true value, trust it
  if (cachedIsNextJs === true) {
    return true;
  }

  // Check config (source of truth) - this is set by importing dndev-config.js
  const config = getDndevConfig();
  if (config?.platform) {
    const isNext = config.platform === PLATFORMS.NEXTJS;
    // Only cache true values (don't cache false - __NEXT_DATA__ might appear later)
    if (isNext) {
      cachedIsNextJs = true;
    }
    return isNext;
  }

  // Fallback to full platform detection
  const detected = detectPlatform() === PLATFORMS.NEXTJS;
  // Only cache true values
  if (detected) {
    cachedIsNextJs = true;
  }
  return detected;
}

/**
 * Check if running on Vite platform
 * Checks config first (source of truth), then falls back to detection
 * Caches result after first successful detection
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running on Vite
 */
export function isVite(): boolean {
  if (cachedIsVite !== null) {
    return cachedIsVite;
  }

  const config = getDndevConfig();
  if (config?.platform) {
    cachedIsVite = config.platform === PLATFORMS.VITE;
    return cachedIsVite;
  }

  const detected = detectPlatform() === PLATFORMS.VITE;
  cachedIsVite = detected;
  return detected;
}

/**
 * Check if running in client context
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running in browser/client environment
 */
export function isClient(): boolean {
  // React Native has window but no DOM - check for document instead
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if running in test environment
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running in test environment (Jest, etc.)
 */
export function isTest(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    typeof (globalThis as any).JEST_WORKER_ID !== 'undefined'
  );
}

/**
 * Check if running in server context
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running in Node.js/server environment
 */
export function isServer(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

/**
 * Initialize platform detection and set unified config
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Framework configuration object with platform information
 */
export function initializePlatformDetection(): DndevFrameworkConfig {
  const info = detectPlatformInfo();

  const config: DndevFrameworkConfig = {
    platform: info.platform,
    mode: info.mode,
    version: info.version || '1.0.0',
    context: info.context,
    timestamp: Date.now(),
  };

  if (typeof globalThis !== 'undefined') {
    const existingConfig = getDndevConfig();
    globalThis._DNDEV_CONFIG_ = { ...existingConfig, ...config };
  }

  cachedPlatformInfo = null;
  return config;
}

// Internal Detection Functions

/**
 * Check if running on Expo platform
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running on Expo
 */
export function isExpo(): boolean {
  // Check for Expo Constants
  try {
    if (typeof globalThis !== 'undefined') {
      // Expo Constants available at runtime
      const expoGlobal = globalThis as typeof globalThis & {
        expo?: { Constants?: { expoConfig?: unknown } };
      };
      const Constants = expoGlobal.expo?.Constants;
      if (Constants?.expoConfig) {
        return true;
      }
    }
  } catch {
    // Not Expo
  }

  // Check config
  const config = getDndevConfig();
  if (config?.platform === PLATFORMS.EXPO) {
    return true;
  }

  return detectPlatform() === PLATFORMS.EXPO;
}

/**
 * Check if running on React Native platform
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns True if running on React Native
 */
export function isReactNative(): boolean {
  // Check for React Native Platform
  try {
    if (typeof globalThis !== 'undefined') {
      const rnGlobal = globalThis as typeof globalThis & {
        Platform?: { OS?: string };
      };
      const Platform = rnGlobal.Platform;
      if (Platform?.OS) {
        return true;
      }
    }
  } catch {
    // Not React Native
  }

  // Check config
  const config = getDndevConfig();
  if (
    config?.platform === PLATFORMS.REACT_NATIVE ||
    config?.platform === PLATFORMS.EXPO
  ) {
    return true;
  }

  const detected = detectPlatform();
  return detected === PLATFORMS.REACT_NATIVE || detected === PLATFORMS.EXPO;
}

function getViteDetectionStrategies(): DetectionStrategy[] {
  const strategies: DetectionStrategy[] = [];

  if (isClient()) {
    // Check for Vite HMR
    if (globalThis.__vite_plugin_react_preamble_installed__) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.HIGH,
        context: CONTEXTS.CLIENT,
        metadata: { viteHmrPort: globalThis.__vite_hmr_port },
      });
    }

    // Check for unified config indicating Vite
    const config = getDndevConfig();
    if (config?.platform === PLATFORMS.VITE) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.HIGH,
        context: CONTEXTS.CLIENT,
      });
    }

    // Check for i18n mapping in unified config (Vite pattern)
    if (config?.i18n?.mapping) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        context: CONTEXTS.CLIENT,
      });
    }

    // Check for import.meta.hot (Vite HMR)
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as any).import?.meta?.hot !== undefined
    ) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.LOW,
        context: CONTEXTS.CLIENT,
      });
    }
  }

  if (isServer()) {
    // Check for Vite environment variable
    if (process.env.VITE) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        context: CONTEXTS.SERVER,
      });
    }

    // Check for Vite in lifecycle event
    if (process.env.npm_lifecycle_event?.includes(PLATFORMS.VITE)) {
      strategies.push({
        platform: PLATFORMS.VITE,
        confidence: CONFIDENCE_LEVELS.LOW,
        context: CONTEXTS.BUILD,
      });
    }
  }

  return strategies;
}

function getNextjsDetectionStrategies(): DetectionStrategy[] {
  const strategies: DetectionStrategy[] = [];

  if (isServer()) {
    // Check for NextJS runtime
    if (process.env.NEXT_RUNTIME) {
      strategies.push({
        platform: PLATFORMS.NEXTJS,
        confidence: CONFIDENCE_LEVELS.HIGH,
        context: CONTEXTS.SERVER,
        metadata: { nextjsRuntime: process.env.NEXT_RUNTIME },
      });
    }

    // Check for NextJS internal environment variables
    if (process.env.__NEXT_PRIVATE_PREBUNDLED_REACT) {
      strategies.push({
        platform: PLATFORMS.NEXTJS,
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        context: CONTEXTS.SERVER,
      });
    }

    // Check for DNDev NextJS config
    if (process.env._DNDEV_CONFIG_) {
      strategies.push({
        platform: PLATFORMS.NEXTJS,
        confidence: CONFIDENCE_LEVELS.LOW,
        context: CONTEXTS.SERVER,
      });
    }
  }

  if (isClient()) {
    // Check for unified config indicating NextJS
    const config = getDndevConfig();
    if (config?.platform === PLATFORMS.NEXTJS) {
      strategies.push({
        platform: PLATFORMS.NEXTJS,
        confidence: CONFIDENCE_LEVELS.HIGH,
        context: CONTEXTS.CLIENT,
      });
    }

    // Check for NextJS router
    if (globalThis.__NEXT_DATA__) {
      strategies.push({
        platform: PLATFORMS.NEXTJS,
        confidence: CONFIDENCE_LEVELS.LOW,
        context: CONTEXTS.CLIENT,
      });
    }
  }

  return strategies;
}

function getExpoDetectionStrategies(): DetectionStrategy[] {
  const strategies: DetectionStrategy[] = [];

  // Check for Expo Constants
  try {
    if (typeof globalThis !== 'undefined') {
      const expoGlobal = globalThis as typeof globalThis & {
        expo?: { Constants?: { expoConfig?: unknown } };
      };
      const Constants = expoGlobal.expo?.Constants;
      if (Constants?.expoConfig) {
        strategies.push({
          platform: PLATFORMS.EXPO,
          confidence: CONFIDENCE_LEVELS.HIGH,
          context: CONTEXTS.CLIENT,
        });
      }
    }
  } catch {
    // Not Expo
  }

  // Check for React Native Platform
  try {
    if (typeof globalThis !== 'undefined') {
      const rnGlobal = globalThis as typeof globalThis & {
        Platform?: { OS?: string };
      };
      const Platform = rnGlobal.Platform;
      if (Platform?.OS && !isClient()) {
        // React Native but not Expo
        strategies.push({
          platform: PLATFORMS.REACT_NATIVE,
          confidence: CONFIDENCE_LEVELS.MEDIUM,
          context: CONTEXTS.CLIENT,
        });
      }
    }
  } catch {
    // Not React Native
  }

  // Check config
  const config = getDndevConfig();
  if (config?.platform === PLATFORMS.EXPO) {
    strategies.push({
      platform: PLATFORMS.EXPO,
      confidence: CONFIDENCE_LEVELS.HIGH,
      context: CONTEXTS.CLIENT,
    });
  } else if (config?.platform === PLATFORMS.REACT_NATIVE) {
    strategies.push({
      platform: PLATFORMS.REACT_NATIVE,
      confidence: CONFIDENCE_LEVELS.HIGH,
      context: CONTEXTS.CLIENT,
    });
  }

  return strategies;
}

function getEnvironmentMode(): EnvironmentMode {
  // Use proper environment detection via getPlatformEnvVar
  // Avoiding circular dependency by using inline implementation
  let mode: string | undefined;

  // Check import.meta.env.MODE (Vite)
  // @ts-ignore - import.meta.env available in Vite, guarded at runtime
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
    // @ts-ignore
    mode = import.meta.env.MODE;
  }
  // Check process.env.NODE_ENV (Next.js)
  else if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    mode = process.env.NODE_ENV;
  }

  if (mode === ENVIRONMENTS.PRODUCTION) return ENVIRONMENTS.PRODUCTION;
  if (mode === ENVIRONMENTS.TEST) return ENVIRONMENTS.TEST;
  return ENVIRONMENTS.DEVELOPMENT;
}

function getContext(): PlatformInfo['context'] {
  if (isClient()) return CONTEXTS.CLIENT;
  if (isServer()) {
    if (
      process.env.NODE_ENV === ENVIRONMENTS.PRODUCTION &&
      !process.env.NEXT_RUNTIME
    ) {
      return CONTEXTS.BUILD;
    }
    return CONTEXTS.SERVER;
  }
  return CONTEXTS.CLIENT; // fallback
}

function getVersionInfo(platform: Platform): string | undefined {
  if (typeof process === 'undefined') return undefined;

  // Simple, direct environment variable access - no recursion
  if (platform === PLATFORMS.VITE) {
    return (
      process.env.VITE_APP_VERSION ||
      process.env.VITE_VERSION ||
      process.env.APP_VERSION
    );
  }

  if (platform === PLATFORMS.NEXTJS) {
    return (
      process.env.NEXT_PUBLIC_APP_VERSION ||
      process.env.NEXT_PUBLIC_VERSION ||
      process.env.__NEXT_VERSION ||
      process.env.APP_VERSION
    );
  }

  // Fallback for unknown platform
  return (
    process.env.APP_VERSION ||
    process.env.VITE_APP_VERSION ||
    process.env.NEXT_PUBLIC_APP_VERSION
  );
}

/**
 * Debug platform detection
 * Development helper to log platform detection details
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function debugPlatformDetection(): void {
  if (getEnvironmentMode() !== 'development') return;

  const info = detectPlatformInfo();
  console.log('[PlatformDetection]', {
    platform: info.platform,
    mode: info.mode,
    context: info.context,
    version: info.version,
    metadata: info.metadata,
    unifiedConfig: getDndevConfig(),
  });
}
