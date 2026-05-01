// packages/core/config/utils/PathResolver.d.ts
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

import type { Dirent, FSWatcher, Stats, WatchOptions } from 'node:fs';
export declare const PACKAGE_PATHS: {
  readonly CLI: 'packages/cli';
  readonly COMPONENTS: 'packages/core/components';
  readonly CONFIG: 'packages/core/config';
  readonly CORE: 'packages/core';
  readonly CRUD: 'packages/core/crud';
  readonly FEATURES: 'packages/features';
  readonly HOOKS: 'packages/core/hooks';
  readonly I18N: 'packages/core/i18n';
  readonly SCHEMAS: 'packages/core/schemas';
  readonly STORES: 'packages/core/stores';
  readonly TEMPLATES: 'packages/templates';
  readonly TOOLING: 'packages/tooling';
  readonly TYPES: 'packages/core/types';
  readonly UI: 'packages/ui';
  readonly UTILS: 'packages/core/utils';
  readonly AUTH: 'packages/features/auth';
  readonly BILLING: 'packages/features/billing';
  readonly OAUTH: 'packages/features/oauth';
  readonly FIREBASE: 'packages/providers/firebase';
  readonly FUNCTIONS: 'packages/functions';
};
interface PathResolverOptions {
  debug?: boolean;
  maxLevels?: number;
  customMarkers?: string[];
  cache?: boolean;
}
/**
 * PathResolver - Cross-platform path operations with singleton pattern
 * Singleton maintains shared state: _repoRoot (from cwd) and _appRoot (set once)
 */
