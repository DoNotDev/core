/**
 * @fileoverview Base Next.js Handler - Platform Adapter Foundation
 * @description Common patterns for transforming discovery data into Next.js compatible format.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { GENERATED_PATHS, CONFIG_KEYS, NEXT_RENDER } from '../../constants.js';
import { DEFAULT_OPTIONS } from '../../next/options.js';
import { createBuildError } from '../../utils/buildError.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';
import {
  PUBLIC_READER_DEPENDENCIES,
  publicReaderProvider,
} from '../../utils/publicReaders.js';

/**
 * Discovery options every Next handler passes (whatever the app's config):
 * `pageGenerateMetadata`, a page module's own `generateMetadata` sets its identity
 * (route discovery's dynamic-route SEO check counts it; Vite has no server).
 * @since 0.3.2
 */
export const NEXT_DISCOVERY_OPTIONS = Object.freeze({ pageGenerateMetadata: true });

/**
 * Code text of each public reader in a generated Next file ({@link BaseNextHandler#serverCrudReader}),
 * by provider of `PUBLIC_READERS` (`utils/publicReaders.js`, the table the Vite build reads
 * in process): the names it imports from the reader module, the comment on who decides
 * what a signed-out visitor reads, and the `CRUD` construction from the env constants.
 */
const NEXT_READER_CODE = Object.freeze({
  '@donotdev/supabase': {
    exports: 'createPublicServerClient, SupabasePublicReader',
    comment: 'RLS returns what a signed-out visitor can read.',
    construct: `new SupabasePublicReader(
  createPublicServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY)
)`,
  },
  '@donotdev/firebase': {
    exports: 'createPublicServerFirestore, FirestorePublicReader',
    comment: 'Security Rules return what a signed-out visitor can read.',
    construct: `new FirestorePublicReader(
  createPublicServerFirestore({ apiKey: FIREBASE_API_KEY, projectId: FIREBASE_PROJECT_ID })
)`,
  },
});

export class BaseNextHandler {
  constructor(discoveryClass, defaultOptions = {}) {
    // Trust merged config - no local defaults override.
    // getHandlerDefaults() is spread FIRST so it only fills gaps: spreading it last
    // let a hardcoded default silently beat an explicit app setting. That is how an
    // app declaring i18n.fallbackLanguage: 'fr' still shipped <html lang="en">,
    // which disables French hyphenation and mislabels the page for screen readers
    // and crawlers.
    this.options = {
      ...this.getHandlerDefaults(), // Handler-specific fallbacks
      ...defaultOptions, // Already merged from config — always wins
    };

    // Initialize logger
    this.logger = createLogger(
      `Next${this.getHandlerName()}Handler`,
      this.options.debug,
      this.options.verbose
    );

    // Use PathResolver singleton - appRoot already set in defineNextConfig()
    this.pathResolver = PathResolver.getInstance();
    this.configRoot = this.pathResolver.getAppRoot();
    this.discovery = this.createDiscovery(discoveryClass);

    // Handler-specific initialization
    this.initialize();
  }

  /**
   * Cache lifetime written into generated Next routes (`export const revalidate`):
   * `appConfig.revalidate` (seconds, or `false` = kept until the next deploy),
   * default `NEXT_RENDER.revalidateSeconds`.
   *
   * @returns {number | false}
   * @throws When the value is neither a whole number of seconds above 0 nor `false`
   * @since 0.2.6
   */
  revalidate() {
    const value = this.options.revalidate ?? NEXT_RENDER.revalidateSeconds;
    if (value === false || (Number.isInteger(value) && value > 0)) return value;
    throw new Error(
      `appConfig.revalidate must be a whole number of seconds above 0, or false (kept until the next deploy). Got ${JSON.stringify(value)}.`
    );
  }

  /**
   * Cache lifetime in words, for generated-file comments.
   *
   * @returns {string}
   * @since 0.2.6
   */
  revalidateLabel() {
    const value = this.revalidate();
    return value === false
      ? 'kept until the next deploy'
      : `re-rendered at most every ${value}s`;
  }

