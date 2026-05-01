import { describe, it, expect } from 'vitest';

import { maybeTranslate } from '../maybeTranslate';

describe('maybeTranslate', () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'purchase:products.earlyBird.name': 'Early Bird Lifetime',
      'products.earlyBird.name': 'Early Bird',
    };
    return translations[key] ?? key;
  };

  it('returns empty string for falsy values', () => {
    expect(maybeTranslate(mockT, '')).toBe('');
    expect(maybeTranslate(mockT, undefined)).toBe('');
  });

  it('returns plain strings as-is (no dots or colons)', () => {
    expect(maybeTranslate(mockT, 'Hello World')).toBe('Hello World');
    expect(maybeTranslate(mockT, 'Simple')).toBe('Simple');
  });

  it('translates keys with namespace prefix', () => {
    expect(maybeTranslate(mockT, 'purchase:products.earlyBird.name')).toBe(
      'Early Bird Lifetime'
    );
  });

  it('translates keys with dots (no namespace)', () => {
    expect(maybeTranslate(mockT, 'products.earlyBird.name')).toBe('Early Bird');
  });

  it('returns key as-is when translation missing (i18next fallback)', () => {
    expect(maybeTranslate(mockT, 'missing.key.here')).toBe('missing.key.here');
  });

  it('handles strings with dots that are not translation keys', () => {
    // "Dr. Smith" has a dot, so it goes through t() which returns it as-is
    expect(maybeTranslate(mockT, 'Dr. Smith')).toBe('Dr. Smith');
  });
});
