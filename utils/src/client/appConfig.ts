// packages/core/utils/src/client/appConfig.ts

/**
 * @fileoverview Centralized app configuration utilities
 * @description Handles app name, URLs, and other configuration with proper fallbacks
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AppMetadata } from '@donotdev/types';

import { getDndevConfig } from './configAccess';
import { detectPlatform, isVite, isNextJs } from './platformDetection';

/**
 * Trim quotes from environment variable values
 * Handles both single and double quotes that developers often add in .env files
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param value - Raw environment variable value
 * @returns Cleaned value without surrounding quotes
 */
function trimQuotes(value: string | undefined): string | undefined {
  if (!value) return value;

  // Remove surrounding quotes (both single and double)
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * Get Vite environment variable
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getViteEnvVar(name: string): string | undefined {
  // Try virtual:env module first (allows dynamic access via bracket notation)
  // The virtual:env module exports an env object with all VITE_* vars at build time
  let rawValue: string | undefined;

  // Access via getDndevConfig() (same pattern as other config access in framework)
  const config = getDndevConfig();
  if (config?.env && typeof config.env === 'object') {
    rawValue = config.env[name];
  }

  // Fallback to import.meta.env for direct property access (static replacement)
  // This works for known vars but bracket notation doesn't work in production
  if (rawValue === undefined && typeof import.meta !== 'undefined') {
    // @ts-ignore - import.meta.env available in Vite, guarded at runtime
    if (import.meta.env) {
      // Try direct property access (Vite static replacement)
      // This only works for vars that are statically referenced in the code
      // @ts-ignore
      rawValue = (import.meta.env as unknown as Record<string, string>)[name];
    }
  }

  return trimQuotes(rawValue);
}

/**
 * Get Next.js environment variable
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getNextEnvVar(name: string): string | undefined {
  // Try getDndevConfig() first (same pattern as Vite for consistency)
  // This allows access to env vars injected via _DNDEV_CONFIG_
  const config = getDndevConfig();
  let rawValue: string | undefined;
  if (config?.env && typeof config.env === 'object') {
    rawValue = config.env[name];
  }

  // Fallback to process.env (Next.js exposes NEXT_PUBLIC_* vars here)
  if (rawValue === undefined && typeof process !== 'undefined' && process.env) {
    rawValue = process.env[name];
  }

  return trimQuotes(rawValue);
}

/**
 * Platform-agnostic environment variable access
 * Handles both Vite (VITE_) and Next.js (NEXT_PUBLIC_) naming conventions
 *
 * Forgiving API: Accepts both prefixed and unprefixed names
 * - 'VITE_APP_VERSION' or 'APP_VERSION' both work for Vite
 * - 'NEXT_PUBLIC_APP_URL' or 'APP_URL' both work for Next.js
 *
 * @version 0.1.0
 * @author AMBROISE PARK Consulting
 * @param baseName - The environment variable name (with or without prefix, e.g., 'COMPANY_NAME' or 'VITE_COMPANY_NAME')
 * @returns The value or undefined if not found
 */
export function getPlatformEnvVar(
  baseName: string,
  platform?: import('@donotdev/types').Platform
): string | undefined {
  // Special case: Environment mode vars (Vite built-ins mapped to Next.js equivalents)
  // Vite: MODE, DEV, PROD, SSR (built-in, no prefix)
  // Next.js: NODE_ENV only
  if (
    baseName === 'NODE_ENV' ||
    baseName === 'VITE_NODE_ENV' ||
    baseName === 'NEXT_PUBLIC_NODE_ENV' ||
    baseName === 'MODE' ||
    baseName === 'DEV' ||
    baseName === 'PROD'
  ) {
    // For Vite, use _DNDEV_CONFIG_.env.MODE (populated by virtual:env)
    const config = getDndevConfig();
    if (config?.env?.MODE) {
      // Map to appropriate value
      if (baseName === 'DEV')
        return config.env.MODE === 'development' ? 'true' : 'false';
      if (baseName === 'PROD')
        return config.env.MODE === 'production' ? 'true' : 'false';
      return config.env.MODE;
    }
    // Fallback to import.meta.env for Vite
    // @ts-ignore - import.meta.env available in Vite, guarded at runtime
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const env = (import.meta as any).env;
      // @ts-ignore
      if (baseName === 'MODE' && env.MODE) return env.MODE;
      // @ts-ignore
      if (baseName === 'DEV') return env.DEV ? 'true' : 'false';
      // @ts-ignore
      if (baseName === 'PROD') return env.PROD ? 'true' : 'false';
    }
    // For Next.js, use process.env.NODE_ENV
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      const nodeEnv = process.env.NODE_ENV;
      if (baseName === 'DEV')
        return nodeEnv === 'development' ? 'true' : 'false';
      if (baseName === 'PROD')
        return nodeEnv === 'production' ? 'true' : 'false';
      if (baseName === 'MODE') return nodeEnv;
      return nodeEnv;
    }
    // Default fallback
    if (baseName === 'DEV') return 'true';
    if (baseName === 'PROD') return 'false';
    return 'development';
  }

  // Use provided platform if available, otherwise detect
  // Check config first (source of truth), then fall back to detection
  const configPlatform = getDndevConfig()?.platform;
  const resolvedPlatform: import('@donotdev/types').Platform =
    platform ||
    configPlatform ||
    (isVite() ? 'vite' : isNextJs() ? 'nextjs' : detectPlatform());

  // Normalize the name: if it already has a prefix, use it as-is; otherwise add the platform prefix
  // Special Vite variables (MODE, DEV, PROD, SSR) don't have VITE_ prefix
  const viteBuiltInVars = ['MODE', 'DEV', 'PROD', 'SSR'];
  let envKey: string;
  if (resolvedPlatform === 'vite') {
    // Special Vite built-in vars don't need VITE_ prefix
    if (viteBuiltInVars.includes(baseName)) {
      envKey = baseName;
    } else if (baseName.startsWith('VITE_')) {
      // If already has VITE_ prefix, use as-is
      envKey = baseName;
    } else {
      // Otherwise add VITE_ prefix
      envKey = `VITE_${baseName}`;
    }
  } else if (resolvedPlatform === 'nextjs') {
    // If already has NEXT_PUBLIC_ prefix, use as-is; otherwise add it
    if (baseName.startsWith('NEXT_PUBLIC_')) {
      envKey = baseName;
    } else {
      envKey = `NEXT_PUBLIC_${baseName}`;
    }
  } else {
    // Unknown platform, use as-is
    envKey = baseName;
  }

  // Platform-aware lookup
  if (resolvedPlatform === 'vite') {
    return getViteEnvVar(envKey);
  } else if (resolvedPlatform === 'nextjs') {
    return getNextEnvVar(envKey);
  } else {
    return undefined;
  }
}

