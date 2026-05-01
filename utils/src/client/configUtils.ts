// packages/core/utils/src/client/configUtils.ts

/**
 * @fileoverview Config Utilities
 * @description Low-level config access utilities (no platform dependencies)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { DndevFrameworkConfig } from '@donotdev/types';

/**
 * Get DnDev config data synchronously
 *
 * Data is populated at build time and immediately available at runtime.
 * No async needed - config is always there when the app starts.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getDndevConfig(): DndevFrameworkConfig | null {
  if (typeof globalThis !== 'undefined' && globalThis._DNDEV_CONFIG_) {
    return globalThis._DNDEV_CONFIG_;
  }
  return null;
}
