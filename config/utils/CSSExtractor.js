/**
 * @fileoverview CSSExtractor - CSS Feature Extraction Utility
 * @description Extracts themes, variables, classes, and keyframes from CSS content. Used by ThemeDiscovery for comprehensive CSS analysis.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { CSS_PATTERNS } from '../constants.js';

/** Regex: --font-family or --font-headline declaration; captures the full value */
const FONT_VAR_DECL_REGEX = /--(?:font-family|font-headline)\s*:\s*([^;]+);/g;
/** Regex: extract quoted font names from a CSS value */
const QUOTED_FONT_NAME_REGEX = /['"]([^'"]+)['"]/g;

export class CSSExtractor {
  /**
   * @param {Object} pathResolver - PathResolver instance for cross-platform path operations
   * @param {Object} options - Configuration options
   * @param {boolean} options.debug - Enable debug logging
   * @param {Object} options.customPatterns - Custom extraction patterns
   * @param {Object} options.logger - Logger instance for cross-platform logging
   */
  constructor(pathResolver, options = {}) {
    if (!pathResolver) {
      throw new Error('CSSExtractor requires PathResolver instance');
    }

    this.pathResolver = pathResolver;
    this.options = {
      debug: false,
      customPatterns: {},
      ...options,
    };

    // Use provided logger or create simple one
    this.logger = options.logger || {
      debug: (msg, ...args) => {
        if (this.options.debug) {
          console.log(`[CSSExtractor] ${msg}`, ...args);
        }
      },
    };

    // Merge custom patterns with defaults
    this.patterns = {
      selectors: {
        ...CSS_PATTERNS.selectors,
        ...this.options.customPatterns?.selectors,
      },
      themes: {
        ...CSS_PATTERNS.themes,
        ...this.options.customPatterns?.themes,
      },
    };
  }

  /**
   * Convert CSS variable to camelCase JavaScript identifier
   * @param {string} cssVar - CSS variable name (--variable-name)
   * @returns {string|null} Valid JavaScript identifier or null
   */
  cssVarToJsIdentifier(cssVar) {
    if (!cssVar || typeof cssVar !== 'string') {
      this._debug(`Invalid CSS variable: ${cssVar}`);
      return null;
    }

    const cleanVar = cssVar.replace(/^--/, '');
    if (!cleanVar) {
      this._debug(`Empty CSS variable after removing --: ${cssVar}`);
      return null;
    }

    const parts = cleanVar.split('-').filter((part) => part.length > 0);
    if (parts.length === 0) {
      this._debug(`No valid parts in CSS variable: ${cssVar}`);
      return null;
    }

    const identifier = parts
      .map((word, index) => {
        const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
        if (!cleanWord) return null;

        return index === 0
          ? cleanWord.toLowerCase()
          : cleanWord.charAt(0).toUpperCase() +
              cleanWord.slice(1).toLowerCase();
      })
      .filter(Boolean)
      .join('');

    if (!identifier || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(identifier)) {
      this._debug(
        `Invalid JavaScript identifier generated from ${cssVar}: ${identifier}`
      );
      return null;
    }

    const reservedWords = [
      'const',
      'let',
      'var',
      'function',
      'class',
      'export',
      'import',
      'default',
      'if',
      'else',
      'for',
      'while',
    ];

    if (reservedWords.includes(identifier)) {
      return `${identifier}Var`;
    }

    return identifier;
  }

  /**
   * Strip CSS comments from content
   * @param {string} cssContent - CSS content with comments
   * @returns {string} CSS content without comments
   */
  _stripComments(cssContent) {
    // Remove block comments /* ... */ (including multi-line)
    return cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /**
   * Extract themes from CSS content
   * @param {string} cssContent - CSS content to analyze
   * @param {string} filePath - Source file path for context
   * @param {Object} discovered - Discovery state object to update
   * @returns {Object[]} Extracted theme definitions
   */
  extractThemes(cssContent, filePath, discovered) {
    const themes = [];
    let match;
    const normalizedFilePath = this.pathResolver.normalizePath(filePath);

    // Strip comments to avoid matching commented-out theme examples
    const cleanContent = this._stripComments(cssContent);

    // Find blocks that contain --theme-label (inverted logic - find themes first)
    const themeBlockRegex =
      /(?::root\.|\.)([a-z][a-z0-9-]*)\s*\{([^}]*--theme-label\s*:\s*['"]([^'"]+)['"][^}]*)\}/gim;

    while ((match = themeBlockRegex.exec(cleanContent)) !== null) {
      const [, className, ruleContent, label] = match;

      if (!className || !label) continue;

      // Extract icon and isDark from the matched block
      const iconMatch = ruleContent.match(this.patterns.themes.themeIcon);
      const isDarkMatch = ruleContent.match(this.patterns.themes.themeIsDark);

      const themeObj = {
        name: className,
        displayName: label,
        isDark: isDarkMatch ? isDarkMatch[1] === '1' : false,
        meta: {
          icon: iconMatch?.[1],
        },
        source: this.pathResolver.getBasename(filePath),
      };

      this._debug(`Discovered theme: ${className} (${label})`);
      themes.push(themeObj);

      discovered.themes.set(className, {
        name: className,
        displayName: label,
        isDark: themeObj.isDark,
        file: normalizedFilePath,
        variables: new Set(),
        meta: themeObj.meta,
      });
    }

