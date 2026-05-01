/**
 * @fileoverview Build-Time Error Utility
 * @description Creates standardized DoNotDevError instances for build-time configuration errors.
 * Used by discovery engines and plugins to fail fast with clear, actionable error messages.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Creates a build-time configuration error
 *
 * @param {string} pluginName - Plugin/component name (e.g., 'dndev-theme', 'dndev-routes')
 * @param {string} message - Error message explaining what's wrong
 * @param {string} [code='configuration-error'] - Error code
 * @param {object} [context] - Additional context (file paths, config values, etc.)
 * @returns {Error} Error instance ready to throw
 *
 * @example
 * throw createBuildError(
 *   'dndev-theme',
 *   'No themes found. Framework requires at least light/dark themes.',
 *   'missing-required-resource',
 *   { searchedPaths: ['src/** / * .css'] }
 * );
 */
export function createBuildError(
  pluginName,
  message,
  code = 'configuration-error',
  context = {}
) {
  const fullMessage = `[${pluginName}] ${message}`;

  // Use plain Error with consistent format for build-time errors
  // DoNotDevError is for runtime - build errors should be simple and clear
  const error = new Error(fullMessage);
  error.code = code;
  error.pluginName = pluginName;
  error.context = context;
  return error;
}

/**
 * Creates an error for missing required resources
 *
 * @param {string} pluginName - Plugin name
 * @param {string} resourceName - Name of missing resource (e.g., 'themes', 'HomePage.tsx')
 * @param {string} fixInstructions - Instructions on how to fix
 * @param {object} [context] - Additional context
 * @returns {Error}
 */
export function createMissingResourceError(
  pluginName,
  resourceName,
  fixInstructions,
  context = {}
) {
  return createBuildError(
    pluginName,
    `Required resource missing: ${resourceName}. ${fixInstructions}`,
    'missing-required-resource',
    Object.assign({ resourceName }, context)
  );
}

/**
 * Creates an error for invalid configuration
 *
 * @param {string} pluginName - Plugin name
 * @param {string} invalidValue - The invalid value/config
 * @param {string} expectedValue - What was expected
 * @param {object} [context] - Additional context
 * @returns {Error}
 */
export function createInvalidConfigError(
  pluginName,
  invalidValue,
  expectedValue,
  context = {}
) {
  return createBuildError(
    pluginName,
    `Invalid configuration: ${invalidValue}. Expected: ${expectedValue}`,
    'invalid-configuration',
    Object.assign({ invalidValue, expectedValue }, context)
  );
}
