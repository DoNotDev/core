// packages/core/types/src/utils/networkManager.ts

/**
 * @fileoverview Network-Related Type Definitions
 * @description Centralized types for network connectivity, status tracking, and monitoring. Defines network connection types, network state, and network-related interfaces.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Possible network connection types based on the Network Information API
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type NetworkConnectionType =
  | 'bluetooth'
  | 'cellular'
  | 'ethernet'
  | 'none'
  | 'wifi'
  | 'wimax'
  | 'other'
  | 'unknown';

/**
 * Effective connection speed types from the Network Information API
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type EffectiveConnectionType =
  | 'slow-2g'
  | '2g'
  | '3g'
  | '4g'
  | 'unknown';

/**
 * Represents the network connectivity status.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface NetworkStatus {
  /**
   * Indicates whether the device has an active internet connection.
   * This is the primary status that authentication and other critical systems should check.
   */
  online: boolean;

  /**
   * The general type of the current network connection.
   * Based on the Network Information API.
   */
  connectionType: NetworkConnectionType;

  /**
   * The effective connection type based on measured performance.
   * Based on the Network Information API, might be 'unknown' if unavailable.
   */
  effectiveType?: EffectiveConnectionType | string;

  /** The timestamp when the network status was last checked or updated. */
  lastChecked: Date;
}

/**
 * Network state specifically for store usage
 * Variant of NetworkStatus with string timestamp for serialization
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface NetworkState {
  /** Whether the device is currently online */
  online: boolean;

  /**
   * Type of network connection if available
   * Uses the full range of network connection types from the Network Information API
   */
  connectionType: NetworkConnectionType;

  /**
   * The effective connection type based on measured performance.
   * Based on the Network Information API, might be 'unknown' if unavailable.
   */
  effectiveType?: EffectiveConnectionType | string;

  /** ISO date string of when network status was last checked */
  lastChecked: string;
}

/**
 * Configuration options for the NetworkManager.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface NetworkCheckConfig {
  /**
   * URL to ping (using a HEAD request) to verify actual internet connectivity.
   * Defaults to a reliable Google endpoint. Set to null or empty string to disable pinging.
   * @default "https://www.gstatic.com/generate_204"
   */
  pingEndpoint?: string | null;

  /**
   * Timeout in milliseconds for the ping request.
   * @default 5000
   */
  pingTimeout?: number;

  /**
   * Interval in milliseconds for periodically checking network connectivity via ping.
   * @default 30000 (30 seconds)
   */
  checkInterval?: number;

  /**
   * Debounce time in milliseconds for processing browser online/offline events
   * to avoid rapid status fluctuations.
   * @default 300
   */
  debounceTime?: number;
}

/**
 * Function signature for network reconnection callbacks
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type NetworkReconnectCallback = () => void;

/**
 * Generic observable interface to avoid circular dependencies
 * This allows us to define the interface without depending on Subject implementation
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface Observable<T> {
  subscribe: (
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ) => { unsubscribe: () => void };
}

/**
 * Network manager interface for observing and controlling network status
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface INetworkManager {
  /** Get the current network status */
  getStatus(): NetworkStatus;

  /**
   * Observe network status changes
   * @returns An observable of NetworkStatus updates
   */
  observeStatus(): Observable<NetworkStatus>;

  /**
   * Register a callback for reconnection events
   * @param callback Function to execute when network reconnects
   * @returns Unsubscribe function
   */
  onReconnect(callback: NetworkReconnectCallback): () => void;

  /**
   * Manually check connectivity
   * @param url Optional custom URL to check
   * @returns Promise resolving to true if online, false otherwise
   */
  checkConnectivity(url?: string): Promise<boolean>;

  /** Clean up resources */
  destroy(): void;
}
