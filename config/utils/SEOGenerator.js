/**
 * @fileoverview SEO Generator - Core SEO Logic
 * @description Generates robots.txt, sitemap.xml, rss.xml, and SEO manifest. Platform-agnostic - used by both Vite and Next.js.
 * Auto-discovers blog content from src/content/blog/ and integrates posts into sitemap + RSS.
 *
 * @version 0.0.2
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { PathResolver } from './PathResolver.js';
import { createLogger } from './debugLog.js';
import { RouteDiscovery } from '../discovery/RouteDiscovery.js';

/**
 * Escape XML special characters in text content and attribute values
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitize content for use inside CDATA sections.
 * CDATA cannot contain the sequence ]]> - split it to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeCdata(str) {
  if (!str) return '';
  return str.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

/**
 * SEO Generator class - single source of truth for SEO generation
 */
export class SEOGenerator {
  constructor(options = {}) {
    const {
      debug = false,
      generateRobotsTxt = true,
      generateSitemap = true,
      baseUrl,
      siteName,
      crawlDelay = 1,
      aiCrawlers = 'recommended',
      routes: routeOptions = {},
      ...pluginOptions
    } = options;

    // Validate required options
    if (!baseUrl || !siteName) {
      throw new Error('SEOGenerator requires baseUrl and siteName options');
    }

    this.options = {
      debug,
      generateRobotsTxt,
      generateSitemap,
      baseUrl,
      siteName,
      crawlDelay,
      aiCrawlers,
      routes: routeOptions,
      defaultImage: '/og-image.jpg',
      twitterHandle: '@donotdev',
      defaultAuthor: 'DNDev Team',
      defaultLanguage: 'en',
      blogPath: '/blog',
      staticTags: {},
      ...pluginOptions,
    };

    this.appRoot = pluginOptions.appRoot || null;

    this.logger = createLogger('SEO Generator', options.debug, options.verbose);
  }

  /**
   * Generate all SEO files
   * @param {Object} routeData - Route discovery data
   * @param {Function} writeFile - Function to write files (platform-specific)
   * @returns {Object} Generation results
   */
  async generateSEOFiles(routeData, writeFile) {
    try {
      // Generate route meta tags
      const routeMetaTags = this.generateRouteMetaTags(routeData.routes || []);

      // Prepare SEO data
      const seoData = {
        routes: routeData.routes || [],
        routeMetaTags,
        baseUrl: this.options.baseUrl,
        siteName: this.options.siteName,
      };

      // Discover blog content (no-ops if src/content/blog/ doesn't exist)
      const blogPosts = this.discoverBlogPosts();

      const results = {
        robotsTxt: null,
        sitemap: null,
        rss: null,
        manifest: null,
        totalRoutes: seoData.routes.length,
        publicRoutes: seoData.routes.filter((r) => !r.auth || r.auth === false)
          .length,
        protectedRoutes: seoData.routes.filter((r) => r.auth && r.auth.required)
          .length,
        blogPosts: blogPosts.length,
      };

      // Generate robots.txt
      if (this.options.generateRobotsTxt) {
        results.robotsTxt = await this.generateRobotsTxt(seoData, writeFile);
      }

      // Generate sitemap.xml (includes blog post URLs if any)
      if (this.options.generateSitemap) {
        results.sitemap = await this.generateSitemap(
          seoData,
          writeFile,
          blogPosts
        );
      }

      // Generate RSS feed if blog content exists
      if (blogPosts.length > 0) {
        results.rss = await this.generateRSSFeed(blogPosts, writeFile);
      }

      // Generate SEO manifest
      results.manifest = await this.generateManifest(seoData, writeFile);

      return results;
    } catch (error) {
      this.logger.error(
        `SEO generator failed to create files (robots.txt/sitemap.xml/manifest): ${error.message}`
      );
      this.logger.error(`Stack: ${error.stack || 'No stack trace available'}`);
      // Log error but continue - SEO files are optional, build can proceed without them
      throw error; // Re-throw to let caller decide - SEO plugin/handler will catch and continue
    }
  }

