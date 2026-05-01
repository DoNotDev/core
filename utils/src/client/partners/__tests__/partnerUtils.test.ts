import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../appConfig', () => ({
  getPlatformEnvVar: vi.fn(),
  getOAuthRedirectUrl: vi.fn(() => 'http://localhost:3000/api/oauth/callback'),
  isDev: vi.fn(() => false),
}));

vi.mock('../../platformDetection', () => ({
  isClient: vi.fn(() => true),
}));

import { getPlatformEnvVar, getOAuthRedirectUrl } from '../../appConfig';
import {
  getValidAuthPartnerIds,
  getValidOAuthPartnerIds,
  getValidAuthPartnerConfig,
  getValidOAuthPartnerConfig,
  getEnabledAuthPartners,
  getEnabledOAuthPartners,
  getAuthPartnerConfig,
  getOAuthPartnerConfig,
  isAuthPartnerEnabled,
  isOAuthPartnerEnabled,
  getPartnerConfig,
  getOAuthClientId,
  getOAuthRedirectUri,
  clearPartnerCache,
  getPartnerCacheStatus,
  getAuthPartnerIdByFirebaseId,
} from '../partnerUtils';

const mockGetPlatformEnvVar = vi.mocked(getPlatformEnvVar);
const mockGetOAuthRedirectUrl = vi.mocked(getOAuthRedirectUrl);

