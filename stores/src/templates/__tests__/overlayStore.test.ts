import { describe, it, expect, beforeEach } from 'vitest';

import { useOverlayStore } from '../overlayStore';

// Reset global store registry between tests to get fresh store instances
beforeEach(() => {
  // Reset overlay store state
  useOverlayStore.getState().closeAll();
  useOverlayStore.getState().hideRedirectOverlay();
});

describe('useOverlayStore', () => {
  describe('initial state', () => {
    it('all overlays are closed by default', () => {
      const state = useOverlayStore.getState();

      expect(state.isOpen).toBe(false);
      expect(state.content).toBeNull();
      expect(state.isSheetOpen).toBe(false);
      expect(state.isCommandDialogOpen).toBe(false);
      expect(state.isRedirectOverlayOpen).toBe(false);
    });
  });

  describe('modal', () => {
    it('opens modal with content', () => {
      useOverlayStore.getState().openModal('test-content');

      expect(useOverlayStore.getState().isOpen).toBe(true);
      expect(useOverlayStore.getState().content).toBe('test-content');
    });

    it('closes modal and clears content', () => {
      useOverlayStore.getState().openModal('content');
      useOverlayStore.getState().closeModal();

      expect(useOverlayStore.getState().isOpen).toBe(false);
      expect(useOverlayStore.getState().content).toBeNull();
    });
  });

  describe('sheet', () => {
    it('opens and closes sheet', () => {
      useOverlayStore.getState().openSheet();
      expect(useOverlayStore.getState().isSheetOpen).toBe(true);

      useOverlayStore.getState().closeSheet();
      expect(useOverlayStore.getState().isSheetOpen).toBe(false);
    });
  });

  describe('command dialog', () => {
    it('opens command dialog without search', () => {
      useOverlayStore.getState().openCommandDialog();

      expect(useOverlayStore.getState().isCommandDialogOpen).toBe(true);
      expect(
        useOverlayStore.getState().commandDialogInitialSearch
      ).toBeUndefined();
    });

    it('opens command dialog with initial search', () => {
      useOverlayStore.getState().openCommandDialog('dashboard');

      expect(useOverlayStore.getState().isCommandDialogOpen).toBe(true);
      expect(useOverlayStore.getState().commandDialogInitialSearch).toBe(
        'dashboard'
      );
    });

    it('closes command dialog and clears search', () => {
      useOverlayStore.getState().openCommandDialog('search');
      useOverlayStore.getState().closeCommandDialog();

      expect(useOverlayStore.getState().isCommandDialogOpen).toBe(false);
      expect(
        useOverlayStore.getState().commandDialogInitialSearch
      ).toBeUndefined();
    });
  });

  describe('redirect overlay', () => {
    it('shows redirect overlay with operation', () => {
      useOverlayStore.getState().showRedirectOverlay('stripe-checkout' as any);

      const state = useOverlayStore.getState();
      expect(state.isRedirectOverlayOpen).toBe(true);
      expect(state.redirectOperation).toBe('stripe-checkout');
      expect(state.redirectPhase).toBe('connecting');
      expect(state.showCancelButton).toBe(false);
      expect(state.redirectStartTime).toBeGreaterThan(0);
    });

    it('hides redirect overlay and resets state', () => {
      useOverlayStore.getState().showRedirectOverlay('stripe-checkout' as any);
      useOverlayStore.getState().hideRedirectOverlay();

      const state = useOverlayStore.getState();
      expect(state.isRedirectOverlayOpen).toBe(false);
      expect(state.redirectOperation).toBeNull();
      expect(state.redirectStartTime).toBeNull();
    });

    it('sets redirect phase', () => {
      useOverlayStore.getState().showRedirectOverlay('stripe-checkout' as any);
      useOverlayStore.getState().setRedirectPhase('preparing');

      expect(useOverlayStore.getState().redirectPhase).toBe('preparing');
    });

    it('sets cancel button visibility', () => {
      useOverlayStore.getState().setShowCancelButton(true);

      expect(useOverlayStore.getState().showCancelButton).toBe(true);
    });
  });

  describe('closeAll', () => {
    it('closes all overlays at once', () => {
      // Open everything
      useOverlayStore.getState().openModal('modal-content');
      useOverlayStore.getState().openSheet();
      useOverlayStore.getState().openCommandDialog('search');
      // Close all
      useOverlayStore.getState().closeAll();

      const state = useOverlayStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.content).toBeNull();
      expect(state.isSheetOpen).toBe(false);
      expect(state.isCommandDialogOpen).toBe(false);
      expect(state.commandDialogInitialSearch).toBeUndefined();
    });

    it('does not close redirect overlay (intentional)', () => {
      useOverlayStore.getState().showRedirectOverlay('stripe-checkout' as any);
      useOverlayStore.getState().closeAll();

      // Redirect overlay should remain open (it has its own hideRedirectOverlay)
      expect(useOverlayStore.getState().isRedirectOverlayOpen).toBe(true);
    });
  });
});
