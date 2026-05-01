import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockStorage } from '../../../__tests__/test-utils';
import { isClient } from '../../platformDetection';
import { safeLocalStorage, safeSessionStorage } from '../safeStorage';

// Mock platformDetection (hoisted by vitest automatically)
vi.mock('../../platformDetection', () => ({
  isClient: vi.fn(() => true),
}));

const mockIsClient = vi.mocked(isClient);

describe('safeSessionStorage', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('sessionStorage', mockStorage);
    mockIsClient.mockReturnValue(true);
  });

  describe('getItem', () => {
    it('returns value from sessionStorage', () => {
      mockStorage.setItem('key', 'value');
      expect(safeSessionStorage.getItem('key')).toBe('value');
    });

    it('returns null when key does not exist', () => {
      expect(safeSessionStorage.getItem('missing')).toBeNull();
    });

    it('returns null when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      mockStorage.setItem('key', 'value');
      expect(safeSessionStorage.getItem('key')).toBeNull();
    });

    it('returns null when sessionStorage throws', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(safeSessionStorage.getItem('key')).toBeNull();
    });
  });

  describe('setItem', () => {
    it('stores value in sessionStorage', () => {
      safeSessionStorage.setItem('key', 'value');
      expect(mockStorage.getItem('key')).toBe('value');
    });

    it('no-op when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      safeSessionStorage.setItem('key', 'value');
      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('silently fails when sessionStorage throws', () => {
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => safeSessionStorage.setItem('key', 'value')).not.toThrow();
    });
  });

  describe('removeItem', () => {
    it('removes key from sessionStorage', () => {
      mockStorage.setItem('key', 'value');
      safeSessionStorage.removeItem('key');
      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('no-op when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      mockStorage.setItem('key', 'value');
      safeSessionStorage.removeItem('key');
      expect(mockStorage.getItem('key')).toBe('value');
    });

    it('silently fails when sessionStorage throws', () => {
      vi.spyOn(mockStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => safeSessionStorage.removeItem('key')).not.toThrow();
    });
  });
});

describe('safeLocalStorage', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    mockIsClient.mockReturnValue(true);
  });

  describe('getItem', () => {
    it('returns value from localStorage', () => {
      mockStorage.setItem('key', 'value');
      expect(safeLocalStorage.getItem('key')).toBe('value');
    });

    it('returns null when key does not exist', () => {
      expect(safeLocalStorage.getItem('missing')).toBeNull();
    });

    it('returns null when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      mockStorage.setItem('key', 'value');
      expect(safeLocalStorage.getItem('key')).toBeNull();
    });

    it('returns null when localStorage throws', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(safeLocalStorage.getItem('key')).toBeNull();
    });
  });

  describe('setItem', () => {
    it('stores value in localStorage', () => {
      safeLocalStorage.setItem('key', 'value');
      expect(mockStorage.getItem('key')).toBe('value');
    });

    it('no-op when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      safeLocalStorage.setItem('key', 'value');
      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('silently fails when localStorage throws', () => {
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => safeLocalStorage.setItem('key', 'value')).not.toThrow();
    });
  });

  describe('removeItem', () => {
    it('removes key from localStorage', () => {
      mockStorage.setItem('key', 'value');
      safeLocalStorage.removeItem('key');
      expect(mockStorage.getItem('key')).toBeNull();
    });

    it('no-op when not client (SSR)', () => {
      mockIsClient.mockReturnValue(false);
      mockStorage.setItem('key', 'value');
      safeLocalStorage.removeItem('key');
      expect(mockStorage.getItem('key')).toBe('value');
    });

    it('silently fails when localStorage throws', () => {
      vi.spyOn(mockStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => safeLocalStorage.removeItem('key')).not.toThrow();
    });
  });
});
