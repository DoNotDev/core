// packages/core/utils/src/client/degradedApis.ts

/**
 * @fileoverview Degraded API Constants
 * @description Centralized degraded API objects for all feature packages (auth, billing, crud, oauth).
 * Used when features are not installed or consent not given, ensuring graceful degradation.
 *
 * **Each degraded API:**
 * - Returns safe defaults (null, empty arrays, no-op functions)
 * - Sets `status: 'degraded'` for guards to handle
 * - Guards redirect protected routes to auth route with error message
 * - Public routes continue to work normally
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  AIAPI,
  AIMessage,
  AuthAPI,
  AuthUser,
  PageAuth,
  BillingAPI,
  CrudAPI,
  OAuthAPI,
  OAuthPartnerId,
  StripeCheckoutResponse,
} from '@donotdev/types';
import {
  USER_ROLES,
  SUBSCRIPTION_TIERS,
  FEATURE_STATUS,
} from '@donotdev/types';

/**
 * Auth store keys - keys that come from Zustand store (reactive state)
 */
export const AUTH_STORE_KEYS: Set<keyof AuthAPI> = new Set([
  'user',
  'loading',
  'error',
  'status',
  'userProfile',
  'userSubscription',
  'emailVerification',
  'partnerError',
  'getPartnerState',
  'setPartnerState',
]);

/**
 * Auth computed keys - keys that are computed from store state
 */
export const AUTH_COMPUTED_KEYS: Set<keyof AuthAPI> = new Set([
  'isAuthenticated',
  'userRole',
  'userTier',
  'can',
]);

/**
 * Billing store keys - keys that come from local state (useState, not Zustand)
 * Note: `status` is computed, not stored
 */
export const BILLING_STORE_KEYS: Set<keyof BillingAPI> = new Set(['error']);

/**
 * OAuth store keys - keys that come from Zustand store (reactive state)
 */
export const OAUTH_STORE_KEYS: Set<keyof OAuthAPI> = new Set([
  'status',
  'error',
  'partners',
  'connectedPartners',
]);

/**
 * Degraded Auth API - returned when @donotdev/auth is not installed or not available
 */
export const DEGRADED_AUTH_API: AuthAPI = {
  user: null as AuthUser | null,
  userProfile: null,
  userSubscription: null,
  loading: false,
  reauthenticateWithPassword: async () => {},
  reauthenticateWithProvider: async () => {},
  deleteAccount: async () => {},
  setRememberMe: async () => {},
  error: null,
  emailVerification: { status: 'pending' as const },
  passwordResetPending: false,
  getPartnerState: () => 'idle' as const,
  setPartnerState: () => {},
  partnerError: null,
  // status: 'degraded' tells guards to redirect protected routes to auth route with ?error=auth_unavailable
  status: FEATURE_STATUS.DEGRADED,
  hasRole: async () => false,
  hasTier: async () => false,
  hasFeature: async () => false,
  getCustomClaims: () => ({}),
  getCustomClaim: () => null,
  signInWithEmail: async () => null,
  createUserWithEmail: async () => null,
  signInWithPartner: async () => null,
  linkWithPartner: async () => null,
  signInWithGoogleCredential: async () => null,
  signOut: async () => {},
  sendPasswordResetEmail: async () => {},
  updatePassword: async () => {},
  verifyPasswordResetCode: async () => null,
  confirmPasswordReset: async () => {},
  sendEmailVerification: async () => {},
  getEmailVerificationStatus: async () => ({ status: 'pending' as const }),
  isEmailVerificationEnabled: async () => false,
  sendSignInLinkToEmail: async () => {},
  signInWithEmailLink: async () => null,
  isSignInWithEmailLink: () => false,
  getCurrentUser: async () => null as AuthUser | null,
  isAuthenticated: false,
  userRole: USER_ROLES.GUEST,
  userTier: SUBSCRIPTION_TIERS.FREE,
  // Unified capability-based access control (replaces canAccess)
  can: {
    navigate: (authConfig: PageAuth | false) => {
      // Public routes should return true even when degraded
      if (authConfig === false) return true;
      // Optional auth routes (required: false) should also return true
      if (typeof authConfig === 'object' && !authConfig.required) return true;
      // Required auth without user = false
      return false;
    },
    view: () => false,
    edit: () => false,
    delete: () => false,
    create: () => false,
    perform: () => false,
    has: () => false,
  },
  isAvailable: false,
} as const;

/**
 * Degraded Billing API - returned when @donotdev/billing is not installed or not available
 */
export const DEGRADED_BILLING_API: BillingAPI = {
  status: FEATURE_STATUS.DEGRADED,
  error: null,
  loading: false,
  checkout: async () => ({
    sessionId: '',
    sessionUrl: null,
    success: false,
    error: 'Billing not available - consent required',
  }),
  cancelSubscription: async () => ({
    success: false,
    endsAt: '',
  }),
  changePlan: async () => ({ success: false }),
  refreshStatus: async () => {},
  openCustomerPortal: async () => {},
  clearError: () => {},
  isAvailable: false,
} as const;

/**
 * Degraded AI API - returned when @donotdev/ai is not installed or not available
 */
export const DEGRADED_AI_API: AIAPI = {
  messages: [] as AIMessage[],
  append: () => {},
  stop: () => {},
  isLoading: false,
  error: undefined,
  clearMessages: () => {},
  isAvailable: false,
  input: '',
  setInput: () => {},
  handleSubmit: () => {},
  cost: {
    lastCost: null,
    sessionCost: {
      providerCost: 0,
      billedCost: 0,
      markup: 4.0,
      breakdown: {
        promptTokens: 0,
        completionTokens: 0,
        promptCost: 0,
        completionCost: 0,
      },
    },
    formattedBilledCost: '$0.00',
  },
  toolCalls: [],
};

/**
 * Degraded CRUD API - returned when @donotdev/crud is not installed or not available
 */
export const DEGRADED_CRUD_API: CrudAPI = {
  status: FEATURE_STATUS.DEGRADED,
  data: null,
  loading: false,
  error: null,
  get: async () => null,
  set: async () => {},
  update: async () => {},
  delete: async () => {},
  add: async () => '',
  query: async () => [],
  subscribe: () => () => {},
  subscribeToCollection: () => () => {},
  invalidate: async () => {},
  isAvailable: false,
} as const;

/**
 * Degraded OAuth API - returned when @donotdev/oauth is not installed or not available
 */
export const DEGRADED_OAUTH_API: OAuthAPI = {
  status: FEATURE_STATUS.DEGRADED,
  error: null,
  partners: {} as Record<OAuthPartnerId, any>,
  connectedPartners: [],
  connect: async () => {},
  disconnect: async () => {},
  isConnected: () => false,
  getCredentials: () => null,
  handleCallback: async () => {},
  isAvailable: false,
} as const;
