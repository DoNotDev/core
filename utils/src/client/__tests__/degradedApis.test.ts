/**
 * @fileoverview Unit tests for `DEGRADED_AUTH_API` loud methods.
 * @description Without auth, listing users and confirming a code reject with an
 *   `unavailable` DoNotDevError: never an empty list or a "wrong code".
 */

import { describe, it, expect } from 'vitest';

import { DoNotDevError, ERROR_CODES } from '@donotdev/types';

import { DEGRADED_AUTH_API } from '../degradedApis';

describe('DEGRADED_AUTH_API', () => {
  it.each([
    ['listUsers', () => DEGRADED_AUTH_API.listUsers()],
    ['verifyEmailCode', () => DEGRADED_AUTH_API.verifyEmailCode('a@b.co', '1')],
  ])('%s rejects with an unavailable DoNotDevError', async (_name, call) => {
    const error = await call().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DoNotDevError);
    expect(error).toMatchObject({
      message: 'Authentication is unavailable',
      code: ERROR_CODES.UNAVAILABLE,
    });
  });
});