    if (themes.length > 0) {
      this._debug(
        `Extracted ${themes.length} themes from ${normalizedFilePath}`
      );
    }
    return themes;
  }

  /**
   * Extract CSS classes from content
   * @param {string} cssContent - CSS content to analyze
   * @param {Object} discovered - Discovery state object to update
   */
  extractClasses(cssContent, discovered) {
    const classMatches = cssContent.match(this.patterns.selectors.class) || [];

    classMatches.forEach((match) => {
      const className = match.slice(1);
      if (!className.startsWith('_')) {
        discovered.classes.add(className);
      }
    });
  }

  /**
   * Extract CSS variables from content
   * @param {string} cssContent - CSS content to analyze
   * @param {Object} discovered - Discovery state object to update
   * @param {string} source - Source type (framework/consumer)
   */
  extractVariables(cssContent, discovered, source) {
    const varMatches = cssContent.match(this.patterns.selectors.variable) || [];

    varMatches.forEach((match) => {
      if (match.startsWith('--') && match.length > 2) {
        if (source === 'framework') {
          discovered.variables.framework.add(match);
        } else {
          discovered.variables.consumer.add(match);
        }
      } else {
        this._debug(`Skipping invalid CSS variable: ${match}`);
      }
    });
  }

  /**
   * Extract font family names from --font-family and --font-headline declarations.
   * Only collects literal quoted names (e.g. 'Space Grotesk', "Inter"); ignores var(--font-sans) etc.
   * @param {string} cssContent - CSS content to analyze
   * @returns {string[]} Unique list of font family names
   */
  extractFontFamilies(cssContent) {
    if (!cssContent || typeof cssContent !== 'string') return [];
    const cleanContent = this._stripComments(cssContent);
    const names = new Set();
    let declMatch;
    FONT_VAR_DECL_REGEX.lastIndex = 0;
    while ((declMatch = FONT_VAR_DECL_REGEX.exec(cleanContent)) !== null) {
      const value = declMatch[1];
      let nameMatch;
      QUOTED_FONT_NAME_REGEX.lastIndex = 0;
      while ((nameMatch = QUOTED_FONT_NAME_REGEX.exec(value)) !== null) {
        const name = nameMatch[1].trim();
        if (name) names.add(name);
      }
    }
    return Array.from(names);
  }

  /**
   * Extract keyframe animations from content
   * @param {string} cssContent - CSS content to analyze
   * @param {Object} discovered - Discovery state object to update
   */
  extractKeyframes(cssContent, discovered) {
    const keyframeMatches =
      cssContent.match(this.patterns.selectors.keyframe) || [];

    keyframeMatches.forEach((match) => {
      const name = match.replace('@keyframes', '').trim();
      if (name) {
        discovered.keyframes.add(name);
      }
    });
  }

  /**
   * Validate CSS content for common issues
   * @param {string} cssContent - CSS content to validate
   * @returns {string[]} Array of validation warnings
   */
  validateCSS(cssContent) {
    const warnings = [];

    // Check for malformed CSS variables
    const possibleVars = cssContent.match(
      /--[a-zA-Z0-9-_]*[^a-zA-Z0-9-_:;\s]/g
    );
    if (possibleVars) {
      possibleVars.forEach((varMatch) => {
        warnings.push(`Possible malformed CSS variable: ${varMatch}`);
      });
    }

    // Check for themes without labels
    const themeClassMatches =
      cssContent.match(/\.[a-z][a-z0-9-]+\s*\{[^}]*\}/gi) || [];
    themeClassMatches.forEach((match) => {
      if (!match.includes('--theme-label') && match.includes('--')) {
        const className = match.match(/\.([a-z][a-z0-9-]+)/)?.[1];
        if (className) {
          warnings.push(`Theme class "${className}" missing --theme-label`);
        }
      }
    });

    return warnings;
  }

  /**
   * Extract all CSS features in one comprehensive pass
   * @param {string} cssContent - CSS content to analyze
   * @param {string} filePath - Source file path
   * @param {string} source - Source type (framework/consumer)
   * @returns {Object} Complete extraction results
   */
  extractAll(cssContent, filePath, source = 'consumer') {
    const discovered = {
      themes: new Map(),
      classes: new Set(),
      variables: {
        framework: new Set(),
        consumer: new Set(),
      },
      keyframes: new Set(),
    };

    const themes = this.extractThemes(cssContent, filePath, discovered);
    this.extractClasses(cssContent, discovered);
    this.extractVariables(cssContent, discovered, source);
    this.extractKeyframes(cssContent, discovered);

    const warnings = this.validateCSS(cssContent);

    return {
      themes,
      classes: Array.from(discovered.classes),
      variables: {
        framework: Array.from(discovered.variables.framework),
        consumer: Array.from(discovered.variables.consumer),
        all: [
          ...Array.from(discovered.variables.framework),
          ...Array.from(discovered.variables.consumer),
        ].sort(),
      },
      keyframes: Array.from(discovered.keyframes),
      warnings,
    };
  }

  /**
   * Get current extraction patterns
   * @returns {Object} Current pattern configuration
   */
  getPatterns() {
    return { ...this.patterns };
  }

  /**
   * Update extraction patterns
   * @param {Object} newPatterns - New pattern configuration
   */
  setPatterns(newPatterns) {
    this.patterns = {
      ...this.patterns,
      ...newPatterns,
      selectors: {
        ...this.patterns.selectors,
        ...newPatterns.selectors,
      },
      themes: {
        ...this.patterns.themes,
        ...newPatterns.themes,
      },
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Log debug message if debugging enabled
   * @private
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  _debug(message, data) {
    this.logger.debug(message, data || '');
  }
}
