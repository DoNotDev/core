// packages/core/config/index.d.ts

/**
 * @fileoverview TypeScript Definitions for @donotdev/config
 * @description Comprehensive configuration system for DNDev applications supporting Vite and Next.js with built-in routing, theming, and internationalization.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Build configuration options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BuildConfig {
  outDir?: string;
  sourcemap?: boolean;
  /** Minification strategy */
  minify?: boolean | 'esbuild' | 'lightningcss';
  mode?: 'development' | 'production' | string;
  /** Build target (default: 'baseline-widely-available') */
  target?: string;
  /** esbuild minification options */
  esbuildOptions?: Record<string, any>;
  chunkSizeWarningLimit?: number;
  /** Enable bundle analyzer to generate stats.html */
  analyze?: boolean;
  /** CSS minification strategy */
  cssMinify?: boolean | 'esbuild' | 'lightningcss';
  /** Enable CSS code splitting (default: true) */
  cssCodeSplit?: boolean;
  /** Report compressed size (default: false, use stats.html instead) */
  reportCompressedSize?: boolean;
  /** Assets inline limit in bytes (default: 0, never inline) */
  assetsInlineLimit?: number;
  /** Cache directory (default: 'node_modules/.vite') */
  cacheDir?: string;
}

/**
 * Terser minification options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TerserOptions {
  compress?: {
    drop_console?: boolean;
    drop_debugger?: boolean;
    ecma?: number;
    passes?: number;
    pure_funcs?: string[];
    pure_getters?: boolean;
    unsafe?: boolean;
    unsafe_comps?: boolean;
    warnings?: boolean;
  };
  mangle?: {
    keep_classnames?: boolean;
    keep_fnames?: boolean;
    reserved?: string[];
    safari10?: boolean;
  };
  format?: {
    comments?: boolean;
    ascii_only?: boolean;
    webkit?: boolean;
  };
  safari10?: boolean;
  ie8?: boolean;
}

/**
 * Module resolution options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ResolveOptions {
  alias?:
    | Record<string, string>
    | Array<{ find: string | RegExp; replacement: string }>;
}

/**
 * Server configuration options
 * Used for both dev server and preview server
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ServerOptions {
  /** Server port number */
  port?: number;
  /** Fail if port is already in use (default: true) */
  strictPort?: boolean;
  /** Host configuration - true for all interfaces, string for specific host */
  host?: boolean | string;
  /** Automatically open browser */
  open?: boolean;
  /** File system access configuration */
  fs?: {
    /** Allowed directories for file access */
    allow?: string[];
    /** Strict file serving (default: false for workspace access) */
    strict?: boolean;
  };
  /** Hot Module Replacement configuration */
  hmr?: {
    /** HMR timeout in milliseconds */
    timeout?: number;
    /** Overlay error display */
    overlay?: boolean;
    /** HMR server port (for WebSocket) */
    port?: number;
    /** HMR server host */
    host?: string;
    /** Client-side HMR port (when different from server port) */
    clientPort?: number;
    /** WebSocket protocol */
    protocol?: 'ws' | 'wss';
  };
  /** File watcher configuration */
  watch?: {
    /** Use polling for file watching */
    usePolling?: boolean;
    /** Polling interval in milliseconds */
    interval?: number;
    /** Files/patterns to ignore (set by plugin using config.root) */
    ignored?: string | RegExp | Array<string | RegExp>;
  };
  /** Enable CORS */
  cors?: boolean;
  /** Enable HTTPS (default: true for PWA/OAuth/secure context) */
  https?: boolean;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Middleware mode (default: false) */
  middlewareMode?: boolean;
}

/**
 * I18n virtual mapping options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface I18nVirtualMappingOptions {
  virtualModuleId?: string;
  eagerNamespaces?: string[];
}

/**
 * Base discovery options - DRY type for code, not a config level
 * HMR options are internal framework concerns (in DEFAULT_OPTIONS only, not user-configurable)
 * Plugins are always enabled (part of framework) - no enabled option
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseDiscoveryOptions {
  /** Debug logging (default: false) - cascades from global debug */
  debug?: boolean;
  /** Verbose logging (default: true) - cascades from global verbose */
  verbose?: boolean;
}

