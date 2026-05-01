/**
 * @fileoverview Debug Logging Utility
 * @description Enterprise-grade logging system with multiple log levels for debugging, verbose output, info, warnings, and errors. Uses @clack/prompts for CLI output (not stripped by bundler unlike console.log).
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// config/src/utils/debugLog.js

import * as clack from '@clack/prompts';

import { PathResolver } from './PathResolver.js';

// ============================================================================
// COLOR UTILITIES (ANSI codes for explicit color support)
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function supportsColor() {
  if (process.env.NO_COLOR) return false;
  if (process.platform === 'win32') return true;
  return process.stdout.isTTY === true;
}

function colorize(text, color) {
  if (!supportsColor()) return text;
  return `${color}${text}${colors.reset}`;
}

/**
 * Creates a debug logger for a specific namespace
 *
 * Enterprise-grade logging system with 5 levels:
 * - debug (opt-in): Detailed troubleshooting - individual files, timing, internal operations
 * - verbose (opt-out): Configuration/search paths - WHERE we're looking, NOT individual items
 * - info (always): High-level operations and discoveries - WHAT was found (counts, summaries)
 * - warn (always): Potential problems
 * - error (always): Failures
 *
 * @param {string} namespace - The namespace for this logger (e.g., 'dndev-assets', 'dndev-i18n')
 * @param {boolean} debug - Enable debug logging
 * @param {boolean} verbose - Enable verbose logging
 * @param {Object} [options] - Additional options
 * @param {string} [options.logDir] - Directory to write log files to
 * @param {boolean} [options.fileLogging] - Whether to write logs to file
 * @returns {Object} Logger with debug, verbose, info, warn, error, success methods
 */
export function createLogger(namespace, debug, verbose, options = {}) {
  const { logDir = '.dndev-logs', fileLogging = false } = options;
  const pathResolver = PathResolver.getInstance();

  let logFilePath = null;

  if (fileLogging) {
    // Ensure log directory exists
    const logDirPath = pathResolver.resolveAppPath(logDir);
    if (!pathResolver.pathExists(logDirPath)) {
      pathResolver.mkdir(logDirPath);
    }

    logFilePath = pathResolver.resolveAppPath(
      `${logDir}/${namespace.replace(/[^a-zA-Z0-9]/g, '-')}.log`
    );

    // Write header to log file
    const header = `=== ${namespace} Log Started at ${new Date().toISOString()} ===\n`;
    pathResolver.writeSync(logFilePath, header);
  }

  const writeToFile = (level, message, args) => {
    if (logFilePath) {
      const timestamp = new Date().toISOString();
      const argsStr =
        args.length > 0
          ? ' ' +
            args
              .map((arg) =>
                typeof arg === 'object'
                  ? JSON.stringify(arg, null, 2)
                  : String(arg)
              )
              .join(' ')
          : '';
      // Messages are smart enough to identify themselves - no namespace spam
      const logEntry = `${timestamp} [${level}] ${message}${argsStr}\n`;
      pathResolver.appendFile(logFilePath, logEntry);
    }
  };

  /**
   * Format message with args for clack output
   */
  const formatMsg = (msg, args) => {
    if (args.length === 0) return msg;
    const argsStr = args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(' ');
    return `${msg} ${argsStr}`;
  };

  return {
    /**
     * Debug-only logging - only shows when debug is true
     */
    debug: (msg, ...args) => {
      if (debug) {
        if (fileLogging) {
          writeToFile('DEBUG', msg, args);
        } else {
          clack.log.message(colorize(formatMsg(msg, args), colors.gray));
        }
      }
    },

    /**
     * Verbose logging - only shows when verbose is true (opt-out)
     * Used for configuration paths, search directories, PathResolver values
     */
    verbose: (msg, ...args) => {
      if (verbose) {
        if (fileLogging) {
          writeToFile('VERBOSE', msg, args);
        } else {
          clack.log.message(formatMsg(msg, args));
        }
      }
    },

    /**
     * Info logging - always shows (high-level operations, discoveries)
     */
    info: (msg, ...args) => {
      if (fileLogging) {
        writeToFile('INFO', msg, args);
      } else {
        clack.log.info(colorize(formatMsg(msg, args), colors.brightCyan));
      }
    },

    /**
     * Warning logging - always shows
     */
    warn: (msg, ...args) => {
      if (debug && fileLogging) {
        writeToFile('WARN', msg, args);
      } else {
        clack.log.warn(colorize(formatMsg(msg, args), colors.brightYellow));
      }
    },

    /**
     * Error logging - always shows
     */
    error: (msg, ...args) => {
      if (debug && fileLogging) {
        writeToFile('ERROR', msg, args);
      } else {
        clack.log.error(colorize(formatMsg(msg, args), colors.brightRed));
      }
    },

    /**
     * Success logging - always shows
     */
    success: (msg, ...args) => {
      if (debug && fileLogging) {
        writeToFile('SUCCESS', msg, args);
      } else {
        clack.log.success(colorize(formatMsg(msg, args), colors.brightGreen));
      }
    },

    /**
     * Conditional logging - only shows when condition is true
     */
    when:
      (condition, level = 'debug') =>
      (msg, ...args) => {
        if (condition) {
          const formatted = formatMsg(msg, args);
          switch (level) {
            case 'verbose':
              if (verbose) {
                clack.log.message(formatted);
                writeToFile('VERBOSE', msg, args);
              }
              break;
            case 'info':
              clack.log.info(colorize(formatted, colors.brightCyan));
              writeToFile('INFO', msg, args);
              break;
            case 'warn':
              clack.log.warn(colorize(formatted, colors.brightYellow));
              writeToFile('WARN', msg, args);
              break;
            case 'error':
              clack.log.error(colorize(formatted, colors.brightRed));
              writeToFile('ERROR', msg, args);
              break;
            case 'success':
              clack.log.success(colorize(formatted, colors.brightGreen));
              writeToFile('SUCCESS', msg, args);
              break;
            default:
              if (debug) {
                clack.log.message(colorize(formatted, colors.gray));
                writeToFile('DEBUG', msg, args);
              }
          }
        }
      },

    /**
     * Get the log file path
     */
    getLogFilePath: () => logFilePath,
  };
}

