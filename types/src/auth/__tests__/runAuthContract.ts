// packages/core/types/src/auth/__tests__/runAuthContract.ts

/**
 * @fileoverview Reusable AuthProvider Contract Runner
 * @description Extracted from providerContract.test.ts. Call `runAuthContract()`
 * to verify any AuthProvider implementation against the full behavioral contract.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AuthProvider, UnsubscribeFn } from '../types';
import type { AuthUser } from '../schemas';
import type { UserRole } from '../constants';

// =============================================================================
// Contract Runner Types
// =============================================================================

/**
 * Context returned by the factory for each test run.
 * The provider must support seeding test data for the contract to exercise all paths.
 */
export interface AuthContractContext {
  provider: AuthProvider & {
    seedUser(user: AuthUser, password: string, token?: string): void;
    seedRoles?(roles: string[]): void;
    seedFeatures?(features: string[]): void;
    seedTier?(tier: string): void;
    reset(): void;
  };
}

// =============================================================================
// Shared test fixtures
// =============================================================================

const TEST_USER: AuthUser = {
  id: 'user-abc-123',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  role: 'user',
};

const TEST_PASSWORD = 's3cr3tP@ssword';
const TEST_TOKEN = 'access-token-xyz';

// =============================================================================
// Contract Runner
// =============================================================================

/**
 * Runs the full AuthProvider behavioral contract against any implementation.
 *
 * @param label - Suite label (e.g. "MockAuthProvider", "FirebaseAuth")
 * @param factory - Returns a fresh auth context per test. Called in beforeEach.
 *
 * @example
 * ```ts
 * import { runAuthContract } from './runAuthContract';
 * import { MockAuthProvider } from './MockAuthProvider';
 *
 * runAuthContract('MockAuthProvider', () => ({
 *   provider: new MockAuthProvider(),
 * }));
 * ```
 */
