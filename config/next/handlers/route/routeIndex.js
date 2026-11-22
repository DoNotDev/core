/**
 * @fileoverview Next route handler: Route index files
 * @description `src/app/routes.generated.ts` (app router) or `src/pages/routes.generated.ts` (pages router): every discovered route with its auth and meta. Methods of {@link NextRouteHandler} (mixed into its prototype by
 * `../RouteHandler.js`); `this` is the route handler.
 *
 * @version 0.0.1
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

export const routeIndexMethods = {
  async generateAppRoutes(routeData) {
    const routesContent = this.generateAppRoutesContent(routeData.routes);
    this.writeGeneratedFile(
      'src/app/routes.generated.ts',
      routesContent,
      'app routes index'
    );
  },

  generateAppRoutesContent(routes) {
    const routeExports = routes
      .map((route) => {
        const componentName =
          route.componentName || this.pathToComponentName(route.path);
        // Next.js-specific import resolution: relative to app directory
        // RouteDiscovery returns 'file' (relativePath), not 'relativePath'
        const relativePath = route.relativePath || route.file;
        if (!relativePath) {
          this.logger.warn(`Route ${route.path} missing file path, skipping`);
          return null;
        }
        const importPath = relativePath
          .replace(/\.tsx$/, '')
          .replace(/^src\//, '../');

        return `  {
    path: '${route.path}',
    component: lazy(() => import('${importPath}')),
    auth: ${JSON.stringify(route.auth)},
    meta: ${JSON.stringify(route.meta)}
  }`;
      })
      .filter((item) => item !== null)
      .join(',\n');

    return `// Auto-generated app routes by @donotdev/config
// Generated at ${new Date().toISOString()}

import { lazy } from 'react';

export const appRoutes = [
${routeExports}
];

export const routeManifest = {
  totalRoutes: ${routes.length},
  routingMode: 'app',
  generatedAt: '${new Date().toISOString()}'
};

export default appRoutes;
`;
  },

  async generatePagesRoutes(routeData) {
    const routesContent = this.generatePagesRoutesContent(routeData.routes);
    this.writeGeneratedFile(
      'src/pages/routes.generated.ts',
      routesContent,
      'pages routes index'
    );
  },

  generatePagesRoutesContent(routes) {
    const routeExports = routes
      .map((route) => {
        return `  '${route.path}': {
    auth: ${JSON.stringify(route.auth)},
    meta: ${JSON.stringify(route.meta)},
    file: '${route.file}'
  }`;
      })
      .join(',\n');

    return `// Auto-generated pages routes by @donotdev/config
// Generated at ${new Date().toISOString()}

export const pageRoutes = {
${routeExports}
};

export const routeManifest = {
  totalRoutes: ${routes.length},
  routingMode: 'pages',
  generatedAt: '${new Date().toISOString()}'
};

export default pageRoutes;
`;
  },

  pathToComponentName(path) {
    return (
      path
        .split('/')
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('') + 'Page'
    );
  },
};
