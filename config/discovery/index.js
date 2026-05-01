// ----- config/src/discovery/index.js -----
/**
 * @fileoverview Discovery engines index
 * @description Discovery Engines Index. Pure re-exports only. Provides asset, i18n, route, and theme discovery engines for build-time code generation.
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

export * from './AssetDiscovery.js';
export * from './I18nDiscovery.js';
export * from './RouteDiscovery.js';
export * from './ThemeDiscovery.js';
// FeatureDiscovery removed - using explicit features array
