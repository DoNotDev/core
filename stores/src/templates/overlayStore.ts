// packages/core/stores/src/templates/overlayStore.ts

/**
 * @fileoverview Overlay store template
 * @description Zustand store for managing modals, sheets, and command dialogs
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  ModalActions,
  ModalState,
  RedirectOperation,
  RedirectOverlayActions,
  RedirectOverlayConfig,
  RedirectOverlayPhase,
  RedirectOverlayState,
} from '@donotdev/types';

import { createDoNotDevStore } from '../createDoNotDevStore';

import type { ReactNode } from 'react';

/** Default timeout before showing cancel button (10 seconds) */
const DEFAULT_CANCEL_TIMEOUT = 10000;

/** Phase progression timings (ms) */
const PHASE_TIMINGS = {
  connecting: 0,
  preparing: 2000,
  redirecting: 5000,
} as const;

/**
 * Extended overlay actions interface
 */
interface ExtendedOverlayActions extends ModalActions, RedirectOverlayActions {
  /** Open a modal with content */
  openModal: (content: ReactNode) => void;
  /** Close the current modal */
  closeModal: () => void;
  /** Open a sheet */
  openSheet: () => void;
  /** Close the current sheet */
  closeSheet: () => void;
  /** Open the command dialog (GlobalGoTo) with optional initial search value */
  openCommandDialog: (initialSearch?: string) => void;
  /** Close the command dialog (GlobalGoTo) */
  closeCommandDialog: () => void;
  /** Close all overlays (modals, sheets, etc.) */
  closeAll: () => void;
}

/**
 * Overlay state interface
 */
interface OverlayState extends ModalState, RedirectOverlayState {
  /** Whether a sheet is currently open */
  isSheetOpen: boolean;
  /** Whether the command dialog (GlobalSearch) is currently open */
  isCommandDialogOpen: boolean;
  /** Initial search value to pass to command dialog */
  commandDialogInitialSearch?: string;
}

