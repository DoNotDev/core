// packages/core/hooks/src/core/useLocalStorage.ts

/**
 * @fileoverview useLocalStorage Hook - Local Storage Management
 * @description High-performance hook for managing localStorage with SSR safety
 * @package @donotdev/hooks
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Features:
 * - CSR/SSR safe with proper fallbacks
 * - Type-safe serialization/deserialization
 * - Error handling for storage failures
 * - TypeScript support with full type safety
 * - Zero dependencies beyond React
 *
 * Performance:
 * - Efficient serialization with JSON
 * - Automatic cleanup prevents memory leaks
 * - Minimal re-renders with optimized state updates
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import { handleError, isClient } from '@donotdev/utils';

/**
 * Options for useLocalStorage hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseLocalStorageOptions<T> {
  /**
   * Default value for SSR or when key doesn't exist
   */
  defaultValue: T;

  /**
   * Whether to sync with other tabs
   * @default true
   */
  syncAcrossTabs?: boolean;

  /**
   * Custom serializer function
   */
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  };
}

/**
 * Return type for useLocalStorage hook
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface UseLocalStorageReturn<T> {
  /**
   * Current value from localStorage
   */
  value: T;

  /**
   * Set value in localStorage
   */
  setValue: (value: T | ((prev: T) => T)) => void;

  /**
   * Remove value from localStorage
   */
  removeValue: () => void;

  /**
   * Whether the value is loaded from localStorage
   */
  isLoaded: boolean;

  /**
   * Whether localStorage is available
   */
  isAvailable: boolean;
}

/**
 * Default serializer (stable reference prevents infinite loops)
 */
const DEFAULT_SERIALIZER = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
};

/**
 * useLocalStorage - Local Storage Management Hook
 *
 * High-performance hook for managing localStorage with type safety and SSR support.
 * Perfect for persisting user preferences, settings, and application state.
 *
 * @param key - localStorage key
 * @param options - Configuration options for localStorage management
 * @returns Object containing value, setters, and status
 *
 * @example Basic usage
 * ```tsx
 * function Preferences() {
 *   const { value: theme, setValue: setTheme } = useLocalStorage('theme', {
 *     defaultValue: 'light'
 *   });
 *
 *   return (
 *     <div>
 *       <p>Current theme: {theme}</p>
 *       <button onClick={() => setTheme('dark')}>
 *         Switch to dark
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Complex object storage
 * ```tsx
 * function UserSettings() {
 *   const { value: settings, setValue: setSettings } = useLocalStorage('userSettings', {
 *     defaultValue: {
 *       notifications: true,
 *       language: 'en',
 *       fontSize: 14
 *     }
 *   });
 *
 *   const updateSetting = (key: string, value: any) => {
 *     setSettings(prev => ({ ...prev, [key]: value }));
 *   };
 *
 *   return (
 *     <div>
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={settings.notifications}
 *           onChange={(e) => updateSetting('notifications', e.target.checked)}
 *         />
 *         Notifications
 *       </label>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Array storage
 * ```tsx
 * function TodoList() {
 *   const { value: todos, setValue: setTodos } = useLocalStorage('todos', {
 *     defaultValue: []
 *   });
 *
 *   const addTodo = (text: string) => {
 *     setTodos(prev => [...prev, { id: Date.now(), text, completed: false }]);
 *   };
 *
 *   return (
 *     <div>
 *       {todos.map(todo => (
 *         <div key={todo.id}>{todo.text}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Custom serializer
 * ```tsx
 * function CustomStorage() {
 *   const { value: data, setValue: setData } = useLocalStorage('customData', {
 *     defaultValue: { count: 0 },
 *     serializer: {
 *       serialize: (value) => btoa(JSON.stringify(value)),
 *       deserialize: (value) => JSON.parse(atob(value))
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       <p>Count: {data.count}</p>
 *       <button onClick={() => setData(prev => ({ count: prev.count + 1 }))}>
 *         Increment
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example SSR-safe implementation
 * ```tsx
 * function SSRComponent() {
 *   const { value: user, setValue: setUser, isLoaded } = useLocalStorage('user', {
 *     defaultValue: null,
 *     syncAcrossTabs: true
 *   });
 *
 *   if (!isLoaded) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {user ? `Welcome ${user.name}` : 'Please login'}
 *     </div>
 *   );
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T>
): UseLocalStorageReturn<T> {
  const {
    defaultValue,
    syncAcrossTabs = true,
    serializer = DEFAULT_SERIALIZER,
  } = options;

  // Always start with defaultValue (SSR-safe: server + client first render match)
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  const isAvailable =
    isClient() && typeof window !== 'undefined' && 'localStorage' in window;

  // Load from localStorage after mount (client-only, prevents hydration mismatch)
  useEffect(() => {
    if (!isAvailable) {
      setIsLoaded(true);
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setValue(serializer.deserialize(item));
      }
    } catch (error) {
      handleError(error, {
        userMessage: `Failed to read localStorage key "${key}"`,
        context: { key, defaultValue },
        severity: 'warning',
      });
    } finally {
      setIsLoaded(true);
    }
  }, [key]); // Only run on mount or key change

  // Save to localStorage when value changes (skip until loaded to avoid overwriting)
  useEffect(() => {
    if (!isAvailable || !isLoaded) return;

    try {
      window.localStorage.setItem(key, serializer.serialize(value));
    } catch (error) {
      handleError(error, {
        userMessage: `Failed to set localStorage key "${key}"`,
        context: { key, value },
        severity: 'warning',
      });
    }
  }, [key, value, isLoaded, isAvailable, serializer]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    if (!isAvailable || !syncAcrossTabs) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setValue(serializer.deserialize(event.newValue));
        } catch (error) {
          handleError(error, {
            userMessage: `Failed to parse localStorage key "${key}"`,
            context: { key, newValue: event.newValue },
            severity: 'warning',
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, isAvailable, syncAcrossTabs, serializer]);

  // Remove value from localStorage and reset to default
  const removeValue = useCallback(() => {
    if (!isAvailable) return;

    try {
      window.localStorage.removeItem(key);
      setValue(defaultValue);
    } catch (error) {
      handleError(error, {
        userMessage: `Failed to remove localStorage key "${key}"`,
        context: { key },
        severity: 'warning',
      });
    }
  }, [key, isAvailable, defaultValue]);

  // Memoize return object to prevent dependency loops
  return useMemo(
    () => ({
      value,
      setValue,
      removeValue,
      isLoaded,
      isAvailable,
    }),
    [value, removeValue, isLoaded, isAvailable]
  );
}
