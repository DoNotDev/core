/**
 * @fileoverview DNDev Configuration Constants
 * @description Single source of truth for ALL patterns, paths, and configuration used throughout the DoNotDev framework.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// ===== ROUTE DISCOVERY CONSTANTS =====
export const ROUTE_DISCOVERY = {
  // DNDEV Convention: HomePage.tsx is always the root route
  HOMEPAGE_FILE: 'HomePage.tsx',
  HOMEPAGE_PATH: '/',
  HOMEPAGE_COMPONENT: 'HomePage',
};

// ===== FEATURE DISCOVERY CONSTANTS =====
export const FEATURE_DISCOVERY = {
  // Plugin configuration
  pluginName: 'dndev-vite-feature-discovery',
  icon: '🔧',

  // Source identifiers
  sources: {
    configArray: 'config-array',
    empty: 'empty',
  },

  // Default file paths
  defaultFeaturesFile: 'src/features.generated.ts',
  defaultManifestFile: 'public/feature-manifest.json',

  // Log messages
  messages: {
    loaded: 'Loaded {count} features ({enabled} enabled)',
    noFeatures: 'No features enabled - check your configuration',
    invalidFeature:
      "Invalid feature '{feature}'. Available features: {available}",
    validatedFeatures: 'Validated features: {features}',
    invalidFeatures: 'Invalid features: {features}',
  },
};

// ===== VIRTUAL MODULE IDS =====
export const VIRTUAL_MODULES = {
  routes: 'virtual:routes',
  themes: 'virtual:themes',
  i18n: 'virtual:i18n-mapping',
  assets: 'virtual:assets',
  env: 'virtual:env',
  blog: '@donotdev/blog-content',
};

// ===== CONFIG KEYS (for _DNDEV_CONFIG_ properties) =====
// Single source of truth for config keys used by both Vite and Next.js
export const CONFIG_KEYS = {
  routes: 'routes',
  themes: 'themes',
  i18n: 'i18n',
  assets: 'assets',
  env: 'env',
};

// ===== GENERATED FILE PATHS =====
export const GENERATED_PATHS = {
  // Next.js generated files (app-specific only, no providers)
  next: {
    middleware: 'middleware.ts',
    routeManifest: 'public/route-manifest.json',
    assetManifest: 'public/asset-manifest.json',
    utilities: 'src/styles/utilities.generated.css',
    // NEW: App directory generation paths for Site template
    appPages: 'src/app', // Base directory for generated app/** files
    appLayout: 'src/app/layout.tsx', // Layout file location (user-owned)
    // Config files (one per handler to avoid overwrites)
    configRoute: 'src/config/dndev-config-route.js',
    configTheme: 'src/config/dndev-config-theme.js',
    configI18n: 'src/config/dndev-config-i18n.js',
    configPwa: 'src/config/dndev-config-pwa.js',
    configAsset: 'src/config/dndev-config-asset.js',
    configSeo: 'src/config/dndev-config-seo.js',
    configEnv: 'src/config/dndev-config-env.js',
    configServer: 'src/config/dndev-config-server.js',
    blogContent: 'src/content/blog/blog-content.generated.ts',
  },

  // Manifests
  manifests: {
    route: 'route-manifest.json',
    theme: 'theme-manifest.json',
    i18n: 'i18n-manifest.json',
    asset: 'asset-manifest.json',
    feature: 'feature-manifest.json',
    env: 'env-manifest.json',
  },
};

// ===== FRAMEWORK CONFIGURATION =====
export const FRAMEWORK_CONFIG = {
  // Default framework package
  package: '@donotdev/ui',

  // Asset paths within framework package (relative to repoRoot)
  assetsPath: 'packages/ui/assets',

  // Browser support targets
  browserTargets: [
    '> 1%',
    'last 2 versions',
    'Firefox ESR',
    'not dead',
    'not op_mini all',
  ],
};

// ===== DIRECTORY PATHS =====
export const DIR_PATHS = {
  public: 'public',
  fonts: 'fonts',
  nodeModules: 'node_modules',
  packages: 'packages',
  core: 'core',
  ui: 'ui',
};

// ===== I18N PATHS (Single Source of Truth) =====
export const I18N_PATHS = {
  // Monorepo source structure (locales at root, not in src/)
  SOURCE_ROOT: 'packages/core/i18n',
  SOURCE_LOCALES: 'packages/core/i18n/locales',
  SOURCE_EAGER: 'packages/core/i18n/locales/eager',
  SOURCE_LAZY: 'packages/core/i18n/locales/lazy',
  // Published structure (same as source - no flattening needed)
  PUBLISHED_ROOT: 'i18n',
  PUBLISHED_LOCALES: 'i18n/locales',
  PUBLISHED_EAGER: 'i18n/locales/eager',
  PUBLISHED_LAZY: 'i18n/locales/lazy',
};

// ===== SCAN PATTERNS =====
export const SCAN_PATTERNS = {
  routes: {
    consumer: ['src/**/*Page.tsx', 'src/pages/**/*Page.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.tsx',
      '**/*.stories.tsx',
    ],
    extensions: ['.tsx'],
  },

  css: {
    consumer: ['src/**/*.css'],
    themes: ['src/**/*.css'],
    extensions: ['.css', '.scss', '.sass'],
    framework: [
      'packages/ui/src/**/*.css',
      'packages/core/components/src/**/*.css',
      'packages/core/templates/src/**/*.css',
    ],
  },

  i18n: {
    eager: ['src/locales/*_*.json'],
    lazy: [
      'src/**/locales/*_*.json',
      '!src/locales/*_*.json',
      // Auto-detect shared entity translations in monorepos (if exists, use it; if not, no problem)
      '../../entities/locales/*_*.json',
    ],
    // Additional paths from workspace packages (e.g., shared entities)
    // Consumers can still configure via i18n.additionalPaths in dndev/vite config for custom paths
    // Example: ['../../packages/shared/locales/*_*.json']
    additional: [],
    framework: {
      eager: [`${I18N_PATHS.SOURCE_EAGER}/*_*.json`],
      lazy: [`${I18N_PATHS.SOURCE_LAZY}/*_*.json`],
    },
    extensions: ['.json'],
  },

  assets: {
    consumer: ['public/**/*'],
    fallback: ['manifest.json'],
    modern: [
      'logo.svg',
      'favicon.svg',
      'apple-touch-icon.png',
      'android-chrome-192x192.png',
      'android-chrome-512x512.png',
    ],
    patterns: [
      'favicon.svg',
      'favicon.ico',
      'favicon-*.png',
      'logo.svg',
      'logo.png',
      'logo.webp',
      'logo.avif',
      'apple-touch-icon*.png',
      'android-chrome-*.png',
      'manifest.json',
    ],
    fonts: ['fonts/**/*.woff2', 'fonts/**/*.woff', 'fonts/**/*.ttf'],
    framework: ['packages/ui/assets/**/*'],
  },

  pwa: {
    consumer: [
      'public/manifest.json',
      'public/service-worker.js',
      'public/sw.js',
      'public/icon-192x192.png',
      'public/icon-512x512.png',
      'public/favicon.ico',
      'public/favicon.svg',
      'public/apple-touch-icon.png',
      'public/logo.svg',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    extensions: ['.json', '.js', '.png', '.svg', '.ico'],
    framework: ['packages/ui/assets/**/*'],
  },

  globalIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/test/**',
  ],
};

// ===== BUNDLING CONFIGURATION =====
// Single source of truth for all bundling-related lists
// ⚠️ SYNC REQUIRED: When adding/removing optional features, also update:
//    - packages/cli/dependencies-matrix.json (scaffolding source of truth)
//    - Both files must list the same feature packages
export const BUNDLING = {
  // Mandatory third-party dependencies - required for framework to function
  // These are always included in optimizeDeps.include
  // NOTE: @donotdev/* packages are NOT listed here — they are dynamically
  // detected from node_modules/@donotdev/ at config time (resolveConfig.js).
  // This avoids noise when a package isn't installed (e.g. firebase in supabase apps).
  mandatoryIncludes: [
    // React ecosystem
    'react',
    'react-dom',
    'react-router-dom',
    // State management
    'zustand',
    'zustand/middleware',
    // Icons
    'lucide-react',
    // Validation
    'valibot',
    // i18n
    'i18next',
    'i18next-browser-languagedetector',
    'i18next-http-backend',
    'react-i18next',
    // Data fetching
    '@tanstack/react-query',
    // Head management
    'react-helmet-async',
  ],

  // @donotdev/* feature packages that consumers may or may not install.
  // Used for unused feature exclusion in webpack externals.
  // Third-party optional deps (shiki, @tiptap/*) are auto-detected from
  // installed @donotdev packages' peerDependenciesMeta — see detectOptionalDeps.js
  // Auto-detected from installed @donotdev/*/package.json peerDependenciesMeta.
  // No hardcoded list — dependencies-matrix.json + package.json is the source of truth.
  // See scanInstalledPackageOptionals() in detectOptionalDeps.js.
  optionalFeatures: [],

  // Dependencies bundled into @donotdev/core
  coreBundled: [
    '@donotdev/types',
    '@donotdev/utils',
    '@donotdev/stores',
    '@donotdev/schemas',
    '@donotdev/hooks',
    '@donotdev/i18n',
    '@donotdev/config',
  ],

  // Dependencies bundled into @donotdev/components
  componentsBundled: [
    'class-variance-authority',
    'clsx',
    'lucide-react',
    'react-day-picker',
  ],

  // Radix UI pattern - all @radix-ui/* packages are bundled
  radixUIPattern: '@radix-ui/',

  // Build tools - not runtime dependencies, shouldn't be optimized
  buildTools: [
    'esbuild',
    '@esbuild/win32-x64',
    '@esbuild/darwin-x64',
    '@esbuild/linux-x64',
    '@esbuild/darwin-arm64',
    '@esbuild/linux-arm64',
    'vite',
    'rollup',
    'rollup-plugin-visualizer',
    '@vitejs/plugin-react',
    'vite-tsconfig-paths',
    'vite-plugin-pwa',
    'vite-plugin-compression2',
    'vite-plugin-node-polyfills',
    'fsevents',
    'postcss',
    'postcss-import',
    'postcss-nesting',
    'autoprefixer',
  ],

  // Build-time only packages - used during build/config, not at runtime
  // These should be excluded from transpilePackages in Next.js
  // Note: @donotdev/config is a subpackage of @donotdev/core, so it shouldn't be transpiled separately
  // Apps import from @donotdev/core/next, not @donotdev/config directly
  buildTimePackages: [],

  // Large optional dependencies - load when needed
  largeOptional: [
    '@sentry/react',
    'framer-motion',
    'stripe',
    '@tanstack/react-query',
    'shiki',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-placeholder',
    'sharp',
    'semver',
    'file-type',
  ],
};

