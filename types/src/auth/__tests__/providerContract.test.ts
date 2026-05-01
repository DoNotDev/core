// packages/core/types/src/auth/__tests__/providerContract.test.ts

/**
 * @fileoverview Contract tests for the AuthProvider interface
 * @description Verifies that any implementation of AuthProvider satisfies the
 * contract defined in auth/types.ts. Uses an in-memory mock provider as the
 * reference implementation under test.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  AuthProvider,
  UnsubscribeFn,
  AuthResult,
  AuthMethod,
} from '../types';
import type { AuthPartnerId } from '../../partners/schemas';
import type { AuthUser } from '../schemas';
import type { UserRole } from '../constants';

// =============================================================================
// In-Memory Mock AuthProvider
// =============================================================================

/**
 * Minimal in-memory AuthProvider implementation used to verify the contract.
 * Stores a single user and a simple credential registry.
 */
class MockAuthProvider implements AuthProvider {
  private currentUser: AuthUser | null = null;
  private accessToken: string | null = null;
  private credentials: Map<string, string> = new Map();
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private userRoles: Set<string> = new Set();
  private userFeatures: Set<string> = new Set();
  private userTier: string = 'free';

  // ---------------------------------------------------------------------------
  // Seed helpers (not part of the contract, used in test setup)
  // ---------------------------------------------------------------------------

  seedUser(user: AuthUser, password: string, token: string = 'mock-token') {
    if (user.email) {
      this.credentials.set(user.email, password);
    }
    this.currentUser = user;
    this.accessToken = token;
  }

  seedRoles(roles: string[]) {
    this.userRoles = new Set(roles);
  }

  seedFeatures(features: string[]) {
    this.userFeatures = new Set(features);
  }

  seedTier(tier: string) {
    this.userTier = tier;
  }

  reset() {
    this.currentUser = null;
    this.accessToken = null;
    this.credentials.clear();
    this.listeners.clear();
    this.userRoles.clear();
    this.userFeatures.clear();
    this.userTier = 'free';
  }

  // ---------------------------------------------------------------------------
  // AuthProvider contract
  // ---------------------------------------------------------------------------

  async initialize(): Promise<void> {
    // No-op for the mock; real providers may load persisted session here.
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.currentUser;
  }

  async signInWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<AuthUser> {
    const stored = this.credentials.get(email);
    if (!stored || stored !== password) {
      throw new Error('auth/invalid-credential');
    }
    if (!this.currentUser) {
      throw new Error('auth/user-not-found');
    }
    this.listeners.forEach((cb) => cb(this.currentUser));
    return this.currentUser;
  }

  async createUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<AuthUser> {
    if (this.credentials.has(email)) {
      throw new Error('auth/email-already-in-use');
    }
    const newUser: AuthUser = { id: `uid-${Date.now()}`, email };
    this.credentials.set(email, password);
    this.currentUser = newUser;
    this.accessToken = 'new-token';
    this.listeners.forEach((cb) => cb(this.currentUser));
    return newUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.accessToken = null;
    this.listeners.forEach((cb) => cb(null));
  }

  async sendPasswordResetEmail(_email: string): Promise<void> {
    // No-op for the mock; real providers send an email here.
  }

  async updateUserProfile(updates: Partial<AuthUser>): Promise<void> {
    if (!this.currentUser) {
      throw new Error('auth/no-current-user');
    }
    this.currentUser = { ...this.currentUser, ...updates };
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async refreshToken(): Promise<string | null> {
    if (!this.currentUser) return null;
    this.accessToken = `refreshed-${Date.now()}`;
    return this.accessToken;
  }

  onAuthStateChanged(callback: (user: AuthUser | null) => void): UnsubscribeFn {
    this.listeners.add(callback);
    // Immediately emit current state, matching Firebase semantics.
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }

  hasRole(role: UserRole): Promise<boolean> {
    return Promise.resolve(this.userRoles.has(role as string));
  }

  hasFeature(featureId: string): Promise<boolean> {
    return Promise.resolve(this.userFeatures.has(featureId));
  }

  hasTier(requiredTier: string): Promise<boolean> {
    return Promise.resolve(this.userTier === requiredTier);
  }

  // -------------------------------------------------------------------------
  // Extended API (AuthResult-returning and useAuth-specific) — stubs for contract
  // -------------------------------------------------------------------------

  async signInWithEmail(
    email: string,
    password: string
  ): Promise<AuthResult | null> {
    const user = await this.signInWithEmailAndPassword(email, password);
    return { user, success: true };
  }

  async createUserWithEmail(
    email: string,
    password: string
  ): Promise<AuthResult | null> {
    const user = await this.createUserWithEmailAndPassword(email, password);
    return { user, success: true, isNewUser: true };
  }

  async signInWithPartner(
    _partnerId: AuthPartnerId,
    _method?: AuthMethod
  ): Promise<AuthResult | null> {
    return null;
  }

  async linkWithPartner(
    _partnerId: AuthPartnerId,
    _method?: AuthMethod
  ): Promise<AuthResult | null> {
    return null;
  }

  async signInWithGoogleCredential(
    _credential: string
  ): Promise<AuthResult | null> {
    return null;
  }

  async updatePassword(_newPassword: string): Promise<void> {}

  async sendEmailVerification(): Promise<void> {}

  async sendSignInLinkToEmail(
    _email: string,
    _actionCodeSettings?: { url: string; handleCodeInApp: boolean }
  ): Promise<void> {}

  async signInWithEmailLink(
    _email: string,
    _emailLink?: string
  ): Promise<AuthResult | null> {
    return null;
  }

  isSignInWithEmailLink(_emailLink?: string): boolean {
    return false;
  }

  async getEmailVerificationStatus(): Promise<{ status: string }> {
    return { status: 'unknown' };
  }

  async isEmailVerificationEnabled(): Promise<boolean> {
    return false;
  }

  async reauthenticateWithPassword(_password: string): Promise<void> {}

  async reauthenticateWithProvider(
    _partnerId: AuthPartnerId,
    _method?: AuthMethod
  ): Promise<void> {}

  async deleteAccount(_password?: string): Promise<void> {}
}

// =============================================================================
// Run the reusable contract against the mock implementation
// =============================================================================

import { runAuthContract } from './runAuthContract';

runAuthContract('MockAuthProvider', () => ({
  provider: new MockAuthProvider(),
}));
