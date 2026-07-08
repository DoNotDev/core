// packages/core/types/src/layout/layoutTypes.ts

/**
 * @fileoverview Layout Types
 * @description Type definitions for layout system. Defines layout presets, layout configuration, zone configuration, and layout-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';

import type { PresetConfig } from './presetConfig';

import type { FooterMode, LayoutPreset } from './layoutConstants';

export {
  DEFAULT_LAYOUT_PRESET,
  FOOTER_MODE,
  LAYOUT_PRESET,
} from './layoutConstants';
export type { FooterMode, LayoutPreset };

/**
 * Layout preset string literals
 *
 * Each preset provides a different layout configuration optimized for specific use cases:
 * - 'landing': Marketing site with header and footer (default)
 * - 'admin': Admin panel with header, sidebar, and footer
 * - 'docs': Documentation with header, sidebar, and footer
 * - 'blog': Blog with header, sidebar, and footer
 * - 'moolti': SaaS app with sidebar only
 * - 'game': Mobile gaming with fixed header/footer (64px/24px)
 * - 'plain': Minimal layout with no UI chrome
 */

/**
 * Layout slot configuration for customizing layout zones
 *
 * Provides a clean, typed interface for customizing different areas of the layout
 * without prop drilling. Each preset uses only the slots it supports.
 *
 * Slots are functions that return ReactNode - this ensures hooks run after
 * providers are ready, preventing timing issues with feature-gated components.
 * Functions are called when the framework renders, ensuring all providers
 * and stores are initialized before component hooks execute.
 *
 * @example
 * ```typescript
 * const layout: LayoutConfig = {
 *   header: {
 *     start: () => <MyLogo />,
 *     end: () => <MyActions />
 *   },
 *   footer: () => <CustomFooter />
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
/**
 * Layout override function - lazy component renderer
 *
 * Consumers use this to override layout zones/slots.
 * Function ensures components load lazily, not in provider tree.
 * Return `null` to explicitly hide the slot.
 */
export type DnDevOverride = () => ReactNode | null;

/**
 * Main content wrapper component
 *
 * Wraps the page content (`children` / `<Outlet />`) inside `<main>`.
 * Use to add custom chrome around page content without modifying the framework layout:
 * split panes, floating panels, contextual sidebars, terminal docking, etc.
 *
 * Receives page content as `children`. Breadcrumbs, debug tools, and footer
 * remain outside the wrapper (framework-managed).
 *
 * Works identically with Vite (`<Outlet />`) and Next.js (`{children}`).
 *
 * @example
 * ```tsx
 * // Vite — split pane with terminal
 * <ViteAppProviders
 *   layout={{
 *     wrapper: ({ children }) => (
 *       <SplitLayout terminal={<TerminalPanel />}>
 *         {children}
 *       </SplitLayout>
 *     ),
 *   }}
 * />
 *
 * // Next.js — admin panel with contextual sidebar
 * <NextJsAppProviders
 *   layout={{
 *     wrapper: ({ children }) => (
 *       <AdminPanel sidebar={<ContextNav />}>{children}</AdminPanel>
 *     ),
 *   }}
 * />
 * ```
 */
export type DnDevWrapper = (props: { children: ReactNode }) => ReactNode | null;

/**
 * Layout configuration - simple API for consumers
 *
 * @example
 * ```typescript
 * layout={{
 *   preset: 'admin',
 *   header: { end: () => <MyButton /> }
 * }}
 * ```
 */