/**
 * Overlay store for managing all overlay types (modals, sheets, etc.)
 *
 * **Architecture:**
 * This store provides centralized overlay management for the application.
 * It handles modal state, sheet state, and provides a simple API for
 * opening and closing overlays throughout the application.
 *
 * **State Management:**
 * - `isOpen`: Whether a modal is currently open
 * - `content`: The React content to display in the modal
 * - `isSheetOpen`: Whether a sheet is currently open
 * - `isCommandDialogOpen`: Whether the command dialog (GlobalGoTo) is currently open
 * - `isReady`: Store initialization state
 *
 * **Integration Points:**
 * - Modal components that subscribe to this store
 * - Sheet components that subscribe to this store
 * - Application components that need to show overlays
 * - Framework overlay system integration
 * - Navigation cleanup (automatically closes all overlays)
 *
 * **Performance Features:**
 * - Efficient state updates with minimal re-renders
 * - Automatic cleanup when overlays are closed
 * - Zustand optimization for state management
 *
 * **SSR Compatibility:**
 * - Initializes with safe default values
 * - No client-only dependencies in store definition
 * - Hydration-safe state transitions
 *
 * @example
 * ```tsx
 * // Open a modal
 * const openModal = useOverlayStore((state) => state.openModal);
 * openModal(<MyModalContent />);
 *
 * // Close modal
 * const closeModal = useOverlayStore((state) => state.closeModal);
 * closeModal();
 *
 * // Open/close sheet
 * const isSheetOpen = useOverlayStore((state) => state.isSheetOpen);
 * const openSheet = useOverlayStore((state) => state.openSheet);
 * const closeSheet = useOverlayStore((state) => state.closeSheet);
 *
 * // Open/close command dialog (GlobalGoTo)
 * const isCommandDialogOpen = useOverlayStore((state) => state.isCommandDialogOpen);
 * const openCommandDialog = useOverlayStore((state) => state.openCommandDialog);
 * const closeCommandDialog = useOverlayStore((state) => state.closeCommandDialog);
 *
 * // Close all overlays (useful for navigation cleanup)
 * const closeAll = useOverlayStore((state) => state.closeAll);
 * closeAll();
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const useOverlayStore = createDoNotDevStore<
  OverlayState & ExtendedOverlayActions
>({
  name: 'overlay',
  createStore: (set, get) => ({
    // Modal state
    isOpen: false,
    content: null,
    isSheetOpen: false,
    isCommandDialogOpen: false,
    commandDialogInitialSearch: undefined,
    // Redirect overlay state
    isRedirectOverlayOpen: false,
    redirectOperation: null,
    redirectPhase: 'connecting' as RedirectOverlayPhase,
    showCancelButton: false,
    redirectConfig: null,
    redirectStartTime: null,

    /**
     * Open a modal with the specified content
     *
     * Sets the modal to open state and displays the provided React content.
     * The content will be rendered by modal components that subscribe to
     * this store.
     *
     * @param content - The React content to display in the modal
     *
     * @example
     * ```tsx
     * const openModal = useOverlayStore((state) => state.openModal);
     *
     * // Open modal with custom content
     * openModal(
     *   <div>
     *     <h2>Confirm Action</h2>
     *     <p>Are you sure you want to proceed?</p>
     *     <button onClick={handleConfirm}>Confirm</button>
     *   </div>
     * );
     * ```
     */
    openModal: (content: ReactNode) => {
      set({ isOpen: true, content });
    },

    /**
     * Close the current modal
     *
     * Closes the modal and clears the content. This will trigger
     * modal components to hide and clean up any resources.
     *
     * @example
     * ```tsx
     * const closeModal = useOverlayStore((state) => state.closeModal);
     *
     * // Close modal programmatically
     * closeModal();
     *
     * // Or close on user action
     * <button onClick={closeModal}>Close</button>
     * ```
     */
    closeModal: () => {
      set({ isOpen: false, content: null });
    },

    /**
     * Open a sheet
     *
     * Sets the sheet to open state. Used by MergedBar components
     * and other sheet-based navigation.
     *
     * @example
     * ```tsx
     * const openSheet = useOverlayStore((state) => state.openSheet);
     * openSheet();
     * ```
     */
    openSheet: () => {
      set({ isSheetOpen: true });
    },

    /**
     * Close the current sheet
     *
     * Closes the sheet. Used by MergedBar components and navigation cleanup.
     *
     * @example
     * ```tsx
     * const closeSheet = useOverlayStore((state) => state.closeSheet);
     * closeSheet();
     * ```
     */
    closeSheet: () => {
      set({ isSheetOpen: false });
    },

    /**
     * Open the command dialog (GlobalGoTo)
     *
     * Opens the navigation command palette triggered by Cmd+K / Ctrl+K.
     * Used by GlobalGoTo component for keyboard navigation.
     *
     * @param initialSearch - Optional initial search value to populate dialog
     *
     * @example
     * ```tsx
     * const openCommandDialog = useOverlayStore((state) => state.openCommandDialog);
     * openCommandDialog();
     * openCommandDialog('dashboard'); // Open with initial search
     * ```
     */
    openCommandDialog: (initialSearch?: string) => {
      set({
        isCommandDialogOpen: true,
        commandDialogInitialSearch: initialSearch,
      });
    },

    /**
     * Close the command dialog (GlobalGoTo)
     *
     * Closes the navigation command palette and clears initial search.
     * Used by GlobalGoTo component and navigation cleanup.
     *
     * @example
     * ```tsx
     * const closeCommandDialog = useOverlayStore((state) => state.closeCommandDialog);
     * closeCommandDialog();
     * ```
     */
    closeCommandDialog: () => {
      set({
        isCommandDialogOpen: false,
        commandDialogInitialSearch: undefined,
      });
    },

    /**
     * Show the redirect overlay
     *
     * Displays a fullscreen overlay during redirect operations (Stripe checkout,
     * OAuth flows, etc.). Handles phase progression and cancel button timing.
     *
     * @param operation - The redirect operation type (e.g., 'stripe-checkout', 'oauth-google')
     * @param config - Optional configuration overrides
     *
     * @example
     * ```tsx
     * const showRedirectOverlay = useOverlayStore((state) => state.showRedirectOverlay);
     *
     * // Show overlay for Stripe checkout
     * showRedirectOverlay('stripe-checkout');
     *
     * // Show overlay with custom config
     * showRedirectOverlay('stripe-checkout', {
     *   title: 'Custom Title',
     *   cancelTimeout: 15000,
     * });
     * ```
     */
    showRedirectOverlay: (
      operation: RedirectOperation,
      config?: RedirectOverlayConfig
    ) => {
      const startTime = Date.now();
      const cancelTimeout = config?.cancelTimeout ?? DEFAULT_CANCEL_TIMEOUT;

      set({
        isRedirectOverlayOpen: true,
        redirectOperation: operation,
        redirectPhase: 'connecting',
        showCancelButton: false,
        redirectConfig: config ?? null,
        redirectStartTime: startTime,
      });

      // Phase progression timers (managed by component, but store tracks state)
      // These will be handled by the RedirectOverlay component via useEffect
    },

    /**
     * Hide the redirect overlay
     *
     * Hides the overlay and resets all redirect-related state.
     * Called when redirect completes, fails, or user cancels.
     *
     * @example
     * ```tsx
     * const hideRedirectOverlay = useOverlayStore((state) => state.hideRedirectOverlay);
     *
     * // Hide on error
     * try {
     *   await redirectToCheckout();
     * } catch (error) {
     *   hideRedirectOverlay();
     *   showError(error);
     * }
     * ```
     */
    hideRedirectOverlay: () => {
      set({
        isRedirectOverlayOpen: false,
        redirectOperation: null,
        redirectPhase: 'connecting',
        showCancelButton: false,
        redirectConfig: null,
        redirectStartTime: null,
      });
    },

    /**
     * Set the redirect phase (internal use by RedirectOverlay component)
     *
     * @param phase - The new phase
     * @internal
     */
    setRedirectPhase: (phase: RedirectOverlayPhase) => {
      set({ redirectPhase: phase });
    },

    /**
     * Set whether cancel button should be shown (internal use)
     *
     * @param show - Whether to show cancel button
     * @internal
     */
    setShowCancelButton: (show: boolean) => {
      set({ showCancelButton: show });
    },

    /**
     * Close all overlays (modals, sheets, command dialogs, etc.)
     *
     * Useful for navigation cleanup - automatically closes all overlays
     * when navigating to a new route.
     *
     * @example
     * ```tsx
     * const closeAll = useOverlayStore((state) => state.closeAll);
     *
     * // Close all overlays on navigation
     * navigate('/new-page');
     * closeAll();
     * ```
     */
    closeAll: () => {
      set({
        isOpen: false,
        content: null,
        isSheetOpen: false,
        isCommandDialogOpen: false,
        commandDialogInitialSearch: undefined,
      });
    },
  }),
  initialize: async () => {
    return true;
  },
});

