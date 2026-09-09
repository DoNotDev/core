// packages/core/config/utils/PathResolver.ts
/**
 * @fileoverview PathResolver - Unified Cross-Platform Path Operations
 * @description Single source of truth for path resolution across tooling and config.
 * Provides consistent, cross-platform path handling with singleton pattern for shared state.
 * All path operations use forward slashes for web compatibility.
 *
 * TWO ROOTS:
 * - appRoot: The app that ran the config (where vite.config.ts/next.config.js is)
 * - repoRoot: The root of the repo we're in (directory containing apps/ or packages/)
 *
 * PATH RESOLUTION:
 * - resolveAppPath(path): Resolves against appRoot (app paths)
 * - resolveRepoPath(path): Resolves against repoRoot (repo paths)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import * as fs from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
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

// Static imports (config context only)

// Constants wrapper with fallback for tooling context
const constants = {
  getGlobOptionsFor: constantsModule.getGlobOptionsFor || undefined,
  SCAN_PATTERNS: constantsModule.SCAN_PATTERNS || undefined,
  getPatternsFor: constantsModule.getPatternsFor || undefined,
  I18N_PATHS: (constantsModule as any).I18N_PATHS || undefined,
};

// Optional logging - use console as fallback (works in both contexts)
const log = {
  error: (message: string, error?: any) => {
    console.error(message, error);
  },
  warn: (message: string, error?: any) => {
    console.warn(message, error);
  },
  info: (message: string) => {
    console.log(message);
  },
};

// Simple error wrapper for config context (no tooling dependency)
function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  message: string
): Promise<T> {
  return fn().catch((error) => {
    throw new Error(
      `${message}: ${error instanceof Error ? error.message : String(error)}`
    );
  });
}

// Package path constants - single source of truth for package paths
export const PACKAGE_PATHS = {
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
} as const;

interface PathResolverOptions {
  debug?: boolean;
  maxLevels?: number;
  customMarkers?: string[];
  cache?: boolean;
}

/**
 * Unified file operation options
 */
interface FileOptions {
  /**
   * File format: 'text' (string), 'json' (parsed object), 'buffer' (Buffer), or 'auto' (detect from extension)
   * Default: 'auto' - detects .json files as JSON, others as text
   */
  format?: 'text' | 'json' | 'buffer' | 'auto';
  /**
   * Overwrite existing files (default: false)
   */
  overwrite?: boolean;
  /**
   * Dry run mode - log what would be done without actually doing it (default: false)
   */
  dryRun?: boolean;
  /**
   * Verbose logging (default: false)
   */
  verbose?: boolean;
  /**
   * File encoding (default: 'utf8')
   */
  encoding?: string;
}

/**
 * PathResolver - Cross-platform path operations with singleton pattern
 * Singleton maintains shared state: _repoRoot (from cwd) and _appRoot (set once)
 */
export class PathResolver {
  private static _instance: PathResolver | null = null;

  private options!: Required<Omit<PathResolverOptions, 'customMarkers'>> & {
    customMarkers: string[];
  };
  private _repoRoot!: string;
  private _appRoot: string | null = null;

