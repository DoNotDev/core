// packages/core/types/src/common/index.ts

/**
 * @fileoverview DoNotDev Framework - Unified Types & Constants
 * @description Single source of truth for all framework types and constants
 * @package @donotdev/types
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * @remarks
 * This file consolidates all framework types and constants to prevent unnecessary splitting
 * and ensure DRY principles. All magic strings are replaced with typed constants.
 */

import type { ReactNode } from 'react';

import type { SubscriptionTier, UserRole } from '../auth/constants';
import type { LayoutPreset } from '../layout/layoutTypes';

// =============================================================================
// PLATFORM CONSTANTS
// =============================================================================

/**
 * Supported platform identifiers
 * @constant
 */
export const PLATFORMS = {
  VITE: 'vite',
  NEXTJS: 'nextjs',
  EXPO: 'expo',
  REACT_NATIVE: 'react-native',
  UNKNOWN: 'unknown',
} as const;

/**
 * Platform type derived from PLATFORMS constant
 */
export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

// =============================================================================
// ENVIRONMENT CONSTANTS
// =============================================================================

/**
 * Supported environment modes
 * @constant
 */
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

/**
 * Environment mode type derived from ENVIRONMENTS constant
 */
export type EnvironmentMode = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

// =============================================================================
// CONTEXT CONSTANTS
// =============================================================================

/**
 * Supported execution contexts
 * @constant
 */
export const CONTEXTS = {
  CLIENT: 'client',
  SERVER: 'server',
  BUILD: 'build',
} as const;

/**
 * Context type derived from CONTEXTS constant
 */
export type Context = (typeof CONTEXTS)[keyof typeof CONTEXTS];

// =============================================================================
// CONFIDENCE LEVEL CONSTANTS
// =============================================================================

/**
 * Platform detection confidence thresholds
 * @constant
 */
export const CONFIDENCE_LEVELS = {
  HIGH: 0.95,
  MEDIUM: 0.8,
  LOW: 0.7,
  MINIMUM: 0.3,
} as const;

/**
 * Confidence level type derived from CONFIDENCE_LEVELS constant
 */
export type ConfidenceLevel =
  (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];

// =============================================================================
// FEATURE STATUS CONSTANTS
// =============================================================================

/**
 * Unified feature status for all feature packages
 * Replaces combinatorial boolean flags (initialized, authStateChecked, loading) with single-source-of-truth enum.
 *
 * **Status values:**
 * - `initializing`: Feature is loading/initializing (show skeleton/loader, DON'T redirect yet)
 * - `ready`: Feature fully operational (check user state, redirect if needed)
 * - `degraded`: Feature unavailable but app continues (protected routes redirect with error, public routes allow access)
 * - `error`: Feature encountered recoverable error (protected routes redirect with error)
 *
 * **Usage in guards:**
 * - Protected routes with `degraded` status redirect to auth route with `?error=auth_unavailable`
 * - Protected routes with `error` status redirect to auth route with `?error=auth_error`
 * - `initializing` shows loader, doesn't redirect
 * - `ready` performs normal auth checks
 *
 * @example
 * ```typescript
 * switch (status) {
 *   case FEATURE_STATUS.INITIALIZING: return <Skeleton />;
 *   case FEATURE_STATUS.DEGRADED:
 *     // Protected route → redirect with error
 *     // Public route → allow access
 *     return authRequired ? <Redirect to="/auth?error=auth_unavailable" /> : children;
 *   case FEATURE_STATUS.READY: return user ? children : <Redirect />;
 *   case FEATURE_STATUS.ERROR: return <ErrorBoundary />;
 * }
 * ```
 */
export const FEATURE_STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  DEGRADED: 'degraded',
  ERROR: 'error',
} as const;

/**
 * Feature status type derived from FEATURE_STATUS constant
 */
export type FeatureStatus =
  (typeof FEATURE_STATUS)[keyof typeof FEATURE_STATUS];

// =============================================================================
// STORAGE CONSTANTS
// =============================================================================

/**
 * Supported storage backend types
 * @constant
 */
export const STORAGE_TYPES = {
  LOCAL: 'localStorage',
  SESSION: 'sessionStorage',
  INDEXED_DB: 'indexedDB',
  MEMORY: 'memory',
} as const;

