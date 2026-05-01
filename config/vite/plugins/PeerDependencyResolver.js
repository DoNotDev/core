/**
 * @fileoverview Peer Dependency Resolver Plugin
 * @description Ensures peer dependencies resolve from app's node_modules when processing workspace package files
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import {
  shouldResolvePeerDependency,
  extractPackageName,
} from '../../discovery/PeerDepsResolver.js';
import { createLogger } from '../../utils/debugLog.js';
import { PathResolver } from '../../utils/PathResolver.js';

/**
 * Create peer dependency resolver plugin
 * @param {Object} options - Plugin options
 * @returns {Object} Vite plugin
 */
export function createPeerDependencyResolverPlugin(options = {}) {
  const { debug = false, verbose = true } = options;
  const logger = createLogger('peer-dependency-resolver', debug, verbose);

  return {
    name: 'dndev-peer-dependency-resolver',
    enforce: 'pre',

    configResolved(config) {
      const pathResolver = PathResolver.getInstance();
      const appRoot = pathResolver.getAppRoot();

      if (!appRoot) {
        logger.warn('App root not set, peer dependency resolution may fail');
        return;
      }

      this.pathResolver = pathResolver;
      this.appRoot = appRoot;
    },

    resolveId(id, importer) {
      if (!importer || !this.appRoot || !this.pathResolver) return null;

      const resolvedPath = shouldResolvePeerDependency(
        id,
        importer,
        this.pathResolver
      );

      if (resolvedPath) {
        const packageName = extractPackageName(id);

        // Convert normalized path back to actual file system path for Vite
        // PathResolver normalizes to forward slashes, but Vite needs actual FS path
        const actualPath = this.pathResolver.resolveAppPath(
          `node_modules/${id}`
        );

        // Verify package directory exists
        const packageDir = this.pathResolver.resolveAppPath(
          `node_modules/${packageName}`
        );
        if (!this.pathResolver.pathExists(packageDir)) {
          if (debug) {
            logger.debug(
              `[PeerDeps] Package directory not found: ${packageDir}, skipping resolution`
            );
          }
          return null;
        }

        // For bare imports, return package directory - Vite will resolve entry point from package.json
        // For subpath imports, return the full path (Vite will check if it exists)
        if (id === packageName) {
          // Bare import - return package directory
          if (debug || verbose) {
            logger.debug(
              `[PeerDeps] Resolving bare import "${id}" from app's node_modules: ${packageDir}`
            );
          }
          return packageDir;
        } else {
          // Subpath import - return full path, Vite will handle resolution
          if (debug || verbose) {
            logger.debug(
              `[PeerDeps] Resolving subpath "${id}" from app's node_modules: ${actualPath}`
            );
          }
          return actualPath;
        }
      }

      return null;
    },
  };
}
