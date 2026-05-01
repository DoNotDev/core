/**
 * @fileoverview Pure I18n Discovery Engine
 * @description Platform-agnostic translation file discovery. Returns plain data without knowledge of Vite, Next.js, or any platform.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseDiscovery } from './BaseDiscovery.js';
import { getGlobOptionsFor } from '../constants.js';
import { detectMissingOptionalDeps } from '../utils/detectOptionalDeps.js';

export class I18nDiscovery extends BaseDiscovery {
  /**
   * Language-to-flag-code overrides where flagCode !== language id.
   * SSOT: packages/core/i18n/src/utils/constants.ts LANGUAGES array
   */
  static LANGUAGE_FLAG_OVERRIDES = {
    en: 'gb',
    'en-ca': 'ca',
    'es-ar': 'ar',
    'fr-be': 'be',
    ar: 'sa',
    'ar-ma': 'ma',
    'ar-dz': 'dz',
    'ar-tn': 'tn',
    'ar-ly': 'ly',
    'ar-mr': 'mr',
    hi: 'in',
    sl: 'si',
    uk: 'ua',
    ga: 'ie',
    gd: 'gb-sct',
    br: 'bzh',
    co: 'fr-cor',
    am: 'et',
    bn: 'bd',
    gu: 'in',
    kn: 'in',
    ml: 'in',
    mr: 'in',
    ne: 'np',
    pa: 'pk',
    ta: 'in',
    te: 'in',
    ur: 'pk',
    fa: 'ir',
    kk: 'kz',
    ky: 'kg',
    tg: 'tj',
    my: 'mm',
    km: 'kh',
    lo: 'la',
    ka: 'ge',
    hy: 'am',
    be: 'by',
    bs: 'ba',
    sq: 'al',
    ms: 'my',
  };

  constructor(pathResolver, options = {}) {
    super(pathResolver, {
      fallbackLanguage: 'en',
      // Additional locale paths from workspace packages (e.g., shared entities)
      // Example: ['../../entities/locales'] relative to app root
      additionalPaths: [],
      ...options,
    });
  }

  // === ABSTRACT METHOD IMPLEMENTATIONS ===

  _getDiscoveryType() {
    return 'I18n';
  }

  async _getPatterns() {
    return await this.pathResolver.resolvePatterns('i18n');
  }

  _getPatternType() {
    return 'i18n';
  }

  async _processFiles(files) {
    const appRoot = this.pathResolver.getAppRoot();
    const repoRoot = this.pathResolver.getRepoRoot();

    // CRITICAL: Ensure appRoot is set and different from repoRoot
    if (!appRoot || appRoot === repoRoot) {
      this.logger.error(
        `I18n discovery: appRoot not properly set (appRoot: ${appRoot}, repoRoot: ${repoRoot})`
      );
      throw new Error(
        'App root not set before i18n discovery. Ensure configResolved hook has run.'
      );
    }

    this.logger.debug(
      `I18n discovery: appRoot=${appRoot}, repoRoot=${repoRoot}`
    );

    const patterns = await this._getPatterns();

    this.logger.debug(
      `I18n patterns - eager: ${patterns.eager.length}, lazy: ${patterns.lazy.length}, framework eager: ${patterns.framework?.eager?.length || 0}, framework lazy: ${patterns.framework?.lazy?.length || 0}`
    );
    this.logger.debug(
      `isMonorepo: ${this.pathResolver.isMonorepo()}, repoRoot: ${this.pathResolver.getRepoRoot()}`
    );

    // Get glob options from constants
    const globOptions = getGlobOptionsFor('i18n');

    // Patterns from resolvePatterns('i18n') are already resolved:
    // - Consumer patterns: resolved with resolveAppPath() (absolute paths)
    // - Framework patterns: resolved with resolveRepoPath() (absolute paths)
    // So we can use them directly without re-resolving
    const resolvedEagerPatterns = patterns.eager || [];
    const resolvedLazyPatterns = patterns.lazy || [];

    // Additional paths from workspace packages (e.g., shared entities)
    // These are resolved relative to app root and treated as lazy (entity-specific)
    const additionalPatterns = (this.options.additionalPaths || []).map((p) => {
      // Ensure glob pattern for JSON files
      const pattern = p.endsWith('.json') ? p : `${p}/*_*.json`;
      return this.pathResolver.resolveAppPath(pattern);
    });

    if (additionalPatterns.length > 0) {
      this.logger.debug(
        `Additional i18n paths configured: ${additionalPatterns.join(', ')}`
      );
    }
    const resolvedFrameworkEagerPatterns = patterns.framework?.eager || [];
    const resolvedFrameworkLazyPatterns = patterns.framework?.lazy || [];

    this.logger.debug(
      `Resolved patterns - eager: ${resolvedEagerPatterns.join(', ')}, lazy: ${resolvedLazyPatterns.join(', ')}, framework eager: ${resolvedFrameworkEagerPatterns.join(', ')}, framework lazy: ${resolvedFrameworkLazyPatterns.join(', ')}`
    );

    // CRITICAL DEBUG: Log if framework patterns are empty
    if (
      resolvedFrameworkEagerPatterns.length === 0 &&
      resolvedFrameworkLazyPatterns.length === 0
    ) {
      this.logger.error(
        `⚠️  Framework i18n patterns are EMPTY! isMonorepo=${this.pathResolver.isMonorepo()}, repoRoot=${this.pathResolver.getRepoRoot()}`
      );
    }

    // Convert absolute patterns to relative patterns for fast-glob (cross-platform compatibility)
    // fast-glob works better with relative patterns when cwd is set on all platforms
    // Consumer patterns: relative to appRoot
    // Framework patterns: relative to repoRoot (they're resolved with resolveRepoPath)
    const normalizeAppRoot = this.pathResolver.normalizePath(appRoot);
    const normalizeRepoRoot = this.pathResolver.normalizePath(repoRoot);

    const convertToRelative = (pattern, baseRoot) => {
      const normalizedPattern = this.pathResolver.normalizePath(pattern);
      const normalizedBase = this.pathResolver.normalizePath(baseRoot);
      if (normalizedPattern.startsWith(normalizedBase)) {
        return normalizedPattern.slice(normalizedBase.length + 1);
      }
      return normalizedPattern;
    };

    const relativeEagerPatterns = resolvedEagerPatterns.map((p) =>
      convertToRelative(p, appRoot)
    );
    // Merge additional paths into lazy patterns (entity translations are lazy-loaded)
    const allLazyPatterns = [...resolvedLazyPatterns, ...additionalPatterns];
    const relativeLazyPatterns = allLazyPatterns.map((p) =>
      convertToRelative(p, appRoot)
    );
    const relativeFrameworkEagerPatterns = resolvedFrameworkEagerPatterns.map(
      (p) => convertToRelative(p, repoRoot)
    );
    const relativeFrameworkLazyPatterns = resolvedFrameworkLazyPatterns.map(
      (p) => convertToRelative(p, repoRoot)
    );

    // Set cwd for glob operations (required for relative patterns on all platforms)
    // Use same glob options structure as PathResolver.resolveFiles
    const globOptionsWithCwd = {
      ...globOptions,
      onlyFiles: true,
      absolute: true,
      braceExpansion: true,
      extglob: true,
      globstar: true,
      cwd: appRoot,
    };

    // Use PathResolver's _globWithNormalization for consistent path handling
    const eagerFiles = await this.pathResolver._globWithNormalization(
      relativeEagerPatterns,
      globOptionsWithCwd
    );
    const lazyFiles = await this.pathResolver._globWithNormalization(
      relativeLazyPatterns,
      globOptionsWithCwd
    );

    // Framework patterns may be inside node_modules - use options without node_modules ignore
    // Framework patterns use repoRoot as cwd since they're resolved relative to repoRoot
    const frameworkGlobOptions = {
      ...globOptions,
      onlyFiles: true,
      absolute: true,
      braceExpansion: true,
      extglob: true,
      globstar: true,
      cwd: repoRoot,
      ignore:
        globOptions.ignore?.filter((p) => p !== '**/node_modules/**') || [],
    };

    this.logger.debug(
      `🔍 Searching framework patterns with cwd: ${repoRoot}, ignore: ${JSON.stringify(frameworkGlobOptions.ignore)}`
    );

    const frameworkEagerFiles = await this.pathResolver._globWithNormalization(
      relativeFrameworkEagerPatterns,
      frameworkGlobOptions
    );
    const frameworkLazyFiles = await this.pathResolver._globWithNormalization(
      relativeFrameworkLazyPatterns,
      frameworkGlobOptions
    );

    this.logger.debug(
      `Found ${eagerFiles.length} eager, ${lazyFiles.length} lazy, ${frameworkEagerFiles.length} framework eager, ${frameworkLazyFiles.length} framework lazy files`
    );

    // CRITICAL DEBUG: Show first few files found
    if (frameworkEagerFiles.length > 0) {
      this.logger.debug(
        `Framework eager files (first 3): ${frameworkEagerFiles.slice(0, 3).join(', ')}`
      );
    } else {
      this.logger.error(
        `❌ NO framework eager files found! Patterns were: ${resolvedFrameworkEagerPatterns.join(', ')}`
      );
    }
    if (frameworkLazyFiles.length > 0) {
      this.logger.debug(
        `Framework lazy files (first 3): ${frameworkLazyFiles.slice(0, 3).join(', ')}`
      );
    } else {
      this.logger.error(
        `❌ NO framework lazy files found! Patterns were: ${resolvedFrameworkLazyPatterns.join(', ')}`
      );
    }

    // Process discovered files
    const allFiles = [
      ...new Set([
        ...eagerFiles,
        ...lazyFiles,
        ...frameworkEagerFiles,
        ...frameworkLazyFiles,
      ]),
    ];
    const eagerSet = new Set([...eagerFiles, ...frameworkEagerFiles]); // Framework eager files are also eager

    const result = {
      mapping: {},
      content: {},
      eagerNamespaces: new Set(),
      allNamespaces: new Set(),
      supportedLanguages: new Set(),
      files: [],
    };

    // Detect which @donotdev/* packages the consumer doesn't use.
    // Namespace === package short name (auth, oauth, billing, crud).
    // Framework lazy files for unused packages are skipped entirely — no chunks generated.
    const { missing } = detectMissingOptionalDeps(appRoot);
    const excludedNamespaces = new Set(
      missing
        .filter((pkg) => pkg.startsWith('@donotdev/'))
        .map((pkg) => pkg.replace('@donotdev/', ''))
    );

    if (excludedNamespaces.size > 0) {
      this.logger.debug(
        `I18n namespace filter: excluding [${[...excludedNamespaces].join(', ')}] (packages not installed)`
      );
    }

    // Process framework files first (base translations)
    const frameworkTranslations = new Map();
    const allFrameworkFiles = [...frameworkEagerFiles, ...frameworkLazyFiles];

    for (const filePath of allFrameworkFiles) {
      const fileData = this._processTranslationFile(
        filePath,
        frameworkEagerFiles.includes(filePath), // Framework eager files are eager
        appRoot
      );

      if (fileData) {
        // Skip namespaces for packages the consumer doesn't use
        if (excludedNamespaces.has(fileData.namespace)) continue;

        const key = `${fileData.namespace}_${fileData.language}`;
        frameworkTranslations.set(key, fileData);

        // Track namespaces and languages from framework
        result.allNamespaces.add(fileData.namespace);
        result.supportedLanguages.add(fileData.language);

        // Framework eager files contribute to eager namespaces
        if (frameworkEagerFiles.includes(filePath)) {
          result.eagerNamespaces.add(fileData.namespace);
        }
      }
    }

    // Track app-specific languages separately
    const appLanguages = new Set();

    // Process consumer files (can override framework translations)
    for (const filePath of allFiles) {
      // Skip framework files as they were already processed
      if (allFrameworkFiles.includes(filePath)) {
        continue;
      }

      const fileData = this._processTranslationFile(
        filePath,
        eagerSet.has(filePath),
        appRoot
      );

      if (fileData) {
        const { namespace, language, importPath, content } = fileData;
        const key = `${fileData.namespace}_${fileData.language}`;

        // Check if there's a framework translation to merge with
        if (frameworkTranslations.has(key)) {
          const frameworkData = frameworkTranslations.get(key);
          // Merge: framework provides base, consumer can override/add
          fileData.content = this._mergeTranslations(
            frameworkData.content,
            content
          );
        }

        // Track namespaces and languages
        result.allNamespaces.add(namespace);
        result.supportedLanguages.add(language);
        appLanguages.add(language); // Track app-specific languages

        if (eagerSet.has(filePath)) {
          result.eagerNamespaces.add(namespace);
        }

        // Build mapping
        if (!result.mapping[namespace]) result.mapping[namespace] = {};
        result.mapping[namespace][language] = importPath;

        // Always include content inline
        if (fileData.content) {
          if (!result.content[namespace]) result.content[namespace] = {};
          result.content[namespace][language] = fileData.content;
        }

        // Track file info
        result.files.push({
          path: filePath,
          relativePath: this.pathResolver.getRelativePath(filePath),
          namespace,
          language,
          eager: eagerSet.has(filePath),
          size: fileData.content ? JSON.stringify(fileData.content).length : 0,
        });
      }
    }

    // Add framework translations that don't have consumer overrides
    // Only include languages the app actually uses (from consumer files)
    for (const [key, frameworkData] of frameworkTranslations) {
      const lastUnderscore = key.lastIndexOf('_');
      const namespace = key.slice(0, lastUnderscore);
      const language = key.slice(lastUnderscore + 1);
      // Skip framework languages the app doesn't use
      if (appLanguages.size > 0 && !appLanguages.has(language)) continue;
      if (!result.mapping[namespace] || !result.mapping[namespace][language]) {
        // No consumer override exists, add framework translation to mapping
        if (!result.mapping[namespace]) result.mapping[namespace] = {};
        result.mapping[namespace][language] = frameworkData.importPath;

        // Add content inline
        if (!result.content[namespace]) result.content[namespace] = {};
        result.content[namespace][language] = frameworkData.content;

        // Track file info (needed for Vite lazy loaders with absolute paths)
        result.files.push({
          path: frameworkData.absolutePath,
          relativePath: this.pathResolver.getRelativePath(
            frameworkData.absolutePath
          ),
          namespace,
          language,
          eager: result.eagerNamespaces.has(namespace),
          size: frameworkData.content
            ? JSON.stringify(frameworkData.content).length
            : 0,
        });
      }
    }

    // Convert sets to sorted arrays
    // Use app-specific languages if available, otherwise only show fallback (no LanguageSelector)
    const finalLanguages =
      appLanguages.size > 0
        ? [...appLanguages].sort()
        : [this.options.fallbackLanguage];

    // Derive flag codes from supported languages
    // Most languages use their ID as country code; overrides handle exceptions
    const flagCodes = [
      ...new Set(
        finalLanguages.map(
          (lang) => I18nDiscovery.LANGUAGE_FLAG_OVERRIDES[lang] || lang
        )
      ),
    ];

    return {
      mapping: result.mapping,
      content: result.content,
      eagerNamespaces: [...result.eagerNamespaces].sort(),
      allNamespaces: [...result.allNamespaces].sort(),
      supportedLanguages: finalLanguages,
      fallbackLanguage: this.options.fallbackLanguage,
      flagCodes,
      files: result.files,
    };
  }

  _getEmptyResult() {
    return {
      mapping: {},
      content: {},
      eagerNamespaces: [],
      allNamespaces: ['common'],
      supportedLanguages: [this.options.fallbackLanguage],
      fallbackLanguage: this.options.fallbackLanguage,
      flagCodes: [
        I18nDiscovery.LANGUAGE_FLAG_OVERRIDES[this.options.fallbackLanguage] ||
          this.options.fallbackLanguage,
      ],
      files: [],

      timestamp: Date.now(),
    };
  }

  _getDiscoverySummary() {
    return `${this.cache?.allNamespaces?.length || 0} namespaces, ${this.cache?.supportedLanguages?.length || 0} languages`;
  }

  // === PUBLIC API METHODS ===

  /**
   * Discover translation files and return pure data
   * Overrides BaseDiscovery.discover() to skip _scanFiles() since we handle file scanning directly in _processFiles()
   * @param {boolean} force - Force re-discovery
   * @returns {Object} Pure i18n data
   */
  async discover(force = false) {
    if (!force && this._isCacheValid()) {
      this.logger.debug('Using cached results');
      return this.cache;
    }

    const startTime = Date.now();

    try {
      // I18nDiscovery handles file scanning directly in _processFiles()
      // Skip _scanFiles() to avoid validation errors (i18n patterns have different structure)
      // _processFiles() will get patterns itself via _getPatterns()
      const results = await this._processFiles([]);

      this.cache = {
        ...results,
        timestamp: Date.now(),
      };

      const duration = Date.now() - startTime;
      this.logger.debug(`Discovery completed in ${duration}ms`);

      this._lastDiscoveryTime = Date.now();
      return this.cache;
    } catch (error) {
      this.logger.error(`I18n discovery failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover translation files and return pure data
   * @param {boolean} force - Force re-discovery
   * @returns {Object} Pure i18n data
   */
  async discoverTranslations(force = false) {
    return await this.discover(force);
  }

  /**
   * Get translation mapping (cached)
   */
  getMapping() {
    return this.cache?.mapping || {};
  }

  /**
   * Get available languages (cached)
   */
  getLanguages() {
    return this.cache?.supportedLanguages || [this.options.fallbackLanguage];
  }

  /**
   * Get available namespaces (cached)
   */
  getNamespaces() {
    return this.cache?.allNamespaces || ['common'];
  }

  /**
   * Get eager namespaces (cached)
   */
  getEagerNamespaces() {
    return this.cache?.eagerNamespaces || [];
  }

  // === PRIVATE METHODS ===

  _processTranslationFile(filePath, isEager, appRoot) {
    // Extract filename from path (basename equivalent)
    const fileName =
      filePath.split('/').pop() || filePath.split('\\').pop() || '';

    let namespace, language;

    // Standard format: namespace_lang.json (e.g., common_en.json)
    const match = fileName.match(/^(.+)_([^_.]+)\.json$/);
    if (!match) {
      this.logger.debug(`Invalid translation file name format: ${fileName}`);
      return null;
    }
    [, namespace, language] = match;

    if (!namespace || !language) {
      this.logger.debug(`Invalid namespace or language in file: ${fileName}`);
      return null;
    }

    // Create relative import path
    const relativePath = this.pathResolver.getRelativePath(filePath);
    const importPath = './' + relativePath.replace(/\\/g, '/');

    // Read content using unified PathResolver API (auto-detects JSON format)
    let content;
    try {
      content = this.pathResolver.readSync(filePath, { format: 'json' });
      if (!content) {
        this.logger.debug(`Could not read file: ${filePath}`);
        return null;
      }
    } catch (error) {
      this.logger.debug(
        `Error parsing JSON from ${filePath}: ${error.message}`
      );
      return null;
    }

    return {
      namespace,
      language,
      importPath,
      absolutePath: filePath,
      content,
    };
  }

  _mergeTranslations(frameworkContent, consumerContent) {
    // Take all keys from framework and replace/add from consumer
    const merged = { ...frameworkContent };

    for (const [key, value] of Object.entries(consumerContent)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Recursively merge nested objects
        merged[key] = this._mergeTranslations(merged[key] || {}, value);
      } else {
        // Consumer value takes precedence (replaces or adds)
        merged[key] = value;
      }
    }

    return merged;
  }
}