/**
 * Storage type derived from STORAGE_TYPES constant
 */
export type StorageType = (typeof STORAGE_TYPES)[keyof typeof STORAGE_TYPES];

/**
 * Storage scope levels for data isolation
 * @constant
 */
export const STORAGE_SCOPES = {
  USER: 'user',
  GLOBAL: 'global',
  SESSION: 'session',
} as const;

/**
 * Storage scope type derived from STORAGE_SCOPES constant
 */
export type StorageScope = (typeof STORAGE_SCOPES)[keyof typeof STORAGE_SCOPES];

// =============================================================================
// PWA CONSTANTS
// =============================================================================

/**
 * PWA display modes
 * @constant
 */
export const PWA_DISPLAY_MODES = {
  STANDALONE: 'standalone',
  FULLSCREEN: 'fullscreen',
  MINIMAL_UI: 'minimal-ui',
  BROWSER: 'browser',
} as const;

/**
 * PWA display mode type derived from PWA_DISPLAY_MODES constant
 */
export type PWADisplayMode =
  (typeof PWA_DISPLAY_MODES)[keyof typeof PWA_DISPLAY_MODES];

/**
 * PWA asset types
 * @constant
 */
export const PWA_ASSET_TYPES = {
  MANIFEST: 'manifest',
  SERVICE_WORKER: 'service-worker',
  ICON: 'icon',
} as const;

/**
 * PWA asset type derived from PWA_ASSET_TYPES constant
 */
export type PWAAssetType =
  (typeof PWA_ASSET_TYPES)[keyof typeof PWA_ASSET_TYPES];

// =============================================================================
// ROUTE DISCOVERY CONSTANTS
// =============================================================================

/**
 * Route discovery sources
 * @constant
 */
export const ROUTE_SOURCES = {
  AUTO: 'auto-discovery',
  MANUAL: 'manual',
  HYBRID: 'hybrid',
} as const;

/**
 * Route source type derived from ROUTE_SOURCES constant
 */
export type RouteSource = (typeof ROUTE_SOURCES)[keyof typeof ROUTE_SOURCES];

// =============================================================================
// CORE UTILITY TYPES
// =============================================================================

/**
 * Generic ID type used throughout the application
 * @description Currently a string, but typed for future flexibility
 */
export type ID = string;

/**
 * Generic timestamp format for dates and times
 * @description ISO 8601 string format (e.g., "2025-01-15T10:30:00.000Z")
 */
export type Timestamp = string;

/**
 * Generic pagination options for fetching paginated data
 */
export interface PaginationOptions {
  /** The page number (1-indexed) */
  page: number;
  /** The number of items per page */
  pageSize: number;
}

/**
 * Generic API response format for consistent error handling
 * @template T - The type of data in the response
 */
export interface ApiResponse<T> {
  /** Indicates whether the operation was successful */
  success: boolean;
  /** The data returned by the operation (if successful) */
  data?: T;
  /** Error information (if the operation failed) */
  error?: {
    /** A machine-readable error code */
    code: string;
    /** A human-readable error message */
    message: string;
  };
}

/**
 * Basic user information that can be shared in various contexts
 */
export interface BasicUserInfo {
  /** The unique identifier for the user */
  id: ID;
  /** The user's display name (if available) */
  displayName?: string | null;
  /** The user's email address (if available) */
  email?: string | null;
  /** The URL of the user's profile photo (if available) */
  photoURL?: string | null;
}

/**
 * Basic document with ID and timestamps
 * @description All entity documents in the system should extend this interface
 */
export interface BaseDocument {
  /** The unique identifier for the document */
  id: ID;
  /** When the document was created */
  createdAt: Timestamp;
  /** When the document was last updated */
  updatedAt: Timestamp;
  /** The ID of the user who created the document (if available) */
  createdById?: ID;
  /** The ID of the user who last updated the document (if available) */
  updatedById?: ID;
}

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

/**
 * Page-level authentication requirements
 * @description Used in PageMeta and NavigationRoute for route-level auth
 */
