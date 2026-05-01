// packages/core/utils/src/client/eventEmitter.ts

/**
 * @fileoverview Enterprise-Grade EventEmitter Implementation
 * @description Production-ready event system with advanced features for enterprise applications
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { handleError } from './errors';

/**
 * Type for low-level event handler functions (internal use)
 *
 * Used internally for type safety while maintaining flexibility for any number of arguments.
 */
type InternalEventHandler = (...args: any[]) => void;

/**
 * Event listener interface for TypeScript type checking
 *
 * Represents a single event listener with its handler function, configuration,
 * and optional context for binding.
 *
 * **Properties:**
 * - handler: Function to call when event is emitted
 * - once: Whether listener should be removed after first call
 * - context: Optional context to bind handler to
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface EventListener<T = any> {
  /**
   * Handler function for the event
   */
  handler: InternalEventHandler;

  /**
   * Whether this is a one-time listener
   */
  once: boolean;

  /**
   * Optional context for the handler
   */
  context?: T;
}

/**
 * Cached event data structure for race condition handling
 *
 * Stores event data with timestamp for automatic cleanup and race condition
 * prevention during feature initialization.
 *
 * **Properties:**
 * - data: The original event data
 * - timestamp: When the event was cached (for cleanup)
 */
interface CachedEvent {
  /**
   * The original event data
   */
  data: any;

  /**
   * Timestamp when the event was cached (for automatic cleanup)
   */
  timestamp: number;
}

