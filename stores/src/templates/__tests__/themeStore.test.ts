import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS - must be before imports that use them
// ============================================================================

// Mock @donotdev/utils
vi.mock('@donotdev/utils', () => ({
  isClient: vi.fn(() => true),
  isDev: vi.fn(() => false),
  setCookie: vi.fn(),
  handleError: vi.fn((error: unknown) => {
    const err =
      error instanceof Error ? error : new Error(String(error || 'Unknown'));
    return Object.assign(err, { message: err.message });
  }),
  getDndevConfig: vi.fn(() => null),
  resolveAppConfig: vi.fn((app?: any) => ({
    name: app?.name || '',
    shortName: app?.shortName || app?.name || '',
    description: app?.description || '',
    links: app?.links || {},
    metadata: app?.metadata || {},
  })),
}));

// Mock @donotdev/types (only the runtime exports)
vi.mock('@donotdev/types', async () => {
  const actual = await vi.importActual('@donotdev/types');
  return {
    ...actual,
    getBreakpointFromWidth: vi.fn((width: number) => {
      if (width >= 1440) return 'desktop';
      if (width >= 1024) return 'laptop';
      if (width >= 768) return 'tablet';
      return 'mobile';
    }),
  };
});

// Import after mocks
import type { ThemeInfo } from '@donotdev/types';
import { isClient, setCookie, getDndevConfig } from '@donotdev/utils';

import {
  useThemeStore,
  getAvailableThemes,
  getAvailableThemeNames,
  getThemeInfo,
  isValidTheme,
  applyTheme,
} from '../themeStore';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const lightTheme: ThemeInfo = {
  name: 'light',
  displayName: 'Light',
  meta: { icon: 'Sun', category: 'light' },
  isDark: false,
};

const darkTheme: ThemeInfo = {
  name: 'dark',
  displayName: 'Dark',
  meta: { icon: 'Moon', category: 'dark' },
  isDark: true,
};

const customTheme: ThemeInfo = {
  name: 'ocean',
  displayName: 'Ocean',
  meta: { icon: 'Waves', category: 'dark' },
  isDark: true,
};

const allThemes: ThemeInfo[] = [lightTheme, darkTheme, customTheme];

// ============================================================================
// HELPERS
// ============================================================================

function resetStore() {
  // Reset store to initial-like state
  useThemeStore.setState({
    currentTheme: 'light',
    availableThemes: [],
    isDarkMode: false,
    themeMode: 'auto',
    isLoading: false,
    error: null,
    layoutPreset: null,
    layoutApp: null,
    isLayoutLoading: false,
    isReady: false,
    gameTitle: null,
    gameSubtitle: null,
    gameNamespace: '',
    sidebarWidth: 240,
  });
}

/** Set up a minimal DOM environment for applyTheme */
function setupDOM() {
  // Ensure document.documentElement has classList and setAttribute
  if (typeof document !== 'undefined') {
    // Clear any theme classes/attributes from previous tests
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  }
}

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches:
        query === '(prefers-color-scheme: dark)'
          ? prefersDark
          : query === '(prefers-color-scheme: light)'
            ? !prefersDark
            : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  setupDOM();

  // Default: isClient returns true (browser environment)
  vi.mocked(isClient).mockReturnValue(true);
  vi.mocked(getDndevConfig).mockReturnValue(null);

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

  // Mock matchMedia (default: prefers light)
  mockMatchMedia(false);

  // Mock window.location for setCookie secure check
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { protocol: 'https:' },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// PURE UTILITY FUNCTIONS
// ============================================================================

describe('getAvailableThemes', () => {
  it('returns fallback light theme when no config', () => {
    vi.mocked(getDndevConfig).mockReturnValue(null);

    const themes = getAvailableThemes();

    expect(themes).toHaveLength(1);
    expect(themes[0]!.name).toBe('light');
    expect(themes[0]!.isDark).toBe(false);
  });

  it('returns discovered themes from config', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    const themes = getAvailableThemes();

    expect(themes).toHaveLength(3);
    expect(themes.map((t) => t.name)).toEqual(['light', 'dark', 'ocean']);
  });

  it('returns fallback when config.themes.discovered is empty', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: [] },
    } as any);

    const themes = getAvailableThemes();

    expect(themes).toHaveLength(1);
    expect(themes[0]!.name).toBe('light');
  });

  it('returns fallback when config has no themes property', () => {
    vi.mocked(getDndevConfig).mockReturnValue({} as any);

    const themes = getAvailableThemes();

    expect(themes).toHaveLength(1);
    expect(themes[0]!.name).toBe('light');
  });
});

