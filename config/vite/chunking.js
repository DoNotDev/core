/**
 * @fileoverview Vite Chunking Configuration
 * @description Minimal chunking strategy using manualChunks (Vite 7.2.2)
 *
 * Groups the synchronous render graph (react-core) to prevent useLayoutEffect errors.
 * Everything else is handled automatically by Vite's excellent chunking.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * React-core patterns for chunking
 * Groups the synchronous render graph for improved experience and performance
 */
const REACT_CORE_PATTERNS = [
  // The Kernel
  '/react/',
  '/react-dom/',
  '/scheduler/',
  // Context Providers (accessed synchronously)
  '/react-router',
  // Side-effect heavy UI (uses useLayoutEffect)
  '/@radix-ui/',
  '/react-day-picker/',
  // State managers (synchronous subscriptions)
  '/react-hook-form/',
  // i18n - uses React context, must load with React
  '/react-i18next/',
  // Styling utilities (used in every render)
  '/clsx/',
  '/class-variance-authority/',
];

/**
 * Vendor library chunk patterns
 * Large libraries that should be split into their own chunks for better caching
 *
 * Note: Only chunk node_modules, not workspace packages (e.g., @donotdev/*)
 * Workspace packages are bundled with app code for better tree-shaking
 *
 * Note: Firebase SDK has static imports in @donotdev/firebase/sdk, so even though
 * FirebaseAuth is lazy loaded, the SDK itself can bloat the main bundle.
 * Chunking Firebase ensures it's in a separate chunk for better caching.
 */
const VENDOR_CHUNKS = {
  valibot: ['/valibot/'],
  firebase: ['/firebase/', '/@firebase/'],
  // Note: lucide-react is imported from node_modules, not workspace packages
  // If you have lucide in both, only node_modules will be chunked (by design)
  lucide: ['/lucide-react/', '/lucide/'],
  i18n: [
    '/i18next/',
    // react-i18next moved to react-core (needs React context)
    '/i18next-browser-languagedetector/',
    '/i18next-http-backend/',
    '/@donotdev/i18n/',
  ],
  zustand: ['/zustand/'],
  'tanstack-query': ['/@tanstack/react-query/', '/@tanstack/query-core/'],
};

/**
 * Check if a module ID is a virtual module
 * Virtual modules can have IDs like 'virtual:xxx' or '\0virtual:xxx' (with null byte)
 *
 * @param {string} id - Module ID from Rollup
 * @returns {string|undefined} Virtual module name or undefined if not a virtual module
 */
function getVirtualModuleName(id) {
  // Handle both 'virtual:xxx' and '\0virtual:xxx' formats
  const virtualMatch = id.match(/(?:^|\0)virtual:([^?]+)/);
  if (virtualMatch) {
    return virtualMatch[1]; // Returns 'i18n-mapping', 'routes', etc.
  }
  return undefined;
}

/**
 * Normalize and clean module ID for pattern matching
 *
 * @param {string} id - Module ID from Rollup
 * @returns {string|undefined} Cleaned ID or undefined if not a node_modules path
 */
function normalizeModuleId(id) {
  // Normalize path separators (Windows uses \, Unix uses /)
  const normalizedId = id.replace(/\\/g, '/');

  // Only process node_modules (skip app code)
  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  // Handle dynamic imports and query parameters
  return normalizedId.split('?')[0];
}

/**
 * Check if a module ID matches any react-core pattern
 *
 * @param {string} cleanId - Normalized module ID (no query params, forward slashes)
 * @param {Array<string>} patterns - Patterns to check against
 * @returns {boolean} True if matches any pattern
 */
function matchesReactCore(cleanId, patterns = REACT_CORE_PATTERNS) {
  return patterns.some((pattern) => cleanId.includes(pattern));
}

/**
 * Get vendor chunk name for a module ID
 *
 * @param {string} cleanId - Normalized module ID (no query params, forward slashes)
 * @returns {string|undefined} Chunk name or undefined if no match
 */
function getVendorChunk(cleanId) {
  for (const [chunkName, patterns] of Object.entries(VENDOR_CHUNKS)) {
    if (patterns.some((pattern) => cleanId.includes(pattern))) {
      return chunkName;
    }
  }
  return undefined;
}

