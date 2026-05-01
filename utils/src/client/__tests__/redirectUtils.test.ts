import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock platformDetection
vi.mock('../platformDetection', () => ({
  isClient: vi.fn(() => true),
}));

// Mock errors module to prevent side effects
vi.mock('../errors', () => ({
  handleError: vi.fn(),
}));

import { isClient } from '../platformDetection';
import {
  redirectToExternalUrl,
  canRedirectExternally,
  getCurrentOrigin,
} from '../redirectUtils';

const mockIsClient = vi.mocked(isClient);

// Use a URL that will never match happy-dom's default origin
const EXTERNAL_URL = 'https://stripe.com/checkout/abc123';

describe('redirectUtils', () => {
  beforeEach(() => {
    mockIsClient.mockReturnValue(true);
    vi.restoreAllMocks();
    // Re-apply mock after restoreAllMocks
    mockIsClient.mockReturnValue(true);
  });

  describe('canRedirectExternally', () => {
    it('returns true when window is defined', () => {
      expect(canRedirectExternally()).toBe(true);
    });
  });

  describe('getCurrentOrigin', () => {
    it('returns window.location.origin on client', () => {
      const origin = getCurrentOrigin();
      expect(typeof origin).toBe('string');
    });

    it('returns null when not client', () => {
      mockIsClient.mockReturnValue(false);
      expect(getCurrentOrigin()).toBeNull();
    });
  });

  describe('redirectToExternalUrl', () => {
    it('throws when not client (SSR)', async () => {
      mockIsClient.mockReturnValue(false);
      await expect(redirectToExternalUrl(EXTERNAL_URL)).rejects.toThrow(
        'not available on the server'
      );
    });

    it('throws for same-origin URL', async () => {
      const sameOriginUrl = window.location.origin + '/path';
      await expect(redirectToExternalUrl(sameOriginUrl)).rejects.toThrow(
        'same origin'
      );
    });

    it('throws for non-http protocol', async () => {
      await expect(
        redirectToExternalUrl('ftp://external-server.com/file')
      ).rejects.toThrow('Only HTTP and HTTPS');
    });

    it('throws for invalid URL', async () => {
      await expect(redirectToExternalUrl('not-a-url')).rejects.toThrow(
        'Invalid redirect URL'
      );
    });

    it('does not throw for valid external URL', async () => {
      await expect(
        redirectToExternalUrl(EXTERNAL_URL)
      ).resolves.toBeUndefined();
    });

    it('calls window.open with openInNewTab', async () => {
      const mockOpen = vi.fn(() => ({}) as Window);
      window.open = mockOpen;

      // Skip URL validation to isolate window.open behavior
      await redirectToExternalUrl(EXTERNAL_URL, {
        openInNewTab: true,
        validateUrl: false,
      });
      expect(mockOpen).toHaveBeenCalledWith(
        EXTERNAL_URL,
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('throws when popup is blocked (window.open returns null)', async () => {
      window.open = vi.fn(() => null);

      await expect(
        redirectToExternalUrl(EXTERNAL_URL, {
          openInNewTab: true,
          validateUrl: false,
        })
      ).rejects.toThrow('popup');
    });

    it('skips validation when validateUrl is false', async () => {
      // Same-origin URL would fail validation, but we skip it
      const sameOriginUrl = window.location.origin + '/path';
      await expect(
        redirectToExternalUrl(sameOriginUrl, { validateUrl: false })
      ).resolves.toBeUndefined();
    });
  });
});
