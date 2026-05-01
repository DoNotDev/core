// packages/core/hooks/src/core/useScriptLoader.ts

/**
 * @fileoverview useScriptLoader Hook - External Script Loading
 * @description High-performance hook for loading external scripts with proper error handling and cleanup
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Automatic cleanup prevents memory leaks
 * - Error handling with retry logic
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React
 * - Reusable for any external script (Google, Stripe, analytics, etc.)
 *
 * Performance:
 * - Efficient script loading with caching
 * - Automatic cleanup prevents memory leaks
 * - Minimal re-renders with optimized state updates
 * - RequestIdleCallback optimization for non-critical scripts
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { handleError } from '@donotdev/utils';

/**
 * Options for useScriptLoader hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseScriptLoaderOptions {
  /**
   * Whether the script should be loaded
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to load script immediately or wait for idle
   * @default false (load immediately)
   */
  loadOnIdle?: boolean;

  /**
   * Timeout for script loading in milliseconds
   * @default 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Whether to retry on failure
   * @default true
   */
  retry?: boolean;

  /**
   * Number of retry attempts
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay between retries in milliseconds
   * @default 1000 (1 second)
   */
  retryDelay?: number;

  /**
   * CSP nonce for script security
   */
  nonce?: string;

  /**
   * Script attributes
   */
  attributes?: Record<string, string>;

  /**
   * Callback when script loads successfully
   */
  onLoad?: () => void;

  /**
   * Callback when script fails to load
   */
  onError?: (error: Error) => void;

  /**
   * Whether to check if script is already loaded
   * @default true
   */
  checkExisting?: boolean;

  /**
   * Function to check if script is already available
   * @default checks for script.src in document
   */
  isLoaded?: () => boolean;

  /**
   * Manual loading mode - script only loads when load() is called
   * @default false (auto-load when enabled)
   */
  manual?: boolean;
}

/**
 * Return type for useScriptLoader hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseScriptLoaderReturn {
  /**
   * Whether the script is currently loading
   */
  isLoading: boolean;

  /**
   * Whether the script has loaded successfully
   */
  isLoaded: boolean;

  /**
   * Error if script loading failed
   */
  error: Error | null;

  /**
   * Whether the script is ready to use
   */
  isReady: boolean;

  /**
   * Manually trigger script loading
   */
  load: () => void;

  /**
   * Manually retry loading
   */
  retry: () => void;

  /**
   * Reset loading state
   */
  reset: () => void;

  /**
   * Whether load() has been called (tracks manual trigger)
   */
  loadTriggered: boolean;
}

