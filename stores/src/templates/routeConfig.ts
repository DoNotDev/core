// packages/core/stores/src/templates/routeConfig.ts

/**
 * @fileoverview Route Configuration Utilities
 * @description Utilities for route configuration and metadata. Provides functions for smart defaults, route manifest generation, and route data management.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type { RoutesPluginConfig } from '@donotdev/types';
import { getDndevConfig, isClient } from '@donotdev/utils';

// Use the single source of truth from @donotdev/types
/**
 * Route data type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type RouteData = RoutesPluginConfig['mapping'][0];

// Use the global RouteManifest type from @donotdev/types
/**
 * Route manifest type
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type RouteManifest = RoutesPluginConfig['manifest'];

/**
 * Smart defaults for pages without explicit meta configuration
 * Uses convention-over-configuration approach
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getSmartDefaults(
  path: string,
  pageModule: any
): Partial<RouteData['meta']> {
  const pathSegments = path.split('/').filter(Boolean);
  const entity = pathSegments[0] || 'home';

  // Try to extract title from common locale patterns
  const titleCandidates = [
    `${entity}.title`,
    `${entity}.header.title`,
    `${entity}.page.title`,
    // Fallback to formatted path
    entity.charAt(0).toUpperCase() + entity.slice(1),
  ];

  return {
    title: titleCandidates[0], // Framework will try these in order
    entity,
    action: pathSegments[1] || null,
  };
}

/**
 * Merge page meta with smart defaults
 * Only uses defaults for missing properties
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function resolvePageMeta(
  path: string,
  pageModule: any
): RouteData['meta'] {
  const explicitMeta = pageModule?.meta || {};
  const smartDefaults = getSmartDefaults(path, pageModule);

  return {
    ...smartDefaults,
    ...explicitMeta, // Explicit meta overrides defaults
  };
}

/**
 * Determine auth requirements with simple defaults
 * Default: false (public) - developer must explicitly specify auth requirements
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function resolveAuthConfig(
  path: string,
  pageModule: any
): RouteData['auth'] {
  // Explicit meta always wins
  if (pageModule?.meta?.auth !== undefined) {
    return pageModule.meta.auth;
  }

  // Simple rule: No meta = public by default
  // It's the developer's job to tell us what they want
  return false;
}

/**
 * Get route data from globals (following i18n pattern)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getRoutes(): RouteData[] {
  if (!isClient()) {
    return [];
  }

  const config = getDndevConfig();
  if (!config) {
    return [];
  }

  if (!config.routes) {
    return [];
  }

  const routes = config.routes?.mapping || [];
  return routes;
}

/**
 * Get route manifest from globals (following i18n pattern)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getRouteManifest(): RouteManifest | null {
  if (!isClient()) {
    return null;
  }

  const config = getDndevConfig();
  if (!config) {
    return null;
  }

  if (!config.routes) {
    return null;
  }

  const manifest = config.routes?.manifest || null;
  return manifest;
}

/**
 * Get route source from globals
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function getRouteSource(): string {
  if (!isClient()) return 'unknown';
  return 'discovery'; // Routes are always from discovery now
}

/**
 * Build route path with dynamic parameters
 * @param basePath - Base path from file structure (e.g., '/blog')
 * @param params - Route parameters (e.g., ['slug'])
 * @returns Complete route path (e.g., '/blog/:slug')
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function buildRoutePath(basePath: string, params?: string[]): string {
  if (!params || params.length === 0) {
    return basePath;
  }

  const paramSuffix = params.map((param) => `:${param}`).join('/');
  return `${basePath}/${paramSuffix}`;
}

/**
 * Extract route path from page meta export
 * @param pageModule - Imported page module
 * @returns Route path string or undefined
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function extractRoutePath(pageModule: any): string | undefined {
  return pageModule?.meta?.route;
}

// Global types are imported from @donotdev/types
// No local declarations needed
