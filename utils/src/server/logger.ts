// packages/core/utils/src/server/logger.ts

/**
 * @fileoverview Server-side logging utility (client-safe)
 * @description Basic structured logging for server environments without Sentry
 *
 * Note: This is a client-safe version that doesn't import Sentry Node.
 * For full Sentry integration, use the logger from functions/shared/logger.ts
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Usage:
 * ```typescript
 * import { logger } from '@donotdev/utils/server';
 *
 * logger.info('Server started', { port: 3000 });
 * logger.error('Database connection failed', { error: err });
 * ```
 */

// ServerShim: Prevent client-side imports
if (typeof globalThis !== 'undefined') {
  const globalObj = globalThis as any;
  if (globalObj.window !== undefined) {
    throw new Error('Server logger cannot be imported on client side');
  }
}

// ServerShim: Ensure we're in a Node.js environment
if (typeof process === 'undefined' || !process.versions?.node) {
  throw new Error('Server logger requires Node.js environment');
}

/**
 * Log levels for structured logging
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log entry interface for structured logging
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Server-side logger (client-safe, no Sentry)
 *
 * Features:
 * - Structured logging with context
 * - Basic console output
 * - Performance monitoring
 * - Request correlation
 *
 * Note: For Sentry integration, use the logger from functions/shared/logger.ts
 *
 * @example
 * ```typescript
 * import { logger } from '@donotdev/utils/server';
 *
 * // Basic logging
 * logger.info('Server started', { port: 3000 });
 *
 * // Error logging
 * logger.error('Database error', { error: err, query: 'SELECT * FROM users' });
 *
 * // Performance logging
 * logger.info('Request completed', {
 *   duration: 150,
 *   status: 200,
 *   path: '/api/users'
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const logger = {
  /**
   * Log debug information
   * @param message - Log message
   * @param context - Additional context data
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  },

  /**
   * Log informational messages
   * @param message - Log message
   * @param context - Additional context data
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  },

  /**
   * Log warning messages
   * @param message - Log message
   * @param context - Additional context data
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  },

  /**
   * Log error messages
   * @param message - Log message
   * @param context - Additional context data
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  },

  /**
   * Log fatal errors
   * @param message - Log message
   * @param context - Additional context data
   */
  fatal(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context);
  },

  /**
   * Core logging method
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context data
   */
  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // W-NEW-11 fix: suppress entries below the current level in production
    if (level < this.getLevel()) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      level,
      message,
      timestamp,
      context,
      error: context?.error,
      metadata: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        ...context?.metadata,
      },
    };

    // Format log entry for console output
    const levelName = LogLevel[level];
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    // Use appropriate console method based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`[${timestamp}] [DEBUG] ${message}${contextStr}`);
        break;
      case LogLevel.INFO:
        console.info(`[${timestamp}] [INFO] ${message}${contextStr}`);
        break;
      case LogLevel.WARN:
        console.warn(`[${timestamp}] [WARN] ${message}${contextStr}`);
        break;
      case LogLevel.ERROR:
        console.error(`[${timestamp}] [ERROR] ${message}${contextStr}`);
        break;
      case LogLevel.FATAL:
        console.error(`[${timestamp}] [FATAL] ${message}${contextStr}`);
        break;
    }
  },

  /**
   * Check if Sentry is enabled (always false for client-safe version)
   * @returns False - this version doesn't support Sentry
   */
  isSentryEnabled(): boolean {
    return false;
  },

  /**
   * Get current log level — DEBUG in development/test, INFO in production.
   * @returns Current log level
   */
  getLevel(): LogLevel {
    return process.env.NODE_ENV === 'production'
      ? LogLevel.INFO
      : LogLevel.DEBUG;
  },
};

/**
 * Create a child logger with additional context
 * @param context - Additional context to include in all logs
 * @returns Child logger instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createChildLogger(context: Record<string, any>) {
  return {
    debug: (message: string, additionalContext?: Record<string, any>) => {
      logger.debug(message, { ...context, ...additionalContext });
    },
    info: (message: string, additionalContext?: Record<string, any>) => {
      logger.info(message, { ...context, ...additionalContext });
    },
    warn: (message: string, additionalContext?: Record<string, any>) => {
      logger.warn(message, { ...context, ...additionalContext });
    },
    error: (message: string, additionalContext?: Record<string, any>) => {
      logger.error(message, { ...context, ...additionalContext });
    },
    fatal: (message: string, additionalContext?: Record<string, any>) => {
      logger.fatal(message, { ...context, ...additionalContext });
    },
  };
}
