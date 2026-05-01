/**
 * @fileoverview Next.js Peer Dependency Resolver Plugin
 * @description Webpack resolver plugin for peer dependencies in isolated workspaces
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
 * Create Next.js peer dependency resolver plugin
 * @param {Object} options - Plugin options
 * @returns {Object} Webpack resolver plugin
 */
export function createNextPeerDependencyResolverPlugin(options = {}) {
  const { debug = false, verbose = true } = options;
  const logger = createLogger('next-peer-dependency-resolver', debug, verbose);

  return {
    apply(resolver) {
      const pathResolver = PathResolver.getInstance();
      const appRoot = pathResolver.getAppRoot();

      if (!appRoot) {
        logger.warn('App root not set, peer dependency resolution may fail');
        return;
      }

      const target = resolver.ensureHook('resolved');

      resolver
        .getHook('described-resolve')
        .tapAsync(
          'NextPeerDependencyResolver',
          (request, resolveContext, callback) => {
            if (!request.request) return callback();

            // Check if request is from a workspace package
            const issuer = request.context?.issuer || request.path;
            if (!issuer) return callback();

            const id = request.request;
            const resolvedPath = shouldResolvePeerDependency(
              id,
              issuer,
              pathResolver
            );

            if (!resolvedPath) {
              return callback();
            }

            const packageName = extractPackageName(id);
            logger.debug(
              `Resolving peer dependency "${id}" (package: ${packageName}) from app's node_modules`
            );

            const obj = {
              ...request,
              path: resolvedPath,
            };

            resolver.doResolve(
              target,
              obj,
              `resolved peer dependency ${id} from app's node_modules`,
              resolveContext,
              callback
            );
          }
        );
    },
  };
}

/**
 * Add plugin to Next.js webpack config
 * @param {Object} webpackConfig - Next.js webpack config
 * @param {Object} options - Plugin options
 * @returns {Object} Modified webpack config
 */
export function withPeerDependencyResolver(webpackConfig, options = {}) {
  if (!webpackConfig.resolve) {
    webpackConfig.resolve = {};
  }

  if (!webpackConfig.resolve.plugins) {
    webpackConfig.resolve.plugins = [];
  }

  webpackConfig.resolve.plugins.push(
    createNextPeerDependencyResolverPlugin(options)
  );

  return webpackConfig;
}