export type PageAuth =
  | boolean
  | {
      /** Whether authentication is required */
      required?: boolean;
      /** Required user role */
      role?: UserRole;
      /** Required subscription tier */
      tier?: SubscriptionTier;
      /** Custom validation function */
      validate?: (role: string, tier: string) => boolean;
    };

// =============================================================================
// PAGE METADATA TYPES
// =============================================================================

/**
 * Page metadata interface for route discovery and configuration
 *
 * @remarks
 * **ALL PROPERTIES ARE OPTIONAL** - Framework provides smart defaults:
 *
 * - `auth`: false (public) by default - YOU must specify auth requirements explicitly
 * - `title`: Auto-extracted from filename (ShowcasePage → "Showcase")
 * - `entity`: Auto-extracted from path (pages/showcase/ → "showcase")
 * - `action`: Auto-extracted from filename patterns (ListPage → "list", FormPage → "form")
 * - `route`: Only needed for custom paths or dynamic routes like :id, :slug
 *
 * @example Simple page (no meta needed):
 * ```tsx
 * export function HomePage() {
 *   return <PageContainer>...</PageContainer>;
 * }
 * // Framework provides: auth=false, title from home.title, entity=home
 * ```
 *
 * @example Dynamic route (string format - explicit path):
 * ```tsx
 * export const meta: PageMeta = {
 *   route: '/blog/:slug'  // Creates /blog/:slug
 * };
 * // Framework provides: auth=false, title from blog.title, entity=blog
 * ```
 *
 * @example Dynamic route (object format - auto-generates base path):
 * ```tsx
 * export const meta: PageMeta = {
 *   route: { params: ['id'] }  // Creates /myRoute/:id (base path from file location)
 * };
 * // For file at pages/myRoute/DetailPage.tsx → route becomes /myRoute/:id
 * ```
 *
 * @example Auth-required (developer must be explicit):
 * ```tsx
 * export const meta: PageMeta = {
 *   auth: { required: true }  // YOU decide what needs auth
 * };
 * ```
 */

/**
 * SEO metadata for a page
 * @description Controls `<title>`, meta description, Open Graph, and Twitter Cards.
 * All fields default to i18n lookup when undefined.
 *
 * @example i18n-first (default)
 * ```tsx
 * export const meta: PageMeta = {
 *   namespace: 'pricing',  // Uses pricing:title, pricing:description
 * };
 * ```
 *
 * @example Full title control (escape "Page | App" format)
 * ```tsx
 * export const meta: PageMeta = {
 *   namespace: 'home',
 *   seo: { fullTitle: 'DoNotDev - Build Apps in Minutes' },
 * };
 * ```
 *
 * @example siteName only
 * ```tsx
 * export const meta: PageMeta = {
 *   seo: { title: null },  // → "AppName"
 * };
 * ```
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */
export interface SeoMeta {
  /**
   * Page title segment (appears as "title | siteName")
   * @description
   * - `undefined` → i18n lookup (`ns:title`)
   * - `string` → literal value + siteName suffix
   * - `null` → siteName only (no page title)
   */
  title?: string | null;

  /**
   * Full title override (no suffix appended)
   * @description Escapes the "Page | App" format entirely.
   * Takes priority over `title` when set.
   */
  fullTitle?: string;

  /**
   * Meta description
   * @description
   * - `undefined` → i18n lookup (`ns:description`)
   * - `string` → literal value
   * - `null` → omit meta description
   */
  description?: string | null;

  /** Open Graph image URL (relative or absolute) */
  image?: string;

  /** Keywords for meta tag */
  keywords?: string[];

  /** Page type for Open Graph */
  type?: 'website' | 'article' | 'product';

  /** Exclude from search engine indexing */
  noindex?: boolean;
}

/** Page-level metadata for route discovery, auth, SEO, and navigation. */
export interface PageMeta {
  /** Authentication requirements for this route */
  auth?: PageAuth;

  /** Route configuration - just define the exact path you want */
  route?: string | { params?: string[] };

  /** Page title (optional - framework auto-extracts from filename if not provided) */
  title?: string;

  /**
   * Translation/SEO namespace for this page
   * @description Used for meta tags and translations
   */
  namespace?: string;

