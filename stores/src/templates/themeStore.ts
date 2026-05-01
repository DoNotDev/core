// packages/core/stores/src/templates/themeStore.ts

/**
 * @fileoverview Theme store template
 * @description Simplified Theme Store - Component Behavior Only
 * Clean separation: CSS for visuals, store for behavior
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { getBreakpointFromWidth, LAYOUT_PRESET } from '@donotdev/types';
import type {
  AppConfig,
  AppMetadata,
  Breakpoint,
  BreakpointUtils,
  LayoutPreset,
  ThemeActions,
  ThemeInfo,
  ThemeMode,
  ThemeState,
} from '@donotdev/types';
import { isClient, setCookie } from '@donotdev/utils';
import {
  handleError,
  getDndevConfig,
  resolveAppConfig as resolveAppConfigUtil,
} from '@donotdev/utils';

import { createDoNotDevStore } from '../createDoNotDevStore';

/**
 * Get all available themes from build-time detection
 * Zero runtime cost - data injected by Vite plugin
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAvailableThemes(): ThemeInfo[] {
  const config = getDndevConfig();

  // If config is available, use discovered themes
  if (
    config &&
    config.themes &&
    config.themes.discovered &&
    config.themes.discovered.length > 0
  ) {
    return config.themes.discovered;
  }

  // Fallback: Light theme so components never render empty
  return [
    {
      name: 'light',
      displayName: 'Light',
      meta: { icon: 'Sun', category: 'light' },
      isDark: false,
    },
  ];
}

/**
 * Get theme names only - derives from getAvailableThemes()
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getAvailableThemeNames(): string[] {
  return getAvailableThemes().map((theme) => theme.name);
}

/**
 * Get theme metadata for a given theme name
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getThemeInfo(themeName: string): ThemeInfo | null {
  const themes = getAvailableThemes();
  return themes.find((theme) => theme.name === themeName) || null;
}

/**
 * Check if a theme is valid
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function isValidTheme(themeName: string): boolean {
  return getAvailableThemes().some((theme) => theme.name === themeName);
}

/**
 * Apply theme to document with proper dark mode detection
 * Returns whether the applied theme is dark
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function applyTheme(themeName: string): boolean {
  if (typeof document === 'undefined') return false;

  const rootElement = document.documentElement;
  const availableThemes = getAvailableThemeNames();

  // Remove all theme classes
  availableThemes.forEach((theme) => {
    rootElement.classList.remove(theme);
  });
  rootElement.classList.remove('light', 'dark');

  // Apply the theme class (this is what the CSS is looking for)
  rootElement.classList.add(themeName);

  // Set the data-theme attribute
  rootElement.setAttribute('data-theme', themeName);

  // Get theme info to determine if it's dark
  const themeInfo = getThemeInfo(themeName);
  const isDark = themeInfo?.isDark || false;

  return isDark;
}

/**
 * Extended theme state with layout and breakpoint management
 */
interface ExtendedThemeState extends ThemeState {
  /** Current layout preset - single source of truth */
  layoutPreset: LayoutPreset | null;
  /** App configuration for layout */
  layoutApp: AppMetadata | null;
  /** Loading state for layout operations */
  isLayoutLoading: boolean;
  /** Current breakpoint state */
  breakpoint: BreakpointUtils;
  /** Whether the store is ready to be used by components */
  isReady: boolean;
  /** Game layout title (i18n key) - only used by GameLayout preset */
  gameTitle: string | null;
  /** Game layout subtitle (i18n key) - only used by GameLayout preset */
  gameSubtitle: string | null;
  /** Game layout i18n namespace - only used by GameLayout preset */
  gameNamespace: string;
  /** Current sidebar width in pixels (48-400) */
  sidebarWidth: number;
  /**
   * Per-route preset override (transient, NOT persisted)
   * Set by LayoutRoute wrapper on navigation. null = use app default.
   */
  routePresetOverride: LayoutPreset | null;
  /**
   * Per-route breadcrumb hide override (transient, NOT persisted)
   * Set by LayoutRoute wrapper on navigation. false = show breadcrumbs normally.
   */
  routeHideBreadcrumbs: boolean;
}

/**
 * Breakpoint actions
 */
interface BreakpointActions {
  /** Initialize breakpoint detection (single resize listener) */
  _initializeBreakpoints: () => void;
  /** Update breakpoint state (internal) */
  _updateBreakpoint: (
    breakpoint: Breakpoint,
    width?: number,
    height?: number
  ) => void;
}

