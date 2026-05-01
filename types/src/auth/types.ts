// packages/core/types/src/auth/types.ts

/**
 * @fileoverview Authentication Types
 * @description Type definitions for authentication domain. Defines authentication partner types, user types, session types, and authentication-related interfaces.
 * Uses unified FeatureStatus enum for feature state management.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { ReactNode } from 'react';
import type { TokenStatus, UserRole } from './constants';
import type { AuthUser, UserSubscription } from './schemas';
import type { FeatureStatus, PageAuth } from '../common';
import type { SubscriptionClaims } from '../billing';
import type { AuthPartnerId } from '../partners/schemas';
import type { PartnerResult } from '../partners/types';

// Schema-derived types are exported by ./schemas via v.InferOutput under original names

/**
 * Authentication method type
 * 'popup' - Opens OAuth popup window (better for dev/localhost)
 * 'redirect' - Redirects to OAuth provider (better for production)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthMethod = 'redirect' | 'popup';

// Forward declarations for circular dependencies
/**
 * Email verification status type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type EmailVerificationStatus = 'verified' | 'pending' | 'error';

/**
 * Email verification status constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const EMAIL_VERIFICATION_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  ERROR: 'error',
} as const;

// =============================================================================
// Auth Partner Types (moved from partners)
// =============================================================================

/**
 * Auth partner result interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthPartnerResult extends PartnerResult {
  partnerId: AuthPartnerId;
  metadata?: Record<string, any>;
}

// =============================================================================
// Auth Partner State Constants
// =============================================================================

/**
 * Partner state constants - Single source of truth for partner states
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const AUTH_PARTNER_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  ERROR: 'error',
  AUTHENTICATED: 'authenticated',
} as const;

/**
 * Auth partner state type - simple string constants
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthPartnerState =
  (typeof AUTH_PARTNER_STATE)[keyof typeof AUTH_PARTNER_STATE];

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error type that supports Firebase errors and custom errors with code property
 * Note: DoNotDevError is avoided for account linking to preserve Firebase error codes
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type AuthError = (Error & { code?: string }) | null;

// =============================================================================
// Updated User Types - Subscription is now REQUIRED
// =============================================================================

/**
 * Contains authorization and user preference information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UserProfile {
  /** The user's unique identifier (matches AuthUser.id) */
  userId: string;

  /** The user's display name */
  displayName?: string;

  /** The user's email address */
  email?: string;

  /** The user's profile photo URL */
  photoURL?: string;

  /** Additional profile data */
  [key: string]: unknown;
}

/**
 * Factory function to create default user profile
 * @param userId - User ID for the profile
 * @returns Default user profile with minimal required fields
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createDefaultUserProfile(userId: string): UserProfile {
  return {
    userId,
    role: 'user',
    preferences: {},
    metadata: {},
  };
}

/**
 * Provides a unified interface for accessing all user data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UserContext {
  /** Core authentication data */
  auth: AuthUser;

  /** User profile information */
  profile: UserProfile;

  /** Subscription information */
  subscription: UserSubscription;
}

/**
 * Extends SubscriptionClaims with calculated or derived subscription status information.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SubscriptionInfo extends SubscriptionClaims {
  /** Indicates if the subscription is currently active (typically based on subscriptionEnd) */
  isActive: boolean;

  /** Number of days remaining in the subscription, or null if not applicable */
  daysRemaining: number | null;

  /** Array of feature IDs available to the user based on their subscription */
  features: string[];
}

// =============================================================================
// Hook Result Types
// =============================================================================

/**
 * Result type for the useAuthPartner hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthPartnerHookResult {
  /** Current authentication state from the partner */
  partnerState: AuthPartnerState;

  /** Whether a connection operation is in progress */
  isConnecting: boolean;

  /** Whether the partner is currently connected */
  isConnected: boolean;

  /** Current error message, or null if no error */
  error: Error | null;

  /** Function to connect to this partner */
  connect: (options?: {
    redirectUri?: string;
    onSuccess?: (result: AuthPartnerResult) => void;
    onError?: (error: Error) => void;
  }) => Promise<void>;

  /** Function to disconnect from this partner */
  disconnect: () => Promise<boolean>;
}

