// packages/core/hooks/src/providers/AppConfigProvider.tsx

/**
 * @fileoverview AppConfigProvider
 * @description Centralized configuration provider with smart defaults and platform awareness
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createContext, useContext } from 'react';

import type {
  AppConfig,
  AppMetadata,
  AuthConfig,
  SEOConfig,
  FaviconConfig,
  FeaturesConfig,
  Platform,
  DndevFrameworkConfig,
  ThemeMode,
  LayoutPreset,
} from '@donotdev/types';
import { PLATFORMS, LAYOUT_PRESET } from '@donotdev/types';
import {
  isDev,
  isClient,
  resolveAppConfig,
  getPlatformEnvVar,
} from '@donotdev/utils';

import type { ReactNode } from 'react';

/**
 * Default authentication configuration
 */
const DEFAULT_AUTH: AuthConfig = {
  authRoute: '/',
  roleRoute: '/404',
  tierRoute: '/404',
};

/**
 * Default features configuration
 */
const DEFAULT_FEATURES: FeaturesConfig = {
  debug: false,
};

/**
 * Default app name constant
 */
const DEFAULT_APP_NAME = 'DoNotDev App';

/**
 * Default SEO configuration
 */
const DEFAULT_SEO: SEOConfig = {
  enabled: true,
  defaultNamespace: 'home',
  defaultImage: '/logo.svg',
};

/**
 * Base favicon configuration (appName is set dynamically)
 */
const DEFAULT_FAVICON_BASE: Omit<FaviconConfig, 'appName'> = {
  enabled: true,
  themeColor: '#2563eb',
  backgroundColor: '#ffffff',
  includeManifestIcons: true,
  includeMSIcons: false,
};

/**
 * Deep merge helper for configuration objects
 * Priority: target < ...sources (later sources override earlier ones)
 * Merges nested plain objects, preserves arrays/primitives
 */
function simpleMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  const result = { ...target } as Record<string, any>;

  for (const source of sources) {
    if (!source) continue;

    for (const key in source) {
      const sourceValue = source[key];
      if (sourceValue === undefined) continue;

      const targetValue = result[key];

      // Deep merge plain objects
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = { ...targetValue, ...sourceValue };
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}

/**
 * Application configuration context
 * @internal - Use `useAppConfig()` hook instead of accessing context directly
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const AppConfigContext = createContext<AppConfig | null>(null);

/**
 * App config provider props interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AppConfigProviderProps {
  /** User-provided configuration (merged with smart defaults) */
  config?: AppConfig;
  /** Platform for platform-specific defaults */
  platform?: Platform;
  /** Child components */
  children: ReactNode;
}

/**
 * AppConfigProvider
 *
 * Centralized configuration provider with smart defaults and platform awareness.
 * Handles all configuration merging in one place - no prop drilling needed.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * @example
 * ```tsx
 * // Minimal - uses all defaults
 * <AppConfigProvider platform="vite">
 *   <App />
 * </AppConfigProvider>
 *
 * // Partial override
 * <AppConfigProvider
 *   config={{ app: { name: 'My App' } }}
 *   platform="vite"
 * >
 *   <App />
 * </AppConfigProvider>
 * ```
 */