export interface LayoutConfig {
  /** Breadcrumbs display behavior */
  breadcrumbs?: 'smart' | 'always' | 'never';
  /**
   * Footer scroll behavior
   * - 'fixed': Footer stays at viewport bottom (default on desktop)
   * - 'scroll': Footer scrolls with content (default on mobile, optional on desktop)
   */
  footerMode?: FooterMode;
  /** Header override - full component or slot overrides */
  header?:
    | DnDevOverride
    | {
        start?: DnDevOverride;
        center?: DnDevOverride;
        end?: DnDevOverride;
      };
  /** Footer override - full component only */
  footer?: DnDevOverride;
  /** Sidebar override - full component or slot overrides */
  sidebar?:
    | DnDevOverride
    | {
        top?: DnDevOverride;
        content?: DnDevOverride;
        bottom?: DnDevOverride;
      };
  /** MergedBar override - full component or slot overrides */
  mergedbar?:
    | DnDevOverride
    | {
        trigger?: DnDevOverride;
        top?: DnDevOverride;
        content?: DnDevOverride;
        bottom?: DnDevOverride;
      };
  /**
   * Main content wrapper — wraps page content inside `<main>`
   *
   * Add custom chrome around page content (split panes, floating panels,
   * terminal docking) without modifying the framework layout.
   * Breadcrumbs, debug tools, and footer remain outside the wrapper.
   *
   * Works with both Vite and Next.js routing.
   *
   * @example
   * ```tsx
   * layout={{
   *   wrapper: ({ children }) => (
   *     <SplitLayout terminal={<Terminal />}>{children}</SplitLayout>
   *   ),
   * }}
   * ```
   */
  wrapper?: DnDevWrapper;
  /** Mobile-specific overrides */
  mobile?: {
    /** Mobile header slot overrides (overrides desktop header on mobile) */
    header?: {
      start?: DnDevOverride;
      center?: DnDevOverride;
      end?: DnDevOverride;
    };
    /** Mobile sidebar slot overrides (overrides desktop sidebar on mobile) */
    sidebar?: {
      top?: DnDevOverride;
      content?: DnDevOverride;
      bottom?: DnDevOverride;
    };
  };
}

/**
 * App metadata and branding configuration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AppMetadata {
  /** Application name */
  name?: string;

  /** Short application name for mobile/compact displays (defaults to name if not set) */
  shortName?: string;

  /** Application description */
  description?: string;

  /** Social and external links */
  links?: {
    /** GitHub repository URL */
    github?: string;
    /** Twitter/X profile URL */
    twitter?: string;
    /** LinkedIn profile URL */
    linkedin?: string;
    /** Support/contact URL */
    support?: string;
    /** Documentation URL */
    docs?: string;
    /** Blog URL */
    blog?: string;
  };

  /** Footer configuration
   * - `null`: Explicitly hide footer
   * - `undefined`: Use framework default footer
   * - `{ copyright?: ..., legalLinks?: ... }`: Custom footer configuration
   */
  footer?: {
    /** Copyright configuration
     * - `null`: Hide copyright
     * - `undefined`: Use default (© YEAR appName. All rights reserved)
     * - `string`: Custom copyright text
     */
    copyright?: null | string;
    /** Legal links configuration
     * - `null`: Hide legal links
     * - `Array<{ path, label }>`: Custom legal links (labels can be i18n keys via maybeTranslate)
     * - `undefined`: Use framework defaults (Privacy Policy, Terms of Service with i18n labels)
     */
    legalLinks?: null | Array<{
      path: string;
      label: string;
    }>;
  } | null;

  /** Additional application metadata */
  metadata?: Record<string, any>;
}

/**
 * Authentication route configuration
 *
 * Configure redirect routes for authentication and authorization failures.
 * Also configures AuthHeader UI behavior (login page, user menu, etc.).
 * All routes are optional with security-first defaults.
 *
 * @example
 * ```typescript
 * const authConfig: AuthConfig = {
 *   authRoute: '/signin',
 *   roleRoute: '/403',
 *   tierRoute: '/pricing',
 *   loginPath: '/login',  // Optional: links to login page (undefined = show providers in header)
 *   profilePath: '/account',
 *   authMenuPaths: ['/dashboard', '/settings']
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthConfig {
  /** Route to redirect when authentication required (default: '/') */
  authRoute?: string;
  /** Route to redirect when role insufficient (default: '/404') */
  roleRoute: string;
  /** Route to redirect when tier insufficient (default: '/404') */
  tierRoute: string;
  /** Optional: Path to login page. If provided, AuthHeader links to login page. If undefined (default), shows providers in header */
  loginPath?: string;
  /** Optional: Path to password reset callback page (default: '/auth/reset-password'). Framework auto-handles the route. */
  resetPasswordPath?: string;
  /** Optional: Path to profile page (default: '/profile') */
  profilePath?: string;
  /**
   * Optional: Custom menu items for authenticated user menu dropdown.
   * Supports route-based items with paths (auto-creates Link).
   * Icons are auto-resolved from route discovery (PageMeta.icon) if not provided.
   * For items with onClick handlers, use AuthMenu customItems prop instead.
   *
   * @example
   * ```typescript
   * authMenuItems: [
   *   { path: '/dashboard' }, // icon auto-resolved from route
   *   { path: '/settings', label: 'Settings' }, // override label, icon from route
   *   { path: '/billing', icon: 'CreditCard' } // override icon
   * ]
   * ```
   */
  authMenuItems?: Array<{
    /** Route path (creates Link automatically) */
    path: string;
    /** Optional label (falls back to navigation item label or path segment) */
    label?: string;
    /** Optional Lucide icon name (string) - overrides route discovery icon */
    icon?: string;
  }>;
  /**
   * Optional function to handle custom data deletion before account removal
   * Framework will try/catch this - failures won't block account deletion
   *
   * @example
   * ```typescript
   * deleteUserFunction: async (userId: string) => {
   *   // Cancel Stripe subscriptions
   *   await fetch('/api/billing/cancel', { method: 'POST' });
   *
   *   // Delete Firestore user data
   *   await deleteDoc(doc(db, 'users', userId));
   *
   *   // Custom cleanup
   *   await myCustomCleanup(userId);
   * }
   * ```
   */
  deleteUserFunction?: (userId: string) => Promise<void>;
}

