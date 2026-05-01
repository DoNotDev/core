import * as fs from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import { createRequire } from 'node:module';
import {
  resolve,
  join,
  dirname,
  relative,
  normalize,
  sep,
  basename,
  extname,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import fastGlob from 'fast-glob';
import * as constantsModule from '../constants.js';
const constants = {
  getGlobOptionsFor: constantsModule.getGlobOptionsFor || void 0,
  SCAN_PATTERNS: constantsModule.SCAN_PATTERNS || void 0,
  getPatternsFor: constantsModule.getPatternsFor || void 0,
  I18N_PATHS: constantsModule.I18N_PATHS || void 0,
};
const log = {
  error: (message, error) => {
    console.error(message, error);
  },
  warn: (message, error) => {
    console.warn(message, error);
  },
  info: (message) => {
    console.log(message);
  },
};
function safeExecuteAsync(fn, message) {
  return fn().catch((error) => {
    throw new Error(
      `${message}: ${error instanceof Error ? error.message : String(error)}`
    );
  });
}
const PACKAGE_PATHS = {
  CLI: 'packages/cli',
  COMPONENTS: 'packages/core/components',
  CONFIG: 'packages/core/config',
  // I18n paths - single source of truth (use I18N_PATHS from constants.js)
  CORE: 'packages/core',
  CRUD: 'packages/core/crud',
  FEATURES: 'packages/features',
  HOOKS: 'packages/core/hooks',
  I18N: 'packages/core/i18n',
  SCHEMAS: 'packages/core/schemas',
  STORES: 'packages/core/stores',
  TEMPLATES: 'packages/templates',
  TOOLING: 'packages/tooling',
  TYPES: 'packages/core/types',
  UI: 'packages/ui',
  UTILS: 'packages/core/utils',
  AUTH: 'packages/features/auth',
  BILLING: 'packages/features/billing',
  OAUTH: 'packages/features/oauth',
  FIREBASE: 'packages/providers/firebase',
  FUNCTIONS: 'packages/functions',
};
class PathResolver {
  static _instance = null;
  options;
  _repoRoot;
  _appRoot = null;
  /**
   * Get or create singleton instance
   * @param options - Configuration options
   * @returns PathResolver singleton instance
   */
  static getInstance(options = {}) {
    if (!PathResolver._instance) {
      PathResolver._instance = new PathResolver(options);
    }
    return PathResolver._instance;
  }
  /**
   * Reset singleton instance (useful for testing)
   * @private
   */
  static _reset() {
    PathResolver._instance = null;
  }
  /**
   * @param options - Configuration options
   * @param options.maxLevels - Maximum directory levels to traverse (default: 10 for tooling, 2 for config)
   * @param options.customMarkers - Additional markers for DnDev detection
   * @param options.cache - Enable result caching (unused, kept for compatibility)
   * @param options.debug - Enable debug logging
   */
  constructor(options = {}) {
    if (PathResolver._instance) {
      return PathResolver._instance;
    }
    this.options = {
      maxLevels: options.maxLevels ?? 10,
      customMarkers: options.customMarkers || [],
      cache: options.cache ?? false,
      debug: options.debug ?? false,
    };
    try {
      const startDir = process.cwd();
      if (!startDir) {
        throw new Error(
          'PathResolver: process.cwd() returned undefined. This should never happen.'
        );
      }
      this._repoRoot = this._findRepoRoot(startDir);
    } catch (error) {
      throw new Error(
        `PathResolver constructor failed: ${error instanceof Error ? error.message : String(error)}. cwd: ${process.cwd()}`
      );
    }
    this._appRoot = null;
    PathResolver._instance = this;
  }
  // === CORE PATH OPERATIONS ===
  /**
   * Normalize path to use forward slashes consistently across platforms
   */
  normalizePath(path) {
    if (!path) return '';
    try {
      return normalize(path).split(sep).join('/');
    } catch (error) {
      return String(path).split(sep).join('/');
    }
  }
  /**
   * Get relative path from app root
   */
  getRelativePath(absolutePath) {
    const appRoot = this.getAppRoot();
    const rel = relative(appRoot, absolutePath);
    return this.normalizePath(rel);
  }
  /**
   * Get basename (filename) from path
   */
  getBasename(path) {
    if (!path) return '';
    const normalized = this.normalizePath(path);
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }
  /**
   * Get directory name (parent directory) from path
   */
  getDirname(path) {
    if (!path) return '';
    return this.normalizePath(dirname(path));
  }
  /**
   * Resolve package path using Node's module resolution
   * Handles Bun's .bun/ structure, npm, pnpm, yarn workspaces
   * @param packageSpecifier - Package name or subpath (e.g., '@donotdev/components' or '@donotdev/components/styles')
   * @param fromPath - Optional base path to resolve from (defaults to appRoot)
   * @returns Resolved absolute path or null if not found
   */
  resolvePackage(packageSpecifier, fromPath = null) {
    try {
      const basePath = fromPath || this.getAppRoot();
      const require2 = createRequire(join(basePath, 'package.json'));
      const resolved = require2.resolve(packageSpecifier);
      return this.normalizePath(resolved);
    } catch (error) {
      return null;
    }
  }
  /**
   * Resolve framework package with hoisting support
   * Single source of truth for @donotdev/* package resolution
   * Works across: bun workspace, isolated repos, any hoisting strategy, published packages
   *
   * Resolution order:
   * 1. createRequire (handles hoisting automatically via Node resolution)
   * 2. Monorepo packages/ directory (development mode)
   * 3. App-level node_modules
   * 4. Root node_modules (workspace hoisting fallback)
   *
   * @param packageName - Framework package name (e.g., '@donotdev/components')
   * @param fromPath - Optional base path to resolve from (defaults to appRoot)
   * @returns Package root directory path or null if not found
   */
  resolveFrameworkPackage(packageName, fromPath = null) {
    const packageJsonPath = this.resolvePackage(
      `${packageName}/package.json`,
      fromPath
    );
    if (packageJsonPath) {
      return this.getDirname(packageJsonPath);
    }
    if (this.isMonorepo() && packageName.startsWith('@donotdev/')) {
      const name = packageName.replace('@donotdev/', '');
      const monorepoPath = this.resolveRepoPath(`packages/${name}`);
      if (this.pathExists(monorepoPath)) return monorepoPath;
      if (['auth', 'billing', 'crud', 'oauth'].includes(name)) {
        const featurePath = this.resolveRepoPath(`packages/features/${name}`);
        if (this.pathExists(featurePath)) return featurePath;
      }
      if (name === 'firebase') {
        const providerPath = this.resolveRepoPath(`packages/providers/${name}`);
        if (this.pathExists(providerPath)) return providerPath;
      }
    }
    const appNodeModules = this.resolveAppPath(`node_modules/${packageName}`);
    if (this.pathExists(appNodeModules)) return appNodeModules;
    const rootNodeModules = this.resolveRepoPath(`node_modules/${packageName}`);
    if (this.pathExists(rootNodeModules)) return rootNodeModules;
    return null;
  }
  /**
   * Resolve a specific asset inside a package using Node's module resolution
   * This is robust against nested node_modules, workspaces, and different package managers
   *
   * @param assetPath - Path to asset inside package (e.g., '@donotdev/cli/dependencies-matrix.json')
   * @param fromPath - Optional base path to resolve from
   * @returns Resolved absolute path or null if not found
   */
  resolvePackageAsset(assetPath, fromPath = null) {
    return this.resolvePackage(assetPath, fromPath);
  }
  /**
   * Resolve relative path against app root
   */
  resolveAppPath(relativePath) {
    const appRoot = this.getAppRoot();
    const resolved = resolve(appRoot, relativePath);
    return this.normalizePath(resolved);
  }
  /**
   * Resolve relative path against repo root
   */
  resolveRepoPath(relativePath) {
    const repoRoot = this.getRepoRoot();
    const normalizedRelativePath = this.normalizePath(relativePath);
    const resolved = resolve(repoRoot, normalizedRelativePath);
    return this.normalizePath(resolved);
  }
  /**
   * Resolve relative path against arbitrary base directory
   */
  resolvePath(relativePath, baseDir) {
    const normalizedBase = this.normalizePath(baseDir);
    const normalizedRelative = this.normalizePath(relativePath);
    const resolved = resolve(normalizedBase, normalizedRelative);
    return this.normalizePath(resolved);
  }
  /**
   * Create import path for ES modules (always starts with ./)
   */
  createImportPath(absolutePath) {
    const relativePath = this.getRelativePath(absolutePath);
    return './' + relativePath;
  }
  /**
   * Get comprehensive file information with normalized paths
   */
  getFileInfo(absolutePath) {
    try {
      const stats = fs.statSync(absolutePath);
      return {
        absolutePath: this.normalizePath(absolutePath),
        relativePath: this.getRelativePath(absolutePath),
        importPath: this.createImportPath(absolutePath),
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      return null;
    }
  }
  // === FILE SYSTEM OPERATIONS ===
  /**
   * Detect file format from extension
   * @private
   */
  _detectFormat(filePath, explicitFormat) {
    if (explicitFormat && explicitFormat !== 'auto') {
      return explicitFormat;
    }
    const ext = extname(filePath).toLowerCase();
    if (ext === '.json') {
      return 'json';
    }
    return 'text';
  }
  /**
   * Unified file read operation (async)
   * Auto-detects format from file extension (.json → parsed object, others → string)
   *
   * @param filePath - Path to file
   * @param options - File operation options
   * @returns Promise resolving to file content (string, parsed JSON object, or Buffer)
   */
  async read(filePath, options = {}) {
    const { format = 'auto', encoding = 'utf8' } = options;
    const detectedFormat = this._detectFormat(filePath, format);
    try {
      if (detectedFormat === 'buffer') {
        return await fs.promises.readFile(filePath);
      }
      const content = await fs.promises.readFile(filePath, encoding);
      const cleanContent = this.stripBom(content);
      if (detectedFormat === 'json') {
        return JSON.parse(cleanContent);
      }
      return cleanContent;
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to read file: ${filePath}`, error);
      }
      return null;
    }
  }
  /**
   * Unified file read operation (sync)
   * Auto-detects format from file extension (.json → parsed object, others → string)
   *
   * @param filePath - Path to file
   * @param options - File operation options
   * @returns File content (string, parsed JSON object, or Buffer), or null on error
   */
  readSync(filePath, options = {}) {
    const { format = 'auto', encoding = 'utf8' } = options;
    const detectedFormat = this._detectFormat(filePath, format);
    try {
      if (detectedFormat === 'buffer') {
        return fs.readFileSync(filePath);
      }
      const content = fs.readFileSync(filePath, encoding);
      const cleanContent = this.stripBom(content);
      if (detectedFormat === 'json') {
        return JSON.parse(cleanContent);
      }
      return cleanContent;
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to read file: ${filePath}`, error);
      }
      return null;
    }
  }
  /**
   * Unified file write operation (async)
   * Auto-detects format from file extension (.json → stringify, others → string)
   *
   * @param filePath - Path to file
   * @param content - Content to write (string, object for JSON, or Buffer)
   * @param options - File operation options
   * @returns Promise resolving to success status
   */
  async write(filePath, content, options = {}) {
    const {
      format = 'auto',
      overwrite = false,
      dryRun = false,
      verbose = false,
    } = options;
    const normalizedPath = this.normalizePath(filePath);
    const dir = this.normalizePath(dirname(normalizedPath));
    const fileExists = this.pathExists(normalizedPath);
    if (fileExists && !overwrite) {
      if (verbose) {
        log.info(`Skipping existing file: ${normalizedPath}`);
      }
      return false;
    }
    if (dryRun) {
      log.info(`[DRY RUN] Would write file: ${normalizedPath}`);
      return true;
    }
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const detectedFormat = this._detectFormat(filePath, format);
    let writeContent;
    if (Buffer.isBuffer(content)) {
      writeContent = content;
    } else if (detectedFormat === 'json' && typeof content === 'object') {
      writeContent = JSON.stringify(content, null, 2);
    } else {
      writeContent = String(content);
    }
    try {
      return await safeExecuteAsync(async () => {
        if (Buffer.isBuffer(writeContent)) {
          await fs.promises.writeFile(normalizedPath, writeContent);
        } else {
          await fs.promises.writeFile(normalizedPath, writeContent, 'utf8');
        }
        if (verbose) {
          log.info(
            `${fileExists ? 'Updated' : 'Created'} file: ${normalizedPath}`
          );
        }
        return true;
      }, `Failed to write file: ${normalizedPath}`);
    } catch {
      return false;
    }
  }
  /**
   * Unified file write operation (sync)
   * Auto-detects format from file extension (.json → stringify, others → string)
   *
   * @param filePath - Path to file
   * @param content - Content to write (string, object for JSON, or Buffer)
   * @param options - File operation options
   * @returns Success status
   */
  writeSync(filePath, content, options = {}) {
    const {
      format = 'auto',
      overwrite = false,
      dryRun = false,
      verbose = false,
    } = options;
    const normalizedPath = this.normalizePath(filePath);
    const dir = this.normalizePath(dirname(normalizedPath));
    const fileExists = this.pathExists(normalizedPath);
    if (fileExists && !overwrite) {
      if (verbose) {
        log.info(`Skipping existing file: ${normalizedPath}`);
      }
      return false;
    }
    if (dryRun) {
      log.info(`[DRY RUN] Would write file: ${normalizedPath}`);
      return true;
    }
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const detectedFormat = this._detectFormat(filePath, format);
    let writeContent;
    if (Buffer.isBuffer(content)) {
      writeContent = content;
    } else if (detectedFormat === 'json' && typeof content === 'object') {
      writeContent = JSON.stringify(content, null, 2);
    } else {
      writeContent = String(content);
    }
    try {
      if (Buffer.isBuffer(writeContent)) {
        fs.writeFileSync(normalizedPath, writeContent);
      } else {
        fs.writeFileSync(normalizedPath, writeContent, 'utf8');
      }
      if (verbose) {
        log.info(
          `${fileExists ? 'Updated' : 'Created'} file: ${normalizedPath}`
        );
      }
      return true;
    } catch (error) {
      throw new Error(
        `Failed to write file: ${normalizedPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Unified file copy operation (async)
   *
   * @param srcPath - Source file path
   * @param destPath - Destination file path
   * @param options - File operation options
   * @returns Promise resolving to success status
   */
  async copy(srcPath, destPath, options = {}) {
    const { overwrite = false, dryRun = false, verbose = false } = options;
    const normalizedDestPath = this.normalizePath(destPath);
    const fileExists = this.pathExists(normalizedDestPath);
    if (fileExists && !overwrite) {
      if (verbose) {
        log.info(`Skipping existing file: ${normalizedDestPath}`);
      }
      return false;
    }
    if (dryRun) {
      log.info(`[DRY RUN] Would copy file: ${normalizedDestPath}`);
      return true;
    }
    const dir = this.normalizePath(dirname(normalizedDestPath));
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    try {
      return await safeExecuteAsync(async () => {
        await fs.promises.copyFile(srcPath, normalizedDestPath);
        if (verbose) {
          log.info(
            `${fileExists ? 'Updated' : 'Created'} file: ${normalizedDestPath}`
          );
        }
        return true;
      }, `Failed to copy file from ${srcPath} to ${normalizedDestPath}`);
    } catch {
      return false;
    }
  }
  /**
   * Unified file copy operation (sync)
   *
   * @param srcPath - Source file path
   * @param destPath - Destination file path
   * @param options - File operation options
   * @returns Success status
   */
  copySync(srcPath, destPath, options = {}) {
    const { overwrite = false, dryRun = false, verbose = false } = options;
    const normalizedDestPath = this.normalizePath(destPath);
    const fileExists = this.pathExists(normalizedDestPath);
    if (fileExists && !overwrite) {
      if (verbose) {
        log.info(`Skipping existing file: ${normalizedDestPath}`);
      }
      return false;
    }
    if (dryRun) {
      log.info(`[DRY RUN] Would copy file: ${normalizedDestPath}`);
      return true;
    }
    const dir = this.normalizePath(dirname(normalizedDestPath));
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    try {
      fs.copyFileSync(srcPath, normalizedDestPath);
      if (verbose) {
        log.info(
          `${fileExists ? 'Updated' : 'Created'} file: ${normalizedDestPath}`
        );
      }
      return true;
    } catch (error) {
      return false;
    }
  }
  /**
   * Check if path exists
   */
  pathExists(filePath, silent = false) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      if (!silent) {
        log.error(`Error checking path existence: ${filePath}`, error);
      }
      return false;
    }
  }
  /**
   * Create directory (recursive)
   * @param dirPath - Path to directory (relative to app root or absolute)
   * @returns Success status
   */
  mkdir(dirPath) {
    try {
      const absolutePath =
        dirPath.startsWith('/') || dirPath.match(/^[A-Z]:/)
          ? this.normalizePath(dirPath)
          : this.resolveAppPath(dirPath);
      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
      }
      return true;
    } catch (error) {
      return false;
    }
  }
  readdirSync(dirPath, options) {
    try {
      return fs.readdirSync(dirPath, options);
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to read directory: ${dirPath}`, error);
      }
      const isObjectOptions =
        options && typeof options === 'object' && 'withFileTypes' in options;
      return isObjectOptions && options.withFileTypes ? [] : [];
    }
  }
  /**
   * Get file stats synchronously
   * Returns null if file doesn't exist (graceful degradation)
   *
   * @param filePath - Path to file
   * @returns File stats or null if file doesn't exist
   */
  statSync(filePath) {
    try {
      return fs.statSync(filePath);
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to stat file: ${filePath}`, error);
      }
      return null;
    }
  }
  /**
   * Resolve the real path of a file, following symlinks
   * @param filePath - Path to resolve
   * @returns Resolved real path
   */
  realpathSync(filePath) {
    return fs.realpathSync(filePath);
  }
  /**
   * Watch a directory for changes
   * @param dirPath - Directory to watch
   * @param options - fs.watch options
   * @param callback - Callback for change events
   * @returns FSWatcher instance
   */
  watch(dirPath, options, callback) {
    return fs.watch(dirPath, options, callback);
  }
  /**
   * Get file stats synchronously (follows symlinks)
   * Returns null if file doesn't exist (graceful degradation)
   *
   * @param filePath - Path to file
   * @returns File stats or null if file doesn't exist
   */
  lstatSync(filePath) {
    try {
      return fs.lstatSync(filePath);
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to lstat file: ${filePath}`, error);
      }
      return null;
    }
  }
  /**
   * Ensure directory exists (creates if needed)
   * Uses native fs.promises.mkdir with recursive option
   * Wraps EEXIST errors for Windows/Bun compatibility
   */
  async ensureDir(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  /**
   * Ensure directory exists synchronously (creates if needed)
   * Uses native fs.mkdirSync with recursive option
   * Wraps EEXIST errors for Windows/Bun compatibility
   */
  ensureDirSync(dirPath) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  /**
   * Remove file or directory (async)
   * Uses native fs.promises.rm with recursive option
   */
  async remove(path) {
    await fs.promises.rm(path, { recursive: true, force: true });
  }
  /**
   * Remove file or directory (sync)
   * Uses native fs.rmSync with recursive option
   */
  removeSync(path) {
    fs.rmSync(path, { recursive: true, force: true });
  }
  /**
   * Read directory contents asynchronously
   */
  async readdir(dirPath, options) {
    return fs.promises.readdir(dirPath, options);
  }
  /**
   * Strip BOM from content
   */
  stripBom(content) {
    return content.charCodeAt(0) === 65279 ? content.slice(1) : content;
  }
  // === ROOT MANAGEMENT ===
  /**
   * Get repo root (monorepo root)
   * Falls back to process.cwd() if not found
   */
  getRepoRoot() {
    return this._repoRoot || process.cwd();
  }
  /**
   * Get app root (where vite.config.ts is, Vite's config.root)
   * Falls back to repoRoot if not set
   */
  getAppRoot() {
    if (!this._appRoot) {
      return this._repoRoot;
    }
    return this._appRoot;
  }
  /**
   * Set app root
   */
  setAppRoot(root) {
    if (!root) {
      throw new Error(
        'PathResolver.setAppRoot: root cannot be undefined or null'
      );
    }
    this._appRoot = this.normalizePath(root);
  }
  /**
   * Check if we're in the monorepo (framework repo) vs consumer repo
   * @returns True if repoRoot is the monorepo (has packages directory)
   */
  isMonorepo() {
    const packagesDir = join(this._repoRoot, 'packages');
    return this.pathExists(packagesDir);
  }
  /**
   * Validate path is within app boundaries
   */
  isWithinApp(targetPath) {
    const normalizedTarget = this.normalizePath(resolve(targetPath));
    const normalizedApp = this.getAppRoot();
    const relativePath = relative(normalizedApp, normalizedTarget);
    const normalizedRelative = this.normalizePath(relativePath);
    return (
      !normalizedRelative.startsWith('../') &&
      !normalizedRelative.startsWith('/')
    );
  }
  /**
   * Find files matching pattern within directory
   */
  async findFiles(directory, pattern, options = {}) {
    const searchPattern = this.normalizePath(join(directory, pattern));
    const appRoot = this.getAppRoot();
    const normalizeAppRoot = this.normalizePath(appRoot);
    const relativePattern = searchPattern.startsWith(normalizeAppRoot)
      ? searchPattern.slice(normalizeAppRoot.length + 1)
      : searchPattern;
    const defaultOptions = {
      absolute: true,
      onlyFiles: true,
      braceExpansion: true,
      extglob: true,
      globstar: true,
      cwd: appRoot,
      ignore: constants.SCAN_PATTERNS?.globalIgnore || [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
      ],
    };
    return await this._globWithNormalization([relativePattern], {
      ...defaultOptions,
      ...options,
    });
  }
  /**
   * Clear cached roots (forces re-discovery)
   */
  clearCache() {}
  // === DISCOVERY PATTERN RESOLUTION (Config-specific) ===
  /**
   * Resolve framework i18n pattern for consumer repos (handles workspace hoisting)
   * Converts monorepo patterns to installed package paths
   * @param pattern - Pattern like 'packages/core/i18n/locales/eager/*_*.json'
   * @returns Resolved pattern path or null if package not found
   * @private
   */
  async _resolveFrameworkI18nPattern(pattern) {
    const I18N_PATHS = constants.I18N_PATHS;
    if (!I18N_PATHS) {
      return null;
    }
    const i18nSubpath = pattern.replace(I18N_PATHS.SOURCE_ROOT + '/', '');
    const corePackageRoot = this.resolveFrameworkPackage('@donotdev/core');
    if (!corePackageRoot) {
      return null;
    }
    const resolvedPath = this.normalizePath(
      join(corePackageRoot, I18N_PATHS.PUBLISHED_ROOT, i18nSubpath)
    );
    const resolvedDir = resolvedPath.replace(/\/[^/]*\*.*$/, '');
    if (this.pathExists(resolvedDir)) {
      return resolvedPath;
    }
    return resolvedPath;
  }
  /**
   * Execute fast-glob with normalized results
   * @private
   */
  async _globWithNormalization(patterns, options) {
    const results = await fastGlob(patterns, options);
    return results.map((path) => {
      const pathStr = typeof path === 'string' ? path : path.path;
      return this.normalizePath(pathStr);
    });
  }
  /**
   * Resolve files using patterns with cross-platform support
   * @param patterns - Pattern configuration
   * @param patternType - Type of patterns (css, routes, etc.)
   * @returns Framework and consumer file lists
   */
  async resolveFiles(patterns, patternType = 'css') {
    if (!patterns || typeof patterns !== 'object') {
      return { frameworkFiles: [], consumerFiles: [] };
    }
    if (patternType === 'i18n') {
      return { frameworkFiles: [], consumerFiles: [] };
    }
    if (!Array.isArray(patterns.framework)) {
      patterns.framework = [];
    }
    if (!Array.isArray(patterns.consumer)) {
      return { frameworkFiles: [], consumerFiles: [] };
    }
    const allPatterns = [...patterns.framework, ...patterns.consumer];
    for (const pattern of allPatterns) {
      if (typeof pattern !== 'string' || pattern.trim() === '') {
        return { frameworkFiles: [], consumerFiles: [] };
      }
    }
    const appRoot = this.getAppRoot();
    const baseGlobOptions = constants.getGlobOptionsFor
      ? constants.getGlobOptionsFor(patternType)
      : {
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        };
    const normalizeAppRoot = this.normalizePath(appRoot);
    const relativeFrameworkPatterns = patterns.framework.map((pattern) => {
      const normalizedPattern = this.normalizePath(pattern);
      if (normalizedPattern.startsWith(normalizeAppRoot)) {
        return normalizedPattern.slice(normalizeAppRoot.length + 1);
      }
      return normalizedPattern;
    });
    const relativeConsumerPatterns = patterns.consumer.map((pattern) => {
      const normalizedPattern = this.normalizePath(pattern);
      if (normalizedPattern.startsWith(normalizeAppRoot)) {
        return normalizedPattern.slice(normalizeAppRoot.length + 1);
      }
      return normalizedPattern;
    });
    const globOptions = {
      ...baseGlobOptions,
      onlyFiles: true,
      absolute: true,
      // Return absolute paths in results
      braceExpansion: true,
      extglob: true,
      globstar: true,
      cwd: appRoot,
      // Set cwd so relative patterns resolve correctly
    };
    try {
      const frameworkFiles =
        relativeFrameworkPatterns.length > 0
          ? await this._globWithNormalization(
              relativeFrameworkPatterns,
              globOptions
            )
          : [];
      const consumerFiles = await this._globWithNormalization(
        relativeConsumerPatterns,
        globOptions
      );
      return { frameworkFiles, consumerFiles };
    } catch (error) {
      if (this.options.debug) {
        console.error(
          `[PathResolver] resolveFiles error for ${patternType}:`,
          error
        );
        console.error(
          `[PathResolver] patterns:`,
          JSON.stringify(patterns, null, 2)
        );
        console.error(
          `[PathResolver] globOptions:`,
          JSON.stringify(globOptions, null, 2)
        );
      }
      return { frameworkFiles: [], consumerFiles: [] };
    }
  }
  /**
   * Resolve patterns for a discovery type using constants and path utilities
   * Pure utility method - no caching, just resolves patterns
   * @param patternType - Type of patterns (css, routes, i18n, assets, pwa)
   * @returns Resolved patterns with absolute paths
   */
  async resolvePatterns(patternType) {
    if (!constants.getPatternsFor) {
      return { framework: [], consumer: [], all: [] };
    }
    const appRoot = this.getAppRoot();
    const repoRoot = this.getRepoRoot();
    if (patternType === 'i18n' && (!appRoot || appRoot === repoRoot)) {
      throw new Error(
        `Cannot resolve i18n patterns: appRoot not set (appRoot: ${appRoot}, repoRoot: ${repoRoot}). Ensure configResolved hook has run before discovery.`
      );
    }
    const patterns = constants.getPatternsFor(patternType);
    const isMonorepo = this.isMonorepo();
    if (patternType === 'i18n') {
      const i18nPatterns = patterns;
      const resolved2 = {
        eager: i18nPatterns.eager.map((pattern) => {
          if (pattern.startsWith('!')) {
            return '!' + this.resolveAppPath(pattern.slice(1));
          }
          return this.resolveAppPath(pattern);
        }),
        lazy: i18nPatterns.lazy.map((pattern) => {
          if (pattern.startsWith('!')) {
            return '!' + this.resolveAppPath(pattern.slice(1));
          }
          return this.resolveAppPath(pattern);
        }),
        framework: {
          eager: isMonorepo
            ? (i18nPatterns.framework?.eager || [])
                .map((pattern) => this.resolveRepoPath(pattern))
                .filter(Boolean)
            : await Promise.all(
                (i18nPatterns.framework?.eager || []).map((pattern) =>
                  this._resolveFrameworkI18nPattern(pattern)
                )
              ).then((results) => results.filter(Boolean)),
          lazy: isMonorepo
            ? (i18nPatterns.framework?.lazy || [])
                .map((pattern) => this.resolveRepoPath(pattern))
                .filter(Boolean)
            : await Promise.all(
                (i18nPatterns.framework?.lazy || []).map((pattern) =>
                  this._resolveFrameworkI18nPattern(pattern)
                )
              ).then((results) => results.filter(Boolean)),
        },
        all: [],
      };
      resolved2.all = [
        ...resolved2.eager,
        ...resolved2.lazy,
        ...resolved2.framework.eager,
        ...resolved2.framework.lazy,
      ];
      return resolved2;
    }
    const standardPatterns = patterns;
    const resolved = {
      framework: isMonorepo
        ? (standardPatterns.framework || [])
            .map((pattern) => this.resolveRepoPath(pattern))
            .filter(Boolean)
        : [],
      consumer: (standardPatterns.consumer || []).map((pattern) =>
        this.resolveAppPath(pattern)
      ),
      all: [],
    };
    resolved.all = [...resolved.consumer, ...resolved.framework];
    return resolved;
  }
  /**
   * Get absolute path to empty ESM module for optional dependency aliasing.
   * Used by Vite resolveId — served directly to the browser in dev mode.
   */
  getEmptyModulePath() {
    const cjsPath = this.getEmptyCjsModulePath();
    return cjsPath.replace(/\.cjs$/, '.js');
  }
  /**
   * Get absolute path to empty flag component module.
   * Returns `export default () => null;` — used by flag filtering plugins
   * to replace unused flag files at build time.
   */
  getEmptyFlagModulePath() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    return this.normalizePath(resolve(__dirname, 'emptyFlag.js'));
  }
  /**
   * Get absolute path to empty CJS module for esbuild pre-bundling.
   * CJS because esbuild statically analyzes ESM exports — CJS has dynamic
   * exports, so any named import resolves.
   */
  getEmptyCjsModulePath() {
    const resolved = this.resolvePackage('@donotdev/core/empty');
    if (!resolved)
      throw new Error(
        'Cannot resolve @donotdev/core/empty — package setup is broken'
      );
    return resolved;
  }
  // === PRIVATE METHODS ===
  /**
   * Find repo root by looking for DnDev monorepo markers or apps/ directory
   * Supports both config (apps/) and tooling (packages/) detection
   * Also handles simple consumer projects (single app at root)
   */
  _findRepoRoot(startDir) {
    let currentDir = this.normalizePath(startDir);
    let levelsChecked = 0;
    const maxLevels = this.options.maxLevels;
    while (levelsChecked < maxLevels) {
      const toolingPath = this.normalizePath(
        join(currentDir, PACKAGE_PATHS.TOOLING)
      );
      const corePath = this.normalizePath(join(currentDir, PACKAGE_PATHS.CORE));
      if (this.pathExists(toolingPath) && this.pathExists(corePath)) {
        return currentDir;
      }
      const appsDir = join(currentDir, 'apps');
      if (this.pathExists(appsDir)) {
        const appsDirStat = this.statSync(appsDir);
        if (appsDirStat?.isDirectory()) {
          return this.normalizePath(currentDir);
        }
      }
      const packageJsonPath = this.normalizePath(
        join(currentDir, 'package.json')
      );
      if (this.pathExists(packageJsonPath)) {
        const parentDir2 = this.normalizePath(dirname(currentDir));
        if (parentDir2 === currentDir) {
          return currentDir;
        }
      }
      const parentDir = this.normalizePath(dirname(currentDir));
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
      levelsChecked++;
    }
    return this.normalizePath(startDir);
  }
}
export { PACKAGE_PATHS, PathResolver };