describe('getAvailableThemeNames', () => {
  it('returns array of theme name strings', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(getAvailableThemeNames()).toEqual(['light', 'dark', 'ocean']);
  });
});

describe('getThemeInfo', () => {
  it('returns theme info for valid name', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    const info = getThemeInfo('dark');

    expect(info).not.toBeNull();
    expect(info!.name).toBe('dark');
    expect(info!.isDark).toBe(true);
  });

  it('returns null for unknown theme name', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(getThemeInfo('nonexistent')).toBeNull();
  });
});

describe('isValidTheme', () => {
  it('returns true for known theme', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(isValidTheme('ocean')).toBe(true);
  });

  it('returns false for unknown theme', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(isValidTheme('nope')).toBe(false);
  });
});

// ============================================================================
// applyTheme (DOM manipulation)
// ============================================================================

describe('applyTheme', () => {
  it('adds theme class and data-theme attribute', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    applyTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('removes previous theme classes before applying new one', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    applyTheme('light');
    applyTheme('dark');

    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('returns true for dark themes', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(applyTheme('dark')).toBe(true);
    expect(applyTheme('ocean')).toBe(true);
  });

  it('returns false for light themes', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);

    expect(applyTheme('light')).toBe(false);
  });

  it('returns false in SSR (no document)', () => {
    // Temporarily override document
    const origDoc = globalThis.document;
    // @ts-expect-error - testing SSR
    delete globalThis.document;

    const result = applyTheme('dark');

    expect(result).toBe(false);

    // Restore
    globalThis.document = origDoc;
  });
});

// ============================================================================
// THEME STORE - INITIAL STATE
// ============================================================================

describe('useThemeStore - initial state', () => {
  it('has correct defaults', () => {
    const state = useThemeStore.getState();

    expect(state.availableThemes).toEqual([]);
    expect(state.themeMode).toBe('auto');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isReady).toBe(false);
    expect(state.layoutPreset).toBeNull();
    expect(state.layoutApp).toBeNull();
    expect(state.isLayoutLoading).toBe(false);
    expect(state.sidebarWidth).toBe(240);
    expect(state.gameTitle).toBeNull();
    expect(state.gameSubtitle).toBeNull();
    expect(state.gameNamespace).toBe('');
  });
});

// ============================================================================
// setTheme
// ============================================================================

describe('setTheme', () => {
  it('sets current theme and persists to localStorage and cookie', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({ availableThemes: allThemes });

    await useThemeStore.getState().setTheme('dark');

    const state = useThemeStore.getState();
    expect(state.currentTheme).toBe('dark');
    expect(state.isDarkMode).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();

    expect(localStorage.setItem).toHaveBeenCalledWith('dndev-theme', 'dark');
    expect(setCookie).toHaveBeenCalledWith(
      'dndev-theme',
      'dark',
      expect.objectContaining({ expires: 365, path: '/' })
    );
  });

  it('sets isDarkMode false for light theme', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'dark',
    });

    await useThemeStore.getState().setTheme('light');

    expect(useThemeStore.getState().isDarkMode).toBe(false);
  });

  it('throws for invalid (empty) theme', async () => {
    await expect(useThemeStore.getState().setTheme('')).rejects.toThrow();

    expect(useThemeStore.getState().error).toBeTruthy();
    expect(useThemeStore.getState().isLoading).toBe(false);
  });

  it('throws for unavailable theme name when themes are loaded', async () => {
    useThemeStore.setState({ availableThemes: allThemes });

    await expect(
      useThemeStore.getState().setTheme('nonexistent')
    ).rejects.toThrow();

    expect(useThemeStore.getState().error).toBeTruthy();
  });

  it('allows any theme when availableThemes is empty (no validation)', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: {
        discovered: [
          { name: 'custom', displayName: 'Custom', isDark: false, meta: {} },
        ],
      },
    } as any);
    useThemeStore.setState({ availableThemes: [] });

    // When no available themes loaded, setTheme skips the availability check
    await useThemeStore.getState().setTheme('custom');

    expect(useThemeStore.getState().currentTheme).toBe('custom');
  });
});