/**
 * Theme detection options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ThemeDetectionOptions extends BaseDiscoveryOptions {
  /** Theme manifest file name (default: 'theme-manifest.json') */
  manifestFileName?: string;
  /** Auto-generate safelist (default: true) */
  autoSafelist?: boolean;
}

/**
 * Route discovery options with virtual module support
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RouteDiscoveryOptions extends BaseDiscoveryOptions {
  /** Disable route discovery (default: false) - set to true if using custom router */
  disabled?: boolean;
  /** Path to manual routes file relative to vite.config.ts (default: './src/routes.ts') */
  manualPath?: string;
  /** Additional patterns to scan beyond centralized patterns */
  additionalPatterns?: string[];
}

/**
 * I18n options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface I18nOptions extends BaseDiscoveryOptions {
  useVirtualMapping?: boolean;
  fallbackLanguage?: string;
  namespaces?: string[];
  virtualMapping?: I18nVirtualMappingOptions;
  /** Additional locale paths from workspace packages (e.g., shared entities) */
  /** Paths are relative to app root. Useful for custom shared translation locations. */
  /** Example: ['../../packages/shared/locales'] */
  /** Note: '../../entities/locales' is auto-detected by default, no config needed */
  additionalPaths?: string[];
}

/**
 * Asset options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AssetOptions extends BaseDiscoveryOptions {
  /** Asset fallback configuration */
  fallback?: AssetFallbackOptions | false;
}

/**
 * Progressive Web App options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface PWAOptions {
  /** Enable PWA in production builds (default: false) */
  enabled?: boolean;
  /** Enable PWA in development (default: false) */
  devEnabled?: boolean;
  /** Service worker registration: 'autoUpdate' = update in background, 'prompt' = ask user (default: 'prompt') */
  registerType?: 'autoUpdate' | 'prompt';
  /** Debug logging (default: false) */
  debug?: boolean;
  /** Override manifest values (auto-discovered from app.ts by default) */
  manifest?: Record<string, any>;
  /** Discover build assets for precache (Next.js only, default: true) */
  discoverBuildAssets?: boolean;
  /** Override workbox configuration (smart defaults provided) */
  workbox?: {
    /** Maximum file size to cache in bytes (default: 5MB) */
    maximumFileSizeToCacheInBytes?: number;
    /** Glob patterns for precaching (default: all js, css, html, icons, and fonts) */
    globPatterns?: string[];
    /** Glob patterns to ignore */
    globIgnores?: string[];
    /** Clean up outdated caches (default: true) */
    cleanupOutdatedCaches?: boolean;
    /** Skip waiting for service worker activation (default: true) */
    skipWaiting?: boolean;
    /** Claim clients immediately (default: true) */
    clientsClaim?: boolean;
    /** Runtime caching strategies (smart defaults provided) */
    runtimeCaching?: Array<{
      urlPattern: RegExp | ((options: { request: Request }) => boolean);
      handler:
        | 'CacheFirst'
        | 'NetworkFirst'
        | 'StaleWhileRevalidate'
        | 'NetworkOnly'
        | 'CacheOnly';
      options?: Record<string, any>;
    }>;
    /** Navigation fallback URL (default: '/') */
    navigateFallback?: string;
    /** URLs to exclude from navigation fallback */
    navigateFallbackDenylist?: RegExp[];
    /** Transform precache manifest (allows custom filtering/modification) */
    manifestTransforms?: Array<
      (manifest: Array<{ url: string; revision: string | null }>) => {
        manifest: Array<{ url: string; revision: string | null }>;
        warnings?: string[];
      }
    >;
    /** Background sync configuration for offline actions */
    backgroundSync?:
      | {
          /** Queue name for background sync (default: 'background-sync-queue') */
          queueName?: string;
          /** Maximum retention time in minutes (default: 24 * 60) */
          maxRetentionTime?: number;
          /** URL pattern for background sync routes (default: matches /api/ routes) */
          urlPattern?: RegExp | ((options: { request: Request }) => boolean);
        }
      | false;
    [key: string]: any; // Allow other workbox options
  };
}

