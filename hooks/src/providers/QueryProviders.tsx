'use client';
// packages/core/hooks/src/providers/QueryProviders.tsx

/**
 * @fileoverview QueryProviders - TanStack Query Provider Component
 * @description TanStack Query provider for apps that use CRUD operations (SSR-safe)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { QueryClientProvider, getQueryClient } from '../core';
import { useAppConfig } from './AppConfigProvider';

import type { ReactNode } from 'react';

/**
 * QueryProviders - TanStack Query Provider Component
 *
 * Wraps your app with TanStack Query (React Query) context.
 * Provides QueryClient with SSR safety and configurable cache defaults.
 *
 * **SSR Safety:**
 * - Uses getQueryClient() which creates new instance on server per-request
 * - Reuses singleton on client for cache persistence
 *
 * **Configuration:**
 * - Reads `query` config from `AppConfig` if available
 * - Applies config to QueryClient defaults
 * - Config is applied on first call (browser singleton)
 *
 * ⚠️ OPTIONAL: Only use this if your app needs CRUD operations
 * React Query is a large package - don't load it unless needed!
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const QueryProviders: React.ComponentType<{ children: ReactNode }> = ({
  children,
}) => {
  // Get query config from app config (if available)
  const config = useAppConfig();
  const queryConfig = config?.query;

  // SSR-safe: getQueryClient() returns new instance on server, singleton on client
  // Config is applied only on first call (browser singleton pattern)
  const queryClient = getQueryClient(queryConfig);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