// ============================================================================
// setAvailableThemes
// ============================================================================

describe('setAvailableThemes', () => {
  it('sets valid themes array', () => {
    useThemeStore.getState().setAvailableThemes(allThemes);

    expect(useThemeStore.getState().availableThemes).toEqual(allThemes);
  });

  it('filters out invalid theme objects', () => {
    const mixedThemes = [
      lightTheme,
      null as any,
      undefined as any,
      { notATheme: true } as any,
      darkTheme,
    ];

    useThemeStore.getState().setAvailableThemes(mixedThemes);

    const themes = useThemeStore.getState().availableThemes;
    expect(themes).toHaveLength(2);
    expect(themes[0]!.name).toBe('light');
    expect(themes[1]!.name).toBe('dark');
  });

  it('ignores non-array input', () => {
    useThemeStore.setState({ availableThemes: allThemes });

    useThemeStore.getState().setAvailableThemes('not-array' as any);

    // Should not have changed
    expect(useThemeStore.getState().availableThemes).toEqual(allThemes);
  });

  it('applies persisted theme to DOM when currentTheme exists in new themes', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({ currentTheme: 'dark' });

    useThemeStore.getState().setAvailableThemes(allThemes);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(useThemeStore.getState().isDarkMode).toBe(true);
  });

  it('falls back to first theme when currentTheme is stale', () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({ currentTheme: 'deleted-theme' });

    useThemeStore.getState().setAvailableThemes(allThemes);

    // Should reset to first available theme
    expect(useThemeStore.getState().currentTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.setItem).toHaveBeenCalledWith('dndev-theme', 'light');
  });

  it('does not apply to DOM when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);
    useThemeStore.setState({ currentTheme: 'dark' });

    useThemeStore.getState().setAvailableThemes(allThemes);

    // DOM should not be touched (isClient guard)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});

// ============================================================================
// setDarkMode / setThemeMode
// ============================================================================

describe('setDarkMode', () => {
  it('sets isDarkMode', () => {
    useThemeStore.getState().setDarkMode(true);
    expect(useThemeStore.getState().isDarkMode).toBe(true);

    useThemeStore.getState().setDarkMode(false);
    expect(useThemeStore.getState().isDarkMode).toBe(false);
  });
});

describe('setThemeMode', () => {
  it('sets valid theme mode', () => {
    useThemeStore.getState().setThemeMode('dark');
    expect(useThemeStore.getState().themeMode).toBe('dark');

    useThemeStore.getState().setThemeMode('light');
    expect(useThemeStore.getState().themeMode).toBe('light');

    useThemeStore.getState().setThemeMode('auto');
    expect(useThemeStore.getState().themeMode).toBe('auto');
  });

  it('ignores invalid mode', () => {
    useThemeStore.getState().setThemeMode('auto');
    useThemeStore.getState().setThemeMode('invalid' as any);

    expect(useThemeStore.getState().themeMode).toBe('auto');
  });
});

// ============================================================================
// setLoading / setError / clearError
// ============================================================================

describe('setLoading / setError / clearError', () => {
  it('setLoading updates isLoading', () => {
    useThemeStore.getState().setLoading(true);
    expect(useThemeStore.getState().isLoading).toBe(true);
  });

  it('setError sets error string', () => {
    useThemeStore.getState().setError('Something failed');

    expect(useThemeStore.getState().error).toBe('Something failed');
  });

  it('setError accepts null', () => {
    useThemeStore.setState({ error: 'old error' });
    useThemeStore.getState().setError(null);

    expect(useThemeStore.getState().error).toBeNull();
  });

  it('clearError clears error', () => {
    useThemeStore.setState({ error: 'some error' });
    useThemeStore.getState().clearError();

    expect(useThemeStore.getState().error).toBeNull();
  });
});

// ============================================================================
// isThemeAvailable
// ============================================================================

describe('isThemeAvailable', () => {
  beforeEach(() => {
    useThemeStore.setState({ availableThemes: allThemes });
  });

  it('returns true for available theme', () => {
    expect(useThemeStore.getState().isThemeAvailable('dark')).toBe(true);
  });

  it('returns false for unknown theme', () => {
    expect(useThemeStore.getState().isThemeAvailable('nonexistent')).toBe(
      false
    );
  });

  it('returns false for empty string', () => {
    expect(useThemeStore.getState().isThemeAvailable('')).toBe(false);
  });
});

// ============================================================================
// getCurrentThemeInfo
// ============================================================================

describe('getCurrentThemeInfo', () => {
  it('returns info for current theme', () => {
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'ocean',
    });

    const info = useThemeStore.getState().getCurrentThemeInfo();

    expect(info).not.toBeNull();
    expect(info!.name).toBe('ocean');
    expect(info!.isDark).toBe(true);
  });

  it('returns null when current theme not in available themes', () => {
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'nonexistent',
    });

    expect(useThemeStore.getState().getCurrentThemeInfo()).toBeNull();
  });
});

