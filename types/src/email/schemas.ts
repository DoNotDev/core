// packages/core/types/src/email/schemas.ts

/**
 * @fileoverview Email Schemas
 * @description Valibot schemas for email request/response validation.
 *
 * @version 0.1.0
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

import * as v from 'valibot';

// =============================================================================
// Request / Response Schemas
// =============================================================================

/** Schema for send email request (caller → handler) */
export const SendEmailRequestSchema = v.object({
  /** Template ID from the registry */
  templateId: v.pipe(v.string(), v.minLength(1)),
  /** Recipient email address */
  to: v.pipe(v.string(), v.email()),
  /** Template data (shape depends on template) */
  data: v.record(v.string(), v.unknown()),
  /** Locale for i18n rendering (default: 'fr') */
  locale: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(5)), 'fr'),
  /** Override "from" address */
  from: v.optional(v.string()),
  /** Override reply-to address */
  replyTo: v.optional(v.string()),
});

/** Schema for send email response */
export const SendEmailResponseSchema = v.object({
  /** Whether the email was sent successfully */
  success: v.boolean(),
  /** Provider message ID (for tracking) */
  messageId: v.optional(v.string()),
  /** Error message if sending failed */
  error: v.optional(v.string()),
});

// =============================================================================
// Type Exports (Schema-Derived)
// =============================================================================

/** Request payload for sending an email. */
export type SendEmailRequest = v.InferOutput<typeof SendEmailRequestSchema>;
/** Response payload after sending an email. */
export type SendEmailResponse = v.InferOutput<typeof SendEmailResponseSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

export function validateSendEmailRequest(data: unknown) {
  return v.safeParse(SendEmailRequestSchema, data);
}

export function validateSendEmailResponse(data: unknown) {
  return v.safeParse(SendEmailResponseSchema, data);
}