  /**
   * Icon for navigation (optional - framework provides smart defaults)
   * @description **ONLY lucide-react JSX components** - extracted as component name string at build time for tree-shaking.
   *
   * **RESTRICTIONS:**
   * - ✅ Only: `<Rocket />`, `<ShoppingCart />`, `<Home />` (lucide-react JSX components)
   * - ❌ NOT: Emojis (`"🚀"`), strings (`"Rocket"`), or custom ReactNode
   *
   * **Why?** This is for build-time extraction and tree-shaking. The component name is extracted and stored as a string.
   *
   * **For flexible icons** (emojis, strings, custom components), use the `Icon` component directly in your JSX, not in PageMeta.
   *
   * @example
   * ```tsx
   * import { Rocket } from 'lucide-react';
   * export const meta: PageMeta = {
   *   icon: <Rocket />  // ✅ Correct - lucide-react component
   * };
   * ```
   *
   * @example
   * ```tsx
   * // ❌ WRONG - Don't use emojis or strings in PageMeta
   * export const meta: PageMeta = {
   *   icon: "🚀"  // ❌ Not supported in PageMeta
   * };
   * ```
   */
  icon?: ReactNode;

  /**
   * Hide from navigation menu (default: false - shows in navigation)
   * @description Set to true to exclude this route from navigation menus
   * @default false
   * @example
   * ```tsx
   * export const meta: PageMeta = {
   *   hideFromMenu: true // Won't appear in HeaderNavigation, Sidebar, etc.
   * };
   * ```
   */
  hideFromMenu?: boolean;

  /**
   * Hide breadcrumbs on this page (default: false)
   * @description Set to true to hide framework breadcrumbs on this route
   * @default false
   */
  hideBreadcrumbs?: boolean;

  /**
   * Layout preset override for this route
   * @description When set, overrides the app's default layout preset for this route only.
   * When absent, the app's `appConfig.preset` is used.
   * The override is transient — navigating away restores the next route's preset or the app default.
   *
   * @example
   * ```tsx
   * export const meta: PageMeta = {
   *   preset: 'admin', // This route uses admin layout (sidebar, compact density)
   *   auth: true,
   * };
   * ```
   */
  preset?: LayoutPreset;

  /**
   * SEO metadata override
   * @description Fine-grained control over `<title>`, meta description, and Open Graph tags.
   * When omitted, SEO uses i18n lookup based on `namespace` (i18n-first by default).
   *
   * @example Escape "Page | App" format
   * ```tsx
   * export const meta: PageMeta = {
   *   namespace: 'home',
   *   seo: { fullTitle: 'DoNotDev - Build Apps in Minutes' },
   * };
   * ```
   *
   * @example siteName only (no page title)
   * ```tsx
   * export const meta: PageMeta = {
   *   seo: { title: null },
   * };
   * ```
   */
  seo?: SeoMeta;

  /**
   * User-facing category for sidebar/menu grouping
   * @description Groups routes into collapsible sections in navigation. Unlike
   * auto-discovered `entity` (parent-dir name), `category` is author-declared
   * and typically maps to a higher-level folder (e.g., `Analyzers`, `Tools`).
   * Routes without `category` render ungrouped at the top of the menu.
   *
   * @example
   * ```tsx
   * export const meta: PageMeta = {
   *   namespace: 'budgetPlanner',
   *   category: 'Analyzers',
   *   icon: <WalletIcon />,
   * };
   * ```
   */
  category?: string;
}

/**
 * Route metadata (discovery-generated)
 * @description Complete route metadata including auto-discovered fields from RouteDiscovery
 *
 * This extends PageMeta with fields that are automatically discovered from file paths:
 * - `entity`: Auto-extracted from path (pages/showcase/ → "showcase")
 * - `action`: Auto-extracted from filename patterns (ListPage → "list", FormPage → "form")
 *
 * These fields are always present in discovered routes but cannot be set in PageMeta.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RouteMeta extends PageMeta {
  /** Entity/domain grouping - auto-discovered from file path (not user-configurable) */
  entity?: string;
  /** Action type for route categorization - auto-discovered from filename patterns (not user-configurable) */
  action?: string | null;
  /** File path where route was discovered */
  file?: string;
}

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

/**
 * Navigation route interface
 * @description Single source of truth for all navigation routes
 */
