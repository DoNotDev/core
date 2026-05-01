/**
 * @fileoverview AppRoot Resolution for Next.js
 * @description Resolves app root before handlers are created
 */

import { PathResolver } from '../utils/PathResolver.js';

/**
 * Resolve app root with priority: DNDEV_APP_ROOT env var > fallback detection
 * @param {Object} options - Options
 * @param {Object} options.logger - Logger instance
 * @param {boolean} options.debug - Enable debug logging
 * @returns {Object} { appRoot, appRootSet }
 */
export function resolveAppRoot({ logger, debug = false } = {}) {
  const pathResolver = PathResolver.getInstance();
  let appRootSet = false;
  let appRoot = null;

  // First: Check DNDEV_APP_ROOT env var (set by CLI dev command)
  if (process.env.DNDEV_APP_ROOT) {
    appRoot = pathResolver.normalizePath(process.env.DNDEV_APP_ROOT);
    if (pathResolver.pathExists(appRoot)) {
      pathResolver.setAppRoot(appRoot);
      appRootSet = true;
      if (debug && logger) {
        logger.debug(`App root set from DNDEV_APP_ROOT: ${appRoot}`);
      }
    } else if (logger) {
      logger.warn(`DNDEV_APP_ROOT path does not exist: ${appRoot}`);
    }
  } else if (debug && logger) {
    logger.debug('DNDEV_APP_ROOT env var not set');
  }

  // Fallback: Try to detect app root (only if env var not set)
  if (!appRootSet) {
    const repoRoot = pathResolver.getRepoRoot();
    if (repoRoot) {
      const appsDir = pathResolver.resolveRepoPath('apps');
      if (pathResolver.pathExists(appsDir)) {
        try {
          const cwd = process.cwd();
          const normalizedCwd = pathResolver.normalizePath(cwd);
          if (normalizedCwd.includes('/apps/')) {
            const appsIndex = normalizedCwd.indexOf('/apps/');
            const afterApps = normalizedCwd.substring(appsIndex + 6);
            const appName = afterApps.split('/')[0];
            if (appName) {
              const candidateAppRoot = pathResolver.resolveRepoPath(
                `apps/${appName}`
              );
              const configPath = pathResolver.resolveRepoPath(
                `apps/${appName}/next.config.js`
              );
              if (pathResolver.pathExists(configPath)) {
                appRoot = candidateAppRoot;
                pathResolver.setAppRoot(appRoot);
                appRootSet = true;
                if (debug && logger) {
                  logger.debug(
                    `App root detected from process.cwd(): ${appRoot}`
                  );
                }
              }
            }
          }
        } catch (error) {
          // Fallback to process.cwd()
        }
      }
    }

    // Final fallback: use process.cwd() (might be wrong, but better than crashing)
    if (!appRootSet && !appRoot) {
      appRoot = process.cwd();
      pathResolver.setAppRoot(appRoot);
      appRootSet = true;
      if (debug && logger) {
        logger.debug(`App root fallback to process.cwd(): ${appRoot}`);
      }
    }
  }

  return { appRoot, appRootSet };
}
