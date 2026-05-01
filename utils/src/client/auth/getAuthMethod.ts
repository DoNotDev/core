// packages/core/utils/src/client/auth/getAuthMethod.ts

/**
 * @fileoverview Auth Method Resolution
 * @description Resolves the authentication method (popup vs redirect) based on
 * explicit preference or environment detection.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AuthMethod } from '@donotdev/types';

import { isDev } from '../appConfig';

/**
 * Get auth method (single source of truth)
 * - If method is provided: use it
 * - If method is null/undefined: isDev() ? 'popup' : 'redirect'
 * @param method - Auth method ('popup' or 'redirect')
 * @returns 'popup' or 'redirect'
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAuthMethod(method?: AuthMethod | null): AuthMethod {
  return method || (isDev() ? 'popup' : 'redirect');
}
