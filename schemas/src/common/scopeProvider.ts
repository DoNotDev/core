// packages/core/schemas/src/common/scopeProvider.ts

/**
 * @fileoverview Scope Provider Registry for Multi-Tenancy
 * @description Global registry for scope providers that supply tenant/company/workspace IDs
 * to CRUD operations. Apps register providers once, entities declare which provider to use.
 *
 * @example
 * ```typescript
 * // 1. App registers scope provider (once, at startup)
 * import { registerScopeProvider } from '@donotdev/core';
 * import { useCurrentCompanyStore } from './stores/currentCompanyStore';
 *
 * registerScopeProvider('company', () =>
 *   useCurrentCompanyStore.getState().currentCompanyId
 * );
 *
 * // 2. Entity declares scope
 * const clientEntity = defineEntity({
 *   name: 'Client',
 *   collection: 'clients',
 *   scope: { field: 'companyId', provider: 'company' },
 *   fields: { ... }
 * });
 *
 * // 3. CRUD operations auto-inject/filter by scope (transparent)
 * const { add } = useCrud(clientEntity);
 * await add({ name: 'Acme' }); // companyId auto-injected
 * ```
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */

/**
 * Function that returns the current scope ID from app state
 * Returns null if no scope is currently selected (e.g., no company selected)
 */
export type ScopeProviderFn = () => string | null;

/**
 * Global registry for scope providers
 * Key: provider name (e.g., 'company', 'tenant', 'workspace')
 * Value: function that returns current scope ID
 */
const scopeProviders: Map<string, ScopeProviderFn> = new Map();

/**
 * Register a scope provider function
 *
 * Call this once at app startup to register scope providers.
 * The provider function should return the current scope ID from your app's state.
 *
 * @param name - Provider name (e.g., 'company', 'tenant', 'workspace')
 * @param provider - Function that returns the current scope ID
 *
 * @example
 * ```typescript
 * // Using Zustand store
 * registerScopeProvider('company', () =>
 *   useCurrentCompanyStore.getState().currentCompanyId
 * );
 *
 * // Using React context (via ref)
 * const companyIdRef = { current: null };
 * registerScopeProvider('company', () => companyIdRef.current);
 * // Update ref in your context provider
 * ```
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function registerScopeProvider(
  name: string,
  provider: ScopeProviderFn
): void {
  if (scopeProviders.has(name)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[DoNotDev] Scope provider "${name}" already registered. Overwriting.`
      );
    }
  }
  scopeProviders.set(name, provider);
}

/**
 * Unregister a scope provider (for testing or cleanup)
 *
 * @param name - Provider name to unregister
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function unregisterScopeProvider(name: string): void {
  scopeProviders.delete(name);
}

/**
 * Get the current scope value from a registered provider
 *
 * Used internally by CRUD operations to inject/filter by scope.
 *
 * @param providerName - Name of the registered provider
 * @returns Current scope ID, or null if not available
 *
 * @example
 * ```typescript
 * const companyId = getScopeValue('company');
 * if (!companyId) {
 *   throw new Error('No company selected');
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function getScopeValue(providerName: string): string | null {
  const provider = scopeProviders.get(providerName);
  if (!provider) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[DoNotDev] Scope provider "${providerName}" not registered. ` +
          `Call registerScopeProvider('${providerName}', () => yourScopeId) at app startup.`
      );
    }
    return null;
  }
  return provider();
}

/**
 * Check if a scope provider is registered
 *
 * @param providerName - Name of the provider to check
 * @returns True if provider is registered
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function hasScopeProvider(providerName: string): boolean {
  return scopeProviders.has(providerName);
}

/**
 * Get all registered scope provider names (for debugging)
 *
 * @returns Array of registered provider names
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function getRegisteredScopeProviders(): string[] {
  return Array.from(scopeProviders.keys());
}

/**
 * Clear all scope providers (for testing)
 *
 * @version 0.1.0
 * @since 0.0.4
 * @author AMBROISE PARK Consulting
 */
export function clearScopeProviders(): void {
  scopeProviders.clear();
}