/**
 * Result type for the useAuthCore hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthCoreHookResult {
  // Core state
  user: AuthUser | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

/**
 * Result type for the useAuthToken hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthTokenHookResult {
  // Current token state
  token: string | null;
  status: TokenStatus;
  expiresAt: Date | null;

  // Actions
  refreshToken: () => Promise<string | null>;
  getAccessToken: () => Promise<string | null>;
}

/**
 * Result type for the useSubscription hook
 * NOTE: subscription is now always present
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SubscriptionHookResult {
  // Subscription data - always present
  subscription: SubscriptionInfo;

  // Actions
  refreshSubscription: () => Promise<void>;
  hasFeature: (featureId: string) => boolean;
  hasTier: (requiredTier: string) => boolean;
}

/**
 * Result type for the useAdminCheck hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AdminCheckHookResult {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Result type for the useNetworkStatus hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface NetworkStatusHookResult {
  online: boolean;
  connectionType: string;
}

/**
 * Options for redirect behavior
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthRedirectOptions {
  /** If true, only allow admin users */
  adminOnly?: boolean;

  /** If true, require email verification */
  requireEmailVerification?: boolean;

  /** If true, require subscription */
  requireSubscription?: boolean;

  /** Redirect URL if conditions not met */
  redirectTo?: string;
}

/**
 * Result type for the useAuthRedirect hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthRedirectHookResult {
  authenticated: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  hasSubscription: boolean;
  shouldRedirect: boolean;
  redirectTo?: string;
}

/**
 * Result type for the useEmailVerification hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EmailVerificationHookResult {
  // State
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  sendVerificationEmail: () => Promise<void>;
  checkVerificationStatus: () => Promise<void>;
}

/**
 * Result type for the useFeatureAccess hook
 * NOTE: subscription is now always present
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FeatureAccessHookResult {
  hasFeature: (featureId: string) => boolean;
  hasTier: (requiredTier: string) => boolean;
  subscription: SubscriptionInfo;
}

/**
 * Result type for the useFeature hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FeatureHookResult {
  enabled: boolean;
}

/**
 * Result type for the useTierAccess hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TierAccessHookResult {
  enabled: boolean;
}

// =============================================================================
// Feature & Tier Types
// =============================================================================

/**
 * Represents a feature that can be enabled or disabled for users,
 * often tied to a specific subscription tier.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Feature {
  /** Unique identifier for the feature */
  id: string;

  /** Human-readable name for the feature */
  name: string;

  /** Description of what the feature does */
  description?: string;

  /** Whether the feature is currently enabled */
  enabled: boolean;

  /** Required subscription tier for this feature */
  requiredTier?: string;
}

// =============================================================================
// Provider Data Types
// =============================================================================

/**
 * Stores information specific to a user's identity from a particular authentication provider.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UserProviderData {
  /** The unique identifier for the authentication provider (e.g., 'google.com') */
  providerId: string;

  /** The user's unique identifier within this provider */
  uid: string;

  /** The user's email address from this provider */
  email?: string | null;

  /** The user's display name from this provider */
  displayName?: string | null;

  /** The user's photo URL from this provider */
  photoURL?: string | null;

  /** The user's phone number from this provider */
  phoneNumber?: string | null;

  /** Additional provider-specific data */
  [key: string]: any;
}

// =============================================================================
// Claims Types
// =============================================================================

/**
 * Defines custom claims specifically for administrative users.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AdminClaims {
  /** Flag indicating if the user has administrative privileges */
  isAdmin: boolean;

  /** Optional role or permission level */
  role?: string;

  /** Optional department or team */
  department?: string;

  /** Additional admin-specific claims */
  [key: string]: any;
}

// =============================================================================
// Account Linking Types
// =============================================================================

