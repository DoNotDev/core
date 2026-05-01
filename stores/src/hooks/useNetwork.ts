// packages/core/stores/src/hooks/useNetwork.ts

/**
 * @fileoverview Network hook
 * @description Hook for accessing network state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { NetworkStatus } from '@donotdev/types';

import { useNetworkStore } from '../templates/networkStore';

import type { DoNotDevStore } from '../createDoNotDevStore';

interface NetworkState {
  status: NetworkStatus;
  isReconnected: boolean;
  isConnectionLost: boolean;
  setStatus: (status: NetworkStatus) => void;
  setReconnected: () => void;
  setConnectionLost: () => void;
}

type NetworkStoreState = NetworkState & DoNotDevStore;

/**
 * Hook for accessing network state
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useNetwork() {
  const state = useNetworkStore((state: NetworkStoreState) => ({
    // Network status
    status: state.status,
    isOnline: state.status.online,
    isReconnected: state.isReconnected,
    isConnectionLost: state.isConnectionLost,
    connectionType: state.status.connectionType,
    effectiveType: state.status.effectiveType,
    lastChecked: state.status.lastChecked,
  }));

  return {
    ...state,
    // Get reset via getState() to avoid reference instability from middleware
    reset: useNetworkStore.getState().reset,
  };
}

/**
 * Selector hook for network status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useNetworkStatus() {
  return useNetworkStore((state: NetworkStoreState) => state.status);
}

/**
 * Selector hook for online status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useNetworkOnline() {
  return useNetworkStore((state: NetworkStoreState) => state.status.online);
}

/**
 * Selector hook for connection type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useNetworkConnectionType() {
  return useNetworkStore(
    (state: NetworkStoreState) => state.status.connectionType
  );
}