export function runAuthContract(
  label: string,
  factory: () => AuthContractContext
): void {
  describe(`AuthProvider contract — ${label}`, () => {
    let provider: AuthContractContext['provider'];

    beforeEach(() => {
      const ctx = factory();
      provider = ctx.provider;
      provider.reset();
    });

    // -------------------------------------------------------------------------
    // 1. Type satisfaction
    // -------------------------------------------------------------------------

    it('satisfies the AuthProvider type', () => {
      const typed: AuthProvider = provider;
      expect(typed).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // 2. initialize()
    // -------------------------------------------------------------------------

    describe('initialize()', () => {
      it('resolves without throwing', async () => {
        await expect(provider.initialize()).resolves.toBeUndefined();
      });

      it('returns a Promise', () => {
        const result = provider.initialize();
        expect(result).toBeInstanceOf(Promise);
      });
    });

    // -------------------------------------------------------------------------
    // 3. getCurrentUser()
    // -------------------------------------------------------------------------

    describe('getCurrentUser()', () => {
      it('returns null when no user is signed in', async () => {
        const user = await provider.getCurrentUser();
        expect(user).toBeNull();
      });

      it('returns AuthUser when a user is signed in', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const user = await provider.getCurrentUser();
        expect(user).not.toBeNull();
        expect(user?.id).toBe(TEST_USER.id);
        expect(user?.email).toBe(TEST_USER.email);
      });
    });

    // -------------------------------------------------------------------------
    // 4. signInWithEmailAndPassword()
    // -------------------------------------------------------------------------

    describe('signInWithEmailAndPassword()', () => {
      beforeEach(() => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
      });

      it('returns AuthUser on valid credentials', async () => {
        const user = await provider.signInWithEmailAndPassword(
          TEST_USER.email!,
          TEST_PASSWORD
        );
        expect(user).toBeDefined();
        expect(user.id).toBe(TEST_USER.id);
        expect(user.email).toBe(TEST_USER.email);
      });

      it('returned value has required AuthUser shape (id is string)', async () => {
        const user = await provider.signInWithEmailAndPassword(
          TEST_USER.email!,
          TEST_PASSWORD
        );
        expect(typeof user.id).toBe('string');
        expect(user.id.length).toBeGreaterThan(0);
      });

      it('throws on wrong password', async () => {
        await expect(
          provider.signInWithEmailAndPassword(TEST_USER.email!, 'wrong')
        ).rejects.toThrow();
      });

      it('throws on unknown email', async () => {
        await expect(
          provider.signInWithEmailAndPassword(
            'nobody@example.com',
            TEST_PASSWORD
          )
        ).rejects.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // 5. createUserWithEmailAndPassword()
    // -------------------------------------------------------------------------

    describe('createUserWithEmailAndPassword()', () => {
      it('returns a new AuthUser', async () => {
        const user = await provider.createUserWithEmailAndPassword(
          'new@example.com',
          'newPass123'
        );
        expect(user).toBeDefined();
        expect(typeof user.id).toBe('string');
        expect(user.email).toBe('new@example.com');
      });

      it('throws when email already in use', async () => {
        await provider.createUserWithEmailAndPassword(
          'dup@example.com',
          'pass'
        );
        await expect(
          provider.createUserWithEmailAndPassword('dup@example.com', 'pass2')
        ).rejects.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // 6. signOut()
    // -------------------------------------------------------------------------

    describe('signOut()', () => {
      it('resolves without throwing', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        await expect(provider.signOut()).resolves.toBeUndefined();
      });

      it('clears current user after sign-out', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        await provider.signOut();
        const user = await provider.getCurrentUser();
        expect(user).toBeNull();
      });

      it('resolves even when no user is signed in', async () => {
        await expect(provider.signOut()).resolves.toBeUndefined();
      });
    });

    // -------------------------------------------------------------------------
    // 7. sendPasswordResetEmail()
    // -------------------------------------------------------------------------

    describe('sendPasswordResetEmail()', () => {
      it('resolves without throwing', async () => {
        await expect(
          provider.sendPasswordResetEmail('reset@example.com')
        ).resolves.toBeUndefined();
      });

      it('returns a Promise', () => {
        const result = provider.sendPasswordResetEmail('x@example.com');
        expect(result).toBeInstanceOf(Promise);
      });
    });

    // -------------------------------------------------------------------------
    // 8. updateUserProfile()
    // -------------------------------------------------------------------------

    describe('updateUserProfile()', () => {
      beforeEach(() => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
      });

      it('resolves without throwing', async () => {
        await expect(
          provider.updateUserProfile({ displayName: 'Updated' })
        ).resolves.toBeUndefined();
      });

      it('applies partial updates to the current user', async () => {
        await provider.updateUserProfile({ displayName: 'New Name' });
        const user = await provider.getCurrentUser();
        expect(user?.displayName).toBe('New Name');
        expect(user?.email).toBe(TEST_USER.email);
      });

      it('throws when no user is signed in', async () => {
        await provider.signOut();
        await expect(
          provider.updateUserProfile({ displayName: 'Ghost' })
        ).rejects.toThrow();
      });
    });

    // -------------------------------------------------------------------------
    // 9. getAccessToken()
    // -------------------------------------------------------------------------

    describe('getAccessToken()', () => {
      it('returns null when no session exists', async () => {
        const token = await provider.getAccessToken();
        expect(token).toBeNull();
      });

      it('returns a string token when a user is signed in', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const token = await provider.getAccessToken();
        expect(typeof token).toBe('string');
        expect((token as string).length).toBeGreaterThan(0);
      });

      it('returns null after sign-out', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        await provider.signOut();
        const token = await provider.getAccessToken();
        expect(token).toBeNull();
      });
    });

    // -------------------------------------------------------------------------
    // 10. refreshToken()
    // -------------------------------------------------------------------------

    describe('refreshToken()', () => {
      it('returns null when no user is signed in', async () => {
        const token = await provider.refreshToken();
        expect(token).toBeNull();
      });

      it('returns a string when a user is signed in', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const token = await provider.refreshToken();
        expect(typeof token).toBe('string');
        expect((token as string).length).toBeGreaterThan(0);
      });

      it('refreshed token differs from the original', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const original = await provider.getAccessToken();
        const refreshed = await provider.refreshToken();
        expect(refreshed).not.toBe(original);
      });
    });

    // -------------------------------------------------------------------------
    // 11. onAuthStateChanged()
    // -------------------------------------------------------------------------

    describe('onAuthStateChanged()', () => {
      it('returns an unsubscribe function', () => {
        const unsub = provider.onAuthStateChanged(vi.fn());
        expect(typeof unsub).toBe('function');
        unsub();
      });

      it('calls the callback immediately with current user state', () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const callback = vi.fn();
        const unsub = provider.onAuthStateChanged(callback);

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_USER.id })
        );
        unsub();
      });

      it('calls the callback immediately with null when no user', () => {
        const callback = vi.fn();
        const unsub = provider.onAuthStateChanged(callback);

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(null);
        unsub();
      });

      it('notifies listener on sign-in', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const callback = vi.fn();
        const unsub = provider.onAuthStateChanged(callback);
        callback.mockClear();

        await provider.signInWithEmailAndPassword(
          TEST_USER.email!,
          TEST_PASSWORD
        );
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({ id: TEST_USER.id })
        );
        unsub();
      });

      it('notifies listener with null on sign-out', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const callback = vi.fn();
        const unsub = provider.onAuthStateChanged(callback);
        callback.mockClear();

        await provider.signOut();
        expect(callback).toHaveBeenCalledWith(null);
        unsub();
      });

      it('stops notifying after unsubscribe', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const callback = vi.fn();
        const unsub = provider.onAuthStateChanged(callback);
        callback.mockClear();

        unsub();
        await provider.signOut();
        expect(callback).not.toHaveBeenCalled();
      });

      it('supports multiple independent listeners', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        const unsub1 = provider.onAuthStateChanged(cb1);
        const unsub2 = provider.onAuthStateChanged(cb2);
        cb1.mockClear();
        cb2.mockClear();

        await provider.signOut();
        expect(cb1).toHaveBeenCalledWith(null);
        expect(cb2).toHaveBeenCalledWith(null);
        unsub1();
        unsub2();
      });
    });

    // -------------------------------------------------------------------------
    // 12. hasRole() / hasFeature() / hasTier()
    // -------------------------------------------------------------------------

    describe('hasRole()', () => {
      it('returns false when user has no roles', async () => {
        expect(await provider.hasRole('admin')).toBe(false);
      });

      it('returns true when user has the specified role', async () => {
        if (provider.seedRoles) provider.seedRoles(['user', 'admin']);
        else return;
        expect(await provider.hasRole('admin')).toBe(true);
      });

      it('returns false for a role the user does not have', async () => {
        if (provider.seedRoles) provider.seedRoles(['user']);
        else return;
        expect(await provider.hasRole('admin')).toBe(false);
      });

      it('always returns a boolean', async () => {
        const result = await provider.hasRole('super');
        expect(typeof result).toBe('boolean');
      });
    });

    describe('hasFeature()', () => {
      it('returns false when user has no features', async () => {
        expect(await provider.hasFeature('advanced_features')).toBe(false);
      });

      it('returns true when user has the specified feature', async () => {
        if (provider.seedFeatures)
          provider.seedFeatures(['advanced_features', 'export']);
        else return;
        expect(await provider.hasFeature('advanced_features')).toBe(true);
      });

      it('always returns a boolean', async () => {
        const result = await provider.hasFeature('any-feature');
        expect(typeof result).toBe('boolean');
      });
    });

    describe('hasTier()', () => {
      it('returns false when tier does not match', async () => {
        expect(await provider.hasTier('pro')).toBe(false);
      });

      it('returns true when tier matches', async () => {
        if (provider.seedTier) provider.seedTier('pro');
        else return;
        expect(await provider.hasTier('pro')).toBe(true);
      });

      it('always returns a boolean', async () => {
        const result = await provider.hasTier('premium');
        expect(typeof result).toBe('boolean');
      });
    });

    // -------------------------------------------------------------------------
    // 13. Error scenarios
    // -------------------------------------------------------------------------

    describe('Error scenarios', () => {
      it('signIn with wrong password throws', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        await expect(
          provider.signInWithEmailAndPassword(TEST_USER.email!, 'bad-password')
        ).rejects.toThrow();
      });

      it('signIn with unknown email throws', async () => {
        await expect(
          provider.signInWithEmailAndPassword('ghost@example.com', 'anypass')
        ).rejects.toThrow();
      });

      it('createUser with duplicate email throws', async () => {
        await provider.createUserWithEmailAndPassword(
          'existing@example.com',
          'pass1'
        );
        await expect(
          provider.createUserWithEmailAndPassword(
            'existing@example.com',
            'pass2'
          )
        ).rejects.toThrow();
      });

      it('updateUserProfile without signed-in user throws', async () => {
        await expect(
          provider.updateUserProfile({ displayName: 'Nobody' })
        ).rejects.toThrow();
      });

      it('thrown errors are instances of Error', async () => {
        provider.seedUser(TEST_USER, TEST_PASSWORD, TEST_TOKEN);
        const error = await provider
          .signInWithEmailAndPassword(TEST_USER.email!, 'bad')
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
}