/**
 * Information stored in sessionStorage for account linking flow
 * Firebase 12.3 stores credentials, we only store UI state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AccountLinkingInfo {
  email: string;
  existingProvider: AuthPartnerId;
  newProvider: string;
  timestamp: number;
}

/**
 * Represents the outcome of an attempt to link an additional authentication provider.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AccountLinkResult {
  /** Indicates whether the overall linking process was successful */
  success: boolean;

  /** The provider that was linked */
  provider: string;

  /** Error message if the linking failed */
  error?: string;

  /** Additional data about the linked account */
  data?: Record<string, any>;
}

// =============================================================================
// Store Types
// =============================================================================

/**
 * Authentication state interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthState {
  // Core auth state
  user: AuthUser | null;
  authenticated: boolean;
  userId: string | null;
  loading: boolean;
  error: AuthError;

  // User data
  userProfile: UserProfile | null;
  userSubscription: UserSubscription | null;

  // Simplified partner states - single enum per partner
  partnerStates: Record<AuthPartnerId, AuthPartnerState>;

  // Single error field for the most recent partner error
  // When a partner fails, its state becomes 'error' and details go here
  partnerError: {
    partnerId: AuthPartnerId;
    error: AuthError;
  } | null;

  // Email verification
  emailVerification: {
    status: EmailVerificationStatus;
    error?: string;
  };

  /**
   * Password reset recovery mode.
   * Set by provider when PASSWORD_RECOVERY event fires (Supabase)
   * or when oobCode is detected in URL (Firebase).
   * Components use this to show the "set new password" UI.
   */
  passwordResetPending: boolean;

  // Service reference for real data access
  authService: unknown;

  // ==========================================================================
  // Lifecycle State
  // ==========================================================================

  /**
   * Unified feature status - single source of truth for auth state.
   * Replaces deprecated boolean flags (initialized, authStateChecked).
   *
   * **Lifecycle timeline:**
   * 1. Store created → `status: 'initializing'` (show loader)
   * 2. Auth service init + first callback → `status: 'ready'` (normal operation)
   * 3. If feature disabled/unavailable → `status: 'degraded'` (protected routes redirect with error)
   * 4. If init fails → `status: 'error'` (protected routes redirect with error)
   *
   * **Guard behavior:**
   * - `degraded` + protected route → redirect to auth route with `?error=auth_unavailable`
   * - `error` + protected route → redirect to auth route with `?error=auth_error`
   * - `initializing` → show loader, don't redirect
   * - `ready` → perform normal auth checks
   *
   * @see FEATURE_STATUS for possible values
   */
  status: FeatureStatus;
}