/**
 * Asset fallback options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AssetFallbackOptions {
  /** Enable asset fallback (default: true) */
  enabled?: boolean;
  /** Assets to copy (default: from centralized patterns) */
  assets?: string[];
  /** Asset patterns to scan (default: from centralized patterns) */
  assetPatterns?: string[];
  /** Framework package name (default: '@donotdev/ui') */
  frameworkPackage?: string;
  /** Assets path within framework package (default: 'assets') */
  assetsPath?: string;
  /** Debug logging (default: false) */
  debug?: boolean;
}

/**
 * SEO options for static file generation
 * Note: SEO config comes from appConfig only - cannot be overridden in vite.config.ts
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SEOOptions {
  /** Base URL for the site (e.g., 'https://example.com') - reads from VITE_APP_URL/NEXT_PUBLIC_APP_URL env var */
  baseUrl?: string;
  /** Site name for meta tags and titles - defaults to APP_NAME from app.ts */
  siteName?: string;
  /** Crawl delay for robots.txt (default: 1) */
  crawlDelay?: number;
  /** Generate robots.txt (default: true) */
  generateRobotsTxt?: boolean;
  /** Generate sitemap.xml (default: true) */
  generateSitemap?: boolean;
  /** Disable SEO plugin (default: false) - set to true if managing robots.txt/sitemap.xml manually */
  disabled?: boolean;
}

/**
 * Chunking configuration options
 *
 * User patterns are APPENDED to framework's react-core patterns (not replaced).
 * Framework patterns are always included - user patterns extend them.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ChunkingOptions {
  /** Additional React-dependent library patterns to APPEND to framework's react-core chunk */
  reactCore?: string[];
}

/**
 * Server shim options for blocking server-only imports
 * Note: serverShim cannot be disabled - framework would crash without it
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ServerShimOptions {
  /** Additional imports to block beyond defaults */
  blockedImports?: string[];
  /** Debug logging (default: false) */
  debug?: boolean;
}

/**
 * Dependency optimization options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OptimizeDepsOptions {
  entries?: string | string[];
  exclude?: string[];
  include?: string[];
  force?: boolean;
  esbuildOptions?: {
    format?: 'esm' | 'cjs' | 'iife';
    target?: string | string[];
    platform?: 'browser' | 'node' | 'neutral';
    define?: Record<string, string>;
    external?: string[];
    [key: string]: any;
  };
}

/**
 * Configuration options for DNDev applications
 *
 * Provides comprehensive configuration for Vite-based applications with
 * built-in support for routing, theming, internationalization, and SEO.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ConfigOptions {
  /** App config from app.ts - features and SEO will be extracted automatically (required) */
  appConfig: import('@donotdev/types').AppConfig;
  /** Debug mode - disables minification, enables sourcemaps, preserves console logs */
  debug?: boolean;
  /** Verbose logging - shows config/search paths (opt-out, auto-disabled in CI) */
  verbose?: boolean;
  /** Base public path */
  base?: string;
  /** Build mode */
  mode?: 'development' | 'production';
  /** Build configuration */
  build?: BuildConfig;
  /** Module resolution options */
  resolve?: ResolveOptions;
  /** Development server configuration */
  server?: ServerOptions;
  /** Preview server configuration (reuses ServerOptions) */
  preview?: ServerOptions;
  /** Internationalization options */
  i18n?: I18nOptions;
  /** Progressive Web App options */
  pwa?: PWAOptions;
  /** Asset management options */
  assets?: AssetOptions;
  /** Theme detection options */
  themes?: ThemeDetectionOptions;
  /** Route discovery options */
  routes?: RouteDiscoveryOptions;
  /** Chunking configuration options */
  chunking?: ChunkingOptions;
  /** Server shim options */
  serverShim?: ServerShimOptions;
  /** Dependency optimization options */
  optimizeDeps?: OptimizeDepsOptions;
  /** Environment directory (default: Vite auto-resolves relative to vite.config.ts) */
  envDir?: string;
  /** Environment variable prefixes */
  envPrefix?: string | string[];
  /** Additional Vite plugins */
  plugins?: any[];
  /** Prerender options - false to disable, array for explicit routes, object for full config (default: auto-discovers public routes) */
  prerender?:
    | false
    | string[]
    | {
        /** Routes to prerender - 'auto' discovers from manifest, array for explicit (default: 'auto') */
        routes?: string[] | 'auto';
      };
  /** Enable DnDev dashboard plugin (terminal, file API, HMR watcher). Only for the dndev app. */
  dndev?: boolean | Record<string, unknown>;
}