/**
 * Overlay API type - complete interface for useOverlay
 *
 * Maps each property of OverlayState & ExtendedOverlayActions to its value type
 * for fine-grained selectors. Components only subscribe to the specific property they need.
 *
 * @example
 * ```typescript
 * // Subscribe only to modal open state
 * const isOpen = useOverlay('isOpen');
 *
 * // Subscribe only to showRedirectOverlay method
 * const showRedirectOverlay = useOverlay('showRedirectOverlay');
 *
 * // Subscribe only to redirect overlay state
 * const isRedirectOverlayOpen = useOverlay('isRedirectOverlayOpen');
 * ```
 */
export type OverlayAPI = OverlayState & ExtendedOverlayActions;

/**
 * Hook for accessing overlay state and actions
 * Fine-grained selectors - subscribe only to the property you need
 *
 * @param key - Property key from OverlayAPI to subscribe to
 * @returns The value of the requested property
 *
 * @example
 * ```typescript
 * // Subscribe only to modal open state
 * const isOpen = useOverlay('isOpen');
 *
 * // Subscribe only to showRedirectOverlay method
 * const showRedirectOverlay = useOverlay('showRedirectOverlay');
 * showRedirectOverlay('stripe-checkout');
 *
 * // Subscribe only to redirect overlay state
 * const isRedirectOverlayOpen = useOverlay('isRedirectOverlayOpen');
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useOverlay<K extends keyof OverlayAPI>(key: K): OverlayAPI[K] {
  return useOverlayStore((state) => state[key]);
}
