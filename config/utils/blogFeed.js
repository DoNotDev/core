/**
 * @fileoverview Blog feed detection
 * @description Whether the app has an RSS feed: the SEO pipeline (SEOGenerator) writes
 * `rss.xml` only when `src/content/blog/` holds at least one `<slug>_en.md` post.
 * The route manifest carries this fact (`hasBlogFeed`) so the page head links `/rss.xml`
 * only when the feed exists.
 *
 * @version 0.0.1
 * @since 0.1.49
 * @author AMBROISE PARK Consulting
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Whether the app at `appRoot` has blog posts (so `rss.xml` is generated).
 * Same rule as `SEOGenerator.discoverBlogPosts`: `src/content/blog/*_en.md`.
 * @param {string} appRoot - Absolute app root
 * @returns {boolean}
 */
export function hasBlogFeed(appRoot) {
  const blogDir = join(appRoot, 'src', 'content', 'blog');
  try {
    if (!existsSync(blogDir)) return false;
    return readdirSync(blogDir).some((f) => f.endsWith('_en.md'));
  } catch {
    return false;
  }
}
