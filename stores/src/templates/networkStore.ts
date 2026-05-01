// packages/core/stores/src/templates/networkStore.ts

/**
 * @fileoverview Network store template
 * @description Zustand store for managing network connection status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { NetworkStatus } from '@donotdev/types';

import { createDoNotDevStore } from '../createDoNotDevStore';

/**
 * Network store state interface
 */
interface NetworkState {
  // Network status
  status: NetworkStatus;
  isReconnected: boolean;
  isConnectionLost: boolean;

  // Actions
  setStatus: (status: NetworkStatus) => void;
  setReconnected: () => void;
  setConnectionLost: () => void;
}

/**
 * Network store for DoNotDev framework
 *
 * **Architecture:**
 * This store provides centralized network state management for the application.
 * It monitors network connectivity, connection quality, and provides real-time
 * updates about network status changes.
 *
 * **State Management:**
 * - `status`: Current network status including online state and connection type
 * - `isReconnected`: Whether the connection was recently restored
 * - `isConnectionLost`: Whether the connection was recently lost
 * - `isReady`: Store initialization state
 *
 * **Integration Points:**
 * - Network monitoring components
 * - Offline/online state management
 * - Connection quality indicators
 * - Framework network utilities
 *
 * **Performance Features:**
 * - Efficient state updates with minimal re-renders
 * - Real-time network status monitoring
 * - Zustand optimization for state management
 *
 * **SSR Compatibility:**
 * - Initializes with safe default values
 * - No client-only dependencies in store definition
 * - Hydration-safe state transitions
 *
 * @example
 * ```tsx
 * // Check network status
 * const { status, isReconnected } = useNetworkStore();
 *
 * // Monitor connection changes
 * const { setStatus } = useNetworkStore();
 * setStatus({ online: true, connectionType: 'wifi' });
 *
 * // Handle reconnection
 * const { setReconnected } = useNetworkStore();
 * setReconnected();
 * ```
 */
export const useNetworkStore = createDoNotDevStore<NetworkState>({
  name: 'network',
  createStore: (set, get) => ({
    // Initial state
    status: {
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      lastChecked: new Date(),
    },
    isReconnected: false,
    isConnectionLost: false,

    /**
     * Set the network status
     *
     * Updates the current network status with new information.
     * This is typically called when network conditions change
     * or when monitoring systems detect status updates.
     *
     * @param status - The new network status information
     *
     * @example
     * ```tsx
     * const { setStatus } = useNetworkStore();
     *
     * // Update network status
     * setStatus({
     *   online: true,
     *   connectionType: 'wifi',
     *   effectiveType: '4g',
     *   lastChecked: new Date()
     * });
     * ```
     */
    setStatus: (status: NetworkStatus) => {
      set({ status });
    },

    /**
     * Mark the connection as reconnected
     *
     * Sets the reconnected flag to true and clears the connection lost flag.
     * This is typically called when the network connection is restored
     * after being lost.
     *
     * @example
     * ```tsx
     * const { setReconnected } = useNetworkStore();
     *
     * // Handle reconnection
     * setReconnected();
     * ```
     */
    setReconnected: () => {
      set({ isReconnected: true, isConnectionLost: false });
    },

    /**
     * Mark the connection as lost
     *
     * Sets the connection lost flag to true and clears the reconnected flag.
     * This is typically called when the network connection is lost
     * or becomes unavailable.
     *
     * @example
     * ```tsx
     * const { setConnectionLost } = useNetworkStore();
     *
     * // Handle connection loss
     * setConnectionLost();
     * ```
     */
    setConnectionLost: () => {
      set({ isConnectionLost: true, isReconnected: false });
    },

    /**
     * Reset the network store to initial state
     *
     * Resets all network state flags and updates the status to current
     * network conditions. This is useful for cleanup or when starting
     * fresh network monitoring.
     *
     * @example
     * ```tsx
     * const { reset } = useNetworkStore();
     *
     * // Reset network state
     * reset();
     * ```
     */
    reset: () => {
      set({
        status: {
          online: typeof navigator !== 'undefined' ? navigator.onLine : true,
          connectionType: 'unknown',
          effectiveType: 'unknown',
          lastChecked: new Date(),
        },
        isReconnected: false,
        isConnectionLost: false,
      });
    },
  }),
  initialize: async () => {
    // Network store doesn't require complex initialization
    // Just mark as ready since it's already functional
    return true;
  },
});
