/**
 * @fileoverview Optional Dependencies Detection
 * @description Detects optional dependencies for graceful degradation.
 *
 * Three sources of optional deps (merged, deduped):
 * 1. **Installed @donotdev packages** — scans `node_modules/@donotdev/` star `/package.json`
 *    for `peerDependenciesMeta` with `optional: true`. Collects ALL optional peers:
 *    both third-party (shiki, firebase) and @donotdev/* feature packages (auth, billing).
 *    Source of truth: package.json peerDependenciesMeta from dependencies-matrix.json.
 * 2. **BUNDLING.optionalFeatures** — legacy fallback (now empty, scanner is authoritative).
 * 3. **Consumer's package.json** — `peerDependenciesMeta` + `optionalDependencies`
 *    for any consumer-specific optional deps.
 *
 * Missing detection:
 * - **@donotdev/* packages**: checked against consumer's explicit package.json deps.
 *   Physical presence is irrelevant (dn pack --install installs all as transitive deps).
 * - **Third-party deps**: checked via physical resolution (only present if consumer installed).
 *
 * Used by Vite (`OptionalDepResolver` plugin), webpack (`NormalModuleReplacementPlugin`),
 * and Turbopack (`resolveAlias`) to alias missing deps to `empty.cjs`.
 *
 * @version 0.0.4
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from './PathResolver.js';
import { BUNDLING } from '../constants.js';

/**
 * Scan installed @donotdev packages for ALL optional peerDependencies.
 *
 * Reads `node_modules/@donotdev/` star `/package.json` and collects names from
 * `peerDependenciesMeta` where `optional: true`. Includes both third-party deps
 * (shiki, firebase, @tiptap/*) and @donotdev/* feature packages (@donotdev/auth,
 * @donotdev/billing, etc.). Source of truth: package.json peerDependenciesMeta,
 * derived from dependencies-matrix.json.
 *
 * @param {string} appRoot - Consumer's app root directory
 * @returns {string[]} All optional peer dep names from installed @donotdev packages
 */
export function scanInstalledPackageOptionals(appRoot) {
  if (!appRoot) return [];

  const pathResolver = PathResolver.getInstance();
  const optional = new Set();

  try {
    // Use resolvePackage to find actual node_modules location (handles monorepo hoisting).
    // Resolve @donotdev/core main entry (always installed), then go up 2 levels
    // to get node_modules/@donotdev/. Can't use /package.json subpath because
    // Node's exports map blocks it.
    const coreMainPath = pathResolver.resolvePackage('@donotdev/core', appRoot);
    if (!coreMainPath) return [];
    // coreMainPath = .../node_modules/@donotdev/core/index.js → up to @donotdev/
    const scopeDir = pathResolver.getDirname(
      pathResolver.getDirname(coreMainPath)
    );

    /** @type {string[]} */
    let entries;
    try {
      entries = pathResolver.readdirSync(scopeDir);
    } catch {
      return []; // @donotdev scope dir doesn't exist
    }

    for (const entry of entries) {
      try {
        const pkgJsonPath = pathResolver.resolvePath(
          `${entry}/package.json`,
          scopeDir
        );
        const pkg = pathResolver.readSync(pkgJsonPath, { format: 'json' });
        if (!pkg?.peerDependenciesMeta) continue;

        for (const [name, meta] of Object.entries(pkg.peerDependenciesMeta)) {
          if (meta?.optional) {
            optional.add(name);
          }
        }
      } catch {
        // Skip unreadable packages
      }
    }
  } catch {
    // Scope dir doesn't exist or isn't readable
  }

  return Array.from(optional);
}

/**
 * Detect optional dependencies from consumer's package.json
 * Parses:
 * - peerDependenciesMeta where optional: true
 * - optionalDependencies
 *
 * @param {string} appRoot - Consumer's app root directory
 * @returns {string[]} List of optional package names from package.json
 */
export function detectOptionalFromPackageJson(appRoot) {
  if (!appRoot) return [];

  const pathResolver = PathResolver.getInstance();

  try {
    const pkgPath = pathResolver.resolvePath('package.json', appRoot);
    const pkg = pathResolver.readSync(pkgPath, { format: 'json' });
    if (!pkg) return [];

    const optional = new Set();

    // From peerDependenciesMeta
    if (pkg.peerDependenciesMeta) {
      for (const [name, meta] of Object.entries(pkg.peerDependenciesMeta)) {
        if (meta?.optional) optional.add(name);
      }
    }

    // From optionalDependencies
    if (pkg.optionalDependencies) {
      for (const name of Object.keys(pkg.optionalDependencies)) {
        optional.add(name);
      }
    }

    return Array.from(optional);
  } catch {
    return [];
  }
}

