import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting — avoids TDZ
const {
  mockGetCookie,
  mockSetCookie,
  mockDeleteCookie,
  mockHandleError,
  mockIsClient,
  mockIsFeatureAvailable,
  mockIsDev,
} = vi.hoisted(() => ({
  mockGetCookie: vi.fn(),
  mockSetCookie: vi.fn(),
  mockDeleteCookie: vi.fn(),
  mockHandleError: vi.fn(),
  mockIsClient: vi.fn(() => true),
  mockIsFeatureAvailable: vi.fn((_feature: any) => true),
  mockIsDev: vi.fn(() => false),
}));

vi.mock('@donotdev/utils', () => ({
  getCookie: (key: string) => mockGetCookie(key),
  setCookie: (key: string, value: string, options?: any) =>
    mockSetCookie(key, value, options),
  deleteCookie: (key: string, options?: any) => mockDeleteCookie(key, options),
  handleError: (error: any, options?: any) => mockHandleError(error, options),
  isClient: () => mockIsClient(),
  isDev: () => mockIsDev(),
  isFeatureAvailable: (feature: any) => mockIsFeatureAvailable(feature),
  FRAMEWORK_FEATURES: {
    analytics: 'analytics',
    marketing: 'marketing',
    billing: 'billing',
  },
}));

import { useConsentStore, useFeatureConsent } from '../consentStore';