/**
 * Minimal chunking strategy using manualChunks (Vite 7.2.2)
 *
 * TESTING: React-core NOT chunked (bundled with app code)
 * Only vendor libraries are chunked for better caching.
 * Virtual modules (especially i18n-mapping) are chunked separately.
 * Everything else is handled automatically by Vite's excellent chunking.
 *
 * @param {string} id - Module ID from Rollup
 * @param {Object} options - Additional options (unused, but part of Rollup API)
 * @returns {string|undefined} Chunk name or undefined for default chunking
 */
export function getManualChunks(id) {
  // 🌐 Check for virtual modules first (before node_modules check)
  // Virtual modules like 'virtual:i18n-mapping' can be large and should be chunked separately
  const virtualModuleName = getVirtualModuleName(id);
  if (virtualModuleName) {
    // Chunk i18n-mapping separately (config + eager content)
    if (virtualModuleName === 'i18n-mapping') {
      return 'virtual-i18n-mapping';
    }
    // Each lazy i18n virtual module gets its own chunk for true code splitting
    // e.g. 'i18n-lazy-crud-en' → chunk 'i18n-lazy-crud-en'
    if (virtualModuleName.startsWith('i18n-lazy-')) {
      return virtualModuleName;
    }
    // All other virtual modules together
    return 'virtual-modules';
  }

  const cleanId = normalizeModuleId(id);
  if (!cleanId) return undefined;

  // 📦 React-core chunk: React, ReactDOM, Radix UI, React Router - cached separately
  if (matchesReactCore(cleanId)) {
    return 'react-core';
  }

  // 📦 Split large vendor libraries into separate chunks
  const vendorChunk = getVendorChunk(cleanId);
  if (vendorChunk) {
    return vendorChunk;
  }

  // 🚀 TRUST VITE: Let Vite handle everything else automatically
  return undefined;
}

/**
 * Create extended manualChunks function that includes user's additional patterns
 *
 * User patterns are APPENDED to framework patterns (framework patterns come first)
 * Duplicates are removed to ensure each pattern is checked only once
 *
 * @param {Array<string>} additionalPatterns - Additional string patterns to append to react-core
 * @returns {Function} manualChunks function
 */
function createExtendedManualChunks(additionalPatterns = []) {
  // Framework patterns first, then user patterns (appended, not replaced)
  // Deduplicate: remove any user patterns that already exist in framework patterns
  const uniqueUserPatterns = additionalPatterns.filter(
    (pattern) => !REACT_CORE_PATTERNS.includes(pattern)
  );
  const allPatterns = [...REACT_CORE_PATTERNS, ...uniqueUserPatterns];

  return function (id) {
    const cleanId = normalizeModuleId(id);
    if (!cleanId) return undefined;

    // Check all patterns (framework + user's additional)
    if (matchesReactCore(cleanId, allPatterns)) {
      return 'react-core';
    }

    return undefined;
  };
}

/**
 * Chunking configuration for different build modes
 *
 * Convention: No chunking in development for faster HMR and simpler debugging.
 * Production uses manualChunks for optimal performance.
 */
export const CHUNKING_CONFIG = {
  development: {
    // No chunking in dev - faster HMR, simpler debugging
    manualChunks: undefined,
  },
  production: {
    manualChunks: getManualChunks, // Testing: vendor chunks only, react-core bundled
  },
};

/**
 * Get chunking configuration based on mode and user options
 *
 * Follows framework pattern: Trust merged config from options.js
 * User's chunking.reactCore patterns are APPENDED to framework defaults (not replaced)
 *
 * @param {string} mode - Build mode ('development' or 'production')
 * @param {Object} chunkingOptions - Chunking options (already merged from DEFAULT_OPTIONS)
 * @returns {Object} Chunking configuration with manualChunks property
 *
 * @example
 * // In vite.config.ts - Extend react-core with a new React-dependent library
 * // Framework patterns are always included, user patterns are appended
 * export default defineViteConfig({
 *   chunking: {
 *     reactCore: ['/my-react-library/'] // Appended to framework's REACT_CORE_PATTERNS
 *   }
 * })
 */
export function getChunkingConfig(mode, chunkingOptions = {}) {
  const baseConfig = CHUNKING_CONFIG[mode] || CHUNKING_CONFIG.production;

  // Trust merged config - chunkingOptions.reactCore contains user's patterns
  const userReactCorePatterns = chunkingOptions.reactCore || [];

  // If user provided reactCore patterns, append them to framework patterns
  if (userReactCorePatterns.length > 0) {
    const extendedChunks = createExtendedManualChunks(userReactCorePatterns);
    return { manualChunks: extendedChunks };
  }

  // Use base config (no user extensions)
  return baseConfig;
}
