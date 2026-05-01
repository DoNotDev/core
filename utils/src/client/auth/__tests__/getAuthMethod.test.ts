/**
 * @fileoverview getAuthMethod unit tests
 * @description Verifies auth method resolution logic — explicit method takes priority,
 * falls back to env detection.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect } from 'vitest';

import { getAuthMethod } from '../getAuthMethod';

describe('getAuthMethod', () => {
  it('returns popup when explicitly passed', () => {
    expect(getAuthMethod('popup')).toBe('popup');
  });

  it('returns redirect when explicitly passed', () => {
    expect(getAuthMethod('redirect')).toBe('redirect');
  });

  it('returns a valid auth method when no argument given', () => {
    const result = getAuthMethod();
    expect(['popup', 'redirect']).toContain(result);
  });

  it('returns a valid auth method when null given', () => {
    const result = getAuthMethod(null);
    expect(['popup', 'redirect']).toContain(result);
  });
});