  /**
   * Get or create singleton instance
   * @param options - Configuration options
   * @returns PathResolver singleton instance
   */
  static getInstance(options: PathResolverOptions = {}): PathResolver {
    if (!PathResolver._instance) {
      PathResolver._instance = new PathResolver(options);
    }
    return PathResolver._instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   * @private
   */
  static _reset(): void {
    PathResolver._instance = null;
  }

  /**
   * @param options - Configuration options
   * @param options.maxLevels - Maximum directory levels to traverse (default: 10 for tooling, 2 for config)
   * @param options.customMarkers - Additional markers for DnDev detection
   * @param options.cache - Enable result caching (unused, kept for compatibility)
   * @param options.debug - Enable debug logging
   */
  constructor(options: PathResolverOptions = {}) {
    // Prevent direct instantiation if singleton exists
    if (PathResolver._instance) {
      return PathResolver._instance;
    }

    this.options = {
      maxLevels: options.maxLevels ?? 10,
      customMarkers: options.customMarkers || [],
      cache: options.cache ?? false,
      debug: options.debug ?? false,
    };

    // Find repo root - supports both config (apps/) and tooling (packages/) detection
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

    // appRoot: App root (where vite.config.ts is, Vite's config.root) - set in configResolved hook
    this._appRoot = null;

    PathResolver._instance = this;
  }

  // === CORE PATH OPERATIONS ===

  /**
   * Normalize path to use forward slashes consistently across platforms
   */
  normalizePath(path: string): string {
    if (!path) return '';
    try {
      return normalize(path).split(sep).join('/');
    } catch (error) {
      // Fallback: just convert separators if normalize fails
      return String(path).split(sep).join('/');
    }
  }

  /**
   * Get relative path from app root
   */
  getRelativePath(absolutePath: string): string {
    const appRoot = this.getAppRoot();
    const rel = relative(appRoot, absolutePath);
    return this.normalizePath(rel);
  }

  /**
   * Get basename (filename) from path
   */
  getBasename(path: string): string {
    if (!path) return '';
    const normalized = this.normalizePath(path);
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
  }

  /**
   * Get directory name (parent directory) from path
   */
  getDirname(path: string): string {
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
  resolvePackage(
    packageSpecifier: string,
    fromPath: string | null = null
  ): string | null {
    try {
      const basePath = fromPath || this.getAppRoot();
      // Use createRequire to get a require function relative to the base path
      // This handles Bun's .bun/, npm, pnpm (.pnpm/), yarn (.yarn/) automatically
      const require = createRequire(join(basePath, 'package.json'));
      const resolved = require.resolve(packageSpecifier);
      return this.normalizePath(resolved);
    } catch (error) {
      // Package not found - return null instead of throwing
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
  resolveFrameworkPackage(
    packageName: string,
    fromPath: string | null = null
  ): string | null {
    // 1. Try createRequire first (handles hoisting automatically)
    // This works for: published packages, hoisted deps, pnpm/yarn/bun workspaces
    const packageJsonPath = this.resolvePackage(
      `${packageName}/package.json`,
      fromPath
    );
    if (packageJsonPath) {
      return this.getDirname(packageJsonPath);
    }

    // 2. Monorepo: packages/ directory (development mode)
    if (this.isMonorepo() && packageName.startsWith('@donotdev/')) {
      const name = packageName.replace('@donotdev/', '');

      // Try standard packages/ structure
      const monorepoPath = this.resolveRepoPath(`packages/${name}`);
      if (this.pathExists(monorepoPath)) return monorepoPath;

      // Try features/ subdirectory
      if (['auth', 'billing', 'crud', 'oauth'].includes(name)) {
        const featurePath = this.resolveRepoPath(`packages/features/${name}`);
        if (this.pathExists(featurePath)) return featurePath;
      }

      // Try providers/ subdirectory
      if (name === 'firebase') {
        const providerPath = this.resolveRepoPath(`packages/providers/${name}`);
        if (this.pathExists(providerPath)) return providerPath;
      }
    }

    // 3. App-level node_modules
    const appNodeModules = this.resolveAppPath(`node_modules/${packageName}`);
    if (this.pathExists(appNodeModules)) return appNodeModules;

    // 4. Root node_modules (workspace hoisting)
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
  resolvePackageAsset(
    assetPath: string,
    fromPath: string | null = null
  ): string | null {
    return this.resolvePackage(assetPath, fromPath);
  }

  /**
   * Resolve relative path against app root
   */
  resolveAppPath(relativePath: string): string {
    const appRoot = this.getAppRoot();
    const resolved = resolve(appRoot, relativePath);
    return this.normalizePath(resolved);
  }

  /**
   * Resolve relative path against repo root
   */
  resolveRepoPath(relativePath: string): string {
    const repoRoot = this.getRepoRoot();
    const normalizedRelativePath = this.normalizePath(relativePath);
    const resolved = resolve(repoRoot, normalizedRelativePath);
    return this.normalizePath(resolved);
  }

  /**
   * Resolve relative path against arbitrary base directory
   */
  resolvePath(relativePath: string, baseDir: string): string {
    const normalizedBase = this.normalizePath(baseDir);
    const normalizedRelative = this.normalizePath(relativePath);
    const resolved = resolve(normalizedBase, normalizedRelative);
    return this.normalizePath(resolved);
  }

  /**
   * Create import path for ES modules (always starts with ./)
   */
  createImportPath(absolutePath: string): string {
    const relativePath = this.getRelativePath(absolutePath);
    return './' + relativePath;
  }

  /**
   * Get comprehensive file information with normalized paths
   */
  getFileInfo(absolutePath: string): {
    absolutePath: string;
    relativePath: string;
    importPath: string;
    size: number;
    isFile: boolean;
    isDirectory: boolean;
  } | null {
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
  private _detectFormat(
    filePath: string,
    explicitFormat?: 'text' | 'json' | 'buffer' | 'auto'
  ): 'text' | 'json' | 'buffer' {
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
  async read(
    filePath: string,
    options: FileOptions = {}
  ): Promise<string | any | Buffer | null> {
    const { format = 'auto', encoding = 'utf8' } = options;
    const detectedFormat = this._detectFormat(filePath, format);

    try {
      if (detectedFormat === 'buffer') {
        return await fs.promises.readFile(filePath);
      }

      const content = await fs.promises.readFile(
        filePath,
        encoding as BufferEncoding
      );
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
  readSync(
    filePath: string,
    options: FileOptions = {}
  ): string | any | Buffer | null {
    const { format = 'auto', encoding = 'utf8' } = options;
    const detectedFormat = this._detectFormat(filePath, format);

    try {
      if (detectedFormat === 'buffer') {
        return fs.readFileSync(filePath);
      }

      const content = fs.readFileSync(filePath, encoding as BufferEncoding);
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
  async write(
    filePath: string,
    content: string | any | Buffer,
    options: FileOptions = {}
  ): Promise<boolean> {
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
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }

    const detectedFormat = this._detectFormat(filePath, format);
    let writeContent: string | Buffer;

    if (Buffer.isBuffer(content)) {
      writeContent = content;
    } else if (detectedFormat === 'json' && typeof content === 'object') {
      writeContent = JSON.stringify(content, null, 2);
    } else {
      writeContent = String(content);
    }

    try {
      return await safeExecuteAsync(async () => {
        // Binary files (Buffer) should be written without encoding
        // Text files (string) should use utf8 encoding
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
  writeSync(
    filePath: string,
    content: string | any | Buffer,
    options: FileOptions = {}
  ): boolean {
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
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }

    const detectedFormat = this._detectFormat(filePath, format);
    let writeContent: string | Buffer;

    if (Buffer.isBuffer(content)) {
      writeContent = content;
    } else if (detectedFormat === 'json' && typeof content === 'object') {
      writeContent = JSON.stringify(content, null, 2);
    } else {
      writeContent = String(content);
    }

    try {
      // Binary files (Buffer) should be written without encoding
      // Text files (string) should use utf8 encoding
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
  async copy(
    srcPath: string,
    destPath: string,
    options: FileOptions = {}
  ): Promise<boolean> {
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
    } catch (error: any) {
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
  copySync(
    srcPath: string,
    destPath: string,
    options: FileOptions = {}
  ): boolean {
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
    } catch (error: any) {
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
  pathExists(filePath: string, silent: boolean = false): boolean {
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
  mkdir(dirPath: string): boolean {
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

  /**
   * Read directory contents synchronously
   * Returns empty array if directory doesn't exist (graceful degradation)
   *
   * @param dirPath - Path to directory
   * @param options - Directory reading options
   * @returns Array of directory entries, or empty array on error
   */
  readdirSync(
    dirPath: string,
    options?:
      | { encoding?: BufferEncoding | null; withFileTypes?: false }
      | BufferEncoding
      | null
  ): string[];
  readdirSync(
    dirPath: string,
    options: { encoding?: BufferEncoding | null; withFileTypes: true }
  ): Dirent[];
  readdirSync(
    dirPath: string,
    options?:
      | { encoding?: BufferEncoding | null; withFileTypes?: boolean }
      | BufferEncoding
      | null
  ): string[] | Dirent[] {
    try {
      return fs.readdirSync(dirPath, options as any);
    } catch (error) {
      if (this.options.debug) {
        log.warn(`Failed to read directory: ${dirPath}`, error);
      }
      // Return empty array for graceful degradation (consistent with findFiles)
      const isObjectOptions =
        options && typeof options === 'object' && 'withFileTypes' in options;
      return isObjectOptions && options.withFileTypes
        ? ([] as Dirent[])
        : ([] as string[]);
    }
  }

  /**
   * Get file stats synchronously
   * Returns null if file doesn't exist (graceful degradation)
   *
   * @param filePath - Path to file
   * @returns File stats or null if file doesn't exist
   */
  statSync(filePath: string): Stats | null {
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
   * Get file stats synchronously (follows symlinks)
   * Returns null if file doesn't exist (graceful degradation)
   *
   * @param filePath - Path to file
   * @returns File stats or null if file doesn't exist
   */
  lstatSync(filePath: string): Stats | null {
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
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Ensure directory exists synchronously (creates if needed)
   * Uses native fs.mkdirSync with recursive option
   * Wraps EEXIST errors for Windows/Bun compatibility
   */
  ensureDirSync(dirPath: string): void {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Remove file or directory (async)
   * Uses native fs.promises.rm with recursive option
   */
  async remove(path: string): Promise<void> {
    await fs.promises.rm(path, { recursive: true, force: true });
  }

  /**
   * Remove file or directory (sync)
   * Uses native fs.rmSync with recursive option
   */
  removeSync(path: string): void {
    fs.rmSync(path, { recursive: true, force: true });
  }

  /**
   * Read directory contents asynchronously
   */
  async readdir(
    dirPath: string,
    options?: { encoding?: BufferEncoding | null; withFileTypes?: boolean }
  ): Promise<string[] | Dirent[]> {
    return fs.promises.readdir(dirPath, options as any);
  }

  /**
   * Strip BOM from content
   */
  private stripBom(content: string): string {
    return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  }

  // === ROOT MANAGEMENT ===

  /**
   * Get repo root (monorepo root)
   * Falls back to process.cwd() if not found
   */
  getRepoRoot(): string {
    return this._repoRoot || process.cwd();
  }

  /**
   * Get app root (where vite.config.ts is, Vite's config.root)
   * Falls back to repoRoot if not set
   */
  getAppRoot(): string {
    if (!this._appRoot) {
      // CRITICAL: Do not fallback to process.cwd() or repoRoot
      // In monorepos, process.cwd() is the repo root, not the app root
      // Discovery must wait for configResolved to set appRoot correctly
      // Return repoRoot only as last resort (will cause pattern resolution errors if used)
      return this._repoRoot;
    }
    return this._appRoot;
  }

  /**
   * Set app root
   */
  setAppRoot(root: string): void {
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
  isMonorepo(): boolean {
    const packagesDir = join(this._repoRoot, 'packages');
    return this.pathExists(packagesDir);
  }

  /**
   * Validate path is within app boundaries
   */
  isWithinApp(targetPath: string): boolean {
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
  async findFiles(
    directory: string,
    pattern: string,
    options: any = {}
  ): Promise<string[]> {
    const searchPattern = this.normalizePath(join(directory, pattern));

    // Convert absolute pattern to relative for fast-glob (cross-platform compatibility)
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
  clearCache(): void {
    // No longer needed, but kept for API compatibility
  }

  // === DISCOVERY PATTERN RESOLUTION (Config-specific) ===

  /**
   * Resolve framework i18n pattern for consumer repos (handles workspace hoisting)
   * Converts monorepo patterns to installed package paths
   * @param pattern - Pattern like 'packages/core/i18n/locales/eager/*_*.json'
   * @returns Resolved pattern path or null if package not found
   * @private
   */
  async _resolveFrameworkI18nPattern(pattern: string): Promise<string | null> {
    // Get I18N_PATHS from constants (single source of truth)
    const I18N_PATHS = constants.I18N_PATHS;
    if (!I18N_PATHS) {
      return null;
    }

    // Extract the glob suffix from the pattern
    // packages/core/i18n/locales/eager/*_*.json -> locales/eager/*_*.json
    const i18nSubpath = pattern.replace(I18N_PATHS.SOURCE_ROOT + '/', '');

    // Use resolveFrameworkPackage to find @donotdev/core
    const corePackageRoot = this.resolveFrameworkPackage('@donotdev/core');
    if (!corePackageRoot) {
      return null;
    }

    // Source and published structure are now the same (locales at root, not in src/)
    // So path is: @donotdev/core/i18n/locales/eager/*_*.json
    const resolvedPath = this.normalizePath(
      join(corePackageRoot, I18N_PATHS.PUBLISHED_ROOT, i18nSubpath)
    );

    // Check if directory exists (strip glob pattern)
    const resolvedDir = resolvedPath.replace(/\/[^/]*\*.*$/, '');
    if (this.pathExists(resolvedDir)) {
      return resolvedPath;
    }

    // Return path anyway (glob will check if files exist)
    return resolvedPath;
  }

  /**
   * Execute fast-glob with normalized results
   * @private
   */
  async _globWithNormalization(
    patterns: string[],
    options: any
  ): Promise<string[]> {
    const results = await fastGlob(patterns, options);
    return results.map((path: string | { path: string }) => {
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
  async resolveFiles(
    patterns: any,
    patternType: string = 'css'
  ): Promise<{ frameworkFiles: string[]; consumerFiles: string[] }> {
    // Validate patterns structure
    if (!patterns || typeof patterns !== 'object') {
      return { frameworkFiles: [], consumerFiles: [] };
    }

    // i18n patterns have a different structure: framework is { eager: [], lazy: [] }
    // Skip validation and file resolution for i18n - it handles its own structure in _processFiles
    if (patternType === 'i18n') {
      // i18n discovery overrides discover() and _processFiles and doesn't use resolveFiles results
      // Return empty silently (no logging) to avoid confusion
      return { frameworkFiles: [], consumerFiles: [] };
    }

    if (!Array.isArray(patterns.framework)) {
      patterns.framework = []; // Default to empty array for routes (no framework files)
    }

    if (!Array.isArray(patterns.consumer)) {
      return { frameworkFiles: [], consumerFiles: [] };
    }

    // Validate pattern strings
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

    // Convert absolute patterns to relative patterns for fast-glob (cross-platform compatibility)
    // fast-glob works better with relative patterns when cwd is set on all platforms
    const normalizeAppRoot = this.normalizePath(appRoot);
    const relativeFrameworkPatterns = patterns.framework.map(
      (pattern: string) => {
        const normalizedPattern = this.normalizePath(pattern);
        if (normalizedPattern.startsWith(normalizeAppRoot)) {
          return normalizedPattern.slice(normalizeAppRoot.length + 1); // Remove appRoot + leading slash
        }
        return normalizedPattern;
      }
    );

    const relativeConsumerPatterns = patterns.consumer.map(
      (pattern: string) => {
        const normalizedPattern = this.normalizePath(pattern);
        if (normalizedPattern.startsWith(normalizeAppRoot)) {
          return normalizedPattern.slice(normalizeAppRoot.length + 1); // Remove appRoot + leading slash
        }
        return normalizedPattern;
      }
    );

    const globOptions = {
      ...baseGlobOptions,
      onlyFiles: true,
      absolute: true, // Return absolute paths in results
      braceExpansion: true,
      extglob: true,
      globstar: true,
      cwd: appRoot, // Set cwd so relative patterns resolve correctly
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
  async resolvePatterns(patternType: string): Promise<any> {
    if (!constants.getPatternsFor) {
      // Tooling context - return empty (not used in tooling)
      return { framework: [], consumer: [], all: [] };
    }

    // CRITICAL: Ensure appRoot is set before resolving patterns
    const appRoot = this.getAppRoot();
    const repoRoot = this.getRepoRoot();
    if (patternType === 'i18n' && (!appRoot || appRoot === repoRoot)) {
      // For i18n, appRoot must be set and different from repoRoot
      // If not set, throw error to prevent incorrect pattern resolution
      throw new Error(
        `Cannot resolve i18n patterns: appRoot not set (appRoot: ${appRoot}, repoRoot: ${repoRoot}). ` +
          `Ensure configResolved hook has run before discovery.`
      );
    }

    // Get raw patterns from constants (PathResolver handles resolution)
    const patterns = constants.getPatternsFor(patternType) as any;
    const isMonorepo = this.isMonorepo();

    // Handle i18n patterns (different structure)
    if (patternType === 'i18n') {
      const i18nPatterns = patterns as {
        eager: string[];
        lazy: string[];
        framework?: { eager: string[]; lazy: string[] };
      };
      const resolved = {
        eager: i18nPatterns.eager.map((pattern: string) => {
          if (pattern.startsWith('!')) {
            return '!' + this.resolveAppPath(pattern.slice(1));
          }
          return this.resolveAppPath(pattern);
        }),
        lazy: i18nPatterns.lazy.map((pattern: string) => {
          if (pattern.startsWith('!')) {
            return '!' + this.resolveAppPath(pattern.slice(1));
          }
          return this.resolveAppPath(pattern);
        }),
        framework: {
          eager: isMonorepo
            ? (i18nPatterns.framework?.eager || [])
                .map((pattern: string) => this.resolveRepoPath(pattern))
                .filter(Boolean)
            : await Promise.all(
                (i18nPatterns.framework?.eager || []).map((pattern: string) =>
                  this._resolveFrameworkI18nPattern(pattern)
                )
              ).then((results) => results.filter(Boolean) as string[]),
          lazy: isMonorepo
            ? (i18nPatterns.framework?.lazy || [])
                .map((pattern: string) => this.resolveRepoPath(pattern))
                .filter(Boolean)
            : await Promise.all(
                (i18nPatterns.framework?.lazy || []).map((pattern: string) =>
                  this._resolveFrameworkI18nPattern(pattern)
                )
              ).then((results) => results.filter(Boolean) as string[]),
        },
        all: [] as string[],
      };

      resolved.all = [
        ...resolved.eager,
        ...resolved.lazy,
        ...resolved.framework.eager,
        ...resolved.framework.lazy,
      ];

      return resolved;
    }

    // Handle standard patterns (css, routes, assets, pwa)
    const standardPatterns = patterns as {
      framework?: string[];
      consumer?: string[];
    };
    const resolved = {
      framework: isMonorepo
        ? (standardPatterns.framework || [])
            .map((pattern: string) => this.resolveRepoPath(pattern))
            .filter(Boolean)
        : [],
      consumer: (standardPatterns.consumer || []).map((pattern: string) =>
        this.resolveAppPath(pattern)
      ),
      all: [] as string[],
    };

    resolved.all = [...resolved.consumer, ...resolved.framework];
    return resolved;
  }

  /**
   * Get absolute path to empty ESM module for optional dependency aliasing.
   * Used by Vite resolveId — served directly to the browser in dev mode.
   * Note: resolvePackage uses require.resolve (CJS) which picks the "default"
   * condition (.cjs), so we derive the ESM path from it.
   */
  getEmptyModulePath(): string {
    const cjsPath = this.getEmptyCjsModulePath();
    return cjsPath.replace(/\.cjs$/, '.js');
  }

  /**
   * Get absolute path to empty CJS module for esbuild pre-bundling.
   * CJS because esbuild statically analyzes ESM exports — CJS has dynamic
   * exports, so any named import resolves.
   */
  getEmptyCjsModulePath(): string {
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
  private _findRepoRoot(startDir: string): string {
    let currentDir = this.normalizePath(startDir);
    let levelsChecked = 0;
    const maxLevels = this.options.maxLevels;

    while (levelsChecked < maxLevels) {
      // FIRST: Check if this is the dndev framework monorepo (has packages/tooling AND packages/core)
      const toolingPath = this.normalizePath(
        join(currentDir, PACKAGE_PATHS.TOOLING)
      );
      const corePath = this.normalizePath(join(currentDir, PACKAGE_PATHS.CORE));
      if (this.pathExists(toolingPath) && this.pathExists(corePath)) {
        return currentDir;
      }

      // SECOND: Check for apps/ directory (consumer monorepos)
      const appsDir = join(currentDir, 'apps');
      if (this.pathExists(appsDir)) {
        const appsDirStat = this.statSync(appsDir);
        if (appsDirStat?.isDirectory()) {
          return this.normalizePath(currentDir);
        }
      }

      // THIRD: Check for package.json (simple consumer project)
      const packageJsonPath = this.normalizePath(
        join(currentDir, 'package.json')
      );
      if (this.pathExists(packageJsonPath)) {
        const parentDir = this.normalizePath(dirname(currentDir));
        if (parentDir === currentDir) {
          // At filesystem root, this is the project root
          return currentDir;
        }
      }

      // Move up one level
      const parentDir = this.normalizePath(dirname(currentDir));
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
      levelsChecked++;
    }

    // Fallback to startDir
    return this.normalizePath(startDir);
  }
}