  /**
   * Generate robots.txt file
   * @param {Object} seoData - SEO data
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateRobotsTxt(seoData, writeFile) {
    const disallowedPaths = [];

    // Auto-detect protected routes to disallow
    (seoData.routes || []).forEach((route) => {
      if (route.auth && route.auth.required) {
        // Ensure path starts with /
        const path = route.path.startsWith('/') ? route.path : `/${route.path}`;
        disallowedPaths.push(path);
      }
    });

    // Add common disallowed paths
    disallowedPaths.push('/admin', '/api', '/_next', '/static');

    const robotsContent = this.generateRobotsTxtContent({
      disallowedPaths: [...new Set(disallowedPaths)], // Remove duplicates
      sitemap: `${this.options.baseUrl}/sitemap.xml`,
      crawlDelay: this.options.crawlDelay,
    });

    await writeFile('robots.txt', robotsContent);

    return {
      fileName: 'robots.txt',
      content: robotsContent,
      disallowedPaths: disallowedPaths.length,
    };
  }

  /**
   * Generate sitemap.xml file
   * @param {Object} seoData - SEO data
   * @param {Function} writeFile - Function to write files
   * @param {Array} blogPosts - Discovered blog posts (from discoverBlogPosts)
   * @returns {Object} Generation result
   */
  async generateSitemap(seoData, writeFile, blogPosts = []) {
    const publicRoutes = (seoData.routes || []).filter((route) => {
      // Exclude auth-protected routes
      if (route.auth && route.auth !== false) return false;
      // Exclude dynamic :param routes (not real URLs)
      if (typeof route.path === 'string' && route.path.includes(':'))
        return false;
      // Exclude /blog if blog posts exist (blog discovery adds it with proper lastmod)
      if (blogPosts.length > 0 && route.path === this.options.blogPath)
        return false;
      return true;
    });

    const sitemapUrls = publicRoutes.map((route) => ({
      url: route.path,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: route.path === '/' ? '1.0' : '0.8',
    }));

    // Append blog post URLs if any
    if (blogPosts.length > 0) {
      sitemapUrls.push({
        url: this.options.blogPath,
        lastmod: blogPosts[0]?.date || new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.7',
      });

      for (const post of blogPosts) {
        sitemapUrls.push({
          url: `${this.options.blogPath}/${post.slug}`,
          lastmod: post.date,
          changefreq: 'monthly',
          priority: '0.6',
          image: post.image || null,
        });
      }
    }

    const sitemapContent = this.generateSitemapContent(sitemapUrls);

    await writeFile('sitemap.xml', sitemapContent);

    return {
      fileName: 'sitemap.xml',
      content: sitemapContent,
      publicRoutes: sitemapUrls.length,
    };
  }

  /**
   * Generate SEO manifest
   * @param {Object} seoData - SEO data
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateManifest(seoData, writeFile) {
    const manifest = {
      totalRoutes: seoData.routes?.length || 0,
      publicRoutes:
        seoData.routes?.filter((r) => !r.auth || r.auth === false).length || 0,
      protectedRoutes:
        seoData.routes?.filter((r) => r.auth && r.auth.required).length || 0,
      baseUrl: this.options.baseUrl,
      siteName: this.options.siteName,
      generatedAt: new Date().toISOString(),
      routeMetaTags: seoData.routeMetaTags || [],
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    await writeFile('seo-manifest.json', manifestContent);

    return {
      fileName: 'seo-manifest.json',
      content: manifestContent,
      manifest,
    };
  }

  /**
   * Generate robots.txt content
   * @param {Object} options - Robots.txt options
   * @returns {string} Robots.txt content
   */
  generateRobotsTxtContent(options = {}) {
    const {
      allowedPaths = ['/'],
      disallowedPaths = ['/admin', '/api'],
      sitemap,
      crawlDelay,
    } = options;

    // Ensure all paths are properly formatted
    const formatPath = (path) => {
      if (!path) return '/';
      if (path === '*') return '*';
      return path.startsWith('/') ? path : `/${path}`;
    };

    const robotsTxt = [
      'User-agent: *',
      ...disallowedPaths.map((path) => `Disallow: ${formatPath(path)}`),
      ...allowedPaths.map((path) => `Allow: ${formatPath(path)}`),
    ];

    if (crawlDelay) {
      robotsTxt.push(`Crawl-delay: ${crawlDelay}`);
    }

    if (sitemap) {
      robotsTxt.push(`Sitemap: ${sitemap}`);
    }

    // AI crawler directives
    const aiCrawlers = this.options.aiCrawlers;
    if (aiCrawlers && aiCrawlers !== false) {
      robotsTxt.push('');
      robotsTxt.push(...generateAICrawlerDirectives(aiCrawlers));
    }

    return robotsTxt.join('\n');
  }