  /**
   * Whether the app's package.json lists a dependency.
   * @param {string} name
   * @returns {boolean}
   */
  appDependsOn(name) {
    const pkg = this.pathResolver.readSync(
      this.pathResolver.resolveAppPath('package.json'),
      { format: 'json' }
    );
    return Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
  }

  /**
   * Server-side public reader for a generated file that reads published records (sitemap
   * and llms.txt routes, prerendered entity pages): built from the app's provider package
   * and its public env variables, never from the app's client bootstrap
   * (src/config/providers.ts loads client code), never from a privileged key. Only when
   * a route lists records.
   *
   * - `@donotdev/supabase`: anonymous client (`NEXT_PUBLIC_SUPABASE_URL`,
   *   `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`), RLS decides what it reads.
   * - `@donotdev/firebase` (since 0.3.1): Firestore Web SDK without a signed-in user
   *   (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
   *   `@donotdev/firebase/public`), Security Rules decide what it reads.
   *
   * The provider, its module and env come from `PUBLIC_READERS` (`utils/publicReaders.js`),
   * shared with the Vite build; the code text from `NEXT_READER_CODE`.
   *
   * With the reader, the read schemas its records are queried with (`READ_SCHEMAS`:
   * `entityReadSchemas` of the app's `entities` package, `createSchemas(entity).get` per
   * listed collection, as the client lists query): rows keep the entity's field names, with
   * everything the database returns to a signed-out visitor (the public reader filters
   * nothing). The generated file imports `entities`.
   *
   * @param {Array<{ path: string, collection?: string }>} routes - Routes of the generated file
   * @param {string} [purpose] - What the file reads records for, in the missing-env error
   * @param {string} [optOut] - How to keep these routes from reading records, in the no-reader error
   * @returns {{ imports: string, setup: string, expr: string | null, schemas: string | null,
   *   named: Record<string, string[]> }} Code to insert: import lines (provider module,
   *   `entities`), setup (`CRUD`, `READ_SCHEMAS`), the reader and schemas expressions, and
   *   the framework names the setup uses, by module (merged into the file's import lines)
   * @throws {Error} When a route lists records and the app depends on neither provider, or
   *   on no `entities` package
   * @since 0.2.3
   */
  serverCrudReader(
    routes,
    purpose = 'the sitemap and llms.txt list published records',
    optOut = 'Mark these pages `seo: { noindex: true }`.'
  ) {
    const listing = routes.filter((route) => route.collection);
    if (listing.length === 0) {
      return { imports: '', setup: '', expr: null, schemas: null, named: {} };
    }
    const paths = listing.map((route) => route.path).join(', ');
    const reader = publicReaderProvider((dependency) => this.appDependsOn(dependency));
    if (!reader) {
      throw new Error(
        `[dndev] ${paths} list published records, but the app's ` +
          `backend provider has no server reader (supported: ${PUBLIC_READER_DEPENDENCIES}). ${optOut}`
      );
    }
    if (!this.appDependsOn('entities')) {
      const collections = [...new Set(listing.map((route) => route.collection))];
      throw createBuildError(
        'dndev-routes',
        `${paths} ${listing.length === 1 ? 'lists' : 'list'} published ` +
          `${collections.map((c) => `"${c}"`).join(', ')} records, read with ` +
          "their entity definition's read schema, but the app does not depend on an `entities` package. " +
          "Add the app's `entities` package (exporting the defineEntity definition) to its dependencies. " +
          optOut,
        'missing-entities-package',
        { routes: listing.map((route) => route.path), collections }
      );
    }
    const { exports, comment, construct } = NEXT_READER_CODE[reader.dependency];
    // The env constants of the generated file: SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const names = reader.env;
    const schemaRoutes = listing.map(({ path, collection }) => ({ path, collection }));
    return {
      imports: `import { ${exports} } from '${reader.module}';\nimport * as entities from 'entities';\n`,
      setup: `
// Public (anonymous) reader: ${comment}
${names.map((name) => `const ${name} = process.env.NEXT_PUBLIC_${name};`).join('\n')}
if (${names.map((name) => `!${name}`).join(' || ')}) {
  throw new Error(
    '[dndev] Set ${names.map((name) => `NEXT_PUBLIC_${name}`).join(' and ')}: ${purpose}.'
  );
}
const CRUD = ${construct};

// Records are read with their entity's read schema: keyed by the entity's field names
// (RLS / Security Rules decide what a signed-out visitor reads)
const READ_SCHEMAS = entityReadSchemas(entities, ${JSON.stringify(schemaRoutes)}, createSchemas);
`,
      expr: 'CRUD',
      schemas: 'READ_SCHEMAS',
      named: {
        '@donotdev/core/server': ['createSchemas'],
        '@donotdev/core/next': ['entityReadSchemas'],
      },
    };
  }