// ===== SERVER-ONLY PACKAGES (for shimming/externalizing) =====
export const SERVER_ONLY_PACKAGES = [
  'firebase-admin',
  'gcp-metadata',
  'google-logging-utils',
  'payload',
  'undici',
  '@fastify/busboy',
  'image-size',
  '@donotdev/tooling',
  'fs',
  'path',
  'crypto',
  'net',
  'tls',
  'http',
  'https',
  'child_process',
  'os',
  'util',
  'stream',
  'buffer',
  'events',
  'querystring',
  'url',
  'zlib',
  'assert',
  'constants',
  'domain',
  'punycode',
  'string_decoder',
  'timers',
  'tty',
  'vm',
  'worker_threads',
  'cluster',
  'dgram',
  'dns',
  'http2',
  'inspector',
  'module',
  'perf_hooks',
  'process',
  'readline',
  'repl',
  'trace_events',
  'v8',
  'wasi',
];

// ===== SERVER-ONLY SUBPATH EXPORTS (for blocking in client code) =====
// These are @donotdev/core subpath exports that should never be bundled into client code
export const SERVER_ONLY_SUBPATHS = [
  '@donotdev/core/functions',
  '@donotdev/core/server',
];

// ===== CSS EXTRACTION PATTERNS =====
export const CSS_PATTERNS = {
  selectors: {
    class: /\.([a-zA-Z0-9-]+)/g,
    variable: /--[a-zA-Z0-9-]+/g,
    keyframe: /@keyframes\s+([a-zA-Z0-9-]+)/g,
  },

  themes: {
    themeClass: /(?::root\.|\.)([a-z][a-z0-9-]+)\s*\{([\s\S]*?)\}/gim,
    themeLabel: /--theme-label\s*:\s*['"]([^'"]+)['"]/,
    themeIcon: /--theme-icon\s*:\s*['"]([^'"]+)['"]/,
    themeIsDark: /--theme-is-dark\s*:\s*(0|1)/,
  },
};

