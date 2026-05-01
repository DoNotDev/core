import { describe, it, expect, beforeEach } from 'vitest';

import { useNetworkStore } from '../networkStore';

describe('networkStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useNetworkStore.getState().reset();
  });

  describe('initial state', () => {
    it('has online status', () => {
      const { status } = useNetworkStore.getState();
      expect(status.online).toBe(true); // jsdom navigator.onLine defaults to true
    });

    it('has unknown connection type', () => {
      const { status } = useNetworkStore.getState();
      expect(status.connectionType).toBe('unknown');
      expect(status.effectiveType).toBe('unknown');
    });

    it('is not reconnected or connection lost', () => {
      const state = useNetworkStore.getState();
      expect(state.isReconnected).toBe(false);
      expect(state.isConnectionLost).toBe(false);
    });
  });

  describe('setStatus', () => {
    it('updates network status', () => {
      const newStatus = {
        online: false,
        connectionType: 'cellular' as const,
        effectiveType: '3g',
        lastChecked: new Date(),
      };
      useNetworkStore.getState().setStatus(newStatus);

      const { status } = useNetworkStore.getState();
      expect(status.online).toBe(false);
      expect(status.connectionType).toBe('cellular');
      expect(status.effectiveType).toBe('3g');
    });
  });

  describe('setReconnected', () => {
    it('sets isReconnected true and isConnectionLost false', () => {
      // First set connection lost
      useNetworkStore.getState().setConnectionLost();
      expect(useNetworkStore.getState().isConnectionLost).toBe(true);

      // Then reconnect
      useNetworkStore.getState().setReconnected();
      const state = useNetworkStore.getState();
      expect(state.isReconnected).toBe(true);
      expect(state.isConnectionLost).toBe(false);
    });
  });

  describe('setConnectionLost', () => {
    it('sets isConnectionLost true and isReconnected false', () => {
      // First set reconnected
      useNetworkStore.getState().setReconnected();
      expect(useNetworkStore.getState().isReconnected).toBe(true);

      // Then lose connection
      useNetworkStore.getState().setConnectionLost();
      const state = useNetworkStore.getState();
      expect(state.isConnectionLost).toBe(true);
      expect(state.isReconnected).toBe(false);
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      // Mutate state
      useNetworkStore.getState().setConnectionLost();
      useNetworkStore.getState().setStatus({
        online: false,
        connectionType: 'wifi',
        effectiveType: '4g',
        lastChecked: new Date(),
      });

      // Reset
      useNetworkStore.getState().reset();

      const state = useNetworkStore.getState();
      expect(state.isReconnected).toBe(false);
      expect(state.isConnectionLost).toBe(false);
      expect(state.status.online).toBe(true);
      expect(state.status.connectionType).toBe('unknown');
    });
  });
});