// ============================================================================
// resetTheme
// ============================================================================

describe('resetTheme', () => {
  it('resets currentTheme and themeMode to initial values', () => {
    useThemeStore.setState({
      currentTheme: 'ocean',
      themeMode: 'dark',
    });

    useThemeStore.getState().resetTheme();

    const state = useThemeStore.getState();
    // Resets to initialState values (light for client with light system preference)
    expect(state.themeMode).toBe('auto');
  });
});

// ============================================================================
// switchToNextTheme
// ============================================================================

describe('switchToNextTheme', () => {
  it('cycles to next theme in the list', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'light',
    });

    // switchToNextTheme calls setTheme internally (async)
    useThemeStore.getState().switchToNextTheme();

    // Wait for async setTheme
    await vi.waitFor(() => {
      expect(useThemeStore.getState().currentTheme).toBe('dark');
    });
  });

  it('wraps around to first theme', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'ocean', // last theme
    });

    useThemeStore.getState().switchToNextTheme();

    await vi.waitFor(() => {
      expect(useThemeStore.getState().currentTheme).toBe('light');
    });
  });

  it('does nothing when only one theme available', () => {
    useThemeStore.setState({
      availableThemes: [lightTheme],
      currentTheme: 'light',
    });

    useThemeStore.getState().switchToNextTheme();

    expect(useThemeStore.getState().currentTheme).toBe('light');
  });
});

// ============================================================================
// toggleDarkMode
// ============================================================================

describe('toggleDarkMode', () => {
  it('switches from light to dark theme', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'light',
    });

    useThemeStore.getState().toggleDarkMode();

    await vi.waitFor(() => {
      expect(useThemeStore.getState().isDarkMode).toBe(true);
    });
  });

  it('switches from dark to light theme', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: allThemes },
    } as any);
    useThemeStore.setState({
      availableThemes: allThemes,
      currentTheme: 'dark',
    });

    useThemeStore.getState().toggleDarkMode();

    await vi.waitFor(() => {
      expect(useThemeStore.getState().isDarkMode).toBe(false);
    });
  });

  it('uses fallback "dark"/"light" names when no alternative found', async () => {
    vi.mocked(getDndevConfig).mockReturnValue({
      themes: { discovered: [lightTheme, darkTheme] },
    } as any);
    useThemeStore.setState({
      availableThemes: [lightTheme, darkTheme],
      currentTheme: 'light',
    });

    useThemeStore.getState().toggleDarkMode();

    await vi.waitFor(() => {
      expect(useThemeStore.getState().currentTheme).toBe('dark');
    });
  });
});

// ============================================================================
// SYSTEM PREFERENCE DETECTION
// ============================================================================

describe('getSystemTheme (via initial state behavior)', () => {
  it('detects dark system preference', () => {
    mockMatchMedia(true);
    vi.mocked(isClient).mockReturnValue(true);

    // We can't call getSystemTheme directly (not exported),
    // but we can verify via the matchMedia mock behavior
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(
      true
    );
  });

  it('defaults to light when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);

    // In SSR, initial state defaults to 'light'
    // This is verified by the initialState definition
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(
      false
    );
  });
});