/**
 * Creates a step-by-step progress logger
 *
 * @param {string} namespace - The namespace for this logger
 * @param {boolean} debug - Enable debug logging
 * @param {boolean} verbose - Enable verbose logging
 * @param {Object} [options] - Additional options (passed to createLogger)
 * @returns {Object} Logger with step tracking
 */
export function createStepLogger(namespace, debug, verbose, options = {}) {
  const logger = createLogger(namespace, debug, verbose, options);
  let stepCount = 0;

  return {
    ...logger,

    /**
     * Log a step in a process
     */
    step: (msg, ...args) => {
      stepCount++;
      if (debug) {
        const argsStr = args.length > 0 ? ' ' + args.join(' ') : '';
        clack.log.step(
          colorize(`${namespace} [${stepCount}] ${msg}${argsStr}`, colors.gray)
        );
      }
    },

    /**
     * Reset step counter
     */
    resetSteps: () => {
      stepCount = 0;
    },
  };
}

/**
 * Creates a grouped logger for related operations
 * Note: clack doesn't support console.group, using indented messages instead
 *
 * @param {string} namespace - The namespace for this logger
 * @param {boolean} debug - Enable debug logging
 * @param {boolean} verbose - Enable verbose logging
 * @param {Object} [options] - Additional options (passed to createLogger)
 * @returns {Object} Logger with grouping capabilities
 */
export function createGroupLogger(namespace, debug, verbose, options = {}) {
  const logger = createLogger(namespace, debug, verbose, options);
  let groupDepth = 0;

  return {
    ...logger,

    /**
     * Start a group (logs header message)
     */
    group: (title, ...args) => {
      if (debug) {
        const indent = '  '.repeat(groupDepth);
        const argsStr = args.length > 0 ? ' ' + args.join(' ') : '';
        clack.log.message(`${indent}▼ ${namespace} ${title}${argsStr}`);
        groupDepth++;
      }
    },

    /**
     * Start a collapsed group (same as group in clack context)
     */
    groupCollapsed: (title, ...args) => {
      if (debug) {
        const indent = '  '.repeat(groupDepth);
        const argsStr = args.length > 0 ? ' ' + args.join(' ') : '';
        clack.log.message(`${indent}▶ ${namespace} ${title}${argsStr}`);
        groupDepth++;
      }
    },

    /**
     * End a group
     */
    groupEnd: () => {
      if (debug && groupDepth > 0) {
        groupDepth--;
      }
    },
  };
}