/**
 * SEO configuration
 *
 * Configure automatic SEO meta tags and social sharing.
 *
 * @example
 * ```typescript
 * const seoConfig: SEOConfig = {
 *   baseUrl: 'https://example.com',
 *   defaultImage: '/og-image.png',
 *   twitterHandle: 'mycompany'
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SEOConfig {
  /** Enable automatic SEO (default: true) */
  enabled?: boolean;
  /** Base URL for SEO files (robots.txt, sitemap.xml) - reads from VITE_APP_URL/NEXT_PUBLIC_APP_URL env var */
  baseUrl?: string;
  /** Site name for SEO - defaults to APP_NAME from app.ts */
  siteName?: string;
  /** Crawl delay for robots.txt (default: 1) */
  crawlDelay?: number;
  /** Generate robots.txt (default: true) */
  generateRobotsTxt?: boolean;
  /** Generate sitemap.xml (default: true) */
  generateSitemap?: boolean;
  /** Default namespace for i18n translations (default: 'home') */
  defaultNamespace?: string;
  /** Default image for social sharing */
  defaultImage?: string;
  /** Twitter handle (without @) */
  twitterHandle?: string;
  /** Additional static meta tags */
  staticTags?: Record<string, string>;
  /** URL redirect rules - generates platform-specific 301/302 redirects at build time */
  redirects?: Array<{
    /** Source path (supports :param syntax, e.g. '/old-blog/:slug') */
    from: string;
    /** Destination path (supports :param syntax, e.g. '/blog/:slug') */
    to: string;
    /** true = 301 permanent (default), false = 302 temporary */
    permanent?: boolean;
  }>;

  // --- SEO/GEO features (all ON by default, opt-out per feature) ---

  /**
   * AI crawler management in robots.txt (default: 'recommended')
   * - 'recommended': Block training bots (GPTBot, Google-Extended, CCBot, ClaudeBot),
   *   allow search/retrieval bots (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, etc.)
   * - 'block-all': Block all AI bots
   * - 'allow-all': Allow all AI bots
   * - false: No AI crawler directives
   */
  aiCrawlers?: 'recommended' | 'block-all' | 'allow-all' | false;
  /** Generate llms.txt per llmstxt.org spec (default: true). Set to false to disable. */
  llmsTxt?: boolean;
  /** Inject Speculation Rules API for prefetch/prerender of internal links (default: true). Set to false to disable. */
  speculationRules?: boolean;
  /** Emit hreflang alternate links when i18n has 2+ languages (default: true). No-op for monolingual apps. Set to false to disable. */
  hreflang?: boolean;
  /** Auto-generate BreadcrumbList JSON-LD from URL path segments (default: true). Set to false to disable. */
  breadcrumbSchema?: boolean;
  /** Auto-generate WebSite JSON-LD with SearchAction for sitelinks search box (default: true). Set to false to disable. */
  websiteSchema?: boolean;
  /** Auto-generate Organization JSON-LD on homepage from app.links (default: true). Set to false to disable. */
  organizationSchema?: boolean;
}