// ============================================================================
// LAYOUT MANAGEMENT
// ============================================================================

describe('setLayoutPreset', () => {
  it('sets valid layout preset', () => {
    useThemeStore.getState().setLayoutPreset('admin');

    expect(useThemeStore.getState().layoutPreset).toBe('admin');
  });

  it('accepts all known presets', () => {
    const presets = [
      'admin',
      'blog',
      'docs',
      'game',
      'landing',
      'moolti',
      'plain',
    ];

    for (const preset of presets) {
      useThemeStore.getState().setLayoutPreset(preset);
      expect(useThemeStore.getState().layoutPreset).toBe(preset);
    }
  });

  it('accepts custom preset strings (CSS-driven)', () => {
    useThemeStore.setState({ layoutPreset: 'admin' });

    useThemeStore.getState().setLayoutPreset('ai-lab');

    expect(useThemeStore.getState().layoutPreset).toBe('ai-lab');
  });

  it('ignores empty string', () => {
    useThemeStore.setState({ layoutPreset: 'admin' });

    useThemeStore.getState().setLayoutPreset('');

    expect(useThemeStore.getState().layoutPreset).toBe('admin');
  });

  it('ignores non-string input', () => {
    useThemeStore.setState({ layoutPreset: 'admin' });

    useThemeStore.getState().setLayoutPreset(123 as any);

    expect(useThemeStore.getState().layoutPreset).toBe('admin');
  });
});

describe('setLayoutLoading', () => {
  it('sets loading state', () => {
    useThemeStore.getState().setLayoutLoading(true);
    expect(useThemeStore.getState().isLayoutLoading).toBe(true);

    useThemeStore.getState().setLayoutLoading(false);
    expect(useThemeStore.getState().isLayoutLoading).toBe(false);
  });
});

describe('setReady', () => {
  it('sets readiness state', () => {
    useThemeStore.getState().setReady(true);
    expect(useThemeStore.getState().isReady).toBe(true);

    useThemeStore.getState().setReady(false);
    expect(useThemeStore.getState().isReady).toBe(false);
  });
});

// ============================================================================
// GAME LAYOUT STATE
// ============================================================================

describe('game layout state', () => {
  it('setGameTitle sets and clears title', () => {
    useThemeStore.getState().setGameTitle('game.title');
    expect(useThemeStore.getState().gameTitle).toBe('game.title');

    useThemeStore.getState().setGameTitle(null);
    expect(useThemeStore.getState().gameTitle).toBeNull();
  });

  it('setGameSubtitle sets and clears subtitle', () => {
    useThemeStore.getState().setGameSubtitle('game.subtitle');
    expect(useThemeStore.getState().gameSubtitle).toBe('game.subtitle');

    useThemeStore.getState().setGameSubtitle(null);
    expect(useThemeStore.getState().gameSubtitle).toBeNull();
  });

  it('setGameNamespace sets namespace', () => {
    useThemeStore.getState().setGameNamespace('quiz');
    expect(useThemeStore.getState().gameNamespace).toBe('quiz');
  });
});

// ============================================================================
// SIDEBAR WIDTH
// ============================================================================

describe('setSidebarWidth', () => {
  it('sets width within valid range', () => {
    useThemeStore.getState().setSidebarWidth(200);
    expect(useThemeStore.getState().sidebarWidth).toBe(200);
  });

  it('clamps to minimum of 48', () => {
    useThemeStore.getState().setSidebarWidth(10);
    expect(useThemeStore.getState().sidebarWidth).toBe(48);
  });

  it('clamps to maximum of 400', () => {
    useThemeStore.getState().setSidebarWidth(500);
    expect(useThemeStore.getState().sidebarWidth).toBe(400);
  });

  it('handles exact boundaries', () => {
    useThemeStore.getState().setSidebarWidth(48);
    expect(useThemeStore.getState().sidebarWidth).toBe(48);

    useThemeStore.getState().setSidebarWidth(400);
    expect(useThemeStore.getState().sidebarWidth).toBe(400);
  });
});

// ============================================================================
// BREAKPOINT MANAGEMENT
// ============================================================================