export interface NavigationRoute {
  /** Route path */
  path: string;
  /** Display label for navigation */
  label: string;
  /** Optional icon identifier or component */
  icon?: string | ReactNode;
  /** Whether route is external */
  external?: boolean;
  /** Whether route is disabled */
  disabled?: boolean;
  /** Badge content for notifications */
  badge?: string | number;
  /** Authentication configuration */
  auth?: PageAuth;
  /** Route metadata (includes auto-discovered fields) */
  meta?: RouteMeta;
  /** Nested child routes */
  children?: NavigationRoute[];
}

// =============================================================================
// STORAGE TYPES
// =============================================================================

/**
 * Storage options for get/set operations
 */
export interface StorageOptions {
  /**
   * Whether to encrypt the data
   * @default false for most data, true for sensitive data
   */
  encryption?: boolean;

  /**
   * Time in seconds after which the data expires
   * @description Set to 0 for no expiration
   * @default 0
   */
  expiry?: number;

  /**
   * Storage scope for data isolation
   * @description
   * - 'user': User-specific data, tied to user ID (requires auth)
   * - 'global': Application-wide data, not tied to specific user
   * - 'session': Session-only data, cleared on logout/browser close
   * @default 'user'
   */
  scope?: StorageScope;
}

/**
 * Storage manager interface
 * @description Main interface for all storage operations
 */
export interface IStorageManager {
  /**
   * Retrieve data from storage
   * @param key - Storage key
   * @param options - Storage options
   * @returns Promise resolving to the stored data or null if not found
   */
  get<T>(key: string, options?: StorageOptions): Promise<T | null>;

  /**
   * Store data
   * @param key - Storage key
   * @param value - Data to store
   * @param options - Storage options
   * @returns Promise resolving when data is stored
   */
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;

  /**
   * Remove data from storage
   * @param key - Storage key
   * @returns Promise resolving when data is removed
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all data in the specified scope
   * @param scope - Scope to clear, or all scopes if not specified
   * @returns Promise resolving when data is cleared
   */
  clear(scope?: StorageScope): Promise<void>;

  /**
   * Store sensitive data with encryption
   * @description Shorthand for set() with encryption=true
   * @param key - Storage key
   * @param value - Data to store
   * @param options - Storage options (encryption will be set to true)
   * @returns Promise resolving when data is stored
   */
  setSecure<T>(
    key: string,
    value: T,
    options?: Omit<StorageOptions, 'encryption'>
  ): Promise<void>;

  /**
   * Retrieve sensitive data with decryption
   * @description Shorthand for get() with encryption=true
   * @param key - Storage key
   * @param options - Storage options (encryption will be set to true)
   * @returns Promise resolving to the decrypted data or null if not found
   */
  getSecure<T>(
    key: string,
    options?: Omit<StorageOptions, 'encryption'>
  ): Promise<T | null>;
}

/**
 * Storage strategy interface
 * @description Used by StorageManager to delegate storage operations
 */
export interface IStorageStrategy {
  /**
   * Retrieve data from storage
   * @param key - Storage key
   * @param options - Storage options
   * @returns Promise resolving to the stored data or null if not found
   */
  get<T>(key: string, options?: StorageOptions): Promise<T | null>;

  /**
   * Store data
   * @param key - Storage key
   * @param value - Data to store
   * @param options - Storage options
   * @returns Promise resolving when data is stored
   */
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;

  /**
   * Remove data from storage
   * @param key - Storage key
   * @returns Promise resolving when data is removed
   */
  remove(key: string): Promise<void>;

  /**
   * Clear all data in the specified scope
   * @param scope - Scope to clear, or all scopes if not specified
   * @returns Promise resolving when data is cleared
   */
  clear(scope?: StorageScope): Promise<void>;
}

// =============================================================================
// PLUGIN CONFIGURATION TYPES
// =============================================================================

/**
 * i18n Plugin Configuration
 * @description Configuration for internationalization system
 */