export declare class PathResolver {
  private static _instance;
  private options;
  private _repoRoot;
  private _appRoot;
  /**
   * Get or create singleton instance
   * @param options - Configuration options
   * @returns PathResolver singleton instance
   */
  static getInstance(options?: PathResolverOptions): PathResolver;
  /**
   * Reset singleton instance (useful for testing)
   * @private
   */
  static _reset(): void;
  /**
   * @param options - Configuration options
   * @param options.maxLevels - Maximum directory levels to traverse (default: 10 for tooling, 2 for config)
   * @param options.customMarkers - Additional markers for DnDev detection
   * @param options.cache - Enable result caching (unused, kept for compatibility)
   * @param options.debug - Enable debug logging
   */
  constructor(options?: PathResolverOptions);
  /**
   * Normalize path to use forward slashes consistently across platforms
   */
  normalizePath(path: string): string;
  /**
   * Get relative path from app root
   */
  getRelativePath(absolutePath: string): string;
  /**
   * Get basename (filename) from path
   */
  getBasename(path: string): string;
  /**
   * Get directory name (parent directory) from path
   */
  getDirname(path: string): string;
  /**
   * Resolve package path using Node's module resolution
   * Handles Bun's .bun/ structure, npm, pnpm, yarn workspaces
   * @param packageSpecifier - Package name or subpath (e.g., '@donotdev/components' or '@donotdev/components/styles')
   * @param fromPath - Optional base path to resolve from (defaults to appRoot)
   * @returns Resolved absolute path or null if not found
   */
  resolvePackage(
    packageSpecifier: string,
    fromPath?: string | null
  ): string | null;
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
    fromPath?: string | null
  ): string | null;
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
    fromPath?: string | null
  ): string | null;
  /**
   * Resolve relative path against app root
   */
  resolveAppPath(relativePath: string): string;
  /**
   * Resolve relative path against repo root
   */
  resolveRepoPath(relativePath: string): string;
  /**
   * Resolve relative path against arbitrary base directory
   */
  resolvePath(relativePath: string, baseDir: string): string;
  /**
   * Create import path for ES modules (always starts with ./)
   */
  createImportPath(absolutePath: string): string;
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
  } | null;
  /**
   * Check if path exists
   */
  pathExists(filePath: string, silent?: boolean): boolean;
  /**
   * Read and parse JSON file synchronously
   */
  readJsonFile(filePath: string): any | null;
  /**
   * Read and parse JSON file asynchronously
   */
  readJsonFileAsync(filePath: string): Promise<any | null>;
  /**
   * Read text file synchronously with BOM handling
   */
  readFileSync(filePath: string): string;
  /**
   * Read text file asynchronously with BOM handling
   */
  readFile(filePath: string): Promise<string>;
  /**
   * Read file content safely (sync, for config compatibility)
   * @param filePath - Path to file
   * @param encoding - File encoding (default: 'utf8')
   * @returns File content or null if error
   */
  readFileSyncCompat(filePath: string, encoding?: string): string | null;
  /**
   * Read file as Buffer (for binary file detection)
   */
  readFileBuffer(filePath: string): Promise<Buffer>;
  /**
   * Write file with options (sync)
   */
  writeFileSync(
    filePath: string,
    content: string,
    options?: {
      overwrite?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    }
  ): boolean;
  /**
   * Write file with options (async)
   */
  writeFile(
    filePath: string,
    content: string,
    options?: {
      overwrite?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    }
  ): Promise<boolean>;
  /**
   * Write file content safely (for config compatibility)
   * @param filePath - Path to file (relative to app root or absolute)
   * @param content - File content (string or Buffer)
   * @param encoding - File encoding (default: 'utf8')
   * @returns Success status
   */
  writeFileCompat(
    filePath: string,
    content: string | Buffer,
    encoding?: string
  ): boolean;
  /**
   * Append content to file safely
   * @param filePath - Path to file (relative to app root or absolute)
   * @param content - Content to append
   * @param encoding - File encoding (default: 'utf8')
   * @returns Success status
   */
  appendFile(
    filePath: string,
    content: string | Buffer,
    encoding?: string
  ): boolean;
  /**
   * Write JSON file
   */
  writeJsonFile(
    filePath: string,
    data: any,
    options?: {
      overwrite?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    }
  ): Promise<boolean>;
  /**
   * Copy file
   */
  copyFile(
    srcPath: string,
    destPath: string,
    options?: {
      overwrite?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    }
  ): Promise<boolean>;
  /**
   * Copy file (binary-safe, for config compatibility)
   * @param srcPath - Source file path (absolute or relative to app root)
   * @param destPath - Destination file path (absolute or relative to app root)
   * @returns Success status
   */
  copyFileCompat(srcPath: string, destPath: string): boolean;
  /**
   * Remove file from filesystem
   * @param filePath - Path to file (relative to app root or absolute)
   */
  removeFile(filePath: string): Promise<void>;
  /**
   * Create directory (recursive)
   * @param dirPath - Path to directory (relative to app root or absolute)
   * @returns Success status
   */
  mkdir(dirPath: string): boolean;
  /**
   * Read directory contents synchronously
   */
  readdirSync(
    dirPath: string,
    options?:
      | {
          encoding?: BufferEncoding | null;
          withFileTypes?: false;
        }
      | BufferEncoding
      | null
  ): string[];
  readdirSync(
    dirPath: string,
    options: {
      encoding?: BufferEncoding | null;
      withFileTypes: true;
    }
  ): Dirent[];
  /**
   * Get file stats synchronously
   */
  statSync(filePath: string): Stats;
  /**
   * Resolve the real path of a file, following symlinks
   * @param filePath - Path to resolve
   * @returns Resolved real path
   */
  realpathSync(filePath: string): string;
  /**
   * Watch a directory for changes
   * @param dirPath - Directory to watch
   * @param options - fs.watch options
   * @param callback - Callback for change events
   * @returns FSWatcher instance
   */
  watch(
    dirPath: string,
    options: WatchOptions,
    callback: (eventType: string, filename: string | null) => void
  ): FSWatcher;
  /**
   * Get file stats synchronously (follows symlinks)
   */
  lstatSync(filePath: string): Stats;
  /**
   * Ensure directory exists (creates if needed)
   * Uses native fs.promises.mkdir with recursive option
   * Wraps EEXIST errors for Windows/Bun compatibility
   */
  ensureDir(dirPath: string): Promise<void>;
  /**
   * Ensure directory exists synchronously (creates if needed)
   * Uses native fs.mkdirSync with recursive option
   * Wraps EEXIST errors for Windows/Bun compatibility
   */
  ensureDirSync(dirPath: string): void;
  /**
   * Remove file or directory (async)
   * Uses native fs.promises.rm with recursive option
   */
  remove(path: string): Promise<void>;
  /**
   * Remove file or directory (sync)
   * Uses native fs.rmSync with recursive option
   */
  removeSync(path: string): void;
  /**
   * Read directory contents asynchronously
   */
  readdir(
    dirPath: string,
    options?: {
      encoding?: BufferEncoding | null;
      withFileTypes?: boolean;
    }
  ): Promise<string[] | Dirent[]>;
  /**
   * Strip BOM from content
   */
  private stripBom;
  /**
   * Get repo root (monorepo root)
   */
  getRepoRoot(): string;
  /**
   * Get app root (where vite.config.ts is, Vite's config.root)
   * Falls back to repoRoot if not set
   */
  getAppRoot(): string;
  /**
   * Set app root
   */
  setAppRoot(root: string): void;
  /**
   * Check if we're in the monorepo (framework repo) vs consumer repo
   * @returns True if repoRoot is the monorepo (has packages directory)
   */
  isMonorepo(): boolean;
  /**
   * Validate path is within app boundaries
   */
  isWithinApp(targetPath: string): boolean;
  /**
   * Find files matching pattern within directory
   */
  findFiles(
    directory: string,
    pattern: string,
    options?: any
  ): Promise<string[]>;
  /**
   * Clear cached roots (forces re-discovery)
   */
  clearCache(): void;
  /**
   * Resolve framework i18n pattern for consumer repos (handles workspace hoisting)
   * Converts monorepo patterns to installed package paths
   * @param pattern - Pattern like 'packages/core/i18n/src/locales/eager/*_*.json'
   * @returns Resolved pattern path or null if package not found
   * @private
   */
  _resolveFrameworkI18nPattern(pattern: string): string | null;
  /**
   * Execute fast-glob with normalized results
   * @private
   */
  _globWithNormalization(patterns: string[], options: any): Promise<string[]>;
  /**
   * Resolve files using patterns with cross-platform support
   * @param patterns - Pattern configuration
   * @param patternType - Type of patterns (css, routes, etc.)
   * @returns Framework and consumer file lists
   */
  resolveFiles(
    patterns: any,
    patternType?: string
  ): Promise<{
    frameworkFiles: string[];
    consumerFiles: string[];
  }>;
  /**
   * Resolve patterns for a discovery type using constants and path utilities
   * Pure utility method - no caching, just resolves patterns
   * @param patternType - Type of patterns (css, routes, i18n, assets, pwa)
   * @returns Resolved patterns with absolute paths
   */
  resolvePatterns(patternType: string): Promise<any>;
  /**
   * Get absolute path to empty ESM module for optional dependency aliasing.
   * Used by Vite resolveId — served directly to the browser in dev mode.
   */
  getEmptyModulePath(): string;
  /**
   * Get absolute path to empty CJS module for esbuild pre-bundling.
   * CJS because esbuild statically analyzes ESM exports — CJS has dynamic exports.
   */
  getEmptyCjsModulePath(): string;
  /**
   * Find repo root by looking for DnDev monorepo markers or apps/ directory
   * Supports both config (apps/) and tooling (packages/) detection
   */
  private _findRepoRoot;
}
export {};
