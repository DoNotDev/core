# @donotdev/hooks

**React Hooks for DoNotDev Framework**

This package provides a collection of essential React Hooks and Provider components designed to streamline common application patterns and enhance development experience within the DoNotDev Framework. These hooks are carefully crafted to be efficient, type-safe, and framework-agnostic where possible.

---

## Contents

### Core Hooks

-   **`useClickOutside`**: Detects clicks outside a referenced DOM element.
-   **`useDebounce`**: Debounces a value or function, useful for optimizing frequent updates.
-   **`useEntityMutation`**: Manages mutations (create, update, delete) for entities with React Query.
-   **`useEntityQuery`**: Fetches and manages queries for single entities with React Query.
-   **`useEventListener`**: Simplifies adding and removing event listeners to the DOM.
-   **`useIntersectionObserver`**: Observes changes in the intersection of a target element with its ancestor or with a top-level document's viewport.
-   **`useLocalStorage`**: Provides a reactive interface for reading from and writing to local storage.
-   **`useScriptLoader`**: Dynamically loads external JavaScript scripts and manages their loading state.
-   **`useViewportVisibility`**: Tracks the visibility of a component within the viewport, useful for lazy loading or animations.

### Generic Data Hooks

-   **`useAddOrUpdate`**: Generic hook for adding or updating data, often used with `useEntityMutation`.
-   **`useBreathingTimer`**: A timer hook that manages a "breathing" state, typically for UI animations or debouncing.
-   **`useDelete`**: Generic hook for deleting data, often used with `useEntityMutation`.
-   **`useGet`**: Generic hook for fetching single data items, often used with `useEntityQuery`.
-   **`useList`**: Generic hook for fetching lists of data, often used with `useEntityQuery`.

### Provider Components

-   **`QueryProviders`**: TanStack Query provider component that wraps your app with React Query context (SSR-safe, configurable cache defaults).
-   **`AppConfigProvider`**: Provides application-wide configuration context.

### Utilities

-   **`queryClient`**: The global React Query client instance.
-   **`providerUtils`**: Helper utilities for creating and managing React context providers.

---

## Usage

These hooks are primarily intended to be consumed by other framework packages (`@donotdev/core`, `@donotdev/ui`, etc.) and by application developers for advanced use cases requiring direct access to data fetching or browser APIs.

For most common scenarios, high-level components and facade hooks (like `useAuth` from `@donotdev/auth`) are recommended, as they compose these lower-level hooks for a simplified API.

---

**Last Updated:** {Current Date}