/**
 * useScriptLoader - External Script Loading Hook
 *
 * High-performance hook for loading external scripts with proper error handling,
 * retry logic, and cleanup. Perfect for loading third-party SDKs like Google,
 * Stripe, analytics, or any external JavaScript libraries.
 *
 * @param src - Script source URL
 * @param options - Configuration options for script loading
 * @returns Object containing loading state, error, and control functions
 *
 * @example Basic script loading
 * ```tsx
 * function GoogleAnalytics() {
 *   const { isLoading, isLoaded, error } = useScriptLoader(
 *     'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID'
 *   );
 *
 *   if (isLoading) return <div>Loading Google Analytics...</div>;
 *   if (error) return <div>Failed to load: {error.message}</div>;
 *   if (isLoaded) return <div>Google Analytics loaded!</div>;
 *
 *   return null;
 * }
 * ```
 *
 * @example Advanced configuration
 * ```tsx
 * function StripeIntegration() {
 *   const { isLoading, isLoaded, error, retry } = useScriptLoader(
 *     'https://js.stripe.com/v3/',
 *     {
 *       loadOnIdle: true,
 *       retry: true,
 *       retryAttempts: 5,
 *       timeout: 15000,
 *       onLoad: () => console.log('Stripe loaded'),
 *       onError: (error) => console.error('Stripe failed:', error),
 *       attributes: {
 *         'data-stripe-publishable-key': 'pk_test_...'
 *       }
 *     }
 *   );
 *
 *   return (
 *     <div>
 *       {isLoading && <Spinner />}
 *       {error && (
 *         <div>
 *           <p>Failed to load Stripe</p>
 *           <button onClick={retry}>Retry</button>
 *         </div>
 *       )}
 *       {isLoaded && <StripeCheckout />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Conditional loading
 * ```tsx
 * function ConditionalScript() {
 *   const [shouldLoad, setShouldLoad] = useState(false);
 *   
 *   const { isLoading, isLoaded } = useScriptLoader(
 *     'https://example.com/script.js',
 *     {
 *       enabled: shouldLoad,
 *       loadOnIdle: true
 *     }
 *   );
 *
 *   return (
 *     <div>
 *       <button onClick={() => setShouldLoad(true)}>
 *         Load Script
 *       </button>
 *       {isLoading && <div>Loading...</div>}
 *       {isLoaded && <div>Script ready!</div>}
 *     </div>
   );
 * }
 * ```
 *
 * @example Custom loaded check
 * ```tsx
 * function CustomScript() {
 *   const { isLoaded } = useScriptLoader(
 *     'https://accounts.google.com/gsi/client',
 *     {
 *       isLoaded: () => !!window.google?.accounts?.id,
 *       onLoad: () => console.log('Google Identity Services ready')
 *     }
 *   );
 *
 *   return isLoaded ? <GoogleSignIn /> : <div>Loading Google...</div>;
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useScriptLoader(
  src: string,
  options: UseScriptLoaderOptions = {}
): UseScriptLoaderReturn {
  const {
    enabled = true,
    manual = false,
    loadOnIdle = false,
    timeout = 10000,
    retry: shouldRetry = true,
    retryAttempts = 3,
    retryDelay = 1000,
    nonce,
    attributes = {},
    onLoad,
    onError,
    checkExisting = true,
    isLoaded: customIsLoaded,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadTriggered, setLoadTriggered] = useState(false);

  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Check if script is already loaded
  const checkIfLoaded = useCallback((): boolean => {
    if (customIsLoaded) {
      return customIsLoaded();
    }

    if (checkExisting) {
      // Check if script with this src already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        return true;
      }
    }

    return false;
  }, [src, customIsLoaded, checkExisting]);

  // Load script function
  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (checkIfLoaded()) {
        setIsLoaded(true);
        setIsLoading(false);
        onLoad?.();
        resolve();
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;

      // Add nonce if provided
      if (nonce) {
        script.nonce = nonce;
      }

      // Add custom attributes
      Object.entries(attributes).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });

      // Set up event handlers
      script.onload = () => {
        if (isMountedRef.current) {
          scriptRef.current = script;
          setIsLoaded(true);
          setIsLoading(false);
          setError(null);
          onLoad?.();
          resolve();
        }
      };

      script.onerror = () => {
        if (isMountedRef.current) {
          const error = new Error(`Failed to load script: ${src}`);
          setError(error);
          setIsLoading(false);
          onError?.(error);
          reject(error);
        }
      };

      // Set timeout
      timeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          const error = new Error(`Script loading timeout: ${src}`);
          setError(error);
          setIsLoading(false);
          onError?.(error);
          reject(error);
        }
      }, timeout);

      // Append to document
      document.head.appendChild(script);
    });
  }, [src, nonce, attributes, timeout, onLoad, onError, checkIfLoaded]);

  // Load script with retry logic
  const load = useCallback(async () => {
    if (!enabled || isLoaded || isLoading) {
      return;
    }

    setLoadTriggered(true);
    setIsLoading(true);
    setError(null);

    try {
      await loadScript();
    } catch (err) {
      const error = handleError(err, {
        userMessage: `Failed to load script: ${src}`,
        context: {
          operation: 'script_loading',
          src,
          retryCount,
        },
        severity: 'error',
      });

      if (shouldRetry && retryCount < retryAttempts) {
        setRetryCount((prev) => prev + 1);
        retryTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            load();
          }
        }, retryDelay);
      } else {
        setError(error);
        setIsLoading(false);
      }
    }
  }, [
    enabled,
    isLoaded,
    isLoading,
    loadScript,
    shouldRetry,
    retryCount,
    retryAttempts,
    retryDelay,
    src,
  ]);

  // Retry function
  const retry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    load();
  }, [load]);

  // Reset function
  // Empty deps intentional: simple setState calls, no external dependencies needed
  const reset = useCallback(() => {
    setRetryCount(0);
    setError(null);
    setIsLoaded(false);
    setIsLoading(false);
    setLoadTriggered(false);
  }, []);

  // Initialize loading
  useEffect(() => {
    if (!enabled || manual) {
      return;
    }

    // Check if already loaded
    if (checkIfLoaded()) {
      setIsLoaded(true);
      return;
    }

    if (loadOnIdle) {
      // Load on idle
      if ('requestIdleCallback' in window) {
        requestIdleCallback(
          () => {
            if (isMountedRef.current) {
              load();
            }
          },
          { timeout: 2000 }
        );
      } else {
        setTimeout(() => {
          if (isMountedRef.current) {
            load();
          }
        }, 100);
      }
    } else {
      // Load immediately
      load();
    }
  }, [enabled, manual, loadOnIdle, load, checkIfLoaded]);

  // Cleanup on unmount
  // Empty deps intentional: cleanup should only run once when component unmounts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    isLoaded,
    error,
    isReady: isLoaded && !error,
    load,
    retry,
    reset,
    loadTriggered,
  };
}