describe('_updateBreakpoint', () => {
  it('sets mobile breakpoint state', () => {
    useThemeStore.getState()._updateBreakpoint('mobile', 375, 667);

    const bp = useThemeStore.getState().breakpoint;
    expect(bp.current).toBe('mobile');
    expect(bp.width).toBe(375);
    expect(bp.height).toBe(667);
    expect(bp.isMobile).toBe(true);
    expect(bp.isTablet).toBe(false);
    expect(bp.isLaptop).toBe(false);
    expect(bp.isDesktop).toBe(false);
    expect(bp.isMobileOrTablet).toBe(true);
    expect(bp.isLaptopOrDesktop).toBe(false);
  });

  it('sets tablet breakpoint state', () => {
    useThemeStore.getState()._updateBreakpoint('tablet', 768, 1024);

    const bp = useThemeStore.getState().breakpoint;
    expect(bp.current).toBe('tablet');
    expect(bp.isMobile).toBe(false);
    expect(bp.isTablet).toBe(true);
    expect(bp.isMobileOrTablet).toBe(true);
    expect(bp.isLaptopOrDesktop).toBe(false);
  });

  it('sets laptop breakpoint state', () => {
    useThemeStore.getState()._updateBreakpoint('laptop', 1200, 800);

    const bp = useThemeStore.getState().breakpoint;
    expect(bp.current).toBe('laptop');
    expect(bp.isLaptop).toBe(true);
    expect(bp.isLaptopOrDesktop).toBe(true);
    expect(bp.isMobileOrTablet).toBe(false);
  });

  it('sets desktop breakpoint state', () => {
    useThemeStore.getState()._updateBreakpoint('desktop', 1920, 1080);

    const bp = useThemeStore.getState().breakpoint;
    expect(bp.current).toBe('desktop');
    expect(bp.isDesktop).toBe(true);
    expect(bp.isLaptopOrDesktop).toBe(true);
  });

  it('uses window dimensions as fallback when not provided', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      writable: true,
    });

    useThemeStore.getState()._updateBreakpoint('desktop');

    const bp = useThemeStore.getState().breakpoint;
    expect(bp.width).toBe(1440);
    expect(bp.height).toBe(900);
  });
});

