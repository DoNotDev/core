// @vitest-environment node

import { expect, it } from 'vitest';

import { getQueryClient, syncQueryCacheIdentity } from '../queryClient';

it('keeps server acquisitions isolated and browser identity sync inert', () => {
  const first = getQueryClient();
  const second = getQueryClient();
  const key = ['identity-boundary', 'server'];
  first.setQueryData(key, { owner: 'synthetic-A' });
  syncQueryCacheIdentity('synthetic-A', true);
  syncQueryCacheIdentity(null);
  syncQueryCacheIdentity('synthetic-B');
  expect(second).not.toBe(first);
  expect(second.getQueryData(key)).toBeUndefined();
  expect(first.getQueryData(key)).toEqual({ owner: 'synthetic-A' });
  first.clear();
  second.clear();
});
