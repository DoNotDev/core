import { describe, it, expect } from 'vitest';

import { hasRoleAccess, getRoleFromClaims } from '../roleHierarchy';

describe('hasRoleAccess', () => {
  it('super can access all roles', () => {
    expect(hasRoleAccess('super', 'super')).toBe(true);
    expect(hasRoleAccess('super', 'admin')).toBe(true);
    expect(hasRoleAccess('super', 'user')).toBe(true);
    expect(hasRoleAccess('super', 'guest')).toBe(true);
  });

  it('admin can access admin, user, guest', () => {
    expect(hasRoleAccess('admin', 'admin')).toBe(true);
    expect(hasRoleAccess('admin', 'user')).toBe(true);
    expect(hasRoleAccess('admin', 'guest')).toBe(true);
  });

  it('admin cannot access super', () => {
    expect(hasRoleAccess('admin', 'super')).toBe(false);
  });

  it('user can access user and guest', () => {
    expect(hasRoleAccess('user', 'user')).toBe(true);
    expect(hasRoleAccess('user', 'guest')).toBe(true);
  });

  it('user cannot access admin or super', () => {
    expect(hasRoleAccess('user', 'admin')).toBe(false);
    expect(hasRoleAccess('user', 'super')).toBe(false);
  });

  it('guest can only access guest', () => {
    expect(hasRoleAccess('guest', 'guest')).toBe(true);
    expect(hasRoleAccess('guest', 'user')).toBe(false);
    expect(hasRoleAccess('guest', 'admin')).toBe(false);
  });

  it('returns false for undefined role', () => {
    expect(hasRoleAccess(undefined, 'user')).toBe(false);
  });

  it('returns false for unknown user role', () => {
    expect(hasRoleAccess('unknown', 'user')).toBe(false);
  });

  it('returns false for unknown required role', () => {
    expect(hasRoleAccess('admin', 'unknown')).toBe(false);
  });
});

describe('getRoleFromClaims', () => {
  it('returns super for role=super', () => {
    expect(getRoleFromClaims({ role: 'super' })).toBe('super');
  });

  it('returns super for isSuper=true', () => {
    expect(getRoleFromClaims({ isSuper: true })).toBe('super');
  });

  it('returns admin for role=admin', () => {
    expect(getRoleFromClaims({ role: 'admin' })).toBe('admin');
  });

  it('returns admin for isAdmin=true', () => {
    expect(getRoleFromClaims({ isAdmin: true })).toBe('admin');
  });

  it('returns user for role=user', () => {
    expect(getRoleFromClaims({ role: 'user' })).toBe('user');
  });

  it('returns user as default', () => {
    expect(getRoleFromClaims({})).toBe('user');
  });

  it('returns user for null claims', () => {
    expect(getRoleFromClaims(null as any)).toBe('user');
  });

  it('returns custom role if set', () => {
    expect(getRoleFromClaims({ role: 'moderator' })).toBe('moderator');
  });

  it('super takes priority over admin flags', () => {
    expect(getRoleFromClaims({ role: 'super', isAdmin: true })).toBe('super');
    expect(getRoleFromClaims({ isSuper: true, isAdmin: true })).toBe('super');
  });
});
