// packages/core/hooks/src/core/index.ts

/**
 * @fileoverview Core Hooks Barrel Exports
 * @description Barrel exports for core hooks. Provides centralized access to query client, click outside, debounce, entity mutations, entity queries, event listeners, intersection observers, local storage, script loader, and viewport visibility hooks.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export * from './queryClient';
export * from './queryTypes';
export * from './useQuery';
export * from './useMutation';
export * from './useClickOutside';
export * from './useDebounce';
export * from './useEventListener';
export * from './useIntersectionObserver';
export * from './useIsClient';
export * from './useLocalStorage';
export * from './useScriptLoader';
export * from './useViewportVisibility';