/**
 * Get all optional dependencies from all sources (merged, deduped).
 *
 * Sources:
 * 1. Installed @donotdev packages' peerDependenciesMeta (third-party only)
 * 2. BUNDLING.optionalFeatures (@donotdev/* feature packages)
 * 3. Consumer's package.json peerDependenciesMeta + optionalDependencies
 *
 * @param {string} appRoot - Consumer's app root directory
 * @returns {string[]} Combined list of optional package names
 */
export function getAllOptionalDependencies(appRoot) {
  const frameworkOptional = BUNDLING.optionalFeatures || [];
  const packageOptional = scanInstalledPackageOptionals(appRoot);
  const consumerOptional = detectOptionalFromPackageJson(appRoot);

  return [
    ...new Set([...frameworkOptional, ...packageOptional, ...consumerOptional]),
  ];
}

/**
 * Read consumer's explicit dependencies from package.json.
 * Returns a Set of package names from dependencies + devDependencies.
 *
 * @param {string} appRoot - Consumer's app root directory
 * @returns {Set<string>} Explicit dependency names
 */
function getConsumerExplicitDeps(appRoot) {
  const pathResolver = PathResolver.getInstance();
  try {
    const pkgPath = pathResolver.resolvePath('package.json', appRoot);
    const pkg = pathResolver.readSync(pkgPath, { format: 'json' });
    if (!pkg) return new Set();
    return new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ]);
  } catch {
    return new Set();
  }
}

/**
 * Check if a third-party package is physically installed.
 * Uses resolvePackage first, then falls back to directory existence check
 * for packages with no main export (e.g. @tiptap/pm has only subpath exports).
 *
 * @param {string} pkg - Package name
 * @param {string} appRoot - Consumer's app root
 * @param {import('./PathResolver.js').PathResolver} pathResolver
 * @returns {boolean}
 */
function isThirdPartyInstalled(pkg, appRoot, pathResolver) {
  // Fast path: resolvePackage handles hoisting via createRequire
  if (pathResolver.resolvePackage(pkg, appRoot || undefined)) return true;

  // Fallback: package may exist but have no main export (strict exports map).
  // Walk up from appRoot checking node_modules directories.
  const parts = pkg.startsWith('@')
    ? pkg.split('/').slice(0, 2).join('/')
    : pkg.split('/')[0];
  let current = appRoot;
  for (let i = 0; i < 10; i++) {
    const candidate = pathResolver.resolvePath(
      `node_modules/${parts}`,
      current
    );
    if (pathResolver.pathExists(candidate)) return true;
    const parent = pathResolver.getDirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

/**
 * Detect which optional dependencies are missing (not installed).
 *
 * For `@donotdev/*` feature packages: checks the consumer's explicit
 * package.json deps — physical presence in node_modules is irrelevant
 * because `dn pack --install` installs ALL packages as transitive deps.
 * If the consumer didn't explicitly list a feature package, it's "missing"
 * and gets aliased to empty.cjs.
 *
 * For third-party deps (shiki, @tiptap/*, etc.): checks physical resolution
 * as before — these are only present when the consumer installed them.
 *
 * @param {string} appRoot - Consumer's app root directory
 * @returns {{ missing: string[], installed: string[] }} Missing and installed optional deps
 */
export function detectMissingOptionalDeps(appRoot) {
  const allOptional = getAllOptionalDependencies(appRoot);
  const missing = [];
  const installed = [];
  const pathResolver = PathResolver.getInstance();
  const explicitDeps = getConsumerExplicitDeps(appRoot);

  for (const pkg of allOptional) {
    if (pkg.startsWith('@donotdev/')) {
      // Framework feature packages: check explicit deps, not physical resolution.
      // dn pack --install installs all packages as transitive deps, so physical
      // presence doesn't mean the consumer actually uses the package.
      if (explicitDeps.has(pkg)) {
        installed.push(pkg);
      } else {
        missing.push(pkg);
      }
    } else {
      // Third-party optional deps: require BOTH explicit listing AND physical presence.
      // Physical presence alone is insufficient — deps like shiki get hoisted into
      // node_modules as transitive deps of @donotdev/components even when the consumer
      // never uses them. Without this check, Vite bundles the entire dep (e.g. 673
      // shiki language grammars) into apps that don't need syntax highlighting.
      if (
        explicitDeps.has(pkg) &&
        isThirdPartyInstalled(pkg, appRoot, pathResolver)
      ) {
        installed.push(pkg);
      } else {
        missing.push(pkg);
      }
    }
  }

  return { missing, installed };
}
