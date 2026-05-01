'use client';
// packages/core/stores/src/index.ts

/**
 * @fileoverview Core stores package
 * @description Zustand stores for DoNotDev framework state management
 * All stores must be Client Components in Next.js
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Core store utilities
export * from './createDoNotDevStore';

// Hooks
export * from './hooks';

// Store templates (exports all stores + their convenience hooks)
export * from './templates';
