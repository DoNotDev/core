// packages/core/utils/src/common/errors/__tests__/loadErrorReason.test.ts

/**
 * @fileoverview The reason of a failed read (owner decision 2026-11-25 E1), shared by the
 * web and native load error boxes.
 */

import { describe, expect, it } from 'vitest';

import { DoNotDevError } from '../doNotDevError';
import { loadErrorReasonKey } from '../loadErrorReason';

describe('loadErrorReasonKey', () => {
  it.each([
    ['unavailable', 'messages.networkError'],
    ['deadline-exceeded', 'messages.networkError'],
    ['timeout', 'messages.networkError'],
    ['permission-denied', 'messages.forbidden'],
    ['unauthenticated', 'messages.unauthorized'],
    ['internal', 'messages.serverError'],
    ['not-found', 'messages.error'],
    ['unknown', 'messages.error'],
  ] as const)('%s → %s', (code, key) => {
    expect(loadErrorReasonKey(new DoNotDevError('Request failed.', code))).toBe(key);
  });

  it('gives the generic reason to an error without a code', () => {
    expect(loadErrorReasonKey(new Error('fetch failed'))).toBe('messages.error');
    expect(loadErrorReasonKey('boom')).toBe('messages.error');
  });
});