/**
 * Enhanced EventEmitter implementation with type safety, event caching, and additional features
 *
 * This EventEmitter provides a robust event system with:
 * - Type safety for event handlers
 * - One-time listeners with automatic cleanup
 * - Context binding for handlers
 * - Listener count warnings for debugging
 * - Error handling for handler exceptions
 * - Memory leak prevention
 * - Event caching for race condition handling
 * - Automatic cache cleanup
 *
 * **Key Features:**
 * - Subscribe/unsubscribe to events
 * - One-time listeners (auto-remove after first call)
 * - Context binding for method handlers
 * - Listener count monitoring and warnings
 * - Error isolation (one handler error doesn't affect others)
 * - Memory leak prevention with proper cleanup
 * - Event caching to handle initialization race conditions
 * - Automatic cache cleanup (3-minute TTL)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Event Caching:**
 * Events are automatically cached when emitted to handle race conditions during
 * feature initialization. Listeners can retrieve cached events on startup to
 * ensure they don't miss events that occurred before they were initialized.
 *
 * **Usage Pattern:**
 * ```typescript
 * const emitter = new EventEmitter();
 *
 * // Subscribe to event
 * const unsubscribe = emitter.on('myEvent', (data) => {
 *   console.log('Event received:', data);
 * });
 *
 * // Emit event (automatically cached)
 * emitter.emit('myEvent', { message: 'Hello' });
 *
 * // Get cached events for race condition handling
 * const cachedEvents = emitter.getCachedEvents('myEvent');
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class EventEmitter {
  /**
   * Map of event names to arrays of handlers
   * @private
   */
  private events: Map<string, EventListener[]> = new Map();

  /**
   * Map of event names to cached event data for race condition handling
   * @private
   */
  private eventCache: Map<string, CachedEvent[]> = new Map();

  /**
   * Maximum number of listeners per event before warnings
   * @private
   */
  private maxListeners = 10;

  /**
   * Cache TTL in milliseconds (3 minutes)
   * @private
   */
  private readonly cacheTTL = 3 * 60 * 1000;

  /**
   * Subscribes to an event with optional context binding
   *
   * **Usage:**
   * ```typescript
   * // Basic subscription
   * const unsubscribe = emitter.on('myEvent', (data) => {
   *   console.log('Event received:', data);
   * });
   *
   * // With context binding
   * const unsubscribe = emitter.on('myEvent', handler, this);
   * ```
   *
   * **Features:**
   * - Returns unsubscribe function for easy cleanup
   * - Supports context binding for method handlers
   * - Validates handler is a function
   * - Monitors listener count for debugging
   *
   * @param eventName - Name of the event to listen for
   * @param handler - Function to call when event is emitted
   * @param context - Optional context to bind handler to
   * @returns Function to unsubscribe from the event
   * @throws TypeError if handler is not a function
   */
  on<T = any>(
    eventName: string,
    handler: InternalEventHandler,
    context?: T
  ): () => void {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    // Get or create the event listener array
    const listeners = this.getListeners(eventName);

    // Add the new listener
    const listener: EventListener<T> = {
      handler,
      once: false,
      context,
    };

    listeners.push(listener);

    // Check if we have too many listeners
    this.checkListenerCount(eventName);

    // Return unsubscribe function
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Subscribes to an event for a single emission (auto-removes after first call)
   *
   * **Usage:**
   * ```typescript
   * // One-time listener
   * const unsubscribe = emitter.once('myEvent', (data) => {
   *   console.log('Event received once:', data);
   * });
   *
   * // With context binding
   * const unsubscribe = emitter.once('myEvent', handler, this);
   * ```
   *
   * **Features:**
   * - Automatically removes listener after first call
   * - Returns unsubscribe function (though not needed for one-time)
   * - Supports context binding for method handlers
   * - Useful for initialization events or one-time callbacks
   *
   * @param eventName - Name of the event to listen for
   * @param handler - Function to call when event is emitted
   * @param context - Optional context to bind handler to
   * @returns Function to unsubscribe from the event (though auto-removes)
   * @throws TypeError if handler is not a function
   */
  once<T = any>(
    eventName: string,
    handler: InternalEventHandler,
    context?: T
  ): () => void {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    // Get or create the event listener array
    const listeners = this.getListeners(eventName);

    // Add the new listener with once flag
    const listener: EventListener<T> = {
      handler,
      once: true,
      context,
    };

    listeners.push(listener);

    // Check if we have too many listeners
    this.checkListenerCount(eventName);

    // Return unsubscribe function
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Unsubscribe from an event
   *
   * @param eventName Event name
   * @param handler Event handler function to remove
   * @returns Whether the handler was removed
   */
  off(eventName: string, handler: InternalEventHandler): boolean {
    const listeners = this.events.get(eventName);

    if (!listeners || listeners.length === 0) {
      return false;
    }

    // Find the index of the handler
    const index = listeners.findIndex(
      (listener) => listener.handler === handler
    );

    if (index === -1) {
      return false;
    }

    // Remove the handler
    listeners.splice(index, 1);

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.events.delete(eventName);
    }

    return true;
  }

  /**
   * Emits an event with arguments to all registered handlers and caches the event
   *
   * **Usage:**
   * ```typescript
   * // Emit with data (automatically cached)
   * emitter.emit('myEvent', { message: 'Hello' });
   *
   * // Emit with multiple arguments (all arguments cached)
   * emitter.emit('myEvent', data1, data2, data3);
   * ```
   *
   * **Features:**
   * - Calls all registered handlers for the event
   * - Handles one-time listeners (auto-removes after call)
   * - Isolates errors (one handler error doesn't affect others)
   * - Returns whether any handlers were called
   * - Supports any number of arguments
   * - Automatically caches event data for race condition handling
   * - Performs automatic cache cleanup
   *
   * **Event Caching:**
   * Events are automatically cached when emitted to handle race conditions during
   * feature initialization. The cache has a 3-minute TTL and is automatically
   * cleaned up to prevent memory leaks.
   *
   * **Error Handling:**
   * - Individual handler errors are caught and logged
   * - Errors don't prevent other handlers from being called
   * - Console errors are logged for debugging
   * - Cache operations are isolated from handler errors
   *
   * @param eventName - Name of the event to emit
   * @param args - Arguments to pass to all handlers and cache
   * @returns True if any handlers were called, false if no handlers exist
   */
  emit(eventName: string, ...args: any[]): boolean {
    // Cache the event data for race condition handling
    this.cacheEvent(eventName, args);

    const listeners = this.events.get(eventName);

    if (!listeners || listeners.length === 0) {
      return false;
    }

    // Create a copy to avoid issues if handlers unsubscribe during emit
    const handlers = [...listeners];

    // Track one-time listeners to remove
    const toRemove: EventListener[] = [];

    // Call each handler
    for (const listener of handlers) {
      try {
        if (listener.context) {
          listener.handler.apply(listener.context, args);
        } else {
          listener.handler(...args);
        }

        // Track one-time listeners for removal
        if (listener.once) {
          toRemove.push(listener);
        }
      } catch (error) {
        handleError(error, {
          userMessage: `Error in event handler for ${eventName}`,
          context: { eventName, args },
          severity: 'warning',
        });
      }
    }

    // Remove one-time listeners
    if (toRemove.length > 0) {
      const activeListeners = this.events.get(eventName);

      if (activeListeners) {
        // Filter out the one-time listeners that were called
        const remainingListeners = activeListeners.filter(
          (listener) => !toRemove.includes(listener)
        );

        if (remainingListeners.length === 0) {
          this.events.delete(eventName);
        } else {
          this.events.set(eventName, remainingListeners);
        }
      }
    }

    return true;
  }

  /**
   * Check if an event has subscribers
   *
   * @param eventName Event name
   * @returns Whether the event has subscribers
   */
  hasListeners(eventName: string): boolean {
    const listeners = this.events.get(eventName);
    return !!listeners && listeners.length > 0;
  }

  /**
   * Get the number of subscribers for an event
   *
   * @param eventName Event name
   * @returns Number of subscribers
   */
  listenerCount(eventName: string): number {
    const listeners = this.events.get(eventName);
    return listeners?.length || 0;
  }

  /**
   * Get all registered event names
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get all listeners for an event
   *
   * @param eventName Event name
   * @returns Array of handler functions
   */
  listeners(eventName: string): InternalEventHandler[] {
    const listeners = this.events.get(eventName);
    return listeners ? listeners.map((l) => l.handler) : [];
  }

  /**
   * Remove all event listeners
   *
   * @param eventName Optional event name to remove listeners for
   */
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
  }

  /**
   * Set the maximum number of listeners per event before warnings
   *
   * @param n Maximum number of listeners
   * @returns This instance for chaining
   */
  setMaxListeners(n: number): this {
    this.maxListeners = n > 0 ? n : Infinity;
    return this;
  }

  /**
   * Get the maximum number of listeners per event
   *
   * @returns Maximum number of listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }

  /**
   * Get or create the listener array for an event
   *
   * @param eventName Event name
   * @returns Array of listeners
   * @private
   */
  private getListeners(eventName: string): EventListener[] {
    let listeners = this.events.get(eventName);

    if (!listeners) {
      listeners = [];
      this.events.set(eventName, listeners);
    }

    return listeners;
  }

  /**
   * Check if we have too many listeners and warn if necessary
   *
   * @param eventName Event name
   * @private
   */
  private checkListenerCount(eventName: string): void {
    const listenerCount = this.listenerCount(eventName);

    if (this.maxListeners !== Infinity && listenerCount > this.maxListeners) {
      console.warn(
        `Warning: Event "${eventName}" has ${listenerCount} listeners, which exceeds the max of ${this.maxListeners}.`,
        `This might indicate a memory leak.`
      );
    }
  }

  /**
   * Cache an event for race condition handling during feature initialization
   *
   * **Purpose:**
   * Events are cached when emitted to handle race conditions where listeners
   * might be initialized after events have already been emitted. This ensures
   * that listeners can retrieve missed events during their initialization.
   *
   * **Automatic Cleanup:**
   * The cache automatically removes events older than the TTL (3 minutes) to
   * prevent memory leaks and ensure only recent events are available.
   *
   * **Usage:**
   * This method is called automatically by the `emit()` method. Manual usage
   * is typically not required unless implementing custom event handling.
   *
   * @param eventName - Name of the event to cache
   * @param eventData - Event data to cache (array of arguments)
   * @private
   */
  private cacheEvent(eventName: string, eventData: any[]): void {
    // Get or create the cache array for this event
    let cachedEvents = this.eventCache.get(eventName);
    if (!cachedEvents) {
      cachedEvents = [];
      this.eventCache.set(eventName, cachedEvents);
    }

    // Add the new event to the cache
    cachedEvents.push({
      data: eventData,
      timestamp: Date.now(),
    });

    // Clean up old events (older than TTL)
    this.cleanupCache(eventName);
  }

  /**
   * Get cached events for a specific event type
   *
   * **Purpose:**
   * Retrieves events that were emitted before a listener was initialized,
   * allowing listeners to catch up on missed events during startup.
   *
   * **Use Case:**
   * This is primarily used by BaseListener implementations during their
   * initialization to process events that occurred before they were ready.
   *
   * **Cache Behavior:**
   * - Returns events from the last 3 minutes
   * - Automatically excludes expired events
   * - Returns empty array if no cached events exist
   *
   * **Usage:**
   * ```typescript
   * // In BaseListener.initialize()
   * const cachedEvents = this.eventEmitter.getCachedEvents('MY_EVENT');
   * cachedEvents.forEach(eventData => {
   *   this.handleEvent('MY_EVENT', eventData);
   * });
   * ```
   *
   * @param eventName - Name of the event to retrieve cached data for
   * @returns Array of cached event data (array of arguments for each event)
   */
  getCachedEvents(eventName: string): any[][] {
    const cachedEvents = this.eventCache.get(eventName);
    if (!cachedEvents || cachedEvents.length === 0) {
      return [];
    }

    // Clean up expired events and return fresh data
    this.cleanupCache(eventName);
    const freshEvents = this.eventCache.get(eventName) || [];

    return freshEvents.map((cachedEvent) => cachedEvent.data);
  }

  /**
   * Clear cached events for a specific event type
   *
   * **Purpose:**
   * Manually clears cached events for a specific event type. This is useful
   * for memory management or when cached events are no longer needed.
   *
   * **Use Cases:**
   * - Memory cleanup after processing cached events
   * - Resetting event state during testing
   * - Manual cache management for specific events
   *
   * **Usage:**
   * ```typescript
   * // Clear cached events after processing
   * const cachedEvents = emitter.getCachedEvents('MY_EVENT');
   * // Process events...
   * emitter.clearCachedEvents('MY_EVENT');
   * ```
   *
   * @param eventName - Name of the event to clear cache for
   */
  clearCachedEvents(eventName: string): void {
    this.eventCache.delete(eventName);
  }

  /**
   * Clear all cached events
   *
   * **Purpose:**
   * Clears all cached events across all event types. This is useful for
   * complete cache reset or memory cleanup.
   *
   * **Use Cases:**
   * - Complete cache reset during testing
   * - Memory cleanup in low-memory environments
   * - Application state reset
   *
   * **Usage:**
   * ```typescript
   * // Clear all cached events
   * emitter.clearAllCachedEvents();
   * ```
   */
  clearAllCachedEvents(): void {
    this.eventCache.clear();
  }

  /**
   * Get cache statistics for monitoring and debugging
   *
   * **Purpose:**
   * Provides information about the current cache state for monitoring,
   * debugging, and performance analysis.
   *
   * **Returns:**
   * Object containing cache statistics including event counts, memory usage
   * estimates, and cache health information.
   *
   * **Usage:**
   * ```typescript
   * const stats = emitter.getCacheStats();
   * console.log(`Cache has ${stats.totalEvents} events across ${stats.eventTypes} types`);
   * ```
   *
   * @returns Object containing cache statistics
   */
  getCacheStats(): {
    totalEvents: number;
    eventTypes: number;
    oldestEvent: number | null;
    newestEvent: number | null;
    memoryEstimate: string;
  } {
    let totalEvents = 0;
    let oldestEvent: number | null = null;
    let newestEvent: number | null = null;

    for (const [eventName, events] of this.eventCache.entries()) {
      totalEvents += events.length;

      for (const event of events) {
        if (oldestEvent === null || event.timestamp < oldestEvent) {
          oldestEvent = event.timestamp;
        }
        if (newestEvent === null || event.timestamp > newestEvent) {
          newestEvent = event.timestamp;
        }
      }
    }

    // Rough memory estimate (events + metadata)
    const memoryEstimate = `${Math.round((totalEvents * 200) / 1024)}KB`;

    return {
      totalEvents,
      eventTypes: this.eventCache.size,
      oldestEvent,
      newestEvent,
      memoryEstimate,
    };
  }

  /**
   * Clean up expired events from the cache
   *
   * **Purpose:**
   * Removes events older than the TTL (3 minutes) from the cache to prevent
   * memory leaks and ensure only recent events are available.
   *
   * **Automatic Execution:**
   * This method is called automatically during event caching and retrieval
   * to maintain cache health. Manual calls are typically not required.
   *
   * @param eventName - Name of the event to clean up (optional, cleans all if not provided)
   * @private
   */
  private cleanupCache(eventName?: string): void {
    const cutoff = Date.now() - this.cacheTTL;

    if (eventName) {
      // Clean up specific event
      const events = this.eventCache.get(eventName);
      if (events) {
        const freshEvents = events.filter((event) => event.timestamp > cutoff);
        if (freshEvents.length === 0) {
          this.eventCache.delete(eventName);
        } else {
          this.eventCache.set(eventName, freshEvents);
        }
      }
    } else {
      // Clean up all events
      for (const [name, events] of this.eventCache.entries()) {
        const freshEvents = events.filter((event) => event.timestamp > cutoff);
        if (freshEvents.length === 0) {
          this.eventCache.delete(name);
        } else {
          this.eventCache.set(name, freshEvents);
        }
      }
    }
  }
}

/**
 * Global event emitter instance for framework-wide event communication
 *
 * This singleton instance is used throughout the framework for:
 * - Cross-component communication
 * - Feature initialization coordination
 * - State synchronization
 * - Error propagation
 *
 * **Usage:**
 * ```typescript
 * import { globalEmitter } from '@donotdev/utils';
 *
 * // Emit framework events
 * globalEmitter.emit('FEATURE_INITIALIZED', { feature: 'auth' });
 *
 * // Listen for framework events
 * globalEmitter.on('FEATURE_INITIALIZED', (data) => {
 *   console.log('Feature initialized:', data);
 * });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export const globalEmitter = new EventEmitter();
