// packages/core/utils/src/common/singleton.ts

/**
 * @fileoverview Singleton utility functions
 * @description Provides singleton pattern implementation for the framework
 *
 * This module provides utilities for creating singleton instances with proper
 * initialization, error handling, and CSR/SSR safety.
 *
 * **Key Features:**
 * - Lazy initialization with factory functions
 * - CSR/SSR safety
 * - Error handling and graceful degradation
 * - Type-safe singleton creation
 * - Method proxy support for direct access
 * - **globalThis-backed singletons** that survive bundler chunk splits and HMR
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Usage Patterns:**
 * ```typescript
 * // Bundler-safe singleton (preferred for cross-package singletons)
 * const registry = getGlobalSingleton('field-registry', () => new FieldRegistry());
 *
 * // Simple singleton (OK for single-file, same-chunk use)
 * const getMyService = createSingleton(MyService);
 *
 * // Singleton with constructor arguments
 * const getMyService = createSingleton(MyService, arg1, arg2);
 *
 * // Singleton with factory function
 * const getMyService = createSingleton(() => new MyService(config));
 * ```
 */

// =============================================================================
// globalThis-backed singletons
// =============================================================================

/**
 * Global singleton registry key.
 * One key on globalThis, all singletons stored inside as a Map.
 */
const GLOBAL_KEY = '__DNDEV_SINGLETONS__';

/**
 * Get the global singleton registry. Creates it on first access.
 */
function getSingletonRegistry(): Map<string, unknown> {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (!g[GLOBAL_KEY]) {
      g[GLOBAL_KEY] = new Map<string, unknown>();
    }
    return g[GLOBAL_KEY] as Map<string, unknown>;
  }
  // Fallback for environments without globalThis (none in practice)
  return new Map<string, unknown>();
}

/**
 * Get or create a singleton backed by `globalThis.__DNDEV_SINGLETONS__`.
 *
 * Use this for singletons that must be shared across packages or survive
 * bundler chunk splits (Vite pre-bundling, esbuild code-splitting, HMR).
 *
 * Module-level `let` singletons break when a bundler evaluates the same
 * module in two separate chunks - each gets its own `let`. `globalThis`
 * is process-wide and survives all of that.
 *
 * **When to use:**
 * - Registries shared between consumer code and framework internals
 *   (e.g. FieldRegistry, providers, auth instance)
 * - Any singleton where `registerX()` happens in one package and
 *   `getX()` happens in another
 *
 * **When NOT to use:**
 * - Server-only singletons (functions/, tooling/, mcp-server/) - no chunk splits
 * - File-local caches that are only read in the same file
 *
 * @param key - Unique key for this singleton (e.g. 'field-registry')
 * @param factory - Factory function called once to create the instance
 * @returns The singleton instance (existing or newly created)
 *
 * @example
 * ```typescript
 * // In FieldRegistry.ts
 * import { getGlobalSingleton } from '@donotdev/core';
 *
 * export function getFieldRegistry(): FieldRegistry {
 *   return getGlobalSingleton('field-registry', () => new FieldRegistry());
 * }
 *
 * // In providers.ts
 * let _providers = getGlobalSingleton('providers', () => ({ current: null }));
 * ```
 */
export function getGlobalSingleton<T>(key: string, factory: () => T): T {
  const registry = getSingletonRegistry();
  if (!registry.has(key)) {
    registry.set(key, factory());
  }
  return registry.get(key) as T;
}

/**
 * Clear a global singleton. **Only for testing.**
 *
 * @param key - The singleton key to clear
 */
export function clearGlobalSingleton(key: string): void {
  getSingletonRegistry().delete(key);
}

/**
 * Creates a singleton getter function for a class or factory function
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @param ClassOrFactory - Class constructor or factory function
 * @param args - Constructor arguments (if ClassOrFactory is a class)
 * @returns Function that returns the singleton instance
 */
export function createSingleton<T>(
  ClassOrFactory: (new (...args: any[]) => T) | (() => T),
  ...args: any[]
): () => T {
  let instance: T | null = null;
  let isInitializing = false;

  return function getInstance(): T {
    if (instance !== null) {
      return instance;
    }

    if (isInitializing) {
      throw new Error(
        'Circular dependency detected in singleton initialization'
      );
    }

    isInitializing = true;

    try {
      if (typeof ClassOrFactory === 'function' && ClassOrFactory.prototype) {
        // It's a class constructor
        instance = new (ClassOrFactory as new (...args: any[]) => T)(...args);
      } else {
        // It's a factory function
        instance = (ClassOrFactory as () => T)();
      }

      return instance;
    } finally {
      isInitializing = false;
    }
  };
}

