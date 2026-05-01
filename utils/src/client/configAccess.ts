// packages/core/utils/src/client/configAccess.ts

/**
 * @fileoverview Cross-platform config access utilities
 * @description Provides unified access to DnDev config data across Vite and Next.js platforms
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  DndevFrameworkConfig,
  I18nPluginConfig,
  ThemesPluginConfig,
} from '@donotdev/types';

import { getDndevConfig } from './configUtils';
import {
  detectPlatform,
  detectPlatformInfo,
  isClient,
} from './platformDetection';

// Re-export for backward compatibility
export { getDndevConfig };

/**
 * Get specific config section
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getConfigSection<T>(
  section: keyof DndevFrameworkConfig
): T | null {
  const config = getDndevConfig();
  return (config?.[section] as T) || null;
}

/**
 * Get themes configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getThemesConfig(): ThemesPluginConfig | null {
  return getConfigSection<ThemesPluginConfig>('themes');
}

/**
 * Get i18n configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getI18nConfig(): I18nPluginConfig | null {
  return getConfigSection<I18nPluginConfig>('i18n');
}

/**
 * Get routes configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getRoutesConfig() {
  return getConfigSection('routes');
}

/**
 * Get assets configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAssetsConfig() {
  return getConfigSection('assets');
}

/**
 * Check if config is available
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isConfigAvailable(): boolean {
  return getDndevConfig() !== null;
}

/**
 * Get config source information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getConfigSource(): {
  platform: string;
  source: string;
  available: boolean;
} {
  const platformInfo = detectPlatformInfo();
  const config = getDndevConfig();

  if (config) {
    const source = 'globalThis._DNDEV_CONFIG_';

    return {
      platform: platformInfo.platform,
      source,
      available: true,
    };
  }

  return {
    platform: platformInfo.platform,
    source: 'not available',
    available: false,
  };
}

/**
 * Initialize config if not available (fallback only)
 * Config should be populated at build time - this is just a safety net
 */
export function initializeConfig(): DndevFrameworkConfig | null {
  const existing = getDndevConfig();
  if (existing) return existing;

  const platform = detectPlatform();
  const config: DndevFrameworkConfig = {
    platform,
    mode:
      typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
        ? 'production'
        : 'development',
    version: '1.0.0',
    context: isClient() ? 'client' : 'server',
    timestamp: Date.now(),
  };

  if (typeof globalThis !== 'undefined') {
    globalThis._DNDEV_CONFIG_ = config;
  }

  return config;
}
