// ----- config/next/runtime.js -----
/**
 * @fileoverview Next.js server runtime entry
 * @description What Next apps' server code imports at request time: route handlers and
 * server components (`@donotdev/core/next` under the `react-server` condition, see
 * package.json). No build tooling (webpack plugins, babel, fast-glob): a route handler
 * that imports it bundles only this. `next.config` gets index.js (config + this).
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

// Server-side SEO utilities
export {
  getMetadataForPath,
  clearMetadataCache,
} from './getMetadataForPath.js';

// Sitemap / llms.txt (generated app/sitemap.xml and app/llms.txt route handlers)
export { buildSitemap, formatSitemapXml } from './seo/sitemap.js';
export { buildLlmsTxt } from './seo/llmsTxt.js';
export { appBaseUrl } from './seo/baseUrl.js';

// generateStaticParams of the generated entity pages (same records as the sitemap)
export { listStaticParams } from './seo/publicPages.js';

// On-demand revalidation (generated app/api/dndev/revalidate route handler)
export {
  handleRevalidationWebhook,
  revalidationPaths,
  REVALIDATE_ROUTE_PATH,
  REVALIDATE_SECRET_ENV,
} from './revalidation.js';