/**
 * Creates a complete Vite configuration optimized for DNDev applications
 *
 * @param options - Configuration options
 * @returns Complete Vite configuration object
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function defineViteConfig(
  options?: ConfigOptions | string | boolean
): any;

/**
 * Creates build-specific configuration
 *
 * @param options - Build configuration options
 * @returns Vite build configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createBuildConfig(options?: BuildConfig): any;

/**
 * Creates the complete plugin array for DNDev applications
 *
 * @param options - Plugin configuration options
 * @returns Array of Vite plugins
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createPlugins(options?: any): any[];

/**
 * Individual plugin creators for advanced customization
 */

/**
 * Create route discovery plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createRouteDiscoveryPlugin(
  options?: RouteDiscoveryOptions
): any;
/**
 * Create I18n virtual mapping plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createI18nVirtualMappingPlugin(options?: any): any;
/**
 * Create asset fallback plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createDndevAssetFallbackPlugin(
  options?: AssetFallbackOptions
): any;
/**
 * Create DNDev discovery plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createDNDevDiscoveryPlugin(
  options?: ThemeDetectionOptions
): any;
/**
 * Create server shim plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createServerShimPlugin(options?: ServerShimOptions): any;

// ===== CONSTANTS TYPES =====

/**
 * Virtual module IDs
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface VirtualModules {
  routes: string;
  themes: string;
  i18n: string;
  assets: string;
}

/**
 * Generated file paths
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GeneratedPaths {
  next: {
    middleware: string;
    routeManifest: string;
    assetManifest: string;
    utilities: string;
    /** Base directory for generated app/** files (Site template) */
    appPages: string;
    /** Layout file location - user-owned, never touched by generation */
    appLayout: string;
  };
  manifests: {
    route: string;
    theme: string;
    i18n: string;
    asset: string;
  };
}

/**
 * Framework configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FrameworkConfig {
  package: string;
  assetsPath: string;
  browserTargets: string[];
}

/**
 * Scan patterns
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ScanPatterns {
  routes: {
    include: string[];
    exclude: string[];
    extensions: string[];
    framework: string[];
  };
  css: {
    framework: string[];
    consumer: string[];
    themes: string[];
    extensions: string[];
  };
  i18n: {
    eager: string[];
    lazy: string[];
    extensions: string[];
    framework: string[];
  };
  assets: {
    public: string[];
    fallback: string[];
    modern: string[];
    patterns: string[];
    framework: string[];
  };
  globalIgnore: string[];
}

/**
 * CSS patterns
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CSSPatterns {
  selectors: {
    class: RegExp;
    variable: RegExp;
    keyframe: RegExp;
  };
  themes: {
    themeClass: RegExp;
    themeLabel: RegExp;
    themeIcon: RegExp;
  };
}

/**
 * Fast-glob options
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GlobOptions {
  base: {
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
  };
  css: {
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
  };
  routes: {
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
  };
  i18n: {
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
  };
  assets: {
    absolute: boolean;
    onlyFiles: boolean;
    ignore: string[];
  };
}

/**
 * Essential defaults
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EssentialDefaults {
  themes: Array<{
    name: string;
    displayName: string;
    meta: {
      icon?: string;
      category?: string;
    };
    essential: boolean;
  }>;
}

/**
 * Utility rule
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UtilityRule {
  name: string;
  match: (name: string) => boolean;
  generate: (
    name: string,
    cssVar: string
  ) => Array<[string, Record<string, string>]>;
}

/**
 * Framework constants and utilities
 */