/**
 * Authentication actions interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthActions {
  // Simplified partner management
  setPartnerState: (
    partnerId: AuthPartnerId,
    state: AuthPartnerState,
    error?: AuthError
  ) => void;
  getPartnerState: (partnerId: AuthPartnerId) => AuthPartnerState;
  clearAllPartnerStates: () => void;

  // Domain methods for auth state changes
  setAuthenticated: (
    user: AuthUser,
    subscription: UserSubscription,
    profile: UserProfile
  ) => void;
  setUnauthenticated: () => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: AuthError) => void;
  clearAuthError: () => void;

  // Lifecycle management
  /** Set unified status - single source of truth */
  setStatus: (status: FeatureStatus) => void;

  // Custom claims support (sync - for display only)
  getCustomClaim: (claim: string) => unknown;
  getCustomClaims: () => Record<string, unknown>;

  // Email verification
  emailVerification: {
    status: EmailVerificationStatus;
    error?: string;
  };

  // Password reset
  setPasswordResetPending: (pending: boolean) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: AuthError) => void;
  clearError: () => void;
  reset: () => void;

  // Service reference for real data access
  setAuthService: (authService: unknown) => void;

  // Local fallback methods (sync - from cached data)
  getCustomClaimLocal: (claim: string) => unknown;
  getCustomClaimsLocal: () => Record<string, unknown>;

  // Email verification actions
  setEmailVerificationStatus: (
    status: EmailVerificationStatus,
    error?: string
  ) => void;

  // User data management
  setUserProfile: (profile: UserProfile) => void;
  setUserSubscription: (subscription: UserSubscription) => void;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Authentication context value interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthContextValue {
  // Core state
  /** The currently authenticated user object, or null if unauthenticated */
  user: AuthUser | null;

  /** Whether the user is currently authenticated */
  authenticated: boolean;

  /** Whether an authentication operation is in progress */
  loading: boolean;

  /** Current error message, or null if no error */
  error: string | null;

  /** The user's role */
  role: UserRole;

  /** The user's subscription information, or null if unauthenticated or not yet loaded */
  subscription: SubscriptionInfo | null;

  // Token state
  /** Current authentication token */
  token: string | null;

  /** Token status */
  tokenStatus: TokenStatus;

  /** When the token expires */
  tokenExpiresAt: Date | null;

  // Actions
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<void>;

  /** Sign up with email and password */
  signUp: (email: string, password: string) => Promise<void>;

  /** Sign out the current user */
  signOut: () => Promise<void>;

  /** Reset password for email */
  resetPassword: (email: string) => Promise<void>;

  /** Update user profile */
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;

  /** Refresh the authentication token */
  refreshToken: () => Promise<string | null>;

  /** Get the current access token */
  getAccessToken: () => Promise<string | null>;

  /** Check if user has a specific role */
  hasRole: (role: UserRole) => boolean;

  /** Check if user has access to a feature */
  hasFeature: (featureId: string) => boolean;

  /** Check if user has access to a tier */
  hasTier: (requiredTier: string) => boolean;
}

/**
 * Props for the AuthProvider component
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthProviderProps {
  /** Child components that will have access to the authentication context */
  children: ReactNode;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of an authentication operation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthResult {
  /** The authenticated user */
  user: AuthUser;

  /** Whether the operation was successful */
  success: boolean;

  /** Whether this is a new user (for sign-up operations) */
  isNewUser?: boolean;

  /** Error message if the operation failed */
  error?: string;
}
// =============================================================================
// Function Request/Response Types (from functions/auth.ts)
// =============================================================================

/**
 * Get user auth status response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GetUserAuthStatusResponse {
  userId: string;
  isAuthenticated: boolean;
  customClaims: Record<string, any>;
  hasClaims: boolean;
  claimCount: number;
}

/**
 * Get custom claims response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface GetCustomClaimsResponse {
  claims: Record<string, any>;
  userId: string;
}

/**
 * Set custom claims response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface SetCustomClaimsResponse {
  success: boolean;
  userId: string;
  claims: Record<string, any>;
}

/**
 * Remove custom claims response interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface RemoveCustomClaimsResponse {
  success: boolean;
  userId: string;
  removedClaims: string[];
  remainingClaims: Record<string, any>;
}

/**
 * Function to unsubscribe from auth state changes
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type UnsubscribeFn = () => void;

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Optional metadata passed to signup methods.
 * Stored in provider-specific user metadata (Supabase `raw_user_meta_data`, Firebase user doc).
 */
export interface SignUpMetadata {
  /** ISO-8601 timestamp of GDPR consent acceptance */
  gdpr_consent_at?: string;
  /** Version identifier of the ToS document accepted */
  gdpr_tos_version?: string;
  /** Extensible for consumer-specific fields */
  [key: string]: unknown;
}

