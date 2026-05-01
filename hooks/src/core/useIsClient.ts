'use client';
// packages/core/hooks/src/core/useIsClient.ts

/**

 * @fileoverview useIsClient Hook

 * @description SSR-safe React hook for client detection using useSyncExternalStore

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

import { useSyncExternalStore } from 'react';

const clientStore = {
  subscribe: () => () => {},
  getSnapshot: () => typeof window !== 'undefined',
  getServerSnapshot: () => false,
};

/**

 * SSR-safe React hook for client detection

 * Uses useSyncExternalStore to prevent hydration mismatches in Next.js

 *

 * Use this in React components instead of isClient() to avoid hydration errors.

 * For non-React code (stores, utils), use isClient() function from @donotdev/utils.

 *

 * @returns boolean indicating if running in browser/client environment

 *

 * @example

 * ```tsx

 * function MyComponent() {

 *   const isClient = useIsClient();

 *   if (!isClient) return null;

 *   return <div>Client-only content</div>;

 * }

 * ```

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

export function useIsClient(): boolean {
  return useSyncExternalStore(
    clientStore.subscribe,

    clientStore.getSnapshot,

    clientStore.getServerSnapshot
  );
}