  /**
   * Override in subclass to provide handler-specific defaults
   */
  getHandlerDefaults() {
    return {};
  }

  /**
   * Override in subclass to log discovery results (TIER 2 - VERBOSE)
   * Show WHAT was found (business metrics), not timing or process details
   * Only called when options.verbose is true
   */
  logDiscoveryResults(data) {
    // Subclasses implement this to show business metrics
    // This is TIER 2 logging - only shown when verbose=true
  }

  /**
   * Override in subclass to create the specific discovery instance
   */
  createDiscovery(discoveryClass) {
    // Merge discovery defaults with handler options to ensure single source of truth
    const mergedDiscoveryOptions = {
      ...DEFAULT_OPTIONS.discovery, // Base discovery defaults from config
      ...this.options, // Handler options override discovery defaults
      ...NEXT_DISCOVERY_OPTIONS,
    };
    return new discoveryClass(this.pathResolver, mergedDiscoveryOptions);
  }

  /**
   * Override in subclass for additional initialization
   */
  initialize() {
    // Subclass hook
  }

  /**
   * Initialize the handler with app root
   */
  setAppRoot(root) {
    this.configRoot = root;
    this.pathResolver.setAppRoot(root);
  }

  /**
   * Generate files for Next.js
   */
  async generateFiles() {
    try {
      const discoveryData = await this.getDiscoveryData();

      // ===================================================================
      // TIER 2 LOGGING - VERBOSE (Handler-level discovery summaries)
      // ===================================================================
      if (this.options.verbose) {
        this.logDiscoveryResults(discoveryData);
      }

      // Generate direct config file instead of API routes
      await this.generateConfigFile(discoveryData);

      if (this.options.generateManifest) {
        await this.generateManifest(discoveryData);
      }

      // Generate handler-specific files (app pages, routes, etc.)
      await this.generateSpecificFiles(discoveryData);

      // Generate Next.js environment types if this is the first handler
      if (this.getHandlerName() === 'Route') {
        await this.generateNextEnvTypes();
      }

      // ===================================================================
      // TIER 3 LOGGING - DEBUG (Generation process details)
      // ===================================================================
      this.logger.debug(
        `Generated ${this.getHandlerName()}: ${this.getGenerationSummary(discoveryData)}`
      );

      return discoveryData;
    } catch (error) {
      this.logger.error(
        `${this.getHandlerName()} handler failed to generate files: ${error.message}`
      );
      this.logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      throw error;
    }
  }

  /**
   * Generate direct config file for Next.js
   */
  async generateConfigFile(discoveryData) {
    const handlerName = this.getHandlerName().toLowerCase();
    const configPath =
      GENERATED_PATHS.next[
        `config${handlerName.charAt(0).toUpperCase()}${handlerName.slice(1)}`
      ];

    if (!configPath) {
      throw new Error(
        `No config path defined for ${handlerName} handler. ` +
          `Add config${handlerName.charAt(0).toUpperCase()}${handlerName.slice(1)} to GENERATED_PATHS.next in constants.js`
      );
    }

    const configContent = this.generateConfigContent(discoveryData);
    this.writeGeneratedFile(
      configPath,
      configContent,
      `DnDev ${handlerName} config`
    );
  }

