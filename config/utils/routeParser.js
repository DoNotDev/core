/**
 * @fileoverview Route Parser - Shared Route Manifest Parsing
 * @description The route manifest of a Vite build (`createRouteManifestStore`: the route
 * plugin's routes, shared in memory with the SEO and prerender plugins), blog post routes
 * expanded from their frontmatter and the public static route filter.
 *
 * @version 0.0.1
 * @since 0.1.0
 * @author AMBROISE PARK Consulting
 */

/**
 * Expand dynamic blog routes (/blog/:slug) into concrete route objects with SEO metadata
 * from the posts' frontmatter: the blog index, then one route per post.
 * @param {Array} routes - Parsed route objects
 * @param {ReturnType<typeof import('./blogFeed.js').readBlogPosts>} blogPosts - The build's blog posts (read once)
 * @param {Object} [options]
 * @param {string} [options.blogPath='/blog'] - Blog URL prefix
 * @returns {Array<{path: string, auth: false, meta: Object}>} Expanded route objects with frontmatter SEO
 *   (none without a dynamic blog route or posts)
 */
export function expandBlogRoutes(routes, blogPosts, options = {}) {
  const { blogPath = '/blog' } = options;

  // Find if there's a dynamic blog route pattern
  const hasBlogRoute = routes.some((r) => {
    const path = r.path || r;
    return (
      typeof path === 'string' &&
      path.startsWith(blogPath + '/') &&
      path.includes(':')
    );
  });

  if (!hasBlogRoute || blogPosts.length === 0) return [];

  return [
    { path: blogPath, auth: false, meta: { namespace: 'blog' } },
    ...blogPosts.map((post) => ({
      path: `${blogPath}/${post.slug}`,
      auth: false,
      meta: {
        namespace: 'blog',
        seo: {
          title: post.title,
          description: post.description || null,
          image: post.image,
          type: 'article',
        },
      },
    })),
  ];
}

/**
 * The route manifest of a Vite build, in memory: the route plugin sets it at `buildStart`
 * (its discovered routes, blog posts expanded, and the blog posts, read once:
 * `readBlogPosts`; no file is written), the SEO and prerender plugins read it
 * (`createVitePlugins` hands one store to all three), so no plugin parses a file back or
 * reads the posts again. It also carries the route discovery's entities resolver to the
 * asset plugin (`useEntityResolver`, `entityResolver()`).
 * @returns {{ set: (manifest: { routes: Array, source: string, blogPosts: Array }) => void, get: () => { routes: Array, errors: string[], source: string, blogPosts: Array }, useEntityResolver: (resolver: Object) => void, entityResolver: () => Promise<Object> }}
 * @since 0.3.2
 */
export function createRouteManifestStore() {
  let manifest = null;
  let resolveEntityResolver;
  const entityResolver = new Promise((resolve) => {
    resolveEntityResolver = resolve;
  });
  return {
    set({ routes, source, blogPosts }) {
      if (!Array.isArray(blogPosts)) {
        throw new Error('[dndev] Route manifest: set() needs the build\'s blogPosts (readBlogPosts).');
      }
      manifest = { routes, errors: [], source, blogPosts };
    },
    /**
     * Set by the route plugin after its discovery (whatever its outcome but a build error).
     * @param {{ usesFieldType: (type: string) => Promise<boolean> }} resolver - `createEntityResolver` of the route discovery
     */
    useEntityResolver(resolver) {
      resolveEntityResolver(resolver);
    },
    /**
     * The route discovery's entities resolver: the asset plugin reads the entities' field
     * types from it (tel-field flags) without parsing the entities package again.
     * @returns {Promise<{ usesFieldType: (type: string) => Promise<boolean> }>}
     */
    entityResolver: () => entityResolver,
    get() {
      if (!manifest) {
        throw new Error(
          '[dndev] Route manifest unavailable: route discovery did not run or failed (see the error above).'
        );
      }
      return manifest;
    },
  };
}

/**
 * Filter routes to only public (non-auth, non-dynamic) routes
 * @param {Array} routes - Parsed route objects
 * @returns {string[]} Array of public route paths
 */
export function getPublicStaticRoutes(routes) {
  return routes
    .filter((route) => {
      const path = route.path || route;
      // Skip auth-protected routes
      if (route.auth && route.auth.required) return false;
      // Skip dynamic :param routes
      if (typeof path === 'string' && path.includes(':')) return false;
      return true;
    })
    .map((route) => route.path || route);
}