export interface I18nPluginConfig {
  /** Mapping of language → namespace → loader function */
  mapping: Record<string, Record<string, () => Promise<any>>>;
  /** List of available language codes */
  languages: string[];
  /** List of eagerly loaded namespace identifiers */
  eager: string[];
  /** Fallback language code */
  fallback: string;
  /** Preloaded translation content for eager namespaces (optional) */
  content?: Record<string, Record<string, any>>;
  /** Lazy loader functions — static import() calls generated by Vite plugin (optional, not serializable) */
  loaders?: Record<string, Record<string, () => Promise<any>>>;
  /** Storage configuration */
  storage: {
    /** Storage backend type */
    type: StorageType;
    /** Storage key prefix */
    prefix: string;
    /** Time-to-live in seconds */
    ttl: number;
    /** Whether to encrypt stored data */
    encryption: boolean;
    /** Maximum storage size in bytes */
    maxSize: number;
  };
  /** Performance configuration */
  performance: {
    /** Maximum cache size */
    cacheSize: number;
    /** Error cache TTL in seconds */
    errorCacheTTL: number;
  };
  /** Discovery manifest metadata */
  manifest: {
    /** Total number of translation files */
    totalFiles: number;
    /** Total number of namespaces */
    totalNamespaces: number;
    /** Total number of languages */
    totalLanguages: number;
    /** Number of eagerly loaded namespaces */
    eagerNamespaces: number;
    /** ISO timestamp of generation */
    generatedAt: string;
  };
  /** Whether debug mode is enabled */
  debug: boolean;
}

/**
 * Routes Plugin Configuration
 * @description Complete route configuration populated by discovery system
 */
export interface RoutesPluginConfig {
  /**
   * Array of discovered routes
   * @description All routes discovered by the route discovery system
   */
  mapping: Array<{
    /**
     * URL path for the route (platform-agnostic)
     * @description The URL path that users see in their browser
     * @example '/showcase/layouts', '/users/:id', '/dashboard'
     */
    path: string;

    /**
     * Lazy component reference (Vite-specific)
     * @description React.lazy() component for code splitting
     * @example lazy(() => import("/src/pages/showcase/LayoutsPage"))
     */
    component: any;

    /**
     * Absolute file system path (Next.js-specific)
     * @description The absolute path to the component file
     * @example '/src/pages/showcase/LayoutsPage.tsx'
     */
    importPath: string;

    /**
     * Export name for named exports
     * @example 'HomePage', 'AboutPage'
     */
    exportName?: string;

    /**
     * Authentication configuration (platform-agnostic)
     * @description Defines whether the route requires authentication
     */
    auth: PageAuth;

    /**
     * Route metadata (platform-agnostic)
     * @description Additional information about the route, including auto-discovered fields
     */
    meta: RouteMeta;
  }>;

  /**
   * Discovery metadata and statistics
   * @description Information about the route discovery process
   */
  manifest: {
    /** Total number of discovered routes */
    totalRoutes: number;
    /** Number of routes requiring authentication */
    authRequired: number;
    /** Number of public routes */
    publicRoutes: number;
    /** Source of routes (auto-discovery vs manual) */
    source: RouteSource;
    /** ISO timestamp when routes were generated */
    generatedAt: string;
  };
}

/**
 * Themes Plugin Configuration
 * @description Configuration for theme discovery and management
 */
export interface ThemesPluginConfig {
  /** Mapping of theme names to theme configurations */
  mapping: Record<string, any>;
  /** Array of discovered themes */
  discovered: Array<{
    /** Theme identifier */
    name: string;
    /** Human-readable theme name */
    displayName: string;
    /** Whether this is a dark theme */
    isDark: boolean;
    /** Theme metadata */
    meta: {
      /** Icon identifier */
      icon: string;
      /** Theme description */
      description?: string;
      /** Theme category */
      category?: string;
      /** Theme author */
      author?: string;
      /** Additional metadata */
      [key: string]: any;
    };
    /** Source file path */
    source: string;
    /** Whether theme is essential (cannot be disabled) */
    essential: boolean;
  }>;
  /** CSS custom property variables */
  variables: Record<string, string>;
  /** Utility class mappings */
  utilities: Record<string, Record<string, string>>;
  /** Discovery manifest metadata */
  manifest: {
    /** Total number of discovered themes */
    totalThemes: number;
    /** Total number of CSS variables */
    totalVariables: number;
    /** Total number of utility classes */
    totalUtilities: number;
    /** ISO timestamp of generation */
    generatedAt: string;
  };
}

