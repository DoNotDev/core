// packages/core/types/src/email/types.ts

/**
 * @fileoverview Email Types
 * @description Type definitions for email feature. Provider abstraction, template registry, route config.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import type { EMAIL_PROVIDERS, EMAIL_ERROR_CODES } from './constants';
import type { SendEmailRequest, SendEmailResponse } from './schemas';

// =============================================================================
// Foundation Types
// =============================================================================

/** Email provider type */
export type EmailProvider =
  (typeof EMAIL_PROVIDERS)[keyof typeof EMAIL_PROVIDERS];

/** Email error code type */
export type EmailErrorCode =
  (typeof EMAIL_ERROR_CODES)[keyof typeof EMAIL_ERROR_CODES];

// =============================================================================
// Template Types
// =============================================================================

/**
 * Email template with i18n support.
 * Templates render subject + HTML body from typed data and locale.
 *
 * @template TData - Shape of the template data
 */
export interface EmailTemplate<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Render email subject for a given locale */
  subject: (data: TData, locale: string) => string;
  /** Render email HTML body for a given locale */
  html: (data: TData, locale: string) => string;
}

/**
 * Registry of named email templates.
 * Each key is a template ID used in send requests.
 */
export type EmailTemplateRegistry = Record<string, EmailTemplate<any>>;

// =============================================================================
// Provider Types
// =============================================================================

/** Configuration for email feature (consumer-facing) */
export interface EmailConfig {
  /** Email provider */
  provider: EmailProvider;
  /** Default "from" address */
  defaultFrom: string;
  /** Default reply-to address */
  replyTo?: string;
}

// =============================================================================
// Server Types
// =============================================================================

/** Email route configuration (server-side) */
export interface EmailRouteConfig {
  /** Email provider */
  provider: EmailProvider;
  /** Default "from" address (e.g., "Frabled <noreply@frabled.com>") */
  defaultFrom: string;
  /** Default reply-to address */
  replyTo?: string;
  /** Registered templates */
  templates: EmailTemplateRegistry;
}

// Re-export schema-derived types for convenience
export type { SendEmailRequest, SendEmailResponse } from './schemas';
