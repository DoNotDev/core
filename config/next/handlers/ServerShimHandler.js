/**
 * @fileoverview Next.js ServerShim Handler
 * @description Simple webpack externals for server-only packages to prevent client-side bundling of server-only code.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { SERVER_ONLY_PACKAGES } from '../../constants.js';

export function createNextServerShimHandler(options = {}) {
  // Trust merged config - defaults come from DEFAULT_OPTIONS.serverShim
  // Note: serverShim cannot be disabled - framework would crash without it
  const { debug } = options; // Already merged from DEFAULT_OPTIONS.serverShim

  return (nextConfig = {}) => ({
    ...nextConfig,
    webpack: (config, context) => {
      const { isServer } = context;

      // Only add externals for client builds
      if (!isServer) {
        // Initialize externals as an object if it doesn't exist
        if (!config.externals) {
          config.externals = {};
        }

        // Add server-only packages as externals
        SERVER_ONLY_PACKAGES.forEach((pkg) => {
          config.externals[pkg] = `commonjs ${pkg}`;
        });
      }

      // Call original webpack config if exists
      if (nextConfig.webpack) {
        return nextConfig.webpack(config, context);
      }

      return config;
    },
  });
}