  /**
   * Generate sitemap XML content
   * @param {Array} urls - Array of URLs with metadata
   * @returns {string} Sitemap XML content
   */
  generateSitemapContent(urls) {
    const hasImages = urls.some((u) => u.image);
    const urlElements = urls
      .map(({ url, lastmod, changefreq, priority, image }) => {
        const elements = [
          `    <loc>${escapeXml(this.options.baseUrl)}${escapeXml(url)}</loc>`,
        ];

        if (lastmod) {
          elements.push(`    <lastmod>${lastmod}</lastmod>`);
        }

        if (changefreq) {
          elements.push(`    <changefreq>${changefreq}</changefreq>`);
        }

        if (priority) {
          elements.push(`    <priority>${priority}</priority>`);
        }

        if (image) {
          elements.push(
            `    <image:image>\n      <image:loc>${escapeXml(this.options.baseUrl)}${escapeXml(image)}</image:loc>\n    </image:image>`
          );
        }

        return `  <url>\n${elements.join('\n')}\n  </url>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? '\n    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>
  ${urlElements}
  </urlset>`;
  }

  /**
   * Generate meta tags from routes data
   * @param {Array} routes - Route data
   * @returns {Array} Array of meta tag objects
   */
  generateRouteMetaTags(routes) {
    return routes.map((route) => {
      // Generate meaningful title
      let title = this.options.siteName;
      if (route.meta?.title) {
        title = `${route.meta.title} - ${this.options.siteName}`;
      } else if (route.path !== '/') {
        // Generate title from path
        const pathParts = route.path.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          const formattedPart = lastPart
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          title = `${formattedPart} - ${this.options.siteName}`;
        }
      }

      // Generate meaningful description
      let description = `Welcome to ${this.options.siteName}`;
      if (route.meta?.description) {
        description = route.meta.description;
      } else if (route.meta?.entity && route.meta?.action) {
        description = `${route.meta.action} ${route.meta.entity} on ${this.options.siteName}`;
      } else if (route.path !== '/') {
        // Generate description from path
        const pathParts = route.path.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          const formattedPart = lastPart
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          description = `Explore ${formattedPart.toLowerCase()} on ${this.options.siteName}`;
        }
      }

      return {
        path: route.path,
        meta: {
          title,
          description,
          canonical: `${this.options.baseUrl}${route.path}`,
          robots:
            route.auth && route.auth.required
              ? 'noindex, nofollow'
              : 'index, follow',
        },
      };
    });
  }

