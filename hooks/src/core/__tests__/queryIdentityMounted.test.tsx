import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';

import { getQueryClient, syncQueryCacheIdentity } from '../queryClient';

const client = getQueryClient();
const key = ['identity-boundary', 'mounted-react'];

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  client.clear();
});

// Expected failure documents F02; this is not a passing isolation guarantee.
it.fails('OPEN F02: a mounted React consumer drops A initialData through logout → B', async () => {
  syncQueryCacheIdentity('synthetic-A', true);
  const { result } = renderHook(() => useQuery({
    queryKey: key,
    initialData: { owner: 'synthetic-A' },
    enabled: false,
  }), { wrapper: Wrapper });

  expect(result.current.data).toEqual({ owner: 'synthetic-A' });
  act(() => {
    syncQueryCacheIdentity(null);
    syncQueryCacheIdentity('synthetic-B');
  });
  await waitFor(() => expect(result.current.data).toBeUndefined());
});