/**
 * Favicon and PWA configuration
 *
 * Configure automatic favicon generation and PWA manifest icons.
 *
 * @example
 * ```typescript
 * const faviconConfig: FaviconConfig = {
 *   appName: 'My App',
 *   themeColor: '#000000',
 *   backgroundColor: '#ffffff'
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FaviconConfig {
  /** Enable automatic favicon system (default: true) */
  enabled?: boolean;
  /** App name for PWA manifest */
  appName?: string;
  /** Theme color for mobile browsers */
  themeColor?: string;
  /** Background color for splash screens */
  backgroundColor?: string;
  /** Include PWA manifest icons */
  includeManifestIcons?: boolean;
  /** Include Microsoft tile icons */
  includeMSIcons?: boolean;
}

/**
 * Feature flags and debug configuration
 *
 * Controls app behavior and GDPR compliance.
 * Feature availability is auto-detected via env vars/packages.
 *
 * @example
 * ```typescript
 * const featuresConfig: FeaturesConfig = {
 *   debug: true,
 *   offlineTrustEnabled: true,
 *   requiredCookies: ['necessary', 'analytics']
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FeaturesConfig {
  /** Enable debug tools (default: false in production, true in development) */
  debug?: boolean;

  /**
   * Enable offline trust for cached claims (default: false)
   *
   * When true:
   * - Online: Always verify with server (don't trust cache)
   * - Offline: Use cached claims (graceful degradation)
   *
   * When false:
   * - Online: Always verify with server
   * - Offline: Reject (throw error, require network)
   *
   * @default false
   */
  offlineTrustEnabled?: boolean;

  /**
   * Cookie consent categories to display in GDPR banner
   *
   * Controls which cookie categories users can consent to.
   * Framework always includes 'necessary' (cannot be disabled).
   *
   * @example
   * ```typescript
   * features: {
   *   requiredCookies: ['necessary', 'functional', 'analytics']
   * }
   * ```
   *
   * @default ['necessary']
   */
  requiredCookies?: string[];
}

/**
 * Complete application configuration
 *
 * Consolidates all app-level configuration with smart defaults.
 * Pass only what you need to override - everything has sensible defaults.
 *
 * @example
 * ```typescript
 * // Minimal configuration
 * const config: AppConfig = {
 *   app: { name: 'My App' }
 * };
 *
 * // Full configuration
 * const config: AppConfig = {
 *   app: {
 *     name: 'My App',
 *     description: 'Professional app'
 *   },
 *   auth: {
 *     authRoute: '/signin',
 *     roleRoute: '/403',
 *     tierRoute: '/pricing'
 *   },
 *   seo: {
 *     defaultImage: '/og.png'
 *   },
 *   preset: 'landing',
 *   features: {
 *     debug: true
 *   }
 * };
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
/**
 * Query cache configuration
 *
 * Configure default TanStack Query cache behavior for your app.
 * These settings apply to all queries unless overridden per-query.
 *
 * **Framework Defaults (Infinite Cache):**
 * - `staleTime: Infinity` (data never becomes stale)
 * - `refetchOnWindowFocus: false` (manual refresh only)
 * - `refetchOnReconnect: false` (manual refresh only)
 *
 * This default strategy minimizes API costs and is ideal for:
 * - Single-admin apps
 * - Apps with manual refresh buttons
 * - Cost-optimized scenarios
 *
 * @example
 * ```typescript
 * // Use framework defaults (infinite cache, no auto-refetch)
 * // No query config needed - defaults are optimal
 * ```
 *
 * @example
 * ```typescript
 * // Override to short cache with auto-refetch
 * query: {
 *   staleTime: 1000 * 60 * 5,  // 5 minutes
 *   refetchOnWindowFocus: true,
 *   refetchOnReconnect: true,
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface QueryConfig {
  /** Time until data is considered stale (default: Infinity = never stale) */
  staleTime?: number;
  /** Time until inactive data is garbage collected (default: 30 minutes) */
  gcTime?: number;
  /** Number of retry attempts for failed queries (default: 1) */
  retry?: number;
  /** Whether to refetch when window regains focus (default: false = manual refresh only) */
  refetchOnWindowFocus?: boolean;
  /** Whether to refetch on reconnect (default: false = manual refresh only) */
  refetchOnReconnect?: boolean;
  /** Mutation retry attempts (default: 1) */
  mutationRetry?: number;
  /** Mutation retry delay function (default: exponential backoff) */
  mutationRetryDelay?: (attemptIndex: number) => number;
}