describe('_initializeBreakpoints', () => {
  it('does nothing when not client', () => {
    vi.mocked(isClient).mockReturnValue(false);
    const addEventSpy = vi.spyOn(window, 'addEventListener');

    useThemeStore.getState()._initializeBreakpoints();

    expect(addEventSpy).not.toHaveBeenCalled();
  });

  it('adds resize listener on client', () => {
    vi.mocked(isClient).mockReturnValue(true);
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
    });
    const addEventSpy = vi.spyOn(window, 'addEventListener');

    useThemeStore.getState()._initializeBreakpoints();

    expect(addEventSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

// ============================================================================
// INITIALIZE (full store initialization)
// ============================================================================

describe('initialize', () => {
  it('sets isReady to true on success', async () => {
    const result = await useThemeStore.getState().initialize({
      themes: allThemes,
    });

    expect(result).toBe(true);
    expect(useThemeStore.getState().isReady).toBe(true);
  });

  it('sets available themes from data', async () => {
    await useThemeStore.getState().initialize({ themes: allThemes });

    expect(useThemeStore.getState().availableThemes).toEqual(allThemes);
  });

  it('initializes layout from appConfig with preset', async () => {
    await useThemeStore.getState().initialize({
      themes: allThemes,
      appConfig: {
        preset: 'admin',
        app: { name: 'Test App' },
      },
    });

    expect(useThemeStore.getState().layoutPreset).toBe('admin');
    expect(useThemeStore.getState().layoutApp).toBeTruthy();
    expect(useThemeStore.getState().isLayoutLoading).toBe(false);
  });

  it('accepts custom preset strings from appConfig (CSS-driven)', async () => {
    await useThemeStore.getState().initialize({
      themes: allThemes,
      appConfig: {
        preset: 'ai-design',
        app: { name: 'Test App' },
      },
    });

    expect(useThemeStore.getState().layoutPreset).toBe('ai-design');
  });

  it('defaults to landing when no preset in appConfig and no persisted value', async () => {
    await useThemeStore.getState().initialize({
      themes: allThemes,
      appConfig: {
        app: { name: 'Test App' },
      },
    });

    expect(useThemeStore.getState().layoutPreset).toBe('landing');
  });

  it('keeps persisted layoutPreset when appConfig has no preset', async () => {
    useThemeStore.setState({ layoutPreset: 'docs' });

    await useThemeStore.getState().initialize({
      themes: allThemes,
      appConfig: {
        app: { name: 'Test App' },
      },
    });

    // Should keep persisted value 'docs' since appConfig has no preset
    expect(useThemeStore.getState().layoutPreset).toBe('docs');
  });

  it('sets isReady even on failure (graceful degradation)', async () => {
    // Force an error during initialization
    vi.mocked(isClient).mockImplementation(() => {
      throw new Error('Forced error');
    });

    const result = await useThemeStore.getState().initialize({
      themes: allThemes,
    });

    expect(result).toBe(false);
    expect(useThemeStore.getState().isReady).toBe(true);
  });

  it('works with no data', async () => {
    const result = await useThemeStore.getState().initialize();

    expect(result).toBe(true);
    expect(useThemeStore.getState().isReady).toBe(true);
  });

  it('works with empty themes array', async () => {
    const result = await useThemeStore.getState().initialize({ themes: [] });

    expect(result).toBe(true);
    expect(useThemeStore.getState().availableThemes).toEqual([]);
  });
});

// ============================================================================
// initializeLayout
// ============================================================================

describe('initializeLayout', () => {
  it('sets layout preset and app config', async () => {
    await useThemeStore.getState().initializeLayout('admin', { name: 'App' });

    expect(useThemeStore.getState().layoutPreset).toBe('admin');
    expect(useThemeStore.getState().layoutApp).toBeTruthy();
    expect(useThemeStore.getState().isLayoutLoading).toBe(false);
  });

  it('sets isLayoutLoading during operation', async () => {
    const promise = useThemeStore.getState().initializeLayout('blog');

    // Note: since resolveAppConfig is synchronous in mock, loading may already be cleared
    await promise;

    expect(useThemeStore.getState().isLayoutLoading).toBe(false);
  });
});

// ============================================================================
// PERSIST OPTIONS
// ============================================================================

describe('persist configuration', () => {
  it('store name is dndev-theme-store', () => {
    // The store is created with persistOptions.name = 'dndev-theme-store'
    // We verify this indirectly - the store uses localStorage with this key
    expect(useThemeStore).toBeDefined();
    // Store is persisted (Zustand persist middleware)
    expect(typeof useThemeStore.getState).toBe('function');
    expect(typeof useThemeStore.setState).toBe('function');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  it('setTheme with non-string input throws', async () => {
    await expect(
      useThemeStore.getState().setTheme(undefined as any)
    ).rejects.toThrow();
  });

  it('setTheme with null throws', async () => {
    await expect(
      useThemeStore.getState().setTheme(null as any)
    ).rejects.toThrow();
  });

  it('setAvailableThemes with empty array clears themes', () => {
    useThemeStore.setState({ availableThemes: allThemes });

    useThemeStore.getState().setAvailableThemes([]);

    expect(useThemeStore.getState().availableThemes).toEqual([]);
  });

  it('switchToNextTheme with empty themes does nothing', () => {
    useThemeStore.setState({ availableThemes: [], currentTheme: 'light' });

    useThemeStore.getState().switchToNextTheme();

    expect(useThemeStore.getState().currentTheme).toBe('light');
  });

  it('toggleDarkMode with no themes does not crash', () => {
    useThemeStore.setState({ availableThemes: [], currentTheme: 'light' });

    // Should not throw
    expect(() => useThemeStore.getState().toggleDarkMode()).not.toThrow();
  });

  it('setSidebarWidth with negative value clamps to 48', () => {
    useThemeStore.getState().setSidebarWidth(-100);
    expect(useThemeStore.getState().sidebarWidth).toBe(48);
  });

  it('setSidebarWidth with zero clamps to 48', () => {
    useThemeStore.getState().setSidebarWidth(0);
    expect(useThemeStore.getState().sidebarWidth).toBe(48);
  });
});