/**
 * Font family display name → @fontsource package stem.
 * Used by resolveFontManifest() to map CSS font families to fontsource packages.
 */
export const FONT_FAMILY_TO_STEMS = {
  Inter: 'inter',
  'Space Grotesk': 'space-grotesk',
  'Playfair Display': 'playfair-display',
  'Press Start 2P': 'press-start-2p',
  Roboto: 'roboto',
};

/**
 * Weights imported per font stem (mirrors dndev.css @import declarations).
 */
export const FONT_WEIGHTS = {
  inter: [300, 400, 600, 700],
  'playfair-display': [400, 500, 600, 700],
  roboto: [400, 700],
  'space-grotesk': [300, 400, 500, 600, 700],
  'press-start-2p': [400],
};

/**
 * Locale code → fontsource unicode-range subset names.
 * Used to filter font files at build time to only include needed subsets.
 * Empty array = system fonts (CJK/RTL), no fontsource subsets needed.
 */
export const LOCALE_TO_FONT_SUBSETS = {
  // Latin-script languages
  en: ['latin'],
  fr: ['latin'],
  es: ['latin'],
  de: ['latin'],
  it: ['latin'],
  pt: ['latin'],
  nl: ['latin'],
  da: ['latin'],
  sv: ['latin'],
  nb: ['latin'],
  fi: ['latin'],
  pl: ['latin'],
  cs: ['latin'],
  sk: ['latin'],
  hr: ['latin'],
  sl: ['latin'],
  hu: ['latin'],
  ro: ['latin'],
  et: ['latin'],
  lv: ['latin'],
  lt: ['latin'],
  mt: ['latin'],
  ga: ['latin'],
  ca: ['latin'],
  eu: ['latin'],
  gl: ['latin'],
  af: ['latin'],
  sw: ['latin'],
  tr: ['latin'],
  id: ['latin'],
  ms: ['latin'],
  tl: ['latin'],
  // Latin-ext (diacritics beyond basic latin)
  vi: ['latin', 'vietnamese'],
  // Cyrillic-script languages
  ru: ['latin', 'cyrillic'],
  bg: ['latin', 'cyrillic'],
  uk: ['latin', 'cyrillic'],
  sr: ['latin', 'cyrillic'],
  mk: ['latin', 'cyrillic'],
  be: ['latin', 'cyrillic'],
  // Greek
  el: ['latin', 'greek'],
  // CJK / RTL → system fonts, no fontsource subsets
  zh: [],
  ja: [],
  ko: [],
  ar: [],
  he: [],
  th: [],
  hi: [],
  bn: [],
  ta: [],
};