/**
 * Virtual modules constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const VIRTUAL_MODULES: VirtualModules;
/**
 * Generated paths constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const GENERATED_PATHS: GeneratedPaths;
/**
 * Framework config constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const FRAMEWORK_CONFIG: FrameworkConfig;
/**
 * Scan patterns constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const SCAN_PATTERNS: ScanPatterns;
/**
 * CSS patterns constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const CSS_PATTERNS: CSSPatterns;
/**
 * Utility rules constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const UTILITY_RULES: UtilityRule[];
/**
 * Glob options constant
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const GLOB_OPTIONS: GlobOptions;

/**
 * Pattern matching and validation utilities
 */

/**
 * Get patterns for type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getPatternsFor(
  type: 'routes' | 'css' | 'i18n' | 'assets',
  repoRoot?: string
): any;
/**
 * Get glob options for type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getGlobOptionsFor(
  type: 'base' | 'css' | 'routes' | 'i18n' | 'assets'
): any;

/**
 * Initialize Firebase
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function initFirebase(): {
  app: any;
  auth: any;
  isDemoMode: boolean;
};
/**
 * Check if Firebase is in demo mode
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isFirebaseDemoMode(): boolean;
/**
 * Reset Firebase
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function resetFirebase(): void;

// Next.js Configuration

/**
 * Next.js configuration options for DNDev applications
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface NextConfigOptions {
  /** App config from app.ts - features and SEO will be extracted automatically (required) */
  appConfig: import('@donotdev/types').AppConfig;
  /** Debug mode - enables detailed debug logging */
  debug?: boolean;
  /** Verbose logging - shows config/search paths (opt-out, auto-disabled in CI) */
  verbose?: boolean;
  /** Route discovery configuration (uses DRY RouteDiscoveryOptions) */
  routes?: RouteDiscoveryOptions & {
    /** Generate app/** page files (Site template) (default: true) */
    generateAppPages?: boolean;
    /** Routing mode for Next.js */
    routingMode?: 'pages' | 'app';
    /** Generate authentication middleware */
    generateMiddleware?: boolean;
  };
  /** Internationalization configuration (uses DRY I18nOptions) */
  i18n?: I18nOptions;
  /** Theme configuration (uses DRY ThemeDetectionOptions) */
  themes?: ThemeDetectionOptions;
  /** Asset configuration (uses DRY AssetOptions) */
  assets?: AssetOptions;
  /** Generate route manifest */
  generateManifest?: boolean;
  /** PWA configuration */
  pwa?: PWAOptions;
  /** Server shim options */
  serverShim?: ServerShimOptions;
  /** Standard Next.js config options (webpack, rewrites, headers, etc.) - passed through as-is */
  [key: string]: any;
}

