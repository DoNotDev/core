import { describe, it, expect } from 'vitest';

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  isPKCESupported,
  validateCodeVerifier,
  validateCodeChallenge,
} from '../pkce';

describe('generateCodeVerifier', () => {
  it('generates a string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBeGreaterThan(0);
  });

  it('generates valid verifier (43-128 chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('generates different values each time', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
});

describe('generateCodeChallenge', () => {
  it('generates a string from verifier', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('generates consistent challenge for same verifier', async () => {
    const verifier =
      'test-verifier-string-that-is-long-enough-for-pkce-validation';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);

    expect(c1).toBe(c2);
  });

  it('generates different challenges for different verifiers', async () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    const c1 = await generateCodeChallenge(v1);
    const c2 = await generateCodeChallenge(v2);

    expect(c1).not.toBe(c2);
  });
});

describe('generatePKCEPair', () => {
  it('returns both codeVerifier and codeChallenge', async () => {
    const pair = await generatePKCEPair();

    expect(pair.codeVerifier).toBeTruthy();
    expect(pair.codeChallenge).toBeTruthy();
    expect(pair.codeVerifier).not.toBe(pair.codeChallenge);
  });
});

describe('isPKCESupported', () => {
  it('returns boolean', () => {
    expect(typeof isPKCESupported()).toBe('boolean');
  });
});

describe('validateCodeVerifier', () => {
  it('accepts valid verifiers (43-128 chars, unreserved chars)', () => {
    const verifier = 'a'.repeat(43);
    expect(validateCodeVerifier(verifier)).toBe(true);
  });

  it('rejects too short verifiers', () => {
    expect(validateCodeVerifier('short')).toBe(false);
    expect(validateCodeVerifier('a'.repeat(42))).toBe(false);
  });

  it('rejects too long verifiers', () => {
    expect(validateCodeVerifier('a'.repeat(129))).toBe(false);
  });

  it('rejects invalid characters', () => {
    const verifier = 'a'.repeat(42) + '!';
    expect(validateCodeVerifier(verifier)).toBe(false);
  });

  it('accepts allowed special characters', () => {
    const verifier = 'abcABC012-._~'.repeat(4); // 52 chars
    expect(validateCodeVerifier(verifier)).toBe(true);
  });
});

describe('validateCodeChallenge', () => {
  it('accepts valid challenges (43-128 chars)', () => {
    expect(validateCodeChallenge('a'.repeat(43))).toBe(true);
    expect(validateCodeChallenge('a'.repeat(128))).toBe(true);
  });

  it('rejects too short challenges', () => {
    expect(validateCodeChallenge('a'.repeat(42))).toBe(false);
  });

  it('rejects too long challenges', () => {
    expect(validateCodeChallenge('a'.repeat(129))).toBe(false);
  });
});
