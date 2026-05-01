// packages/core/utils/src/common/pkce.ts

/**
 * @fileoverview PKCE (Proof Key for Code Exchange) utilities
 * @description Implements PKCE for OAuth 2.0 flows to enhance security
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Generate a cryptographically random code verifier
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Base64URL-encoded code verifier
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate a code challenge from a code verifier
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param verifier The code verifier
 * @returns Promise resolving to Base64URL-encoded code challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/**
 * Generate a PKCE pair (code verifier and challenge)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @returns Promise resolving to PKCE pair
 */
export async function generatePKCEPair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
}

/**
 * Base64URL encode a Uint8Array
 * @param array The array to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Check if PKCE is supported by the current environment
 * @returns True if PKCE is supported
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isPKCESupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues !== 'undefined'
  );
}

/**
 * Validate a code verifier format
 * @param verifier The code verifier to validate
 * @returns True if the verifier is valid
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCodeVerifier(verifier: string): boolean {
  // Code verifier must be 43-128 characters long
  if (verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // Must contain only unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validChars = /^[A-Za-z0-9\-._~]+$/;
  return validChars.test(verifier);
}

/**
 * Validate a code challenge format
 * @param challenge The code challenge to validate
 * @returns True if the challenge is valid
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function validateCodeChallenge(challenge: string): boolean {
  // Code challenge must be 43-128 characters long
  if (challenge.length < 43 || challenge.length > 128) {
    return false;
  }

  // Must contain only unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validChars = /^[A-Za-z0-9\-._~]+$/;
  return validChars.test(challenge);
}