/**
 * Creates a Next.js configuration optimized for DNDev applications
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export declare function defineNextConfig(options?: NextConfigOptions): any;

/**
 * Helper to get route discovery instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export declare function getRouteDiscovery(options?: any): any;

// ============= UTILS TYPES =============

/**
 * Path resolver class - Singleton pattern for shared state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class PathResolver {
  /**
   * Get or create singleton instance
   * @param options - Configuration options
   * @returns PathResolver singleton instance
   */
  static getInstance(options?: {
    debug?: boolean;
    maxLevels?: number;
    customMarkers?: string[];
    cache?: boolean;
  }): PathResolver;

  constructor(options?: {
    debug?: boolean;
    maxLevels?: number;
    customMarkers?: string[];
    cache?: boolean;
  });

  // Core path operations
  normalizePath(path: string): string;
  getRelativePath(absolutePath: string): string;
  getBasename(path: string): string;
  getDirname(path: string): string;
  resolvePackage(
    packageSpecifier: string,
    fromPath?: string | null
  ): string | null;
  resolveFrameworkPackage(
    packageName: string,
    fromPath?: string | null
  ): string | null;
  resolvePackageAsset(
    assetPath: string,
    fromPath?: string | null
  ): string | null;
  resolveAppPath(relativePath: string): string;
  resolveRepoPath(relativePath: string): string;
  resolvePath(relativePath: string, baseDir: string): string;
  createImportPath(absolutePath: string): string;
  getFileInfo(absolutePath: string): any;

  // File system operations
  pathExists(filePath: string, silent?: boolean): boolean;
  readFile(filePath: string, encoding?: string): string | null;
  readJsonFile(filePath: string): any | null;
  readJsonFileAsync(filePath: string): Promise<any | null>;
  readFileSync(filePath: string): string;
  readFileBuffer(filePath: string): Promise<Buffer>;
  writeFile(filePath: string, content: string, options?: any): Promise<boolean>;
  writeFileSync(filePath: string, content: string, options?: any): boolean;
  writeJsonFile(filePath: string, data: any, options?: any): Promise<boolean>;
  copyFile(srcPath: string, destPath: string, options?: any): Promise<boolean>;
  appendFile(
    filePath: string,
    content: string | Buffer,
    encoding?: string
  ): boolean;
  /** Remove file from filesystem */
  removeFile(filePath: string): Promise<void>;
  mkdir(dirPath: string): boolean;
  ensureDir(dirPath: string): Promise<void>;
  ensureDirSync(dirPath: string): void;
  remove(path: string): Promise<void>;
  removeSync(path: string): void;
  readdirSync(dirPath: string, options?: any): string[] | any[];
  readdir(dirPath: string, options?: any): Promise<string[] | any[]>;
  statSync(filePath: string): any;
  lstatSync(filePath: string): any;

  // Pattern resolution
  resolvePatterns(patternType: string): Promise<any>;

  // Root management
  getAppRoot(): string;
  setAppRoot(root: string): void;
  getRepoRoot(): string;
  isMonorepo(): boolean;
  isWithinApp(targetPath: string): boolean;
  clearCache(): void;

  // File operations
  findFiles(
    directory: string,
    pattern: string,
    options?: any
  ): Promise<string[]>;
  resolveFiles(
    patterns: any,
    patternType?: string
  ): Promise<{ frameworkFiles: string[]; consumerFiles: string[] }>;

  // Framework-specific
  getEmptyModulePath(returnPackageSpecifier?: boolean): string;
}

/**
 * CSS extractor class
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class CSSExtractor {
  constructor(options?: { debug?: boolean; customPatterns?: any });
  extractThemes(cssContent: string, filePath: string, discovered: any): any[];
  extractClasses(cssContent: string, discovered: any): void;
  extractVariables(cssContent: string, discovered: any, source: string): void;
  extractKeyframes(cssContent: string, discovered: any): void;
  extractAll(cssContent: string, filePath: string, source?: string): any;
  getPatterns(): any;
  setPatterns(newPatterns: any): void;
}

/**
 * Create logger function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createLogger(
  namespace: string,
  debug: boolean,
  verbose: boolean,
  options?: { logDir?: string; fileLogging?: boolean }
): {
  debug: (msg: string, ...args: any[]) => void;
  verbose: (msg: string, ...args: any[]) => void;
  info: (msg: string, ...args: any[]) => void;
  warn: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
  success: (msg: string, ...args: any[]) => void;
  when: (
    condition: boolean,
    level?: string
  ) => (msg: string, ...args: any[]) => void;
  getLogFilePath: () => string | null;
};
