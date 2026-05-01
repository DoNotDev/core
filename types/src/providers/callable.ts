// packages/core/types/src/providers/callable.ts

/**
 * @fileoverview Callable Provider Interface
 * @description Provider-agnostic interface for invoking server-side functions.
 * Firebase uses `httpsCallable`; Supabase uses `functions.invoke()`.
 *
 * @version 0.1.0
 * @since 0.5.0
 * @author AMBROISE PARK Consulting
 */

// =============================================================================
// Callable Provider
// =============================================================================

/**
 * Provider-agnostic interface for calling server-side functions.
 *
 * @example
 * ```typescript
 * const callable: ICallableProvider = new SupabaseCallableProvider(client);
 * const result = await callable.call<{ userId: string }, { success: boolean }>(
 *   'delete-account',
 *   { userId: '123' }
 * );
 * ```
 *
 * @version 0.1.0
 * @since 0.5.0
 */
export interface ICallableProvider {
  call<TReq, TRes>(functionName: string, data: TReq): Promise<TRes>;
}
