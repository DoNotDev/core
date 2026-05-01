// packages/core/types/src/auth/__tests__/serverAdapterContract.test.ts

/**
 * @fileoverview Contract tests for IServerAuthAdapter
 * @description Validates that any implementation of IServerAuthAdapter satisfies
 * the contract defined by the interface. Uses an in-memory mock adapter.
 *
 * @version 0.1.0
 * @since 0.5.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type {
  IServerAuthAdapter,
  ServerUserRecord,
  VerifiedToken,
} from '../serverAdapter';

// =============================================================================
// In-Memory Mock Adapter
// =============================================================================

/**
 * Minimal token payload stored in the mock token store.
 */
interface MockTokenPayload {
  uid: string;
  email?: string;
  claims?: Record<string, unknown>;
}

/**
 * In-memory implementation of IServerAuthAdapter for contract testing.
 * All state is held in plain Maps — no external dependencies.
 */
class MockServerAuthAdapter implements IServerAuthAdapter {
  /** token string → decoded payload */
  private readonly tokens = new Map<string, MockTokenPayload>();
  /** uid → user record */
  private readonly users = new Map<string, ServerUserRecord>();

  /** Register a valid token so verifyToken() can resolve it. */
  registerToken(token: string, payload: MockTokenPayload): void {
    this.tokens.set(token, payload);
  }

  /** Seed a user so getUser() can find it. */
  registerUser(user: ServerUserRecord): void {
    this.users.set(user.uid, { ...user });
  }

  // ---------------------------------------------------------------------------
  // IServerAuthAdapter implementation
  // ---------------------------------------------------------------------------

  async verifyToken(token: string): Promise<VerifiedToken> {
    const payload = this.tokens.get(token);
    if (!payload) {
      throw new Error('Invalid or expired token');
    }
    const result: VerifiedToken = { uid: payload.uid };
    if (payload.email !== undefined) result.email = payload.email;
    if (payload.claims !== undefined) result.claims = payload.claims;
    return result;
  }

  async getUser(uid: string): Promise<ServerUserRecord | null> {
    return this.users.get(uid) ?? null;
  }

  async setCustomClaims(
    uid: string,
    claims: Record<string, unknown>
  ): Promise<void> {
    const user = this.users.get(uid);
    if (!user) return;
    user.customClaims = { ...(user.customClaims ?? {}), ...claims };
    this.users.set(uid, user);
  }
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('IServerAuthAdapter contract', () => {
  let adapter: MockServerAuthAdapter;

  beforeEach(() => {
    adapter = new MockServerAuthAdapter();
  });

  // 1. Type satisfaction
  it('mock adapter satisfies IServerAuthAdapter type', () => {
    const typed: IServerAuthAdapter = adapter;
    expect(typeof typed.verifyToken).toBe('function');
    expect(typeof typed.getUser).toBe('function');
    expect(typeof typed.setCustomClaims).toBe('function');
  });

  // ---------------------------------------------------------------------------
  // verifyToken
  // ---------------------------------------------------------------------------

  describe('verifyToken()', () => {
    // 2. Returns VerifiedToken with uid
    it('returns VerifiedToken with uid', async () => {
      adapter.registerToken('tok-uid', { uid: 'user-1' });

      const result = await adapter.verifyToken('tok-uid');

      expect(result).toHaveProperty('uid', 'user-1');
    });

    // 3. Includes email when present in token
    it('returns VerifiedToken with email when token contains email', async () => {
      adapter.registerToken('tok-email', {
        uid: 'user-2',
        email: 'user2@example.com',
      });

      const result = await adapter.verifyToken('tok-email');

      expect(result.uid).toBe('user-2');
      expect(result.email).toBe('user2@example.com');
    });

    // 4. Includes claims when present in token
    it('returns VerifiedToken with claims when token contains claims', async () => {
      adapter.registerToken('tok-claims', {
        uid: 'user-3',
        claims: { role: 'admin', plan: 'pro' },
      });

      const result = await adapter.verifyToken('tok-claims');

      expect(result.uid).toBe('user-3');
      expect(result.claims).toEqual({ role: 'admin', plan: 'pro' });
    });

    // 5. Throws on invalid / expired token
    it('throws on invalid or expired token', async () => {
      await expect(adapter.verifyToken('not-a-real-token')).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getUser
  // ---------------------------------------------------------------------------

  describe('getUser()', () => {
    // 6. Returns ServerUserRecord for known uid
    it('returns ServerUserRecord for a known uid', async () => {
      adapter.registerUser({
        uid: 'user-10',
        email: 'user10@example.com',
        displayName: 'User Ten',
      });

      const result = await adapter.getUser('user-10');

      expect(result).not.toBeNull();
      expect(result?.uid).toBe('user-10');
      expect(result?.email).toBe('user10@example.com');
      expect(result?.displayName).toBe('User Ten');
    });

    // 7. Returns null for unknown uid
    it('returns null for unknown uid', async () => {
      const result = await adapter.getUser('nonexistent-uid');

      expect(result).toBeNull();
    });

    // 8. Includes customClaims when set on the user
    it('returns customClaims when present on the user record', async () => {
      adapter.registerUser({
        uid: 'user-11',
        customClaims: { role: 'moderator' },
      });

      const result = await adapter.getUser('user-11');

      expect(result?.customClaims).toEqual({ role: 'moderator' });
    });
  });

  // ---------------------------------------------------------------------------
  // setCustomClaims
  // ---------------------------------------------------------------------------

  describe('setCustomClaims()', () => {
    // 9. Resolves without error
    it('resolves without throwing', async () => {
      adapter.registerUser({ uid: 'user-20' });

      await expect(
        adapter.setCustomClaims('user-20', { plan: 'free' })
      ).resolves.toBeUndefined();
    });

    // 10. Merges with existing claims (verify via getUser)
    it('merges new claims with existing claims', async () => {
      adapter.registerUser({
        uid: 'user-21',
        customClaims: { role: 'editor' },
      });

      await adapter.setCustomClaims('user-21', { plan: 'pro' });

      const user = await adapter.getUser('user-21');
      expect(user?.customClaims).toEqual({ role: 'editor', plan: 'pro' });
    });

    it('overwrites an existing claim key when the same key is provided', async () => {
      adapter.registerUser({
        uid: 'user-22',
        customClaims: { role: 'editor' },
      });

      await adapter.setCustomClaims('user-22', { role: 'admin' });

      const user = await adapter.getUser('user-22');
      expect(user?.customClaims?.role).toBe('admin');
    });
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  describe('error propagation', () => {
    // 11. Errors from verifyToken propagate to the caller
    it('verifyToken() error propagates to caller', async () => {
      const spy = vi
        .spyOn(adapter, 'verifyToken')
        .mockRejectedValueOnce(new Error('token-expired'));

      await expect(adapter.verifyToken('any')).rejects.toThrow('token-expired');

      spy.mockRestore();
    });

    it('getUser() error propagates to caller', async () => {
      const spy = vi
        .spyOn(adapter, 'getUser')
        .mockRejectedValueOnce(new Error('db-unavailable'));

      await expect(adapter.getUser('user-1')).rejects.toThrow('db-unavailable');

      spy.mockRestore();
    });

    it('setCustomClaims() error propagates to caller', async () => {
      const spy = vi
        .spyOn(adapter, 'setCustomClaims')
        .mockRejectedValueOnce(new Error('write-failed'));

      await expect(adapter.setCustomClaims('user-1', {})).rejects.toThrow(
        'write-failed'
      );

      spy.mockRestore();
    });
  });
});
