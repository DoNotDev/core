// packages/core/stores/src/templates/__tests__/languageStore.test.ts

/**
 * @fileoverview Tests for languageStore
 * @description Unit tests for language state management, RTL detection, and i18n sync.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS - must be before imports that use them
// ============================================================================

vi.mock('@donotdev/utils', () => ({
  isClient: vi.fn(() => true),
  isDev: vi.fn(() => false),
  handleError: vi.fn((error: unknown) => {
    const err =
      error instanceof Error ? error : new Error(String(error || 'Unknown'));
    return Object.assign(err, { message: err.message });
  }),
  getGlobalSingleton: (() => {
    const cache = new Map();
    return vi.fn((key: string, factory: any) => {
      if (!cache.has(key)) cache.set(key, factory());
      return cache.get(key);
    });
  })(),
}));

vi.mock('@donotdev/types', async () => {
  const actual = await vi.importActual('@donotdev/types');
  return { ...actual };
});

// Import after mocks
import type { LanguageData } from '@donotdev/types';

import { useLanguageStore } from '../languageStore';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const LANGUAGES: LanguageData[] = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'French' },
  { id: 'ar', name: 'Arabic' },
] as LanguageData[];

// ============================================================================
// HELPERS
// ============================================================================

function resetStore() {
  // Clear the singleton cache so each test gets a fresh state
  if (typeof globalThis !== 'undefined' && globalThis._DNDEV_STORES_) {
    delete globalThis._DNDEV_STORES_['language'];
  }
  useLanguageStore.setState({
    currentLanguage: 'en',
    availableLanguages: [],
    isRTL: false,
    isReady: false,
    isLoading: false,
    error: null,
  });
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();

  // Mock localStorage
  const storage: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      }),
      get length() {
        return Object.keys(storage).length;
      },
      key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// INITIAL STATE
// ============================================================================

describe('useLanguageStore - initial state', () => {
  it('has correct defaults', () => {
    const state = useLanguageStore.getState();
    expect(state.currentLanguage).toBe('en');
    expect(state.availableLanguages).toEqual([]);
    expect(state.isRTL).toBe(false);
    expect(state.isReady).toBe(false);
  });
});

// ============================================================================
// setAvailableLanguages
// ============================================================================

describe('setAvailableLanguages', () => {
  it('sets available languages array', () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    expect(useLanguageStore.getState().availableLanguages).toEqual(LANGUAGES);
  });

  it('replaces previously set languages', () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    const newLangs: LanguageData[] = [
      { id: 'de', name: 'German' },
    ] as LanguageData[];
    useLanguageStore.getState().setAvailableLanguages(newLangs);
    expect(useLanguageStore.getState().availableLanguages).toEqual(newLangs);
  });

  it('accepts empty array', () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    useLanguageStore.getState().setAvailableLanguages([]);
    expect(useLanguageStore.getState().availableLanguages).toEqual([]);
  });
});

// ============================================================================
// setLanguage
// ============================================================================

describe('setLanguage', () => {
  it('changes current language', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('fr');
    expect(useLanguageStore.getState().currentLanguage).toBe('fr');
  });

  it('sets isRTL to true for Arabic', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('ar');
    expect(useLanguageStore.getState().isRTL).toBe(true);
  });

  it('sets isRTL to false for non-RTL language', async () => {
    useLanguageStore.setState({ isRTL: true, currentLanguage: 'ar' });
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('en');
    expect(useLanguageStore.getState().isRTL).toBe(false);
  });

  it('warns for invalid language and does not change state', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('xx');
    expect(useLanguageStore.getState().currentLanguage).toBe('en');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid language'),
      'xx'
    );
    warnSpy.mockRestore();
  });

  it('skips update when language is already current', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    useLanguageStore.setState({ currentLanguage: 'fr' });
    // Should be a no-op
    await useLanguageStore.getState().setLanguage('fr');
    expect(useLanguageStore.getState().currentLanguage).toBe('fr');
  });

  it('allows any language when availableLanguages is empty', async () => {
    // No available languages = no validation
    await useLanguageStore.getState().setLanguage('zz');
    expect(useLanguageStore.getState().currentLanguage).toBe('zz');
  });

  it('updates DOM lang attribute', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('updates DOM dir attribute to rtl for Arabic', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('updates DOM dir attribute to ltr for non-RTL', async () => {
    useLanguageStore.getState().setAvailableLanguages(LANGUAGES);
    await useLanguageStore.getState().setLanguage('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

// ============================================================================
// RTL DETECTION
// ============================================================================

describe('RTL detection via setLanguage', () => {
  const rtlCodes = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ku', 'dv'];

  for (const code of rtlCodes) {
    it(`detects ${code} as RTL`, async () => {
      // Allow any language (no availableLanguages restriction)
      await useLanguageStore.getState().setLanguage(code);
      expect(useLanguageStore.getState().isRTL).toBe(true);
    });
  }

  it('detects BCP-47 subtag as RTL (ar-SA)', async () => {
    await useLanguageStore.getState().setLanguage('ar-SA');
    expect(useLanguageStore.getState().isRTL).toBe(true);
  });

  it('detects en as LTR', async () => {
    await useLanguageStore.getState().setLanguage('en');
    expect(useLanguageStore.getState().isRTL).toBe(false);
  });
});

// ============================================================================
// INITIALIZE
// ============================================================================

describe('initialize', () => {
  it('sets isReady to true on success', async () => {
    const result = await useLanguageStore.getState().initialize({
      supportedLanguages: LANGUAGES,
    });
    expect(result).toBe(true);
    expect(useLanguageStore.getState().isReady).toBe(true);
  });

  it('sets available languages from init data', async () => {
    await useLanguageStore.getState().initialize({
      supportedLanguages: LANGUAGES,
    });
    expect(useLanguageStore.getState().availableLanguages).toEqual(LANGUAGES);
  });

  it('uses fallback language when no i18n and no persisted preference', async () => {
    await useLanguageStore.getState().initialize({
      supportedLanguages: LANGUAGES,
      fallbackLanguage: 'fr',
    });
    expect(useLanguageStore.getState().currentLanguage).toBe('fr');
  });

  it('defaults to en when no fallback specified', async () => {
    await useLanguageStore.getState().initialize({
      supportedLanguages: LANGUAGES,
    });
    expect(useLanguageStore.getState().currentLanguage).toBe('en');
  });

  it('syncs i18n instance language on init', async () => {
    const mockI18n = {
      language: 'fr',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    await useLanguageStore.getState().initialize({
      i18n: mockI18n,
      supportedLanguages: LANGUAGES,
    });

    expect(useLanguageStore.getState().currentLanguage).toBe('fr');
  });

  it('subscribes to i18next languageChanged event', async () => {
    const mockI18n = {
      language: 'en',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    await useLanguageStore.getState().initialize({
      i18n: mockI18n,
      supportedLanguages: LANGUAGES,
    });

    expect(mockI18n.on).toHaveBeenCalledWith(
      'languageChanged',
      expect.any(Function)
    );
  });

  it('works with no data', async () => {
    const result = await useLanguageStore.getState().initialize();
    expect(result).toBe(true);
    expect(useLanguageStore.getState().isReady).toBe(true);
  });

  it('works with empty supported languages', async () => {
    const result = await useLanguageStore.getState().initialize({
      supportedLanguages: [],
    });
    expect(result).toBe(true);
  });
});