describe('partnerUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPartnerCache();
    mockGetOAuthRedirectUrl.mockReturnValue(
      'http://localhost:3000/api/oauth/callback'
    );
  });

  // ── getValidAuthPartnerIds ──────────────────────────────────────────

  describe('getValidAuthPartnerIds', () => {
    it('returns an array of valid auth partner IDs', () => {
      const ids = getValidAuthPartnerIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('includes known auth partners', () => {
      const ids = getValidAuthPartnerIds();
      expect(ids).toContain('google');
      expect(ids).toContain('github');
      expect(ids).toContain('password');
      expect(ids).toContain('emailLink');
    });

    it('does not include non-existent partner IDs', () => {
      const ids = getValidAuthPartnerIds();
      expect(ids).not.toContain('nonexistent');
      expect(ids).not.toContain('');
    });
  });

  // ── getValidOAuthPartnerIds ─────────────────────────────────────────

  describe('getValidOAuthPartnerIds', () => {
    it('returns an array of valid OAuth partner IDs', () => {
      const ids = getValidOAuthPartnerIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('includes known OAuth partners', () => {
      const ids = getValidOAuthPartnerIds();
      expect(ids).toContain('google');
      expect(ids).toContain('github');
      expect(ids).toContain('discord');
      expect(ids).toContain('spotify');
    });

    it('does not include auth-only partners', () => {
      const ids = getValidOAuthPartnerIds();
      expect(ids).not.toContain('password');
      expect(ids).not.toContain('emailLink');
    });
  });

  // ── getValidAuthPartnerConfig ───────────────────────────────────────

  describe('getValidAuthPartnerConfig', () => {
    it('returns config for a valid auth partner', () => {
      const config = getValidAuthPartnerConfig('google');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Google');
      expect(config?.color).toBe('#4285F4');
      expect(config?.icon).toBe('google');
    });

    it('returns config with button properties', () => {
      const config = getValidAuthPartnerConfig('github');
      expect(config).toBeDefined();
      expect(config?.button).toBeDefined();
      expect(config?.button.backgroundColor).toBeDefined();
      expect(config?.button.textColor).toBeDefined();
    });

    it('returns undefined for unknown partner ID', () => {
      const config = getValidAuthPartnerConfig('nonexistent' as any);
      expect(config).toBeUndefined();
    });
  });

  // ── getValidOAuthPartnerConfig ──────────────────────────────────────

  describe('getValidOAuthPartnerConfig', () => {
    it('returns config for a valid OAuth partner', () => {
      const config = getValidOAuthPartnerConfig('github');
      expect(config).toBeDefined();
      expect(config?.name).toBe('GitHub');
      expect(config?.endpoints).toBeDefined();
      expect(config?.endpoints.authUrl).toBe(
        'https://github.com/login/oauth/authorize'
      );
    });

    it('returns config with scopes', () => {
      const config = getValidOAuthPartnerConfig('google');
      expect(config).toBeDefined();
      expect(config?.scopes).toBeDefined();
      expect(config?.scopes['api-access']).toBeDefined();
      expect(Array.isArray(config?.scopes['api-access'])).toBe(true);
    });

    it('returns undefined for unknown partner ID', () => {
      const config = getValidOAuthPartnerConfig('nonexistent' as any);
      expect(config).toBeUndefined();
    });
  });

  // ── getEnabledAuthPartners ──────────────────────────────────────────

  describe('getEnabledAuthPartners', () => {
    it('returns empty array when no AUTH_PARTNERS env var', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      const partners = getEnabledAuthPartners();
      expect(partners).toEqual([]);
    });

    it('returns enabled partners from env var', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,github');
      const partners = getEnabledAuthPartners();
      expect(partners).toContain('google');
      expect(partners).toContain('github');
    });

    it('trims whitespace and lowercases partner names', () => {
      mockGetPlatformEnvVar.mockReturnValue(' Google , GitHub ');
      const partners = getEnabledAuthPartners();
      expect(partners).toContain('google');
      expect(partners).toContain('github');
    });

    it('filters out invalid partner IDs from env var', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,invalid,github');
      const partners = getEnabledAuthPartners();
      expect(partners).toContain('google');
      expect(partners).toContain('github');
      expect(partners).not.toContain('invalid');
    });

    it('caches result after first call', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      const first = getEnabledAuthPartners();
      mockGetPlatformEnvVar.mockReturnValue('github');
      const second = getEnabledAuthPartners();
      expect(first).toBe(second);
      expect(first).toContain('google');
    });

    it('returns fresh result after cache clear', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      getEnabledAuthPartners();
      clearPartnerCache();
      mockGetPlatformEnvVar.mockReturnValue('github');
      const result = getEnabledAuthPartners();
      expect(result).toContain('github');
      expect(result).not.toContain('google');
    });

    it('returns empty array for empty env var string', () => {
      mockGetPlatformEnvVar.mockReturnValue('');
      const partners = getEnabledAuthPartners();
      expect(partners).toEqual([]);
    });
  });

  // ── getEnabledOAuthPartners ─────────────────────────────────────────

  describe('getEnabledOAuthPartners', () => {
    it('returns empty array when no OAUTH_PARTNERS env var', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      const partners = getEnabledOAuthPartners();
      expect(partners).toEqual([]);
    });

    it('returns enabled partners from env var', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,discord');
      const partners = getEnabledOAuthPartners();
      expect(partners).toContain('google');
      expect(partners).toContain('discord');
    });

    it('filters out invalid OAuth partner IDs', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,password,discord');
      const partners = getEnabledOAuthPartners();
      expect(partners).toContain('google');
      expect(partners).toContain('discord');
      expect(partners).not.toContain('password');
    });

    it('caches result after first call', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      const first = getEnabledOAuthPartners();
      mockGetPlatformEnvVar.mockReturnValue('discord');
      const second = getEnabledOAuthPartners();
      expect(first).toBe(second);
    });
  });

  // ── getAuthPartnerConfig / getOAuthPartnerConfig ────────────────────

  describe('getAuthPartnerConfig', () => {
    it('delegates to getValidAuthPartnerConfig', () => {
      const config = getAuthPartnerConfig('google');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Google');
    });

    it('returns undefined for unknown partner', () => {
      expect(getAuthPartnerConfig('unknown' as any)).toBeUndefined();
    });
  });

  describe('getOAuthPartnerConfig', () => {
    it('delegates to getValidOAuthPartnerConfig', () => {
      const config = getOAuthPartnerConfig('github');
      expect(config).toBeDefined();
      expect(config?.name).toBe('GitHub');
    });

    it('returns undefined for unknown partner', () => {
      expect(getOAuthPartnerConfig('unknown' as any)).toBeUndefined();
    });
  });

  // ── isAuthPartnerEnabled / isOAuthPartnerEnabled ────────────────────

  describe('isAuthPartnerEnabled', () => {
    it('returns true for an enabled auth partner', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,github');
      expect(isAuthPartnerEnabled('google')).toBe(true);
    });

    it('returns false for a disabled auth partner', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      expect(isAuthPartnerEnabled('github')).toBe(false);
    });

    it('returns false when no partners are enabled', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      expect(isAuthPartnerEnabled('google')).toBe(false);
    });
  });

  describe('isOAuthPartnerEnabled', () => {
    it('returns true for an enabled OAuth partner', () => {
      mockGetPlatformEnvVar.mockReturnValue('google,discord');
      expect(isOAuthPartnerEnabled('google')).toBe(true);
    });

    it('returns false for a disabled OAuth partner', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      expect(isOAuthPartnerEnabled('discord')).toBe(false);
    });

    it('returns false when no partners are enabled', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      expect(isOAuthPartnerEnabled('google')).toBe(false);
    });
  });

  // ── getPartnerConfig ────────────────────────────────────────────────

  describe('getPartnerConfig', () => {
    it('returns auth config for an auth partner ID', () => {
      const config = getPartnerConfig('password');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Email & Password');
    });

    it('returns OAuth config for an OAuth partner ID', () => {
      const config = getPartnerConfig('slack');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Slack');
    });

    it('returns config for partner that exists in both', () => {
      const config = getPartnerConfig('google');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Google');
    });

    it('returns undefined for unknown partner', () => {
      expect(getPartnerConfig('nonexistent' as any)).toBeUndefined();
    });
  });

  // ── getOAuthClientId ────────────────────────────────────────────────

  describe('getOAuthClientId', () => {
    it('returns partner-specific client ID from env', () => {
      mockGetPlatformEnvVar.mockImplementation((key: string) => {
        if (key === 'GITHUB_CLIENT_ID') return 'github-123';
        return undefined;
      });
      expect(getOAuthClientId('github')).toBe('github-123');
    });

    it('returns client ID for google', () => {
      mockGetPlatformEnvVar.mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'google-456';
        return undefined;
      });
      expect(getOAuthClientId('google')).toBe('google-456');
    });

    it('returns undefined when no env var is set', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      expect(getOAuthClientId('github')).toBeUndefined();
    });
  });

  // ── getOAuthRedirectUri ─────────────────────────────────────────────

  describe('getOAuthRedirectUri', () => {
    it('returns explicit redirect URI from env', () => {
      mockGetPlatformEnvVar.mockImplementation((key: string) => {
        if (key === 'GITHUB_REDIRECT_URI')
          return 'https://myapp.com/callback/github';
        return undefined;
      });
      expect(getOAuthRedirectUri('github')).toBe(
        'https://myapp.com/callback/github'
      );
    });

    it('falls back to framework default when no env var', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      expect(getOAuthRedirectUri('github')).toBe(
        'http://localhost:3000/api/oauth/callback'
      );
    });

    it('uses uppercase partner ID for env var lookup', () => {
      mockGetPlatformEnvVar.mockReturnValue(undefined);
      getOAuthRedirectUri('discord');
      expect(mockGetPlatformEnvVar).toHaveBeenCalledWith(
        'DISCORD_REDIRECT_URI'
      );
    });
  });

  // ── clearPartnerCache / getPartnerCacheStatus ───────────────────────

  describe('clearPartnerCache', () => {
    it('clears both auth and OAuth caches', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      getEnabledAuthPartners();
      clearPartnerCache();
      getEnabledOAuthPartners();
      clearPartnerCache();

      const status = getPartnerCacheStatus();
      expect(status.authPartnersCached).toBe(false);
      expect(status.oauthPartnersCached).toBe(false);
      expect(status.authPartners).toBeNull();
      expect(status.oauthPartners).toBeNull();
    });
  });

  describe('getPartnerCacheStatus', () => {
    it('reports uncached state initially', () => {
      const status = getPartnerCacheStatus();
      expect(status.authPartnersCached).toBe(false);
      expect(status.oauthPartnersCached).toBe(false);
    });

    it('reports cached state after getEnabledAuthPartners', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      getEnabledAuthPartners();
      const status = getPartnerCacheStatus();
      expect(status.authPartnersCached).toBe(true);
      expect(status.authPartners).toContain('google');
    });

    it('reports cached state after getEnabledOAuthPartners', () => {
      mockGetPlatformEnvVar.mockReturnValue('google');
      getEnabledOAuthPartners();
      const status = getPartnerCacheStatus();
      expect(status.oauthPartnersCached).toBe(true);
      expect(status.oauthPartners).toContain('google');
    });
  });

  // ── getAuthPartnerIdByFirebaseId ────────────────────────────────────

  describe('getAuthPartnerIdByFirebaseId', () => {
    it('returns partner ID for google.com', () => {
      expect(getAuthPartnerIdByFirebaseId('google.com')).toBe('google');
    });

    it('returns partner ID for github.com', () => {
      expect(getAuthPartnerIdByFirebaseId('github.com')).toBe('github');
    });

    it('returns partner ID for apple.com', () => {
      expect(getAuthPartnerIdByFirebaseId('apple.com')).toBe('apple');
    });

    it('returns partner ID for password', () => {
      expect(getAuthPartnerIdByFirebaseId('password')).toBe('password');
    });

    it('returns partner ID for emailLink', () => {
      expect(getAuthPartnerIdByFirebaseId('emailLink')).toBe('emailLink');
    });

    it('returns null for unknown firebase provider ID', () => {
      expect(getAuthPartnerIdByFirebaseId('unknown.com')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getAuthPartnerIdByFirebaseId('')).toBeNull();
    });
  });
});
