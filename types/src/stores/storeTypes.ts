// packages/core/types/src/stores/storeTypes.ts

/**
 * @fileoverview Store Types
 * @description Type definitions for store system. Defines store API types, state types, and store-related interfaces for managing application state.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { AuthUser, TokenStatus, UserRole } from '../auth';
import type { SubscriptionClaims } from '../billing';
import type { AuthPartnerId, OAuthPartnerId } from '../partners/schemas';
import type {
  NetworkConnectionType,
  NetworkState,
  RateLimitResult,
  RateLimitState,
} from '../utils';
import type {
  OAuthCredentials,
  OAuthPartnerState,
  OAuthPurpose,
} from '../oauth';

// =============================================================================
// Store API Types
// =============================================================================

/**
 * DoNotDev store API interface without direct Zustand dependency.
 * Renamed from StoreApi to avoid shadowing Zustand's StoreApi.
 * @template T - The store state type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface DndevStoreApi<T> {
  /** Returns the current state */
  getState: () => T;

  /** Updates the store state */
  setState: (
    partial: Partial<T> | ((state: T) => Partial<T>),
    replace?: boolean
  ) => void;

  /** Subscribes to state changes */
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}

// =============================================================================
// Base Store Types
// =============================================================================

/**
 * Base store state that all stores should implement
 * Provides common properties for loading, error handling, and readiness
 *
 * **Lifecycle Timeline:**
 * 1. Store created → `isReady: false`, `isDataResolved: false`
 * 2. Service init complete → `isReady: true`, `isDataResolved: false`
 * 3. First async callback → `isReady: true`, `isDataResolved: true`
 *
 * @property isReady - Service is initialized and methods can be called
 * @property isDataResolved - First async data callback has fired (user/data resolved)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseStoreState {
  /** Whether the store is ready to be used by components */
  isReady: boolean;

  /** Whether the store is currently loading */
  isLoading: boolean;

  /** Current error message, or null if no error */
  error: string | null;

  /**
   * Whether Zustand persist middleware has finished rehydrating from storage.
   * Only present on stores created with persistOptions.
   * `false` before rehydration, `true` after. Non-persisted stores: undefined.
   */
  _hasHydrated?: boolean;

  /**
   * Whether the first async data callback has fired.
   * Optional - only needed for stores with async data sources (e.g., auth, realtime).
   *
   * For AuthStore: equivalent to `authStateChecked` (first onAuthStateChanged)
   * For other stores: set when initial data load completes
   */
  isDataResolved?: boolean;
}

/**
 * Base store actions that all stores should implement
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseStoreActions {
  /** Set the store readiness state */
  setReady: (ready: boolean) => void;

  /** Set the loading state */
  setLoading: (loading: boolean) => void;

  /** Set the error state */
  setError: (error: string | null) => void;

  /** Clear the current error */
  clearError: () => void;

  /** Reset the store to initial state */
  reset: () => void;

  /**
   * Set the data resolved state (optional).
   * Only implement for stores with async data sources.
   *
   * For AuthStore: call when first onAuthStateChanged fires
   * For other stores: call when initial data load completes
   */
  setDataResolved?: (resolved: boolean) => void;
}

/**
 * Base UI state for an entity.
 * @template T - The entity type.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseState<T> extends BaseStoreState {
  /** Currently selected item */
  selected?: T;

  /** Active filters */
  filters: Record<string, any>;

  /** Current sort configuration */
  sort?: {
    field: keyof T;
    direction: 'asc' | 'desc';
  };
}

/**
 * Base actions for UI state management.
 * @template T - The entity type.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BaseActions<T> extends BaseStoreActions {
  /** Select or deselect an item */
  select: (item?: T) => void;

  /** Update active filters */
  setFilters: (filters: Record<string, any>) => void;

  /** Set the sorting configuration */
  setSort: (field: keyof T, direction: 'asc' | 'desc') => void;
}

/**
 * Combined store type including state and actions.
 * @template T - The entity type.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type Store<T> = BaseState<T> & BaseActions<T>;

// =============================================================================
// Token State Types
// =============================================================================

/**
 * Authentication token state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TokenState {
  /** The authentication token string or null if not authenticated */
  token: string | null;

  /** ISO date string of when the token expires */
  expiresAt: string | null;

  /** Current status of the token */
  status: TokenStatus;
}

/**
 * OAuth store state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthStoreState {
  // Partner connections indexed by partner ID
  connections: Record<OAuthPartnerId, OAuthPartnerState>;

  // Loading and error state
  loading: boolean;
  error: Error | null;
}

/**
 * Simple auth state store interface - only state, no mechanisms
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthStateStore {
  // Core auth state
  authenticated: boolean;
  userId: string | null;
  user: AuthUser | null;
  role: UserRole;
  token: {
    token: string | null;
    expiresAt: Date | null;
    status: TokenStatus;
  };
  network: {
    online: boolean;
    connectionType: NetworkConnectionType;
    lastChecked: string;
  };
  rateLimit: Record<string, RateLimitState>;
  error: string | null;
  errorCode: string | undefined;
  loading: boolean;
  initialized: boolean;
  subscription: {
    tier: string;
    isActive: boolean;
    expiresAt: Date | null;
    features: string[];
    daysRemaining: number | null;
  };

  // Actions - only state setters, no auth mechanisms
  setAuthenticated: (authenticated: boolean, userId?: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setRole: (role: UserRole) => void;
  setToken: (token: string | null, expiresAt?: Date | null) => void;
  updateTokenStatus: (status: TokenStatus) => void;
  setNetworkStatus: (
    online: boolean,
    connectionType?: NetworkConnectionType
  ) => void;
  setError: (error: string | null, errorCode?: string) => void;
  setLoading: (loading: boolean) => void;
  setSubscription: (subscription: {
    tier: string;
    isActive: boolean;
    expiresAt: Date | null;
    features: string[];
    daysRemaining: number | null;
  }) => void;
  setInitialized: (initialized: boolean) => void;
  clearError: () => void;
  reset: () => void;
}

/**
 * OAuth store actions
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface OAuthStoreActions {
  // Global actions
  setLoading: (loading: boolean) => void;
  setGlobalError: (error: Error | null) => void;
  reset: () => void;

  // Helper functions
  isConnected: (partnerId: OAuthPartnerId, purpose?: OAuthPurpose) => boolean;
  getCredentials: (partnerId: OAuthPartnerId) => OAuthCredentials | null;
}
