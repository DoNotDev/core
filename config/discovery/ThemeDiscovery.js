/**
 * @fileoverview Pure Theme Discovery Engine
 * @description Platform-agnostic theme and CSS variable discovery. Returns plain data without knowledge of Vite, Next.js, or any platform.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BaseDiscovery } from './BaseDiscovery.js';
import { ESSENTIAL_THEMES } from '../constants.js';
import { CSSExtractor } from '../utils/CSSExtractor.js';

export class ThemeDiscovery extends BaseDiscovery {
  constructor(cssExtractor, pathResolver, options = {}) {
    super(pathResolver, options);

    // Pass the logger to CSSExtractor for cross-platform logging
    this.cssExtractor =
      cssExtractor ||
      new CSSExtractor(pathResolver, {
        debug: options.debug,
        logger: this.logger,
      });

    this.discovered = {
      themes: new Map(),
      variables: {
        framework: new Set(),
        consumer: new Set(),
      },
      classes: new Set(),
      keyframes: new Set(),
    };

    // Add essential themes
    this._addEssentialThemes();
  }

  // === ABSTRACT METHOD IMPLEMENTATIONS ===

  _getDiscoveryType() {
    return 'Theme';
  }

  async _getPatterns() {
    return await this.pathResolver.resolvePatterns('css');
  }

  _getPatternType() {
    return 'css';
  }

  async _processFiles(files) {
    // Reset discovered state but keep essential themes
    this.discovered = {
      themes: new Map(),
      variables: { framework: new Set(), consumer: new Set() },
      classes: new Set(),
      keyframes: new Set(),
    };
    this._addEssentialThemes();

    const { frameworkFiles, consumerFiles } = files;

    // All file-level details moved to DEBUG - aggregate summary shown by plugin's logStats
    this.logger.debug(
      `Scanning ${frameworkFiles.length} framework + ${consumerFiles.length} consumer CSS files`
    );
    this.logger.debug('🔍 FILES DISCOVERED:');
    this.logger.debug('Framework files:', frameworkFiles);
    this.logger.debug('Consumer files:', consumerFiles);

    // Log file counts at DEBUG level (details), aggregate shown at INFO by plugin
    if (frameworkFiles.length > 0) {
      this.logger.debug(`Framework files found: ${frameworkFiles.length}`);
      this.logger.debug('Framework files:', frameworkFiles);
    } else {
      this.logger.debug('No framework files found');
    }

    if (consumerFiles.length > 0) {
      this.logger.debug(`Consumer files found: ${consumerFiles.length}`);
      this.logger.debug('Consumer files:', consumerFiles);
    } else {
      this.logger.debug('No consumer files found');
    }

    // Process framework files (full extraction)
    await this._processFrameworkFiles(frameworkFiles);

    // Process consumer files (themes + variables only)
    await this._processConsumerFiles(consumerFiles);

    const themes = this._serializeThemes();

    // Aggregate summary shown by plugin's logStats, not here
    this.logger.debug(
      `Discovered ${themes.length} themes:`,
      themes.map((t) => t.name)
    );

    return {
      themes,
      variables: {
        framework: Array.from(this.discovered.variables.framework).sort(),
        consumer: Array.from(this.discovered.variables.consumer).sort(),
        all: [
          ...Array.from(this.discovered.variables.framework),
          ...Array.from(this.discovered.variables.consumer),
        ].sort(),
      },
      classes: Array.from(this.discovered.classes).sort(),
      keyframes: Array.from(this.discovered.keyframes).sort(),
    };
  }

  _getEmptyResult() {
    // Always return essential themes as fallback - framework should never be without themes
    const essentialThemes = this._serializeThemes();
    return {
      themes:
        essentialThemes.length > 0
          ? essentialThemes
          : this._getEssentialThemesFallback(),
      variables: { framework: [], consumer: [], all: [] },
      classes: [],
      keyframes: [],
      timestamp: Date.now(),
    };
  }

  _getEssentialThemesFallback() {
    // Fallback if essential themes weren't added (shouldn't happen, but safety net)
    return ESSENTIAL_THEMES.map((theme) => ({
      name: theme.name,
      displayName: theme.displayName,
      meta: { icon: theme.icon, category: theme.isDark ? 'dark' : 'light' },
      essential: true,
      isDark: theme.isDark,
      source: 'built-in',
      variableCount: 0,
    }));
  }

  _getDiscoverySummary() {
    // Don't return a summary here - ThemePlugin logs a nicer version with emoji
    return '';
  }

  // === PUBLIC API METHODS ===

  /**
   * Discover themes and CSS data, return pure data
   * @param {boolean} force - Force re-discovery
   * @returns {Object} Pure theme data
   */
  async discoverThemes(force = false) {
    return await this.discover(force);
  }

  /**
   * Get discovered themes (cached)
   */
  getThemes() {
    return this.cache?.themes || [];
  }

  /**
   * Get discovered variables (cached)
   */
  getVariables() {
    return this.cache?.variables || { framework: [], consumer: [], all: [] };
  }

  /**
   * Get classes for safelist generation
   */
  getClasses() {
    return this.cache?.classes || [];
  }

  // === PRIVATE METHODS ===

  async _processFrameworkFiles(frameworkFiles) {
    for (const file of frameworkFiles) {
      try {
        // Read as text (CSS/TS theme files, not JSON)
        const content = await this.pathResolver.read(file, { format: 'text' });
        const normalizedFile = this.pathResolver.normalizePath(file);

        this.cssExtractor.extractThemes(
          content,
          normalizedFile,
          this.discovered
        );
        this.cssExtractor.extractClasses(content, this.discovered);
        this.cssExtractor.extractVariables(
          content,
          this.discovered,
          'framework'
        );
        this.cssExtractor.extractKeyframes(content, this.discovered);

        this.logger.debug(
          `✅ Processed framework: ${this.pathResolver.getRelativePath(normalizedFile)}`
        );
      } catch (err) {
        this.logger.debug(
          `Error scanning framework file ${file}: ${err.message}`
        );
      }
    }
  }

  async _processConsumerFiles(consumerFiles) {
    for (const file of consumerFiles) {
      try {
        // Read as text (CSS/TS theme files, not JSON)
        const content = await this.pathResolver.read(file, { format: 'text' });
        const normalizedFile = this.pathResolver.normalizePath(file);

        this.cssExtractor.extractThemes(
          content,
          normalizedFile,
          this.discovered
        );
        this.cssExtractor.extractVariables(
          content,
          this.discovered,
          'consumer'
        );

        this.logger.debug(
          `✅ Processed consumer: ${this.pathResolver.getRelativePath(normalizedFile)}`
        );
      } catch (err) {
        this.logger.debug(
          `Error scanning consumer file ${file}: ${err.message}`
        );
      }
    }
  }

  _addEssentialThemes() {
    // Add essential themes to discovered themes
    ESSENTIAL_THEMES.forEach((theme) => {
      this.discovered.themes.set(theme.name, {
        name: theme.name,
        displayName: theme.displayName,
        meta: { icon: theme.icon, category: theme.isDark ? 'dark' : 'light' },
        essential: true,
        isDark: theme.isDark,
        source: 'built-in',
        variables: new Set(),
      });
    });
  }

  _serializeThemes() {
    return Array.from(this.discovered.themes.values()).map((theme) => ({
      name: theme.name,
      displayName: theme.displayName,
      meta: theme.meta,
      source: theme.source,
      essential: theme.essential || false,
      isDark: theme.isDark || false,
      variableCount: theme.variables?.size || 0,
    }));
  }
}
