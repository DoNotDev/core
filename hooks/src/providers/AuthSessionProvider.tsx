// packages/core/hooks/src/providers/AuthSessionProvider.tsx

/**
 * @fileoverview Auth session snapshot provider
 * @description Carries the signed-in state read from the request cookies
 * (AuthProvider.readSessionSnapshot) to the auth hooks, so the server render and the
 * client's hydration pass show the real signed-in state while the auth provider is
 * still initialising. Same props on both sides, so both passes render identically.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { AuthSessionSnapshot } from '@donotdev/types';

import { syncQueryCacheIdentity } from '../core';

const AuthSessionContext = createContext<AuthSessionSnapshot | null>(null);

/**
 * Provides the request's auth session snapshot (`null` = unknown). A known snapshot
 * seeds the identity the query cache is filled under (syncQueryCacheIdentity), so the
 * provider confirming the same user keeps the hydrated cache.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */
export function AuthSessionProvider({
  snapshot,
  children,
}: {
  snapshot: AuthSessionSnapshot | null;
  children: ReactNode;
}) {
  // Seed only: idempotent, never resets, so safe during render (hydration pass first)
  if (snapshot !== null) syncQueryCacheIdentity(snapshot.user?.id ?? null, true);
  return (
    <AuthSessionContext.Provider value={snapshot}>
      {children}
    </AuthSessionContext.Provider>
  );
}

/**
 * The request's auth session snapshot, or `null` when the cookies cannot tell
 * (no provider, or an auth provider that does not keep its session in cookies).
 * Display only, and only meaningful until the auth provider is ready.
 *
 * @version 0.1.0
 * @since 0.1.50
 * @author AMBROISE PARK Consulting
 */
export function useAuthSessionSnapshot(): AuthSessionSnapshot | null {
  return useContext(AuthSessionContext);
}
