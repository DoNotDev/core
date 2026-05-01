// packages/core/utils/src/server/validation.ts

/**
 * @fileoverview Server-side validation utilities
 * @description Validation utilities for server environments
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Validate URL format
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param url - URL string to validate
 * @param name - Name for error message
 * @throws Error if URL is invalid
 */
export function validateUrl(url: string, name: string = 'URL'): string {
  try {
    const parsedUrl = new URL(url);

    // Ensure it's HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
    }

    return url;
  } catch (error) {
    throw new Error(
      `Invalid ${name}: ${url}. ${error instanceof Error ? error.message : 'Invalid URL format'}`
    );
  }
}

/**
 * Validate and sanitize metadata object
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param metadata - Metadata object to validate
 * @returns Sanitized metadata object
 */
export function validateMetadata(
  metadata: Record<string, any>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Only allow string values
    if (typeof value !== 'string') {
      throw new Error(
        `Metadata value for key '${key}' must be a string, got ${typeof value}`
      );
    }

    // Metadata is plain text — reject HTML entirely instead of trying to sanitize it
    if (/<[^>]*>/.test(value)) {
      throw new Error(`Metadata value for key '${key}' must not contain HTML`);
    }

    const sanitizedValue = value;

    // Limit length to prevent abuse
    if (sanitizedValue.length > 1000) {
      throw new Error(
        `Metadata value for key '${key}' is too long (max 1000 characters)`
      );
    }

    // Limit key length
    if (key.length > 100) {
      throw new Error(`Metadata key '${key}' is too long (max 100 characters)`);
    }

    sanitized[key] = sanitizedValue;
  }

  return sanitized;
}

/**
 * Validate environment variable
 * @param name - Environment variable name
 * @param required - Whether the variable is required
 * @returns Environment variable value
 */
export function validateEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];

  if (required && !value) {
    throw new Error(`Required environment variable '${name}' is not set`);
  }

  return value || '';
}