/**
 * Creates a singleton getter function for a class with parameters
 * This version allows passing parameters to the constructor
 *
 * @param ClassOrFactory - Class constructor or factory function
 * @returns Function that returns the singleton instance with parameters
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createSingletonWithParams<T>(
  ClassOrFactory: (new (...args: any[]) => T) | ((...args: any[]) => T)
): (...args: any[]) => T {
  let instance: T | null = null;
  let isInitializing = false;

  return function getInstance(...args: any[]): T {
    if (instance !== null) {
      return instance;
    }

    if (isInitializing) {
      throw new Error(
        'Circular dependency detected in singleton initialization'
      );
    }

    isInitializing = true;

    try {
      if (typeof ClassOrFactory === 'function' && ClassOrFactory.prototype) {
        // It's a class constructor
        instance = new (ClassOrFactory as new (...args: any[]) => T)(...args);
      } else {
        // It's a factory function
        instance = (ClassOrFactory as (...args: any[]) => T)(...args);
      }

      return instance;
    } finally {
      isInitializing = false;
    }
  };
}

/**
 * Creates an async singleton getter function for async factory functions
 *
 * @param asyncFactory - Async factory function that returns a Promise<T>
 * @returns Function that returns a Promise<T> for the singleton instance
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createAsyncSingleton<T>(
  asyncFactory: () => Promise<T>
): () => Promise<T> {
  let instance: T | null = null;
  let isInitializing = false;
  let initializationPromise: Promise<T> | null = null;

  return async function getAsyncInstance(): Promise<T> {
    // Return existing instance if available
    if (instance !== null) {
      return instance;
    }

    // If already initializing, return the same promise
    if (isInitializing && initializationPromise) {
      return initializationPromise;
    }

    // Prevent circular dependencies
    if (isInitializing) {
      throw new Error(
        'Circular dependency detected in async singleton initialization'
      );
    }

    isInitializing = true;

    try {
      // Create and store the initialization promise
      initializationPromise = asyncFactory();
      instance = await initializationPromise;
      return instance;
    } finally {
      isInitializing = false;
      initializationPromise = null;
    }
  };
}

/**
 * Creates a method proxy for a singleton getter
 * This allows direct method access without calling getInstance() first
 *
 * @param getInstance - Singleton getter function
 * @param methods - Array of method names to proxy
 * @returns Proxy object with direct method access
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function createMethodProxy<T extends object>(
  getInstance: () => T,
  methods: (keyof T)[]
): T {
  return new Proxy({} as T, {
    get(target, prop) {
      if (methods.includes(prop as keyof T)) {
        const instance = getInstance();
        const method = instance[prop as keyof T];

        if (typeof method === 'function') {
          return method.bind(instance);
        }

        return method;
      }

      // For non-method properties, return the property directly
      const instance = getInstance();
      return instance[prop as keyof T];
    },
  });
}

/**
 * Singleton manager for complex initialization scenarios
 * Provides async initialization with proper error handling
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export class SingletonManager {
  private static instances = new Map<string, any>();
  private static initializing = new Set<string>();
  private static initialized = new Set<string>();

  /**
   * Get or create a singleton instance with async initialization
   *
   * @param key - Unique key for the singleton
   * @param factory - Factory function that returns the instance
   * @param options - Initialization options
   * @returns Promise that resolves to the singleton instance
   *
   * @version 0.1.0
   * @since 0.0.1
   * @author AMBROISE PARK Consulting
   */
  static async getOrCreate<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: {
      ssrSafe?: boolean;
      timeout?: number;
      cacheFailures?: boolean;
      fallbackFactory?: () => T;
    } = {}
  ): Promise<T> {
    // Return existing instance if available
    if (this.instances.has(key)) {
      return this.instances.get(key);
    }

    // Check if already initialized
    if (this.initialized.has(key)) {
      return this.instances.get(key);
    }

    // Prevent circular dependencies
    if (this.initializing.has(key)) {
      throw new Error(`Circular dependency detected for singleton: ${key}`);
    }

    // CSR/SSR safety check
    if (options.ssrSafe === false && typeof window === 'undefined') {
      // W-NEW-3 fix: only log in development — this is a server-side path
      if (
        typeof process !== 'undefined' &&
        process.env.NODE_ENV !== 'production'
      ) {
        console.log(
          `[SingletonManager] Skipping ${key} initialization on server`
        );
      }
      if (options.fallbackFactory) {
        const fallback = options.fallbackFactory();
        this.instances.set(key, fallback);
        this.initialized.add(key);
        return fallback;
      }
      throw new Error(`Singleton ${key} requires client-side environment`);
    }

    this.initializing.add(key);

    try {
      const result = await factory();
      this.instances.set(key, result);
      this.initialized.add(key);
      return result;
    } catch (error) {
      if (
        typeof process !== 'undefined' &&
        process.env.NODE_ENV !== 'production'
      ) {
        console.error(`[SingletonManager] Failed to initialize ${key}:`, error);
      }

      if (options.cacheFailures) {
        this.initialized.add(key);
      }

      if (options.fallbackFactory) {
        const fallback = options.fallbackFactory();
        this.instances.set(key, fallback);
        this.initialized.add(key);
        return fallback;
      }

      throw error;
    } finally {
      this.initializing.delete(key);
    }
  }

  /**
   * Check if a singleton is initialized
   *
   * @param key - Singleton key
   * @returns True if initialized
   *
   * @version 0.1.0
   * @since 0.0.1
   * @author AMBROISE PARK Consulting
   */
  static isInitialized(key: string): boolean {
    return this.initialized.has(key);
  }

  /**
   * Clear a singleton instance (for testing)
   *
   * @param key - Singleton key
   *
   * @version 0.1.0
   * @since 0.0.1
   * @author AMBROISE PARK Consulting
   */
  static clear(key: string): void {
    this.instances.delete(key);
    this.initialized.delete(key);
    this.initializing.delete(key);
  }

  /**
   * Clear all singleton instances (for testing)
   *
   * @version 0.1.0
   * @since 0.0.1
   * @author AMBROISE PARK Consulting
   */
  static clearAll(): void {
    this.instances.clear();
    this.initialized.clear();
    this.initializing.clear();
  }
}