/**
 * Assets Plugin Configuration
 * @description Configuration for static asset management
 */
export interface AssetsPluginConfig {
  /** Mapping of asset paths to asset metadata */
  mapping: Record<string, any>;
  /** SVG content of logo.svg for inline rendering with CSS variable theming */
  logoSvgContent?: string | null;
  /** Discovery manifest metadata */
  manifest: {
    /** Total number of discovered assets */
    totalAssets: number;
    /** ISO timestamp of generation */
    generatedAt: string;
  };
}

/**
 * PWA Plugin Configuration
 * @description Configuration for Progressive Web App features
 */
export interface PWAPluginConfig {
  /** Array of PWA assets */
  assets: Array<{
    /** Type of PWA asset */
    type: PWAAssetType;
    /** Asset file path */
    path: string;
    /** Asset file size in bytes */
    size?: number;
    /** Asset content (for inline assets) */
    content?: any;
    /** Asset format (for images) */
    format?: string;
    /** Asset purpose (for icons) */
    purpose?: string;
  }>;
  /** PWA manifest configuration */
  manifest: {
    /** Application name */
    name: string;
    /** Short application name */
    short_name: string;
    /** Application description */
    description: string;
    /** Start URL */
    start_url: string;
    /** Display mode */
    display: PWADisplayMode;
    /** Background color */
    background_color: string;
    /** Theme color */
    theme_color: string;
    /** Array of app icons */
    icons: Array<{
      /** Icon source path */
      src: string;
      /** Icon sizes (e.g., '192x192') */
      sizes: string;
      /** Icon MIME type */
      type: string;
      /** Icon purpose (e.g., 'any', 'maskable') */
      purpose: string;
    }>;
  };
  /** Discovery manifest metadata */
  manifestInfo: {
    /** Total number of PWA assets */
    totalAssets: number;
    /** Total number of icons */
    totalIcons: number;
    /** Whether service worker is present */
    hasServiceWorker: boolean;
    /** ISO timestamp of generation */
    generatedAt: string;
  };
}

/**
 * Features Plugin Configuration
 * @description Configuration for feature discovery and enablement
 *
 * @remarks
 * This interface defines the structure for feature discovery data that is populated
 * at build time and made available at runtime for feature availability checking.
 *
 * @example
 * ```typescript
 * // Generated by feature discovery system
 * const featuresConfig: FeaturesPluginConfig = {
 *   available: ['auth', 'billing', 'i18n', 'oauth'],
 *   enabled: ['auth', 'i18n'],
 *   overridden: false
 * };
 * ```
 */
export interface FeaturesPluginConfig {
  /**
   * List of all available features discovered in packages/features/
   * @example ['auth', 'billing', 'i18n', 'oauth']
   */
  available: string[];
}

// =============================================================================
// FRAMEWORK CONFIGURATION
// =============================================================================

/**
 * Complete DoNotDev framework configuration structure
 * @description Single source of truth for all framework configuration
 *
 * @remarks
 * All discovery plugins add their data to this unified config.
 * Available at runtime via globalThis._DNDEV_CONFIG_ or window._DNDEV_CONFIG_
 */
export interface DndevFrameworkConfig {
  /** Framework platform (Vite or Next.js) */
  platform: Platform;
  /** Current environment mode */
  mode: EnvironmentMode;
  /** Framework version */
  version: string;
  /** Execution context */
  context: Context;
  /** Unix timestamp of config generation */
  timestamp: number;
  /** i18n plugin configuration (optional) */
  i18n?: I18nPluginConfig;
  /** Routes plugin configuration (optional) */
  routes?: RoutesPluginConfig;
  /** Themes plugin configuration (optional) */
  themes?: ThemesPluginConfig;
  /** Assets plugin configuration (optional) */
  assets?: AssetsPluginConfig;
  /** PWA plugin configuration (optional) */
  pwa?: PWAPluginConfig;
  /** Features plugin configuration (optional) */
  features?: FeaturesPluginConfig;
  /** Environment variables (VITE_* variables from .env files) */
  env?: Record<string, string>;
}

// Global augmentations are defined in @donotdev/core/config/global.d.ts
// This file only exports types, no global declarations