// ===== ESSENTIAL DEFAULTS =====
export const ESSENTIAL_THEMES = [
  {
    name: 'light',
    displayName: 'Light',
    icon: 'Sun',
    isDark: false,
  },
];

// ===== FAST-GLOB OPTIONS =====
export const GLOB_OPTIONS = {
  base: {
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_PATTERNS.globalIgnore,
  },

  css: {
    absolute: true,
    onlyFiles: true,
    ignore: [...SCAN_PATTERNS.globalIgnore, '**/*.test.css'],
  },

  routes: {
    absolute: true,
    onlyFiles: true,
    ignore: [
      ...SCAN_PATTERNS.globalIgnore,
      '**/*.test.tsx',
      '**/*.stories.tsx',
    ],
  },

  i18n: {
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_PATTERNS.globalIgnore,
  },

  assets: {
    absolute: true,
    onlyFiles: true,
    ignore: SCAN_PATTERNS.globalIgnore,
  },
};

// ===== HELPER FUNCTIONS =====

/**
 * Get scan patterns for a specific plugin type
 */
export function getPatternsFor(type, repoRoot = null) {
  const patterns = SCAN_PATTERNS[type];
  if (!patterns) {
    throw new Error(`Unknown pattern type: ${type}`);
  }

  if (repoRoot && patterns.framework) {
    return {
      ...patterns,
      framework: patterns.framework.map((pattern) => `${repoRoot}/${pattern}`),
    };
  }

  return patterns;
}

/**
 * Get fast-glob options for a specific plugin type
 */
export function getGlobOptionsFor(type) {
  return GLOB_OPTIONS[type] || GLOB_OPTIONS.base;
}
