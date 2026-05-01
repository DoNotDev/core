// packages/core/config/vite-env.d.ts

/**
 * @fileoverview Vite Environment Type Definitions
 * @description Augments ImportMetaEnv with custom VITE_* environment variables.
 * Base types (MODE, PROD, DEV) and ImportMeta interface are provided by vite/client.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Augment ImportMetaEnv with custom VITE_* environment variables
 * Base types (MODE, PROD, DEV) are provided by vite/client
 */
interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  // Firebase Configuration
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  // Firebase Emulator Configuration
  readonly VITE_USE_FIREBASE_EMULATOR: string;
  readonly VITE_FIREBASE_AUTH_EMULATOR_HOST: string;
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: string;

  // App Configuration
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_AUTHOR: string;

  // Authentication Configuration
  readonly VITE_AUTH_PARTNERS: string;

  // Additional app-specific vars (optional)
  readonly VITE_APP_ENV?: string;
  readonly VITE_MOCK_PAYMENTS?: string;
  readonly VITE_STRIPE_TEST_MODE?: string;
  readonly VITE_STRIPE_REPLAY_PRICE_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GITHUB_CLIENT_ID?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

/**
 * Augment ImportMeta with glob function
 * Vite's import.meta.glob for dynamic imports
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
  glob: (
    pattern: string | string[],
    options?: {
      eager?: boolean;
      import?: string;
      query?: string | Record<string, string | string[]>;
    }
  ) => Record<string, () => Promise<any>> | Record<string, any>;
}

// ============================================================================
// VITE VIRTUAL MODULE DECLARATIONS
// ============================================================================

declare module 'virtual:i18n-mapping' {
  export const I18N_CONFIG: Record<string, any>;
  export const LANGUAGES: string[];
  export const FALLBACK_LANGUAGE: string;
  export const EAGER_NAMESPACES: string[];
  export const mapping: Record<string, any>;
  export const languages: string[];
  export const eager: string[];
  export const fallback: string;
  export const manifest: Record<string, any>;
  export const config: Record<string, any>;
  export function getTranslation(
    namespace: string,
    language: string
  ): Promise<any>;
  export function getEagerTranslations(): Promise<Record<string, any>>;
  export function isEagerNamespace(namespace: string): boolean;
  export function getSupportedLanguages(): string[];
  export function getFallbackLanguage(): string;
  export function getInlineContent(namespace: string, language: string): any;
  export default Record<string, any>;
}

declare module 'virtual:routes' {
  export const routes: Array<{
    path: string;
    component: () => Promise<any>;
    auth: boolean | Record<string, any>;
    meta: Record<string, any>;
  }>;
  export const manifest: {
    totalRoutes: number;
    authRequired: number;
    publicRoutes: number;
    generatedAt: string;
  };
  export const source: string;
  type DefaultExport = {
    routes: Array<{
      path: string;
      component: () => Promise<any>;
      auth: boolean | Record<string, any>;
      meta: Record<string, any>;
    }>;
    manifest: {
      totalRoutes: number;
      authRequired: number;
      publicRoutes: number;
      generatedAt: string;
    };
    source: string;
  };
  const defaultExport: DefaultExport;
  export default defaultExport;
}

declare module 'virtual:themes' {
  export const THEMES: Array<Record<string, any>>;
  export const THEME_MANIFEST: Record<string, any>;
  export const THEME_COUNT: number;
  export const DEFAULT_THEME: string;
  export const themes: Array<Record<string, any>>;
  export const manifest: Record<string, any>;
  export const defaultName: string;
  export function getTheme(themeName: string): Record<string, any> | null;
  export function getDefaultTheme(): Record<string, any> | null;
  export function getAllThemes(): Array<Record<string, any>>;
  export function getThemeNames(): string[];
  type DefaultExport = {
    themes: Array<Record<string, any>>;
    manifest: Record<string, any>;
    defaultName: string;
  };
  const defaultExport: DefaultExport;
  export default defaultExport;
}

declare module 'virtual:assets' {
  export const logo: { optimal: string | null; fallback: string | null };
  export const favicon: { optimal: string | null; fallback: string | null };
  export const manifest: string | null;
  export const assets: string[];
  export const stats: {
    totalAssets: number;
    copiedAssets: number;
    hasLogo: boolean;
    hasFavicon: boolean;
    hasManifest: boolean;
    generatedAt: string;
  };
  export function getLogo(format?: string): string | null;
  export function getFavicon(variant?: 'optimal' | 'fallback'): string | null;
  export function getManifest(): string | null;
  export function getAllAssets(): string[];
  type DefaultExport = {
    logo: { optimal: string | null; fallback: string | null };
    favicon: { optimal: string | null; fallback: string | null };
    manifest: string | null;
    assets: string[];
    stats: {
      totalAssets: number;
      copiedAssets: number;
      hasLogo: boolean;
      hasFavicon: boolean;
      hasManifest: boolean;
      generatedAt: string;
    };
    getLogo: (format?: string) => string | null;
    getFavicon: (variant?: 'optimal' | 'fallback') => string | null;
    getManifest: () => string | null;
    getAllAssets: () => string[];
  };
  const defaultExport: DefaultExport;
  export default defaultExport;
}

declare module 'virtual:env' {
  export const env: Record<string, string>;
  export const manifest: {
    totalVars: number;
    mode: string;
    source: string;
    generatedAt: string;
  };
  export const source: string;
  export default Record<string, string>;
}

// Vite ?raw import
declare module '*?raw' {
  const content: string;
  export default content;
}