/**
 * Simple layout actions
 */
interface LayoutActions {
  /** Initialize layout with preset and app config */
  initializeLayout: (preset: LayoutPreset, app?: AppMetadata) => Promise<void>;

  /** Set the selected layout preset (validates input, keeps current if invalid) */
  setLayoutPreset: (preset: string | LayoutPreset) => void;

  /** Set layout loading state */
  setLayoutLoading: (loading: boolean) => void;

  /** Set the store readiness state */
  setReady: (ready: boolean) => void;

  /** Set game layout title (i18n key) - only used by GameLayout preset */
  setGameTitle: (title: string | null) => void;

  /** Set game layout subtitle (i18n key) - only used by GameLayout preset */
  setGameSubtitle: (subtitle: string | null) => void;

  /** Set game layout i18n namespace - only used by GameLayout preset */
  setGameNamespace: (namespace: string) => void;

  /** Set sidebar width in pixels (48-400) */
  setSidebarWidth: (width: number) => void;

  /**
   * Set per-route preset override (transient, NOT persisted)
   * Called by LayoutRoute wrapper on every navigation.
   * Pass null to clear override and use app default.
   */
  setRoutePresetOverride: (preset: LayoutPreset | null) => void;

  /** Set per-route breadcrumb hide override (transient) */
  setRouteHideBreadcrumbs: (hide: boolean) => void;
}

/**
 * Resolve app configuration with smart defaults
 */
async function resolveAppConfig(app?: AppMetadata): Promise<AppMetadata> {
  return resolveAppConfigUtil(app);
}

/**
 * Validate preset string and return valid LayoutPreset
 * Internal utility for themeStore - validates against LAYOUT_PRESET constant
 * Returns LAYOUT_PRESET.LANDING if invalid/empty
 */
function validatePreset(preset?: string): LayoutPreset {
  if (!preset || typeof preset !== 'string') return LAYOUT_PRESET.LANDING;
  return preset as LayoutPreset; // any string is valid — custom presets are CSS-driven
}

/**
 * Get system theme preference with light as default
 */
function getSystemTheme(): 'light' | 'dark' {
  if (!isClient()) return 'light';

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hasPreference =
    window.matchMedia('(prefers-color-scheme: light)').matches || prefersDark;

  if (!hasPreference) return 'light'; // Default fallback
  return prefersDark ? 'dark' : 'light';
}

/**
 * Initial breakpoint state (SSR safe)
 */
const initialBreakpointState: BreakpointUtils = {
  current: 'desktop',
  width: 1024,
  height: 768,
  isMobile: false,
  isTablet: false,
  isLaptop: true,
  isDesktop: false,
  isMobileOrTablet: false,
  isLaptopOrDesktop: true,
};

/**
 * Initial state for the theme store - starts empty, becomes ready when config loads
 */
const initialState: ExtendedThemeState = {
  currentTheme: isClient() ? getSystemTheme() : 'light', // Use system preference on client
  availableThemes: [], // ✅ Empty - no globalThis access
  isDarkMode: isClient() ? getSystemTheme() === 'dark' : false,
  themeMode: 'auto',
  isLoading: false,
  error: null,
  layoutPreset: null, // Will be initialized from AppConfig
  layoutApp: null, // Will be initialized from AppConfig
  isLayoutLoading: false,
  breakpoint: initialBreakpointState,
  isReady: false, // Will become true when themes are loaded
  gameTitle: null, // Game layout title (i18n key) - only used by GameLayout
  gameSubtitle: null, // Game layout subtitle (i18n key) - only used by GameLayout
  gameNamespace: '', // Game layout i18n namespace - only used by GameLayout
  sidebarWidth: 240, // Default width, overridden by layoutPreset defaults
  routePresetOverride: null, // No route override initially
  routeHideBreadcrumbs: false, // No breadcrumb override initially
};

/**
 * Simplified Theme Store - Clean Architecture
 *
 * SIMPLIFIED APPROACH:
 * - Store only stores the current preset name and app config
 * - CSS file handles all visual styling via [data-layout] selectors
 * - layoutConfigs.tsx maps presets to components
 * - DnDevLayout renders components directly
 * - No complex matrix logic or CSS variable management in JS
 */
