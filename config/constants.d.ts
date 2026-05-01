// packages/core/config/constants.d.ts
/**

 * @fileoverview Type definitions for constants.js

 * @description TypeScript declarations for DNDev Configuration Constants

 *

 * @version 0.1.0

 * @since 0.0.1

 * @author AMBROISE PARK Consulting

 */

export const ROUTE_DISCOVERY: {
  readonly HOMEPAGE_FILE: string;

  readonly HOMEPAGE_PATH: string;

  readonly HOMEPAGE_COMPONENT: string;
};

export const FEATURE_DISCOVERY: {
  readonly pluginName: string;

  readonly icon: string;

  readonly sources: Record<string, string>;

  readonly defaultFeaturesFile: string;

  readonly defaultManifestFile: string;

  readonly messages: Record<string, string>;
};

export const VIRTUAL_MODULES: {
  readonly routes: string;

  readonly themes: string;

  readonly i18n: string;

  readonly assets: string;

  readonly env: string;
};

export const GENERATED_PATHS: {
  readonly next: Record<string, string>;

  readonly vite: Record<string, string>;
};

export const FRAMEWORK_CONFIG: Record<string, any>;

export const DIR_PATHS: Record<string, any>;

export const SCAN_PATTERNS: Record<string, any>;

export const BUNDLING: {
  readonly optionalFeatures: readonly string[];

  readonly coreBundled: readonly string[];

  readonly componentsBundled: readonly string[];

  readonly radixUIPattern: string;

  readonly buildTools: readonly string[];

  readonly largeOptional: readonly string[];
};

export const SERVER_ONLY_PACKAGES: readonly string[];

export const SERVER_ONLY_SUBPATHS: readonly string[];

export const CSS_PATTERNS: Record<string, any>;

export const ESSENTIAL_THEMES: readonly string[];

export const GLOB_OPTIONS: Record<string, any>;

export const I18N_PATHS: {
  readonly SOURCE_ROOT: string;
  readonly SOURCE_LOCALES: string;
  readonly SOURCE_EAGER: string;
  readonly SOURCE_LAZY: string;
  readonly PUBLISHED_ROOT: string;
  readonly PUBLISHED_LOCALES: string;
  readonly PUBLISHED_EAGER: string;
  readonly PUBLISHED_LAZY: string;
};

export const FONT_FAMILY_TO_STEMS: Record<string, string>;

export const FONT_WEIGHTS: Record<string, readonly number[]>;

export const LOCALE_TO_FONT_SUBSETS: Record<string, readonly string[]>;

export function getPatternsFor(
  type: string,

  repoRoot?: string | null
): string[];

export function getGlobOptionsFor(type: string): Record<string, any>;
