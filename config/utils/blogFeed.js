/**
 * @fileoverview Blog posts at build: the one reading of `src/content/blog/`
 * @description The build reads blog posts in one way for every output ({@link readBlogPosts}):
 * the post files (`<slug>_en.md`, one URL per post, sorted so every build lists them in the
 * same order) and their frontmatter (`parseBlogFrontmatter` of `./blogFrontmatter.js`,
 * generated from @donotdev/core `blogFrontmatter.ts`, the runtime's reading). Read once per
 * build: a Vite build in the route plugin (the route manifest's `blogPosts`, which the blog
 * routes `expandBlogRoutes`, the SEO plugin's rss.xml / llms-full.txt and the prerender's
 * sitemap / llms.txt use), a Next build in the SEO handler (`SEOGenerator.discoverBlogPosts`).
 * The RSS link (`hasBlogFeed`: the route manifest carries it so the page head links
 * `/rss.xml` only when the feed exists) only lists the directory.
 *
 * @version 0.1.0
 * @since 0.1.49
 * @author AMBROISE PARK Consulting
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parseBlogFrontmatter } from './blogFrontmatter.js';
import { PathResolver } from './PathResolver.js';

/**
 * The post files among a blog directory's entries: `<slug>_en.md` (one URL per post,
 * whatever its translations), sorted.
 * @param {string[]} entries - File names in `src/content/blog/`
 * @returns {string[]}
 * @since 0.3.2
 */
export function blogPostFiles(entries) {
  return entries.filter((file) => file.endsWith('_en.md')).sort();
}

/**
 * Whether the app at `appRoot` has blog posts (so `rss.xml` is generated):
 * {@link blogPostFiles} in `src/content/blog/`.
 * @param {string} appRoot - Absolute app root
 * @returns {boolean}
 */
export function hasBlogFeed(appRoot) {
  const blogDir = join(appRoot, 'src', 'content', 'blog');
  try {
    if (!existsSync(blogDir)) return false;
    return blogPostFiles(readdirSync(blogDir)).length > 0;
  } catch {
    return false;
  }
}

/**
 * The app's blog posts, newest first: {@link blogPostFiles} of `src/content/blog/` with
 * their frontmatter (`title`, else the slug; `description`; `date`, else the file's mtime,
 * warned; comma-separated `tags`; `image`).
 * @param {string} appRoot - Absolute app root
 * @param {{ info: Function, warn: Function, debug: Function }} logger - Build logger
 * @returns {Array<{slug: string, title: string, description: string, date: string, tags: string[], image: string | null}>}
 *   `[]` without a blog directory or posts, or when the directory cannot be read (debug-logged)
 * @since 0.3.2
 */
export function readBlogPosts(appRoot, logger) {
  const pathResolver = PathResolver.getInstance();
  const blogDir = pathResolver.resolvePath('src/content/blog', appRoot);

  try {
    if (!pathResolver.pathExists(blogDir)) return [];

    const files = blogPostFiles(pathResolver.readdirSync(blogDir));
    if (files.length === 0) return [];

    const posts = [];

    for (const file of files) {
      const filePath = pathResolver.resolvePath(file, blogDir);
      const raw = pathResolver.readSync(filePath, { format: 'text' });
      const slug = file.replace(/_en\.md$/, '');

      const { meta } = parseBlogFrontmatter(raw);

      // Date: frontmatter > file mtime > warn
      let postDate = meta.date;
      if (!postDate) {
        try {
          const stat = pathResolver.statSync(filePath);
          postDate = stat.mtime.toISOString().split('T')[0];
          logger.warn(
            `Blog post "${slug}" has no frontmatter date, using file mtime (${postDate})`
          );
        } catch {
          postDate = new Date().toISOString().split('T')[0];
          logger.warn(`Blog post "${slug}" has no date and file stat failed, using today`);
        }
      }

      posts.push({
        slug,
        title: meta.title || slug,
        description: meta.description || '',
        date: postDate,
        tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : [],
        image: meta.image || null,
      });
    }

    // Sort by date descending
    posts.sort((a, b) => b.date.localeCompare(a.date));

    logger.info(`📝 Discovered ${posts.length} blog post(s) in src/content/blog/`);

    return posts;
  } catch (error) {
    logger.debug(`Blog content discovery skipped: ${error.message}`);
    return [];
  }
}