export const useThemeStore = createDoNotDevStore<
  ExtendedThemeState & ThemeActions & LayoutActions & BreakpointActions
>({
  name: 'theme-store',

  createStore: (set, get) => ({
    ...initialState,

    // ============================================================================
    // THEME MANAGEMENT (unchanged - keep existing theme logic)
    // ============================================================================

    setTheme: async (theme: string) => {
      try {
        set({ isLoading: true, error: null });

        if (!theme || typeof theme !== 'string') {
          throw new Error('Invalid theme provided');
        }

        const state = get();
        if (state.availableThemes.length > 0) {
          const isAvailable = state.availableThemes.some(
            (t) => t.name === theme
          );
          if (!isAvailable) {
            throw new Error(`Theme "${theme}" is not available`);
          }
        }

        const isDarkMode = applyTheme(theme);

        if (typeof window !== 'undefined') {
          // Persist to localStorage (client-side hydration via Zustand persist)
          localStorage.setItem('dndev-theme', theme);
          // Also sync to cookie for SSR (Next.js reads this on server to prevent FOUC)
          setCookie('dndev-theme', theme, {
            expires: 365,
            path: '/',
            sameSite: 'lax',
            secure: window.location.protocol === 'https:',
          });
        }

        set({
          currentTheme: theme,
          isDarkMode,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const standardError = handleError(error, {
          userMessage: 'Failed to change theme',
          context: { operation: 'setTheme', theme },
        });
        set({ error: standardError.message, isLoading: false });
        throw standardError;
      }
    },

    setAvailableThemes: (themes: ThemeInfo[]) => {
      if (!Array.isArray(themes)) return;

      const validThemes = themes.filter(
        (theme) => theme && typeof theme === 'object' && theme.name
      );
      const state = get();
      set({ availableThemes: validThemes });

      /**
       * Apply persisted theme to DOM after themes are loaded (client-side only)
       *
       * This handles:
       * - Client hydration: Zustand persist restores currentTheme from localStorage,
       *   then setAvailableThemes applies it to DOM once themes are available
       * - SSR: Next.js layout applies theme class to HTML during SSR,
       *   then this ensures DOM matches after client hydration
       * - Stale themes: If currentTheme doesn't exist in new themes (e.g., config changed),
       *   reset to first available theme to prevent UI inconsistencies
       *
       * Timing: Runs after themes are discovered/loaded, ensuring theme info is available
       */
      if (state.currentTheme && validThemes.length > 0 && isClient()) {
        const persistedTheme = validThemes.find(
          (t) => t.name === state.currentTheme
        );
        if (persistedTheme) {
          applyTheme(state.currentTheme);
          const isDarkMode = persistedTheme.isDark || false;
          set({ isDarkMode });
        } else {
          // Stale theme: currentTheme doesn't exist in new availableThemes
          // Reset to first available theme to prevent UI inconsistencies
          const fallbackTheme = validThemes[0];
          if (fallbackTheme) {
            applyTheme(fallbackTheme.name);
            const isDarkMode = fallbackTheme.isDark || false;
            set({
              currentTheme: fallbackTheme.name,
              isDarkMode,
            });
            // Update localStorage to prevent future mismatches
            if (typeof window !== 'undefined') {
              localStorage.setItem('dndev-theme', fallbackTheme.name);
            }
          }
        }
      }
    },

    setDarkMode: (isDark: boolean) => {
      set({ isDarkMode: Boolean(isDark) });
    },

    setThemeMode: (mode: ThemeMode) => {
      const validModes: ThemeMode[] = ['light', 'dark', 'auto'];
      if (!validModes.includes(mode)) return;
      set({ themeMode: mode });
    },

    setLoading: (isLoading: boolean) => {
      set({ isLoading });
    },

    setError: (error: string | null) => {
      set({ error, isLoading: false });
    },

    clearError: () => {
      set({ error: null });
    },

    // W-NEW-9 fix: the real implementation lives at config level (see below).
    // This stub exists only to satisfy ThemeActions type — it is overridden by createDoNotDevStore.
    initialize: async (_data?: AppConfig): Promise<boolean> => {
      return true;
    },

    isThemeAvailable: (themeName: string) => {
      if (!themeName) return false;
      const state = get();
      return state.availableThemes.some((theme) => theme.name === themeName);
    },

    resetTheme: () => {
      set({
        currentTheme: initialState.currentTheme,
        themeMode: initialState.themeMode,
      });
    },

    getCurrentThemeInfo: () => {
      const state = get();
      return (
        state.availableThemes.find(
          (theme) => theme.name === state.currentTheme
        ) || null
      );
    },

    switchToNextTheme: () => {
      const state = get();
      const actions = get();
      if (state.availableThemes.length <= 1) return;

      const currentIndex = state.availableThemes.findIndex(
        (theme) => theme.name === state.currentTheme
      );
      const nextIndex = (currentIndex + 1) % state.availableThemes.length;
      const nextTheme = state.availableThemes[nextIndex];

      if (nextTheme) {
        actions.setTheme(nextTheme.name);
      }
    },

    toggleDarkMode: () => {
      const state = get();
      const actions = get();

      const currentThemeInfo = actions.getCurrentThemeInfo();
      const targetIsDark = !currentThemeInfo?.isDark;

      const alternativeTheme = state.availableThemes.find(
        (theme) =>
          theme.isDark === targetIsDark && theme.name !== state.currentTheme
      );

      if (alternativeTheme) {
        actions.setTheme(alternativeTheme.name);
      } else {
        const fallbackTheme = targetIsDark ? 'dark' : 'light';
        if (actions.isThemeAvailable(fallbackTheme)) {
          actions.setTheme(fallbackTheme);
        }
      }
    },

    // ============================================================================
    // SIMPLIFIED LAYOUT ACTIONS
    // ============================================================================

    /**
     * Initialize layout - just store preset and app config
     * CSS file handles all visual styling via [data-layout] selectors
     */
    initializeLayout: async (preset: LayoutPreset, app?: AppMetadata) => {
      try {
        set({ isLayoutLoading: true });

        // Store preset and app config separately (flattened structure)
        const layoutApp = await resolveAppConfig(app);

        set({
          layoutPreset: preset,
          layoutApp,
          isLayoutLoading: false,
        });
      } catch (error) {
        handleError(error, {
          userMessage: 'Layout initialization failed',
          context: { operation: 'layout_initialization' },
          severity: 'error',
          log: true,
          reportToSentry: true,
          showNotification: false,
        });
        set({ isLayoutLoading: false });
        throw error;
      }
    },

    /**
     * Set layout preset - validates input, keeps current preset if invalid
     * CSS file handles visual changes via [data-layout] selector
     */
    setLayoutPreset: (preset: string | LayoutPreset) => {
      if (!preset || typeof preset !== 'string') return;
      set({ layoutPreset: preset as LayoutPreset }); // any string is valid — custom presets are CSS-driven
    },

    setLayoutLoading: (loading: boolean) => {
      set({ isLayoutLoading: loading });
    },

    setReady: (ready: boolean) => {
      set({ isReady: ready });
    },

    setGameTitle: (title: string | null) => {
      set({ gameTitle: title });
    },

    setGameSubtitle: (subtitle: string | null) => {
      set({ gameSubtitle: subtitle });
    },

    setGameNamespace: (namespace: string) => {
      set({ gameNamespace: namespace });
    },

    /**
     * Set sidebar width in pixels
     *
     * @param width - Width in pixels (clamped to 48-400)
     */
    setSidebarWidth: (width: number) => {
      const clampedWidth = Math.max(48, Math.min(width, 400));
      set({ sidebarWidth: clampedWidth });
    },

    /**
     * Set per-route breadcrumb hide override (transient)
     */
    setRouteHideBreadcrumbs: (hide: boolean) => {
      set({ routeHideBreadcrumbs: hide });
    },

    /**
     * Set per-route preset override (transient)
     * Validates input. null clears the override.
     */
    setRoutePresetOverride: (preset: LayoutPreset | null) => {
      if (preset === null) {
        set({ routePresetOverride: null });
        return;
      }
      if (!preset || typeof preset !== 'string') return;
      set({ routePresetOverride: preset as LayoutPreset });
    },

    // ============================================================================
    // BREAKPOINT MANAGEMENT - SINGLE RESIZE LISTENER
    // ============================================================================

    /**
     * Initialize breakpoint detection with single resize listener
     * Replaces 6 MediaQueryList listeners with 1 efficient resize listener
     */
    _initializeBreakpoints: () => {
      if (!isClient()) return;

      // Throttle function for performance
      let throttleTimeout: number | null = null;
      const throttleDelay = 16; // ~60fps

      const updateBreakpoint = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        let current: Breakpoint;

        // Determine breakpoint from window width using DRY function
        current = getBreakpointFromWidth(width);

        // Always update dimensions (throttled)
        const currentState = get().breakpoint;
        const dimensionsChanged =
          currentState.width !== width || currentState.height !== height;
        const breakpointChanged = current !== currentState.current;

        if (dimensionsChanged || breakpointChanged) {
          // Clear existing timeout
          if (throttleTimeout) {
            clearTimeout(throttleTimeout);
          }

          // Throttle the update
          throttleTimeout = window.setTimeout(() => {
            get()._updateBreakpoint(current, width, height);
            throttleTimeout = null;
          }, throttleDelay);
        }
      };

      // Single resize listener instead of 6 media query listeners!
      window.addEventListener('resize', updateBreakpoint);
      updateBreakpoint(); // Initial check

      // Cleanup function
      return () => {
        window.removeEventListener('resize', updateBreakpoint);
        if (throttleTimeout) {
          clearTimeout(throttleTimeout);
        }
      };
    },

    /**
     * Update breakpoint state (internal use only)
     */
    _updateBreakpoint: (
      current: Breakpoint,
      width?: number,
      height?: number
    ) => {
      const actualWidth =
        width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
      const actualHeight =
        height ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

      const breakpoint: BreakpointUtils = {
        current,
        width: actualWidth,
        height: actualHeight,
        isMobile: current === 'mobile',
        isTablet: current === 'tablet',
        isLaptop: current === 'laptop',
        isDesktop: current === 'desktop',
        isMobileOrTablet: current === 'mobile' || current === 'tablet',
        isLaptopOrDesktop: current === 'laptop' || current === 'desktop',
      };

      set({ breakpoint });
    },
  }),

  /**
   * Initialize theme store
   * Loads themes, applies config, initializes breakpoints
   */
  initialize: async (data?: Record<string, unknown>): Promise<boolean> => {
    try {
      const themeData = data as { themes: ThemeInfo[]; appConfig?: AppConfig };
      if (themeData?.themes && themeData.themes.length > 0) {
        const state = useThemeStore.getState();
        state.setAvailableThemes(themeData.themes);

        // Theme mode is handled by the store's internal logic
      }

      // Initialize breakpoints
      useThemeStore.getState()._initializeBreakpoints();

      // Initialize layout
      if (themeData?.appConfig) {
        const layoutApp = await resolveAppConfig(themeData.appConfig.app);

        // AppConfig preset always takes priority on initialization
        // This ensures appConfig.preset overrides any persisted value
        if (
          themeData.appConfig.preset &&
          typeof themeData.appConfig.preset === 'string'
        ) {
          // Validate preset - default to LAYOUT_PRESET.LANDING if invalid
          const preset = validatePreset(themeData.appConfig.preset);
          useThemeStore.setState({
            layoutPreset: preset,
            layoutApp,
            isLayoutLoading: false,
          });
        } else {
          // No preset in appConfig - use persisted value or default
          const currentState = useThemeStore.getState();
          if (currentState.layoutPreset === null) {
            // No persisted value either - use default
            useThemeStore.setState({
              layoutPreset: 'landing',
              layoutApp,
              isLayoutLoading: false,
            });
          } else {
            // Use persisted value (user preference from previous session)
            useThemeStore.setState({
              layoutApp,
              isLayoutLoading: false,
            });
          }
        }
      }

      return true;
    } catch (error) {
      handleError(error, {
        userMessage: 'Theme store initialization failed',
        context: { operation: 'theme_initialization' },
        severity: 'error',
      });
      return false;
    } finally {
      useThemeStore.setState({ isReady: true });
    }
  },

  /**
   * Persist configuration
   * Only persists user preferences, not runtime state
   *
   * Note: Theme application to DOM is handled by setAvailableThemes() after themes are loaded.
   * This ensures themes are available before applying, preventing race conditions.
   */
  persistOptions: {
    name: 'dndev-theme-store',
    partialize: (state) => ({
      currentTheme: state.currentTheme,
      themeMode: state.themeMode,
      // layoutPreset is NOT persisted — it's config (appConfig.preset), not user preference
      // routePresetOverride is NOT persisted — it's transient per-route state
    }),
  },
});

// ============================================================================
// FINE-GRAINED HOOKS - Layout API
// ============================================================================

/**
 * Layout API type - complete interface for useLayout
 *
 * Maps all layout-related state and actions for fine-grained selectors.
 * Components only subscribe to the specific property they need.
 */
export type LayoutAPI = Pick<
  ExtendedThemeState & LayoutActions,
  | 'layoutPreset'
  | 'layoutApp'
  | 'isLayoutLoading'
  | 'gameTitle'
  | 'gameSubtitle'
  | 'gameNamespace'
  | 'sidebarWidth'
  | 'routePresetOverride'
  | 'initializeLayout'
  | 'setLayoutPreset'
  | 'setLayoutLoading'
  | 'setGameTitle'
  | 'setGameSubtitle'
  | 'setGameNamespace'
  | 'setSidebarWidth'
  | 'setRoutePresetOverride'
  | 'routeHideBreadcrumbs'
  | 'setRouteHideBreadcrumbs'
>;

/**
 * Hook for accessing layout state and actions
 * Fine-grained selectors - subscribe only to the property you need
 *
 * @param key - Property key from LayoutAPI to subscribe to
 * @returns The value of the requested property
 *
 * @example
 * ```typescript
 * // Subscribe only to layout preset
 * const preset = useLayout('layoutPreset');
 *
 * // Subscribe only to setLayoutPreset method
 * const setLayoutPreset = useLayout('setLayoutPreset');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useLayout<K extends keyof LayoutAPI>(key: K): LayoutAPI[K] {
  return useThemeStore((state) => state[key]);
}

/**
 * Breakpoint API type - complete interface for useBreakpoint
 *
 * Maps each property of BreakpointUtils to its value type for fine-grained selectors.
 * Components only subscribe to the specific property they need.
 *
 * @example
 * ```typescript
 * // Subscribe only to current breakpoint string
 * const current = useBreakpoint('current');
 *
 * // Subscribe only to width number
 * const width = useBreakpoint('width');
 *
 * // Subscribe only to isMobile boolean
 * const isMobile = useBreakpoint('isMobile');
 * ```
 */
export type BreakpointAPI = BreakpointUtils;

/**
 * Hook for accessing breakpoint state
 * Fine-grained selectors - subscribe only to the property you need
 * - Next.js SSR: Zustand handles SSR automatically
 * - Vite CSR: Uses store state (initialized with actual window size)
 * - Both: Store handles resize updates reactively
 *
 * @param key - Property key from BreakpointUtils to subscribe to
 * @returns The value of the requested property
 *
 * @example
 * ```typescript
 * // Subscribe only to current breakpoint
 * const current = useBreakpoint('current');
 *
 * // Subscribe only to isMobile boolean
 * const isMobile = useBreakpoint('isMobile');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useBreakpoint<K extends keyof BreakpointAPI>(
  key: K
): BreakpointAPI[K] {
  // HMR-safe: fallback to initial state if store isn't ready during reload
  try {
    return useThemeStore(
      (state) => state.breakpoint?.[key] ?? initialBreakpointState[key]
    );
  } catch {
    return initialBreakpointState[key];
  }
}

// ============================================================================
// FINE-GRAINED HOOKS - Theme API
// ============================================================================

/**
 * Theme API type - complete interface for useTheme
 *
 * Maps all theme-related state and actions for fine-grained selectors.
 * Components only subscribe to the specific property they need.
 */
export type ThemeAPI = ThemeState & ThemeActions;

/**
 * Hook for accessing theme state and actions
 * Fine-grained selectors - subscribe only to the property you need
 *
 * @param key - Property key from ThemeAPI to subscribe to
 * @returns The value of the requested property
 *
 * @example
 * ```typescript
 * // Subscribe only to current theme
 * const currentTheme = useTheme('currentTheme');
 *
 * // Subscribe only to isDarkMode
 * const isDarkMode = useTheme('isDarkMode');
 *
 * // Subscribe only to setTheme method
 * const setTheme = useTheme('setTheme');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useTheme<K extends keyof ThemeAPI>(key: K): ThemeAPI[K] {
  return useThemeStore((state) => state[key]);
}

/**
 * Convenience hook to check if ThemeStore is ready
 * Consistent with useI18nReady() pattern
 *
 * @returns true when ThemeStore has finished initialization (themes loaded)
 *
 * @example
 * ```tsx
 * const isReady = useThemeReady();
 * if (!isReady) return <Loading />;
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useThemeReady = () => useThemeStore((state) => state.isReady);