/** Top-level application configuration passed to DoNotDevProvider. */
export interface AppConfig {
  /** App metadata and branding */
  app?: AppMetadata;
  /** Authentication routes - partial override of defaults */
  auth?: Partial<AuthConfig> | false;
  /** SEO configuration (set to false to disable) */
  seo?: SEOConfig | false;
  /** Favicon configuration (set to false to disable) */
  favicon?: FaviconConfig | false;
  /** Layout preset for store initialization (defaults to 'landing' if invalid/empty) */
  preset?: string;
  /** Custom presets — same shape as built-in presets, keyed by name */
  customPresets?: Record<string, PresetConfig>;
  /** Feature flags */
  features?: FeaturesConfig;
  /** Query cache configuration (defaults: 5min staleTime, refetch on focus/reconnect) */
  query?: QueryConfig;
  /**
   * Server-side rendering (Next adapter). **Defaults to `true`** — generated page
   * wrappers render directly and the provider tree renders on the server, so page
   * content is present in the initial HTML (real, crawlable SSR). Set to `false`
   * to opt OUT and restore the legacy client-only render (content appears only
   * after hydration). The provider tree is store-driven, so SSR routes render
   * dynamically at request time.
   */
  ssr?: boolean;
}

/**
 * Custom store configuration for app-specific stores
 *
 * Allows apps to register custom Zustand stores with the framework's
 * store initialization system. Custom stores benefit from:
 * - Shell loader integration (critical stores block render)
 * - Retry logic and error handling
 * - Unified initialization flow
 *
 * @example
 * ```typescript
 * const customStores: CustomStoreConfig[] = [{
 *   name: 'dndop',
 *   type: 'critical',
 *   store: useDndopStore,
 * }];
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface CustomStoreConfig {
  /** Store name for logging and debugging */
  name: string;
  /**
   * Store initialization priority
   * - 'critical': Blocks render until ready, shell loader stays visible
   * - 'regular': Initializes in background after critical stores
   */
  type: 'critical' | 'regular';
  /**
   * Zustand store reference (hook)
   * Can be called as a hook with a selector: `store((state) => state.isReady)`
   * Also has a .getState() method for direct state access
   */
  store: {
    (selector: (state: any) => any): any;
    getState: () => {
      initialize?: () => Promise<boolean | void>;
      [key: string]: any;
    };
    subscribe: (listener: () => void) => () => void;
  };
}

/**
 * AppProviders props interface with slot-based layout customization
 */
/**
 * Application providers props
 *
 * Clean, minimal API for configuring application providers with smart defaults.
 *
 * @example
 * ```typescript
 * // Minimal configuration
 * <ViteAppProviders
 *   config={{ app: { name: 'My App' } }}
 * />
 *
 * // Full configuration
 * <ViteAppProviders
 *   config={{
 *     app: { name: 'My App' },
 *     auth: { authRoute: '/signin' },
 *     seo: {},
 *     layout: { preset: 'landing' },
 *     features: { debug: true }
 *   }}
 *   layout={{
 *     header: { end: () => <LoginButton /> },
 *     footer: () => <CustomFooter />
 *   }}
 * />
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AppProvidersProps {
  /**
   * Consolidated application configuration
   *
   * All configuration is optional with smart defaults.
   * Pass only what you need to override.
   */
  config?: AppConfig;

  /**
   * Layout configuration - simple API for customizing layout
   *
   * @example
   * ```typescript
   * // Preset only
   * layout={{ preset: 'admin' }}
   *
   * // Slot override
   * layout={{ header: { end: () => <MyButton /> } }}
   *
   * // Full override
   * layout={{ header: () => <CustomHeader /> }}
   * ```
   */
  layout?: LayoutConfig;

  /**
   * Child components
   *
   * Custom routing content. When provided, overrides framework routing.
   */
  children?: ReactNode;

  /**
   * Custom store configurations
   *
   * Register Zustand stores to benefit from shell loader, retry logic,
   * error handling. Critical stores block render.
   *
   * @example
   * ```typescript
   * customStores={[{
   *   name: 'dndop',
   *   type: 'critical',
   *   store: useDndopStore,
   * }]}
   * ```
   */
  customStores?: CustomStoreConfig[];
}

/**
 * Resolved layout configuration interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface ResolvedLayoutConfig {
  /** Current preset name */
  preset: LayoutPreset;

  /** Resolved app configuration */
  app: {
    name: string;
    metadata: Record<string, any>;
  };
}