/**
 * Get the OAuth redirect URL used by the framework.
 *
 * Single source of truth for OAuth callback endpoint construction.
 * Reads from VITE_APP_URL/NEXT_PUBLIC_APP_URL env var (set at build time from appConfig.app.url).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param baseUrl - Optional base URL. If not provided, reads from env var (set from appConfig.app.url at build time).
 * @returns Absolute OAuth redirect URL (e.g., 'https://example.com/oauth/callback')
 */
export function getOAuthRedirectUrl(baseUrl?: string): string {
  const url =
    baseUrl || getPlatformEnvVar('APP_URL') || 'http://localhost:3000';
  const normalized = url.trim().replace(/\/+$/, '');
  return `${normalized}/oauth/callback`;
}

/**
 * Get Firebase Auth domain (host only)
 *
 * Firebase Console always returns `projectId.firebaseapp.com` in SDK config,
 * but for custom domains in production, we need `yourdomain.com`.
 *
 * Logic:
 * - If APP_URL is set and not localhost → use APP_URL hostname (production custom domain)
 * - Otherwise → use FIREBASE_AUTH_DOMAIN (localhost/dev uses Firebase default)
 *
 * - Normalizes by stripping protocol and trailing slashes
 * - Lowercases the host
 * - No memoization; computed on each call similar to isDev()
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAuthDomain(): string {
  // Check APP_URL first - if it's set and not localhost, use it for production custom domains
  const appUrl = getPlatformEnvVar('APP_URL');
  if (appUrl) {
    const appUrlHost = appUrl
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    // Extract hostname (remove port if present)
    const hostname = appUrlHost.split(':')[0];
    // If not localhost, use APP_URL hostname (custom domain)
    if (
      hostname &&
      hostname !== 'localhost' &&
      !hostname.startsWith('127.0.0.1')
    ) {
      return hostname;
    }
  }

  // Fallback to FIREBASE_AUTH_DOMAIN (for localhost/dev)
  const raw = getPlatformEnvVar('FIREBASE_AUTH_DOMAIN');
  if (!raw) {
    throw new Error(
      '[appConfig] Missing FIREBASE_AUTH_DOMAIN. Set VITE_FIREBASE_AUTH_DOMAIN/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.'
    );
  }
  const trimmed = raw.trim();
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const withoutSlash = withoutProtocol.replace(/\/+$/, '');
  return withoutSlash.toLowerCase();
}

/**
 * Platform-agnostic development mode check
 * Uses framework's environment access to work in Vite, Next.js, SSR/CSR.
 *
 * Precedence:
 * 1) Vite's import.meta.env.DEV (true when command === 'serve', regardless of mode)
 * 2) Vite's import.meta.env.MODE !== 'production' (handles custom modes like 'test')
 * 3) APP_ENV (framework-level)
 * 4) NODE_ENV (platform-level)
 * Defaults to 'development' when unknown.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isDev(): boolean {
  // Check Vite's DEV flag (true only when running vite dev server)
  // @ts-ignore - import.meta.env available in Vite, guarded at runtime
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env.DEV === true;
  }

  const appEnv = getPlatformEnvVar('APP_ENV');
  const nodeEnv = getPlatformEnvVar('NODE_ENV');
  const env = (appEnv || nodeEnv || 'development').toLowerCase();
  return env === 'development';
}

/**
 * Get the application short name with proper fallback
 * Priority: app.shortName prop → app.name prop → default fallback
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param appConfig - Optional app metadata object
 * @param fallback - Default fallback value (default: 'App')
 * @returns The resolved app short name
 */
export function getAppShortName(
  appConfig?: AppMetadata,
  fallback = 'App'
): string {
  return appConfig?.shortName || appConfig?.name || fallback;
}

/**
 * Resolve complete app metadata with all fallbacks
 *
 * @version 0.1.0
 * @author AMBROISE PARK Consulting
 * @param appConfig - Optional app metadata object
 * @returns Complete resolved app metadata
 */
export function resolveAppConfig(
  appConfig?: AppMetadata
): Required<Omit<AppMetadata, 'footer'>> & { footer?: AppMetadata['footer'] } {
  return {
    name: appConfig?.name || '',
    shortName: appConfig?.shortName || appConfig?.name || '',
    description: appConfig?.description || '',
    links: appConfig?.links || {},
    footer: appConfig?.footer,
    metadata: appConfig?.metadata || {},
  };
}
