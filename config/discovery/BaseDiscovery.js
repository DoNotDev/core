/**
 * @fileoverview BaseDiscovery - Abstract Base Class for Discovery Engines
 * @description Provides common functionality for all discovery engines including caching, file scanning, and result normalization. Implements the Template Method pattern to eliminate DRY violations across discovery engines.
 *
 * @abstract
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { createLogger } from '../utils/debugLog.js';

export class BaseDiscovery {
  /**
   * @param {PathResolver} pathResolver - Path resolution utility
   * @param {Object} options - Configuration options
   * @param {boolean} options.debug - Enable debug logging (TIER 3 - detailed logs)
   * @param {boolean} options.verbose - Enable verbose logging (TIER 2 - discovery summaries)
   * @param {number} options.cacheTimeout - Cache timeout in milliseconds
   */
  constructor(pathResolver, options = {}) {
    if (this.constructor === BaseDiscovery) {
      throw new Error(
        'BaseDiscovery is abstract and cannot be instantiated directly'
      );
    }

    this.pathResolver = pathResolver;
    // Trust merged config - no local defaults override
    this.options = {
      ...options,
    };

    // Optimize cache timeout for dev mode - increased to 5min to reduce overhead
    // This is a runtime optimization, not a config default
    if (process.env.NODE_ENV === 'development') {
      const devCacheTimeout = 300000; // 5 minutes in dev
      this.options.cacheTimeout = Math.max(
        this.options.cacheTimeout || 60000,
        devCacheTimeout
      );
    }

    this.logger = createLogger(
      this._getDiscoveryType(),
      this.options.debug,
      this.options.verbose,
      {
        fileLogging: this.options.fileLogging, // Already merged from config
        logDir: this.options.logDir, // Already merged from config
      }
    );
    this.cache = null;
    this._lastDiscoveryTime = 0;
  }

  /**
   * Main discovery method with caching - Template Method Pattern
   * @param {boolean} force - Force re-discovery ignoring cache
   * @returns {Promise<Object>} Discovery results
   */
  async discover(force = false) {
    if (!force && this._isCacheValid()) {
      this.logger.debug('Using cached results');
      return this.cache;
    }

    const startTime = Date.now();

    try {
      const patterns = await this._getPatterns();

      // ===================================================================
      // VERBOSE LOGGING - Configuration paths (opt-out, shows where we search)
      // Base path is logged once globally in vite/config.js, not per-discovery
      // ===================================================================
      if (this.options.verbose && patterns) {
        // Log search patterns being used
        if (typeof patterns === 'object' && patterns.pattern) {
          this.logger.verbose(`Pattern: ${patterns.pattern}`);
        } else if (typeof patterns === 'string') {
          this.logger.verbose(`Pattern: ${patterns}`);
        }

        // Log resolved search directories if available
        if (patterns.dirs) {
          this.logger.verbose(
            `Search directories: ${patterns.dirs.slice(0, 3).join(', ')}${patterns.dirs.length > 3 ? ` (${patterns.dirs.length} total)` : ''}`
          );
        }
      }

      const files = await this._scanFiles(patterns);
      const results = await this._processFiles(files);

      this.cache = {
        ...results,
        timestamp: Date.now(),
      };

      // ===================================================================
      // TIER 3 LOGGING - DEBUG ONLY (Detailed timing information)
      // ===================================================================
      const duration = Date.now() - startTime;
      this.logger.debug(`Discovery completed in ${duration}ms`);

      // Discovery summaries are logged by platform-specific plugins/handlers
      // BaseDiscovery only logs debug-level process details

      this._lastDiscoveryTime = Date.now();

      return this.cache;
    } catch (error) {
      this.logger.error(
        `${this._getDiscoveryType()} discovery failed during file scanning: ${error.message}`
      );
      this.logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      // Return empty result but log clearly - let plugin/handler decide if this is fatal
      return this._getEmptyResult();
    }
  }

  /**
   * Clear discovery cache
   */
  clearCache() {
    this.cache = null;
    this._lastDiscoveryTime = 0;
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cached results without re-discovery
   * @returns {Object|null} Cached results or null
   */
  getCachedResults() {
    return this.cache;
  }

  // === ABSTRACT METHODS (Must be implemented by subclasses) ===

  /**
   * Get discovery type name for logging
   * @protected
   * @abstract
   * @returns {string} Discovery type name
   */
  _getDiscoveryType() {
    throw new Error('_getDiscoveryType must be implemented by subclass');
  }

  /**
   * Get file patterns for discovery
   * @protected
   * @abstract
   * @returns {Object} Pattern configuration
   */
  _getPatterns() {
    throw new Error('_getPatterns must be implemented by subclass');
  }

  /**
   * Get pattern type for PathResolver
   * @protected
   * @abstract
   * @returns {string} Pattern type
   */
  _getPatternType() {
    throw new Error('_getPatternType must be implemented by subclass');
  }

  /**
   * Process discovered files into results
   * @protected
   * @abstract
   * @param {Object} files - Discovered files
   * @returns {Promise<Object>} Processing results
   */
  async _processFiles(files) {
    throw new Error('_processFiles must be implemented by subclass');
  }

  /**
   * Get empty result for error cases
   * @protected
   * @abstract
   * @returns {Object} Empty result object
   */
  _getEmptyResult() {
    throw new Error('_getEmptyResult must be implemented by subclass');
  }

  /**
   * Get discovery summary for logging
   * @protected
   * @abstract
   * @returns {string} Discovery summary
   */
  _getDiscoverySummary() {
    throw new Error('_getDiscoverySummary must be implemented by subclass');
  }

  // === PROTECTED UTILITY METHODS ===

  /**
   * Scan files using patterns with PathResolver
   * @protected
   * @param {Object} patterns - File patterns
   * @returns {Promise<Object>} Scanned files
   */
  async _scanFiles(patterns) {
    const patternType = this._getPatternType();
    return await this.pathResolver.resolveFiles(patterns, patternType);
  }

  /**
   * Extract filename information
   * @protected
   * @param {string} filePath - File path to analyze
   * @returns {Object} File name information
   */
  _extractFileNameInfo(filePath) {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const baseName = fileName.split('.')[0];
    const extension = fileName.split('.').pop();

    return {
      fileName,
      baseName,
      extension,
      directory: parts.slice(0, -1).join('/'),
    };
  }

  /**
   * Process single file safely with error handling
   * @protected
   * @param {string} filePath - Path to process
   * @param {Function} processor - Processing function
   * @returns {*} Processing result or null if error
   */
  async _processSingleFile(filePath, processor) {
    try {
      const fileInfo = this.pathResolver.getFileInfo(filePath);
      if (!fileInfo) {
        this.logger.debug(`Could not get file info: ${filePath}`);
        return null;
      }

      return await processor(fileInfo);
    } catch (error) {
      this.logger.debug(`Error processing file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch process files with error handling
   * @protected
   * @param {string[]} filePaths - Files to process
   * @param {Function} processor - Processing function
   * @returns {Promise<Array>} Processing results (nulls filtered out)
   */
  async _batchProcessFiles(filePaths, processor) {
    const results = await Promise.all(
      filePaths.map((filePath) => this._processSingleFile(filePath, processor))
    );

    return results.filter((result) => result !== null);
  }

  // === PRIVATE METHODS ===

  /**
   * Check if cache is still valid
   * @private
   * @returns {boolean} True if cache is valid
   */
  _isCacheValid() {
    if (!this.cache) return false;

    const cacheAge = Date.now() - this.cache.timestamp;
    return cacheAge < this.options.cacheTimeout;
  }
}
