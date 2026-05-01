// packages/core/utils/src/client/emailVerification.ts

/**
 * @fileoverview Email verification utilities
 * @description Utilities for checking if email verification should be enabled
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getEnabledAuthPartners } from './partners';

/**
 * Check if email verification should be shown to users
 *
 * Email verification is only relevant when:
 * 1. Email authentication is enabled (user can sign up with email/password)
 * 2. Firebase email verification is enabled in the project settings
 *
 * @returns boolean - true if email verification should be shown
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function shouldShowEmailVerification(): boolean {
  // Check if email authentication is enabled
  const enabledPartners = getEnabledAuthPartners();
  const isEmailAuthEnabled =
    enabledPartners.includes('password') ||
    enabledPartners.includes('emailLink');

  if (!isEmailAuthEnabled) {
    return false;
  }

  // For now, we assume email verification is enabled if email auth is enabled
  // In a real app, you might want to check Firebase project settings
  // or have this as a configuration flag
  return true;
}

/**
 * Check if email verification is required for the current user
 *
 * @param user - The current user object
 * @returns boolean - true if email verification is required
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isEmailVerificationRequired(user: any): boolean {
  if (!user) return false;

  // Only require verification if:
  // 1. Email verification should be shown
  // 2. User has an email
  // 3. Email is not verified
  return shouldShowEmailVerification() && !!user.email && !user.emailVerified;
}
