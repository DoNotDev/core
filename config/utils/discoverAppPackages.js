/**
 * @fileoverview SSOT for @donotdev/* package discovery
 * @description Reads the app's package.json to find declared @donotdev/* dependencies.
 * Used by both Vite (in configResolved) and Next.js (in config function).
 *
 * WHY package.json and not node_modules scanning?
 * - Filesystem scanning (readdir node_modules/@donotdev/) is unreliable in monorepos:
 *   hoisted deps, symlinks, and workspace layouts make the scope dir unpredictable.
 * - package.json is the consumer's declaration of intent — it's always at appRoot.
 *
 * WHY PathResolver.resolveAppPath and not process.cwd()?
 * - process.cwd() is NOT the app root in many scenarios:
 *   • Monorepo: `bun run --cwd apps/myapp dev` — cwd may be repo root.
 *   • Vite config phase: config runs before Vite resolves `root`, so cwd != app root.
 *   • CI/IDE: cwd depends on how the process was launched, not on the project structure.
 * - PathResolver.resolveAppPath() uses appRoot (set from config.root in Vite's configResolved,
 *   or from resolveAppRoot() in Next.js), which is the actual app directory.
 *
 * TIMING (Vite):
 * - This function MUST be called in or after configResolved, not during config().
 *   In config(), appRoot is not yet set — PathResolver.resolveAppPath() would throw.
 *   configResolved runs after Vite has resolved config.root, so appRoot is reliable.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { BUNDLING } from '../constants.js';
import { PathResolver } from './PathResolver.js';

/**
 * Server-only packages — must never be pre-bundled by Vite or transpiled by Next.
 * Guardrail: filtered even if a consumer declares them in package.json.
 * These packages have no browser entry point and would cause bundler errors.
 */
export const SERVER_ONLY_PACKAGES = new Set(['@donotdev/functions']);

/**
 * Discover @donotdev/* packages declared in the app's package.json.
 * SSOT for Vite (configResolved) and Next.js (config function).
 *
 * Filters out:
 * - Build-time-only packages (BUNDLING.buildTimePackages) — not runtime deps
 * - Server-only packages (SERVER_ONLY_PACKAGES) — no browser entry, would crash bundler
 *
 * REQUIRES: PathResolver.appRoot to be set before calling.
 * - Vite: call in configResolved (after setAppRoot(config.root))
 * - Next.js: call after resolveAppRoot()
 *
 * @returns {string[]} Sorted @donotdev/* package names safe for bundler consumption
 */
export function discoverAppPackages() {
  try {
    const pathResolver = PathResolver.getInstance();
    const packageJsonPath = pathResolver.resolveAppPath('package.json');
    const packageJson = pathResolver.readSync(packageJsonPath, {
      format: 'json',
    });
    if (!packageJson) return [];

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return Object.keys(allDeps)
      .filter((pkg) => pkg.startsWith('@donotdev/'))
      .filter((pkg) => !BUNDLING.buildTimePackages.includes(pkg))
      .filter((pkg) => !SERVER_ONLY_PACKAGES.has(pkg))
      .sort();
  } catch {
    return [];
  }
}