export function AppConfigProvider({
  config = {},
  platform = PLATFORMS.VITE,
  children,
}: AppConfigProviderProps) {
  // Resolve app metadata (single source of truth - handles name/shortName/description/links/metadata)
  const resolvedApp = resolveAppConfig(config.app);

  // Logo path is /logo.svg (user must provide, or copy from packages/ui/assets/logo.svg)
  const defaultLogoPath = '/logo.svg';

  // Resolve app URL at runtime from env var (platform-aware)
  // Development: use window.location.origin (CSR) or fallback to localhost:3000 (SSR)
  // Production: use VITE_APP_URL/NEXT_PUBLIC_APP_URL from .env files
  let resolvedAppUrl: string;
  if (isDev()) {
    // Development: use actual browser origin if available (CSR), otherwise fallback
    resolvedAppUrl =
      isClient() && typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
  } else {
    // Production: use env var (single source of truth)
    resolvedAppUrl = getPlatformEnvVar('APP_URL') || '';
  }

  // Default SEO (use logo as default OG image)
  const defaultSeo: SEOConfig = {
    ...DEFAULT_SEO,
    defaultImage: defaultLogoPath, // Override with resolved path
  };

  // Default app metadata with defaults (single source of truth for defaults)
  // Note: footer is special - null = hide, undefined = use defaults
  // Note: URL is NOT part of AppMetadata - use getPlatformEnvVar('APP_URL') directly
  const defaultAppMetadata: Required<Omit<AppMetadata, 'footer'>> & {
    footer?: AppMetadata['footer'];
  } = {
    name: resolvedApp.name || DEFAULT_APP_NAME,
    shortName: resolvedApp.shortName || resolvedApp.name || DEFAULT_APP_NAME,
    description: resolvedApp.description || '',
    links: resolvedApp.links || {},
    footer: config.app?.footer ?? undefined,
    metadata: resolvedApp.metadata || {},
  };

  // Default favicon
  const defaultFavicon: FaviconConfig = {
    ...DEFAULT_FAVICON_BASE,
    appName: defaultAppMetadata.name, // Use resolved name
  };

  // Build-in defaults (lowest priority)
  const builtInDefaults: AppConfig = {
    // App metadata with all defaults merged (single source of truth)
    app: defaultAppMetadata,

    // Auth - merge partial user config with full defaults
    auth: {
      ...DEFAULT_AUTH,
      ...config.auth,
    } as AuthConfig,

    // SEO - false to disable, otherwise merge
    seo:
      config.seo === false
        ? false
        : {
            ...defaultSeo,
            ...(typeof config.seo === 'object' ? config.seo : {}),
          },

    // Favicon - false to disable, otherwise merge
    favicon:
      config.favicon === false
        ? false
        : {
            ...defaultFavicon,
            ...(typeof config.favicon === 'object' ? config.favicon : {}),
          },

    // Preset - pass through as-is (string | undefined), themeStore will validate
    preset: config.preset,

    // Features - merge with defaults
    features: {
      ...DEFAULT_FEATURES,
      ...config.features,
    },
  };

  // Read all configuration sources
  const frameworkConfig = (globalThis as Record<string, any>)._DNDEV_CONFIG_ as
    | DndevFrameworkConfig
    | undefined;

  const localStorageOverrides: any = {};
  if (isClient()) {
    // Theme
    const savedTheme = localStorage.getItem('dndev-theme');
    if (savedTheme) {
      localStorageOverrides.theme = { mode: savedTheme as ThemeMode };
    }

    // Locale
    const savedLocale = localStorage.getItem('dndev-locale');
    if (savedLocale) {
      localStorageOverrides.locale = { default: savedLocale };
    }

    // Add other localStorage keys your stores use
    // DO NOT read cookies here - that's platform-specific, handled by initializers
  }

  // Merge with priority: localStorage > config > globalThis > defaults
  const mergedConfig: AppConfig = simpleMerge(
    builtInDefaults,
    frameworkConfig as Partial<AppConfig>,
    config,
    localStorageOverrides
  );

  return (
    <AppConfigContext.Provider value={mergedConfig}>
      {children}
    </AppConfigContext.Provider>
  );
}

/**
 * useAppConfig hook
 *
 * Access the complete application configuration or a specific property.
 *
 * @example
 * ```tsx
 * // Get full config
 * const config = useAppConfig();
 * console.log(config.app?.name);
 *
 * // Get app metadata object
 * const app = useAppConfig('app');
 *
 * // Get specific property (shorthand)
 * const url = useAppConfig('url');
 * const name = useAppConfig('name');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useAppConfig(): AppConfig;
export function useAppConfig(key: 'app'): AppMetadata | undefined;
export function useAppConfig(key: 'name' | 'shortName' | 'description'): string;
export function useAppConfig(
  key?: 'app' | 'name' | 'shortName' | 'description'
): AppConfig | AppMetadata | string | undefined {
  const context = useContext(AppConfigContext);
  const defaultConfig: AppConfig = {
    app: {
      name: DEFAULT_APP_NAME,
      shortName: DEFAULT_APP_NAME,
      description: '',
      links: {},
      metadata: {},
    },
    auth: DEFAULT_AUTH,
    seo: DEFAULT_SEO,
    favicon: {
      ...DEFAULT_FAVICON_BASE,
      appName: DEFAULT_APP_NAME,
    },
    // preset omitted - themeStore handles default
    features: DEFAULT_FEATURES,
  };

  const config = context || defaultConfig;

  // If key is provided, return the specific property
  if (key === 'app') {
    return config.app;
  }
  if (key) {
    return config.app?.[key] || '';
  }

  // Otherwise return full config
  return config;
}

/**
 * useAuthConfig hook
 *
 * Access authentication routes with defaults.
 *
 * @example
 * ```tsx
 * const auth = useAuthConfig();
 * navigate(auth.authRoute); // Always has default
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useAuthConfig(): AuthConfig {
  const config = useAppConfig();
  // Provider guarantees auth is merged with defaults
  return config.auth as AuthConfig;
}

/**
 * useSeoConfig hook
 *
 * Access SEO configuration.
 *
 * @example
 * ```tsx
 * const seo = useSeoConfig();
 * if (!seo) return null; // Disabled
 * return <meta property="og:image" content={seo.defaultImage} />;
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useSeoConfig(): SEOConfig | false | undefined {
  const config = useAppConfig();
  return config.seo;
}

/**
 * useFaviconConfig hook
 *
 * Access favicon configuration.
 *
 * @example
 * ```tsx
 * const favicon = useFaviconConfig();
 * if (!favicon) return null;
 * return <meta name="theme-color" content={favicon.themeColor} />;
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useFaviconConfig(): FaviconConfig | false | undefined {
  const config = useAppConfig();
  return config.favicon;
}

/**
 * useFeaturesConfig hook
 *
 * Access feature flags with defaults.
 *
 * @example
 * ```tsx
 * const features = useFeaturesConfig();
 * if (features.debug) return <DebugTools />;
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useFeaturesConfig(): FeaturesConfig {
  const config = useAppConfig();
  return config.features!; // Always defined after merge
}