/**
 * Authentication provider interface
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthProvider {
  /**
   * Initialize the auth provider
   */
  initialize(): Promise<void>;

  /**
   * Get the current user
   */
  getCurrentUser(): Promise<AuthUser | null>;

  /**
   * Sign in with email and password
   */
  signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<AuthUser>;

  /**
   * Sign up with email and password
   */
  createUserWithEmailAndPassword(
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ): Promise<AuthUser>;

  /**
   * Sign out the current user
   */
  signOut(): Promise<void>;

  /**
   * Reset password for email
   */
  sendPasswordResetEmail(email: string): Promise<void>;

  /**
   * Update user profile
   */
  updateUserProfile(updates: Partial<AuthUser>): Promise<void>;

  /**
   * Get the current access token
   */
  getAccessToken(): Promise<string | null>;

  /**
   * Refresh the authentication token
   */
  refreshToken(): Promise<string | null>;

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): UnsubscribeFn;

  /**
   * Check if user has a specific role
   */
  hasRole(role: UserRole): Promise<boolean>;

  /**
   * Check if user has access to a feature
   */
  hasFeature(featureId: string): Promise<boolean>;

  /**
   * Check if user has access to a tier
   */
  hasTier(requiredTier: string): Promise<boolean>;

  // -------------------------------------------------------------------------
  // Extended API (useAuth / FirebaseAuth) — same semantics, AuthResult return
  // -------------------------------------------------------------------------

  signInWithEmail(email: string, password: string): Promise<AuthResult | null>;

  createUserWithEmail(
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ): Promise<AuthResult | null>;

  signInWithPartner(
    partnerId: AuthPartnerId,
    method?: AuthMethod
  ): Promise<AuthResult | null>;

  linkWithPartner(
    partnerId: AuthPartnerId,
    method?: AuthMethod
  ): Promise<AuthResult | null>;

  signInWithGoogleCredential(credential: string): Promise<AuthResult | null>;

  updatePassword(newPassword: string): Promise<void>;

  /**
   * Verify a password reset code from the email callback link.
   * Returns the email address associated with the code.
   * @returns email address, or null if code is invalid/expired
   */
  verifyPasswordResetCode?(code: string): Promise<string | null>;

  /**
   * Confirm a password reset with the code from the email and the new password.
   * After success, user can sign in with the new password.
   */
  confirmPasswordReset?(code: string, newPassword: string): Promise<void>;

  /**
   * Get the password reset redirect path for this provider.
   * Used to build the redirect URL in password reset emails.
   */
  getPasswordResetRedirectUrl?(): string;

  sendEmailVerification(): Promise<void>;

  sendSignInLinkToEmail(
    email: string,
    actionCodeSettings?: { url: string; handleCodeInApp: boolean }
  ): Promise<void>;

  signInWithEmailLink(
    email: string,
    emailLink?: string
  ): Promise<AuthResult | null>;

  isSignInWithEmailLink(emailLink?: string): boolean;

  getEmailVerificationStatus(): Promise<{ status: string }>;

  isEmailVerificationEnabled(): Promise<boolean>;

  reauthenticateWithPassword(password: string): Promise<void>;

  reauthenticateWithProvider(
    partnerId: AuthPartnerId,
    method?: AuthMethod
  ): Promise<void>;

  deleteAccount(password?: string): Promise<void>;

  /**
   * Set session persistence (remember me).
   * Provider-specific: Firebase uses browserLocal/browserSession persistence,
   * Supabase uses cookie duration, etc.
   * No-op if the provider doesn't support persistence control.
   *
   * @param remember - true for persistent session, false for session-only
   */
  setRememberMe?(remember: boolean): Promise<void>;
}

// =============================================================================
// Token Information
// =============================================================================

/**
 * Information about a token including its status and expiration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface TokenInfo {
  /** The actual token string or null if not available */
  token: string | null;

  /** Current status of the token */
  status: TokenStatus;

  /** When the token expires, or null if not available */
  expiresAt: Date | null;

  /** When the token was last refreshed */
  lastRefreshed?: Date;

  /** Number of seconds until expiration */
  expiresIn?: number;
}

// =============================================================================
// Hook API Types
// =============================================================================