// Reset global store registry and store state between tests
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Default: client environment
  mockIsClient.mockReturnValue(true);

  // Default: no existing cookie
  mockGetCookie.mockReturnValue(null);

  // Simulate window.location for cookie secure flag
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = { location: { protocol: 'http:' } };
  }

  // Reset store to default state
  useConsentStore.setState({
    hasConsented: false,
    categories: { necessary: true },
    timestamp: null,
    version: '1.0',
    showBanner: false,
    isReady: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('consentStore', () => {
  describe('default state', () => {
    it('has correct initial values', () => {
      const state = useConsentStore.getState();

      expect(state.hasConsented).toBe(false);
      expect(state.categories).toEqual({ necessary: true });
      expect(state.timestamp).toBeNull();
      expect(state.version).toBe('1.0');
      expect(state.showBanner).toBe(false);
    });

    it('necessary category is always true', () => {
      const state = useConsentStore.getState();

      expect(state.categories.necessary).toBe(true);
    });

    it('optional categories are not present by default', () => {
      const state = useConsentStore.getState();

      expect(state.categories.functional).toBeUndefined();
      expect(state.categories.analytics).toBeUndefined();
      expect(state.categories.marketing).toBeUndefined();
    });
  });

  describe('showCookieBanner', () => {
    it('sets showBanner to true', () => {
      useConsentStore.getState().showCookieBanner();

      expect(useConsentStore.getState().showBanner).toBe(true);
    });
  });

  describe('acceptAll', () => {
    it('sets all categories to true', () => {
      useConsentStore.getState().acceptAll();

      const state = useConsentStore.getState();
      expect(state.categories.necessary).toBe(true);
      expect(state.categories.functional).toBe(true);
      expect(state.categories.analytics).toBe(true);
      expect(state.categories.marketing).toBe(true);
    });

    it('sets hasConsented to true', () => {
      useConsentStore.getState().acceptAll();

      expect(useConsentStore.getState().hasConsented).toBe(true);
    });

    it('sets a timestamp', () => {
      useConsentStore.getState().acceptAll();

      const state = useConsentStore.getState();
      expect(state.timestamp).not.toBeNull();
      expect(typeof state.timestamp).toBe('string');
      // Verify it's a valid ISO date
      expect(() => new Date(state.timestamp!)).not.toThrow();
    });

    it('hides the banner', () => {
      useConsentStore.setState({ showBanner: true });
      useConsentStore.getState().acceptAll();

      expect(useConsentStore.getState().showBanner).toBe(false);
    });

    it('persists consent to cookie', () => {
      useConsentStore.getState().acceptAll();

      expect(mockSetCookie).toHaveBeenCalledWith(
        'dndev-cookie-consent',
        expect.any(String),
        expect.objectContaining({
          expires: 365,
          sameSite: 'lax',
          path: '/',
        })
      );
    });
  });

  describe('declineAll', () => {
    it('sets optional categories to false', () => {
      useConsentStore.getState().declineAll();

      const state = useConsentStore.getState();
      expect(state.categories.necessary).toBe(true);
      expect(state.categories.functional).toBe(false);
      expect(state.categories.analytics).toBe(false);
      expect(state.categories.marketing).toBe(false);
    });

    it('sets hasConsented to true (user made a choice)', () => {
      useConsentStore.getState().declineAll();

      expect(useConsentStore.getState().hasConsented).toBe(true);
    });

    it('hides the banner', () => {
      useConsentStore.setState({ showBanner: true });
      useConsentStore.getState().declineAll();

      expect(useConsentStore.getState().showBanner).toBe(false);
    });

    it('persists consent to cookie', () => {
      useConsentStore.getState().declineAll();

      expect(mockSetCookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateCategory', () => {
    it('updates a single category', () => {
      useConsentStore.getState().updateCategory('analytics', true);

      expect(useConsentStore.getState().categories.analytics).toBe(true);
    });

    it('sets hasConsented to true', () => {
      useConsentStore.getState().updateCategory('functional', false);

      expect(useConsentStore.getState().hasConsented).toBe(true);
    });

    it('preserves other categories', () => {
      // Accept all first
      useConsentStore.getState().acceptAll();
      vi.clearAllMocks();

      // Then update only analytics
      useConsentStore.getState().updateCategory('analytics', false);

      const state = useConsentStore.getState();
      expect(state.categories.functional).toBe(true);
      expect(state.categories.analytics).toBe(false);
      expect(state.categories.marketing).toBe(true);
    });

    it('prevents modifying necessary category', () => {
      useConsentStore.getState().updateCategory('necessary', false);

      // necessary should still be true
      expect(useConsentStore.getState().categories.necessary).toBe(true);
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          userMessage: 'Cannot modify necessary category',
        })
      );
    });

    it('hides the banner after update', () => {
      useConsentStore.setState({ showBanner: true });
      useConsentStore.getState().updateCategory('marketing', true);

      expect(useConsentStore.getState().showBanner).toBe(false);
    });

    it('persists consent to cookie', () => {
      useConsentStore.getState().updateCategory('functional', true);

      expect(mockSetCookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasCategory', () => {
    it('returns true for necessary', () => {
      expect(useConsentStore.getState().hasCategory('necessary')).toBe(true);
    });

    it('returns false for unset optional categories', () => {
      expect(useConsentStore.getState().hasCategory('analytics')).toBe(false);
      expect(useConsentStore.getState().hasCategory('functional')).toBe(false);
      expect(useConsentStore.getState().hasCategory('marketing')).toBe(false);
    });

    it('returns true after accepting a category', () => {
      useConsentStore.getState().updateCategory('analytics', true);

      expect(useConsentStore.getState().hasCategory('analytics')).toBe(true);
    });

    it('returns false after declining a category', () => {
      useConsentStore.getState().updateCategory('analytics', true);
      useConsentStore.getState().updateCategory('analytics', false);

      expect(useConsentStore.getState().hasCategory('analytics')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets to default consent state', () => {
      // First accept all
      useConsentStore.getState().acceptAll();

      // Then reset
      useConsentStore.getState().reset();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.categories).toEqual({ necessary: true });
      expect(state.timestamp).toBeNull();
      expect(state.version).toBe('1.0');
    });

    it('deletes the consent cookie', () => {
      useConsentStore.getState().reset();

      expect(mockDeleteCookie).toHaveBeenCalledWith(
        'dndev-cookie-consent',
        expect.objectContaining({
          path: '/',
          sameSite: 'lax',
        })
      );
    });

    it('does not delete cookie on server', () => {
      mockIsClient.mockReturnValue(false);

      useConsentStore.getState().reset();

      expect(mockDeleteCookie).not.toHaveBeenCalled();
    });

    it('warns when cookie deletion fails (dev only)', () => {
      mockIsDev.mockReturnValue(true);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Simulate cookie still existing after deletion
      mockGetCookie.mockReturnValue('still-here');

      useConsentStore.getState().reset();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cookie deletion may have failed')
      );
      mockIsDev.mockReturnValue(false);
    });

    it('sets isReady to true after reset', () => {
      useConsentStore.getState().reset();

      expect(useConsentStore.getState().isReady).toBe(true);
    });
  });

  describe('saveConsent', () => {
    it('saves current state to cookie', () => {
      useConsentStore.getState().acceptAll();
      vi.clearAllMocks();

      useConsentStore.getState().saveConsent();

      expect(mockSetCookie).toHaveBeenCalledTimes(1);
      const savedData = JSON.parse(mockSetCookie.mock.calls[0]![1]!);
      expect(savedData.hasConsented).toBe(true);
      expect(savedData.categories.necessary).toBe(true);
    });

    it('does not save on server', () => {
      mockIsClient.mockReturnValue(false);

      useConsentStore.getState().saveConsent();

      expect(mockSetCookie).not.toHaveBeenCalled();
    });
  });

  describe('persistence - saveConsentCookie', () => {
    it('saves consent data as JSON', () => {
      useConsentStore.getState().acceptAll();

      const savedJson = mockSetCookie.mock.calls[0]![1]!;
      const parsed = JSON.parse(savedJson);

      expect(parsed.hasConsented).toBe(true);
      expect(parsed.categories.necessary).toBe(true);
      expect(parsed.categories.functional).toBe(true);
      expect(parsed.categories.analytics).toBe(true);
      expect(parsed.categories.marketing).toBe(true);
      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.version).toBe('1.0');
    });

    it('sets cookie with 365 day expiry', () => {
      useConsentStore.getState().acceptAll();

      expect(mockSetCookie).toHaveBeenCalledWith(
        'dndev-cookie-consent',
        expect.any(String),
        expect.objectContaining({ expires: 365 })
      );
    });

    it('sets secure flag based on protocol', () => {
      (globalThis as any).window = { location: { protocol: 'https:' } };
      useConsentStore.getState().acceptAll();

      expect(mockSetCookie).toHaveBeenCalledWith(
        'dndev-cookie-consent',
        expect.any(String),
        expect.objectContaining({ secure: true })
      );
    });

    it('does not set secure flag on http', () => {
      (globalThis as any).window = { location: { protocol: 'http:' } };
      useConsentStore.getState().acceptAll();

      expect(mockSetCookie).toHaveBeenCalledWith(
        'dndev-cookie-consent',
        expect.any(String),
        expect.objectContaining({ secure: false })
      );
    });

    it('verifies cookie was set and warns if not (dev only)', () => {
      mockIsDev.mockReturnValue(true);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockGetCookie.mockReturnValue(null); // Cookie not found after set

      useConsentStore.getState().acceptAll();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cookie may not have been set')
      );
      mockIsDev.mockReturnValue(false);
    });

    it('handles setCookie errors gracefully', () => {
      mockSetCookie.mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => useConsentStore.getState().acceptAll()).not.toThrow();
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          userMessage: 'Failed to save cookie preferences',
        })
      );
    });
  });

  describe('persistence - readConsentCookie (via initialize)', () => {
    it('loads saved consent from cookie on client', async () => {
      const savedConsent = {
        hasConsented: true,
        categories: {
          necessary: true,
          functional: true,
          analytics: false,
          marketing: true,
        },
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0',
      };
      mockGetCookie.mockReturnValue(JSON.stringify(savedConsent));

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(true);
      expect(state.categories.functional).toBe(true);
      expect(state.categories.analytics).toBe(false);
      expect(state.categories.marketing).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it('loads consent from SSR cookie value', async () => {
      mockIsClient.mockReturnValue(false);

      const savedConsent = {
        hasConsented: true,
        categories: {
          necessary: true,
          functional: false,
          analytics: true,
        },
        timestamp: '2025-06-01T00:00:00.000Z',
        version: '1.0',
      };

      await useConsentStore.getState().initialize({
        cookieValue: JSON.stringify(savedConsent),
      });

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(true);
      expect(state.categories.functional).toBe(false);
      expect(state.categories.analytics).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it('uses defaults when no cookie exists', async () => {
      mockGetCookie.mockReturnValue(null);

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.categories).toEqual({ necessary: true });
      expect(state.isReady).toBe(true);
    });

    it('sets isReady even on initialization failure', async () => {
      // Force an error in initialize by making setState throw
      const originalSetState = useConsentStore.setState;
      let callCount = 0;
      useConsentStore.setState = (...args: any[]) => {
        callCount++;
        // Throw on first call (inside initialize), but not on finally block
        if (callCount === 1) throw new Error('setState failed');
        return (originalSetState as any).apply(useConsentStore, args);
      };

      await useConsentStore.getState().initialize();

      // Restore
      useConsentStore.setState = originalSetState;

      expect(useConsentStore.getState().isReady).toBe(true);
    });
  });

  describe('edge cases - corrupted storage', () => {
    it('handles invalid JSON in cookie gracefully', async () => {
      mockGetCookie.mockReturnValue('not-valid-json{{{');

      await useConsentStore.getState().initialize();

      // Should fall back to defaults
      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.categories.necessary).toBe(true);
      expect(state.isReady).toBe(true);
    });

    it('handles non-object JSON in cookie', async () => {
      mockGetCookie.mockReturnValue('"just a string"');

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.isReady).toBe(true);
    });

    it('handles cookie with missing categories', async () => {
      const partialConsent = {
        hasConsented: true,
        categories: { necessary: true },
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0',
      };
      mockGetCookie.mockReturnValue(JSON.stringify(partialConsent));

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(true);
      expect(state.categories.necessary).toBe(true);
      // Missing categories should not be set
      expect(state.categories.functional).toBeUndefined();
      expect(state.categories.analytics).toBeUndefined();
    });

    it('handles corrupted SSR cookie value', async () => {
      mockIsClient.mockReturnValue(false);

      await useConsentStore.getState().initialize({
        cookieValue: '<<<corrupted>>>',
      });

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.isReady).toBe(true);
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          userMessage: 'Failed to parse SSR cookie value',
        })
      );
    });

    it('coerces truthy/falsy category values to booleans', async () => {
      const weirdConsent = {
        hasConsented: 1,
        categories: {
          necessary: true,
          functional: 1,
          analytics: 0,
          marketing: '',
        },
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0',
      };
      mockGetCookie.mockReturnValue(JSON.stringify(weirdConsent));

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(true);
      expect(state.categories.functional).toBe(true);
      expect(state.categories.analytics).toBe(false);
      expect(state.categories.marketing).toBe(false);
    });

    it('handles null cookie value in SSR', async () => {
      mockIsClient.mockReturnValue(false);

      await useConsentStore.getState().initialize({
        cookieValue: null,
      });

      const state = useConsentStore.getState();
      expect(state.hasConsented).toBe(false);
      expect(state.isReady).toBe(true);
    });
  });

  describe('edge cases - missing categories', () => {
    it('handles cookie with only some categories', async () => {
      const partialConsent = {
        hasConsented: true,
        categories: {
          necessary: true,
          analytics: true,
          // functional and marketing missing
        },
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0',
      };
      mockGetCookie.mockReturnValue(JSON.stringify(partialConsent));

      await useConsentStore.getState().initialize();

      const state = useConsentStore.getState();
      expect(state.categories.necessary).toBe(true);
      expect(state.categories.analytics).toBe(true);
      expect(state.categories.functional).toBeUndefined();
      expect(state.categories.marketing).toBeUndefined();
    });

    it('always ensures necessary is true regardless of cookie data', async () => {
      const badConsent = {
        hasConsented: true,
        categories: {
          necessary: false, // Trying to disable necessary
          analytics: true,
        },
        timestamp: '2025-01-01T00:00:00.000Z',
        version: '1.0',
      };
      mockGetCookie.mockReturnValue(JSON.stringify(badConsent));

      await useConsentStore.getState().initialize();

      // necessary is always forced to true in readConsentCookie
      expect(useConsentStore.getState().categories.necessary).toBe(true);
    });
  });

  describe('useFeatureConsent', () => {
    it('returns true for available framework features', () => {
      mockIsFeatureAvailable.mockReturnValue(true);

      expect(useFeatureConsent('analytics')).toBe(true);
      expect(mockIsFeatureAvailable).toHaveBeenCalledWith('analytics');
    });

    it('returns false for unavailable framework features', () => {
      mockIsFeatureAvailable.mockReturnValue(false);

      expect(useFeatureConsent('analytics')).toBe(false);
    });

    it('returns true for unknown features (no gating)', () => {
      expect(useFeatureConsent('unknown-feature')).toBe(true);
      expect(mockIsFeatureAvailable).not.toHaveBeenCalled();
    });
  });
});