  /**
   * Discover blog posts from src/content/blog/ directory.
   * Reads only *_en.md files (one URL per post for sitemap/RSS, regardless of translations).
   * @returns {Array<{slug: string, title: string, description: string, date: string, tags: string[]}>}
   */
  discoverBlogPosts() {
    if (!this.appRoot) return [];

    const pathResolver = PathResolver.getInstance();
    const blogDir = pathResolver.resolvePath('src/content/blog', this.appRoot);

    try {
      if (!pathResolver.pathExists(blogDir)) return [];

      const files = pathResolver
        .readdirSync(blogDir)
        .filter((f) => f.endsWith('_en.md'));
      if (files.length === 0) return [];

      const posts = [];

      for (const file of files) {
        const filePath = pathResolver.resolvePath(file, blogDir);
        const raw = pathResolver.readSync(filePath, { format: 'text' });
        const slug = file.replace(/_en\.md$/, '');

        // Parse frontmatter
        const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const meta = {};
        if (match) {
          for (const line of match[1].split('\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            meta[line.slice(0, colonIdx).trim()] = line
              .slice(colonIdx + 1)
              .trim();
          }
        }

        // Date: frontmatter > file mtime > warn
        let postDate = meta.date;
        if (!postDate) {
          try {
            const stat = pathResolver.statSync(filePath);
            postDate = stat.mtime.toISOString().split('T')[0];
            this.logger.warn(
              `Blog post "${slug}" has no frontmatter date, using file mtime (${postDate})`
            );
          } catch {
            postDate = new Date().toISOString().split('T')[0];
            this.logger.warn(
              `Blog post "${slug}" has no date and file stat failed, using today`
            );
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

      this.logger.info(
        `📝 Discovered ${posts.length} blog post(s) in src/content/blog/`
      );

      return posts;
    } catch (error) {
      this.logger.debug(`Blog content discovery skipped: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate RSS 2.0 feed from discovered blog posts.
   * @param {Array} blogPosts - Discovered blog posts
   * @param {Function} writeFile - Function to write files
   * @returns {Object} Generation result
   */
  async generateRSSFeed(blogPosts, writeFile) {
    const items = blogPosts
      .map(
        (post) => `    <item>
      <title><![CDATA[${escapeCdata(post.title)}]]></title>
      <link>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}/${escapeXml(post.slug)}</link>
      <guid>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}/${escapeXml(post.slug)}</guid>
      <description><![CDATA[${escapeCdata(post.description)}]]></description>
      <pubDate>${post.date ? new Date(post.date).toUTCString() : ''}</pubDate>${
        post.tags.length
          ? `\n      <category>${escapeXml(post.tags.join(', '))}</category>`
          : ''
      }${
        post.image
          ? `\n      <enclosure url="${escapeXml(this.options.baseUrl)}${escapeXml(post.image)}" type="image/png" length="0"/>`
          : ''
      }
    </item>`
      )
      .join('\n');

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(this.options.siteName)}</title>
    <link>${escapeXml(this.options.baseUrl)}${escapeXml(this.options.blogPath)}</link>
    <description>${escapeXml(this.options.siteName)} Blog</description>
    <language>en</language>
    <atom:link href="${escapeXml(this.options.baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    await writeFile('rss.xml', rssContent);

    return {
      fileName: 'rss.xml',
      content: rssContent,
      postCount: blogPosts.length,
    };
  }

  /**
   * Get generation summary
   * @param {Object} seoData - SEO data
   * @returns {string} Summary string
   */
  getGenerationSummary(seoData) {
    const totalRoutes = seoData.routes?.length || 0;
    const publicRoutes =
      seoData.routes?.filter((r) => !r.auth || r.auth === false).length || 0;
    const protectedRoutes =
      seoData.routes?.filter((r) => r.auth && r.auth.required).length || 0;

    return `${totalRoutes} routes (${publicRoutes} public, ${protectedRoutes} protected)`;
  }

  /**
   * Format API response
   * @param {Object} seoData - SEO data
   * @returns {Object} API response
   */
  formatAPIResponse(seoData) {
    return {
      totalRoutes: seoData.routes?.length || 0,
      publicRoutes:
        seoData.routes?.filter((r) => !r.auth || r.auth === false).length || 0,
      protectedRoutes:
        seoData.routes?.filter((r) => r.auth && r.auth.required).length || 0,
      baseUrl: this.options.baseUrl,
      siteName: this.options.siteName,
      generatedAt: new Date().toISOString(),
    };
  }
}

// --- AI Crawler Directives ---

/** Training bots — block by default in 'recommended' mode */
const TRAINING_BOTS = ['GPTBot', 'Google-Extended', 'CCBot', 'ClaudeBot'];

/** Search/retrieval bots — allow by default in 'recommended' mode */
const SEARCH_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
];

/**
 * Generate robots.txt directives for AI crawlers
 * @param {'recommended'|'block-all'|'allow-all'} mode
 * @returns {string[]} Lines to append to robots.txt
 */
function generateAICrawlerDirectives(mode) {
  const lines = ['# AI Crawler Management'];

  if (mode === 'block-all') {
    for (const bot of [...TRAINING_BOTS, ...SEARCH_BOTS]) {
      lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
    }
    return lines;
  }

  if (mode === 'allow-all') {
    for (const bot of [...TRAINING_BOTS, ...SEARCH_BOTS]) {
      lines.push(`User-agent: ${bot}`, 'Allow: /', '');
    }
    return lines;
  }

  // 'recommended' (default): block training, allow search/retrieval
  for (const bot of TRAINING_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  }
  for (const bot of SEARCH_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Allow: /', '');
  }

  return lines;
}