  /**
   * Generate config content - override in subclasses
   */
  generateConfigContent(discoveryData) {
    const handlerName = this.getHandlerName().toLowerCase();
    // Use CONFIG_KEYS for consistent naming between Vite and Next.js
    const configKey = CONFIG_KEYS[handlerName] || handlerName;

    return `// Auto-generated DnDev config by @donotdev/config
// Generated at: ${new Date().toISOString()}
// Populates _DNDEV_CONFIG_ with discovery results

const ${handlerName}Config = ${JSON.stringify(discoveryData, null, 2)};

// Populate unified DnDev config for runtime access (universal CSR/SSR)
if (typeof globalThis !== 'undefined') {
  if (!globalThis._DNDEV_CONFIG_) {
    globalThis._DNDEV_CONFIG_ = {
      platform: 'nextjs',
      mode: typeof process !== 'undefined' && process.env.NODE_ENV === 'production' ? 'production' : 'development',
      version: '1.0.0',
      context: typeof window !== 'undefined' ? 'client' : 'server',
      timestamp: Date.now(),
    };
  }
  globalThis._DNDEV_CONFIG_.${configKey} = ${handlerName}Config;
}

// Export for compatibility
export default ${handlerName}Config;
`;
  }

  // === UTILITY METHODS ===

  /**
   * Write a generated file, replacing any previous version in place.
   * Generated files are never deleted before regeneration (a running dev
   * server would see them missing); stale ones are swept after discovery.
   */
  writeGeneratedFile(filePath, content, description = 'file') {
    const fullPath = this.pathResolver.resolveAppPath(filePath);

    // PathResolver.writeSync handles directory creation automatically
    this.pathResolver.writeSync(fullPath, content, { overwrite: true });
    this.logger.debug(`Generated ${description}: ${fullPath}`);

    return fullPath;
  }

  /**
   * Generate manifest file
   */
  async generateManifest(discoveryData) {
    const manifest = this.createManifestContent(discoveryData);

    this.writeGeneratedFile(
      this.options.manifestPath,
      JSON.stringify(manifest, null, 2),
      `${this.getHandlerName().toLowerCase()} manifest`
    );
  }

  /**
   * Generate Next.js environment types file
   */
  async generateNextEnvTypes() {
    try {
      // next-env.d.ts is in the app root (generated by Next.js)
      const nextEnvPath = this.pathResolver.resolveAppPath('next-env.d.ts');
      // Read as text (TS declaration file, not JSON)
      const nextEnvContent = this.pathResolver.readSync(nextEnvPath, {
        format: 'text',
      });

      if (nextEnvContent) {
        this.writeGeneratedFile(
          'next-env.d.ts',
          nextEnvContent,
          'Next.js environment types'
        );
        this.logger.debug('Generated Next.js environment types');
      }
    } catch (error) {
      this.logger.debug(
        `Could not generate Next.js environment types: ${error.message}`
      );
    }
  }

  // === ABSTRACT METHODS (Override in subclass) ===

  /**
   * Get handler name for logging and identification
   */
  getHandlerName() {
    throw new Error('getHandlerName() must be implemented by subclass');
  }

  /**
   * Get discovery data from the specific discovery engine
   */
  async getDiscoveryData() {
    throw new Error('getDiscoveryData() must be implemented by subclass');
  }

  /**
   * Generate handler-specific files
   */
  async generateSpecificFiles(discoveryData) {
    throw new Error('generateSpecificFiles() must be implemented by subclass');
  }


  /**
   * Get API rewrites for this handler
   */
  getAPIRewrites() {
    throw new Error('getAPIRewrites() must be implemented by subclass');
  }


  /**
   * Create manifest content from discovery data
   */
  createManifestContent(discoveryData) {
    throw new Error('createManifestContent() must be implemented by subclass');
  }

  /**
   * Get summary of what was generated for debug logging
   */
  getGenerationSummary(discoveryData) {
    throw new Error('getGenerationSummary() must be implemented by subclass');
  }
}

/**
 * Factory function to create handler with specific discovery class
 */
export function createBaseHandler(discoveryClass, defaultOptions = {}) {
  return (options = {}) =>
    new BaseNextHandler(discoveryClass, { ...defaultOptions, ...options });
}

export default BaseNextHandler;