/**
 * Auth API type - complete interface for useAuth hook
 *
 * This interface defines all properties available through useAuth('propertyName').
 * Properties are categorized by their behavior:
 * - **State** (reactive): Re-renders when value changes
 * - **Methods** (stable): Never re-renders, always same reference
 * - **Computed** (derived): Re-renders when dependencies change
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface AuthAPI {
  // ==========================================================================
  // STATE (from Zustand store) - REACTIVE
  // ==========================================================================

  user: AuthUser | null;
  userProfile: UserProfile | null;
  userSubscription: UserSubscription | null;
  loading: boolean;
  error: AuthError | null;
  emailVerification: { status: string; error?: string };
  passwordResetPending: boolean;
  partnerError: { partnerId: AuthPartnerId; error: string } | null;

  /**
   * Unified feature status - single source of truth for auth state.
   * Replaces deprecated boolean flags. See AuthState.status for detailed lifecycle.
   */
  status: FeatureStatus;

  // ==========================================================================
  // PARTNER STATE METHODS (from Zustand store) - REACTIVE
  // ==========================================================================

  getPartnerState: (partnerId: AuthPartnerId) => string;
  setPartnerState: (
    partnerId: AuthPartnerId,
    state: string,
    error?: string
  ) => void;

  // ==========================================================================
  // METHODS (stable references) - NEVER RE-RENDERS
  // ==========================================================================

  hasRole: (role: string) => Promise<boolean>;
  hasTier: (tier: string) => Promise<boolean>;
  hasFeature: (feature: string) => Promise<boolean>;
  getCustomClaims: () => Record<string, unknown>;
  getCustomClaim: (claim: string) => unknown;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<AuthResult | null>;
  createUserWithEmail: (
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ) => Promise<AuthResult | null>;
  signInWithPartner: (
    partnerId: AuthPartnerId,
    method?: string
  ) => Promise<AuthResult | null>;
  linkWithPartner: (
    partnerId: AuthPartnerId,
    method?: string
  ) => Promise<AuthResult | null>;
  signInWithGoogleCredential: (
    credential: string
  ) => Promise<AuthResult | null>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  verifyPasswordResetCode: (code: string) => Promise<string | null>;
  confirmPasswordReset: (code: string, newPassword: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  getEmailVerificationStatus: () => Promise<{ status: string }>;
  isEmailVerificationEnabled: () => Promise<boolean>;
  sendSignInLinkToEmail: (email: string, settings?: any) => Promise<void>;
  signInWithEmailLink: (
    email: string,
    link?: string
  ) => Promise<AuthResult | null>;
  isSignInWithEmailLink: (link?: string) => boolean;
  getCurrentUser: () => Promise<AuthUser | null>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  reauthenticateWithProvider: (
    partnerId: AuthPartnerId,
    method?: AuthMethod
  ) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  setRememberMe: (remember: boolean) => Promise<void>;

  // ==========================================================================
  // COMPUTED VALUES (derived from state) - REACTIVE
  // ==========================================================================

  isAuthenticated: boolean;
  userRole: string;
  userTier: string;

  // ==========================================================================
  // PROPERTY-BASED ACCESS CONTROL (2026 pattern)
  // ==========================================================================

  /**
   * Capability-based access control object.
   * Usage: `const can = useAuth('can'); if (can.edit('licenses')) { ... }`
   */
  can: CanAPI;

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  isAvailable: boolean;
}

/**
 * Capability-based access control API
 *
 * Provides granular permission checks based on resources and custom capabilities.
 * Permissions are derived from userProfile.permissions array (format: "resource:action")
 * and user role (admin bypasses all checks).
 *
 * @example
 * ```typescript
 * const can = useAuth('can');
 * if (can.view('dashboard')) { ... }
 * if (can.edit('licenses')) { ... }
 * if (can.perform('approve-budget', { amount: 5000 })) { ... }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.3
 * @author AMBROISE PARK Consulting
 */
export interface CanAPI {
  /** Check if user can navigate to a route (replaces canAccess) */
  navigate: (config: PageAuth | false) => boolean;
  /** Check if user can view a resource */
  view: (resource: string) => boolean;
  /** Check if user can edit a resource */
  edit: (resource: string) => boolean;
  /** Check if user can delete a resource */
  delete: (resource: string) => boolean;
  /** Check if user can create a resource */
  create: (resource: string) => boolean;
  /** Check custom capability with optional context */
  perform: (action: string, context?: Record<string, any>) => boolean;
  /** Check if user has specific permission string */
  has: (permission: string) => boolean;
}
