import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SEOGenerator } from '../SEOGenerator.js';

// Mock PathResolver
const mockPathExists = vi.fn(() => false);
const mockReaddirSync = vi.fn(() => [] as string[]);
const mockReadSync = vi.fn(() => '');
const mockStatSync = vi.fn(() => ({ mtime: new Date('2025-06-15T00:00:00Z') }));

vi.mock('../PathResolver.js', () => ({
  PathResolver: {
    getInstance: () => ({
      resolvePath: (rel: string, base: string) => `${base}/${rel}`,
      pathExists: mockPathExists,
      readdirSync: mockReaddirSync,
      readSync: mockReadSync,
      statSync: mockStatSync,
    }),
  },
}));

// Mock debugLog
vi.mock('../debugLog.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
  }),
}));

// Mock RouteDiscovery
vi.mock('../../discovery/RouteDiscovery.js', () => ({
  RouteDiscovery: class {},
}));

const BASE_OPTIONS = {
  baseUrl: 'https://example.com',
  siteName: 'Test App',
  debug: false,
};

describe('SEOGenerator', () => {
  let generator: SEOGenerator;

  beforeEach(() => {
    generator = new SEOGenerator(BASE_OPTIONS);
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('throws when baseUrl is missing', () => {
      expect(() => new SEOGenerator({ siteName: 'Test' })).toThrow(
        'SEOGenerator requires baseUrl and siteName options'
      );
    });

    it('throws when siteName is missing', () => {
      expect(() => new SEOGenerator({ baseUrl: 'https://x.com' })).toThrow(
        'SEOGenerator requires baseUrl and siteName options'
      );
    });

    it('stores options correctly', () => {
      expect(generator.options.baseUrl).toBe('https://example.com');
      expect(generator.options.siteName).toBe('Test App');
      expect(generator.options.crawlDelay).toBe(1);
    });
  });

  // --- robots.txt ---

  describe('generateRobotsTxtContent', () => {
    it('generates valid robots.txt with defaults', () => {
      const content = generator.generateRobotsTxtContent({
        disallowedPaths: ['/admin', '/api'],
        sitemap: 'https://example.com/sitemap.xml',
        crawlDelay: 1,
      });

      expect(content).toContain('User-agent: *');
      expect(content).toContain('Disallow: /admin');
      expect(content).toContain('Disallow: /api');
      expect(content).toContain('Allow: /');
      expect(content).toContain('Sitemap: https://example.com/sitemap.xml');
      expect(content).toContain('Crawl-delay: 1');
    });

    it('formats paths without leading slash', () => {
      const content = generator.generateRobotsTxtContent({
        disallowedPaths: ['admin'],
      });
      expect(content).toContain('Disallow: /admin');
    });

    it('includes AI crawler directives in recommended mode', () => {
      const content = generator.generateRobotsTxtContent({});
      expect(content).toContain('# AI Crawler Management');
      expect(content).toContain('User-agent: GPTBot');
      expect(content).toContain('User-agent: OAI-SearchBot');
    });
  });

  // --- sitemap.xml ---

  describe('generateSitemapContent', () => {
    it('generates valid XML structure', () => {
      const content = generator.generateSitemapContent([
        {
          url: '/',
          lastmod: '2026-01-01',
          changefreq: 'weekly',
          priority: '1.0',
        },
        {
          url: '/about',
          lastmod: '2026-01-01',
          changefreq: 'monthly',
          priority: '0.8',
        },
      ]);

      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      );
      expect(content).toContain('<loc>https://example.com/</loc>');
      expect(content).toContain('<loc>https://example.com/about</loc>');
      expect(content).toContain('<lastmod>2026-01-01</lastmod>');
      expect(content).toContain('<changefreq>weekly</changefreq>');
      expect(content).toContain('<priority>1.0</priority>');
      expect(content).toContain('</urlset>');
    });

    it('handles empty urls array', () => {
      const content = generator.generateSitemapContent([]);
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<urlset');
      expect(content).toContain('</urlset>');
    });

    // GRILL FINDING #3: XML escaping in <loc>
    it('SECURITY: baseUrl with ampersand is properly escaped in XML', () => {
      const gen = new SEOGenerator({
        ...BASE_OPTIONS,
        baseUrl: 'https://example.com?a=1&b=2',
      });
      const content = gen.generateSitemapContent([
        {
          url: '/page',
          lastmod: '2026-01-01',
          changefreq: 'weekly',
          priority: '0.8',
        },
      ]);
      expect(content).toContain('https://example.com?a=1&amp;b=2/page');
      expect(content).not.toContain('&b=2'); // raw & must not appear
    });

    it('includes image:image extension for blog posts with images', () => {
      const content = generator.generateSitemapContent([
        {
          url: '/blog/post-1',
          lastmod: '2026-01-01',
          changefreq: 'monthly',
          priority: '0.6',
          image: '/images/post1.jpg',
        },
      ]);
      expect(content).toContain(
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
      );
      expect(content).toContain('<image:image>');
      expect(content).toContain(
        '<image:loc>https://example.com/images/post1.jpg</image:loc>'
      );
    });

    it('omits image namespace when no images present', () => {
      const content = generator.generateSitemapContent([
        {
          url: '/',
          lastmod: '2026-01-01',
          changefreq: 'weekly',
          priority: '1.0',
        },
      ]);
      expect(content).not.toContain('xmlns:image');
    });
  });

  // --- RSS feed ---

  describe('generateRSSFeed', () => {
    const mockWriteFile = vi.fn();
    const blogPosts = [
      {
        slug: 'hello-world',
        title: 'Hello World',
        description: 'First post',
        date: '2026-01-15',
        tags: ['tech', 'intro'],
        image: '/images/hello.png',
      },
    ];

    beforeEach(() => {
      mockWriteFile.mockReset();
    });

    it('generates valid RSS 2.0 feed', async () => {
      const result = await generator.generateRSSFeed(blogPosts, mockWriteFile);

      expect(result.fileName).toBe('rss.xml');
      expect(result.postCount).toBe(1);
      expect(mockWriteFile).toHaveBeenCalledWith('rss.xml', expect.any(String));

      const content = mockWriteFile.mock.calls[0][1];
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<rss version="2.0"');
      expect(content).toContain('<title>Test App</title>'); // siteName has no special chars
      expect(content).toContain('<link>https://example.com/blog</link>');
      expect(content).toContain('<title><![CDATA[Hello World]]></title>');
      expect(content).toContain(
        '<link>https://example.com/blog/hello-world</link>'
      );
      expect(content).toContain('<category>tech, intro</category>');
      expect(content).toContain('url="https://example.com/images/hello.png"');
    });

    it('always generates rss.xml (no skip logic)', async () => {
      const result = await generator.generateRSSFeed(blogPosts, mockWriteFile);

      expect(result.fileName).toBe('rss.xml');
      expect(result.skipped).toBeUndefined();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    // GRILL FINDING #1: Category tag properly escaped
    it('SECURITY: tags with XML special chars are escaped in RSS', () => {
      const postsWithBadTags = [
        {
          slug: 'test',
          title: 'Test',
          description: 'Desc',
          date: '2026-01-01',
          tags: ['C++', 'R&D', 'tag</category>'],
          image: null,
        },
      ];

      return generator
        .generateRSSFeed(postsWithBadTags, mockWriteFile)
        .then(() => {
          const content = mockWriteFile.mock.calls[0][1];
          expect(content).toContain(
            '<category>C++, R&amp;D, tag&lt;/category&gt;</category>'
          );
        });
    });

    // GRILL FINDING #2: Enclosure URL properly escaped
    it('SECURITY: image path with quotes is escaped in enclosure', async () => {
      const postsWithBadImage = [
        {
          slug: 'test',
          title: 'Test',
          description: 'Desc',
          date: '2026-01-01',
          tags: [],
          image: '/images/test"bad',
        },
      ];

      await generator.generateRSSFeed(postsWithBadImage, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      expect(content).toContain(
        'url="https://example.com/images/test&quot;bad"'
      );
    });

    it('handles posts without image', async () => {
      const postsNoImage = [
        {
          slug: 'no-img',
          title: 'No Image',
          description: 'Post without image',
          date: '2026-01-01',
          tags: ['test'],
          image: null,
        },
      ];

      await generator.generateRSSFeed(postsNoImage, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      expect(content).not.toContain('<enclosure');
    });

    // CDATA injection prevention
    it('SECURITY: title/description with ]]> are sanitized in CDATA', async () => {
      const postsWithCdata = [
        {
          slug: 'test',
          title: 'Hello]]><script>alert(1)</script>',
          description: 'Desc]]>injection',
          date: '2026-01-01',
          tags: [],
          image: null,
        },
      ];

      await generator.generateRSSFeed(postsWithCdata, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      // ]]> must be split so CDATA block cannot be terminated
      expect(content).not.toContain('<![CDATA[Hello]]>');
      expect(content).toContain(']]]]><![CDATA[>');
    });

    it('handles posts without tags', async () => {
      const postsNoTags = [
        {
          slug: 'no-tags',
          title: 'No Tags',
          description: 'Post without tags',
          date: '2026-01-01',
          tags: [],
          image: null,
        },
      ];

      await generator.generateRSSFeed(postsNoTags, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      expect(content).not.toContain('<category');
    });
  });

  // --- Sitemap generation (full flow) ---

  describe('generateSitemap', () => {
    const mockWriteFile = vi.fn();

    beforeEach(() => {
      mockWriteFile.mockReset();
    });

    it('generates sitemap with public routes only', async () => {
      const seoData = {
        routes: [
          { path: '/', auth: false },
          { path: '/about', auth: false },
          { path: '/dashboard', auth: { required: true } },
        ],
      };

      const result = await generator.generateSitemap(seoData, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];

      expect(content).toContain('<loc>https://example.com/</loc>');
      expect(content).toContain('<loc>https://example.com/about</loc>');
      expect(content).not.toContain('/dashboard');
      expect(result.publicRoutes).toBe(2);
    });

    it('includes blog posts in sitemap', async () => {
      const seoData = { routes: [{ path: '/', auth: false }] };
      const blogPosts = [
        {
          slug: 'post-1',
          title: 'Post 1',
          description: '',
          date: '2026-03-01',
          tags: [],
          image: null,
        },
      ];

      await generator.generateSitemap(seoData, mockWriteFile, blogPosts);
      const content = mockWriteFile.mock.calls[0][1];

      expect(content).toContain('<loc>https://example.com/blog</loc>');
      expect(content).toContain('<loc>https://example.com/blog/post-1</loc>');
    });

    it('assigns correct priorities', async () => {
      const seoData = {
        routes: [
          { path: '/', auth: false },
          { path: '/about', auth: false },
        ],
      };

      await generator.generateSitemap(seoData, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];

      // Root gets priority 1.0
      expect(content).toMatch(
        /<loc>https:\/\/example\.com\/<\/loc>[\s\S]*?<priority>1\.0<\/priority>/
      );
    });
  });

  // --- robots.txt generation (full flow) ---

  describe('generateRobotsTxt', () => {
    const mockWriteFile = vi.fn();

    beforeEach(() => {
      mockWriteFile.mockReset();
    });

    it('disallows auth-protected routes', async () => {
      const seoData = {
        routes: [
          { path: '/', auth: false },
          { path: '/admin', auth: { required: true } },
          { path: '/settings', auth: { required: true } },
        ],
      };

      await generator.generateRobotsTxt(seoData, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];

      expect(content).toContain('Disallow: /admin');
      expect(content).toContain('Disallow: /settings');
      expect(content).toContain('Disallow: /api');
    });

    it('deduplicates disallowed paths', async () => {
      const seoData = {
        routes: [{ path: '/admin', auth: { required: true } }],
      };

      await generator.generateRobotsTxt(seoData, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];

      // /admin from route + /admin from common paths = should appear only once
      const adminCount = (content.match(/Disallow: \/admin\n/g) || []).length;
      expect(adminCount).toBe(1);
    });
  });

  // --- Meta tags generation ---

  describe('generateRouteMetaTags', () => {
    it('generates title from route meta', () => {
      const routes = [
        {
          path: '/about',
          meta: { title: 'About Us', description: 'About page' },
        },
      ];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.title).toBe('About Us - Test App');
      expect(tags[0].meta.description).toBe('About page');
    });

    it('generates title from path when no meta', () => {
      const routes = [{ path: '/contact-us' }];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.title).toBe('Contact Us - Test App');
    });

    it('uses siteName for root path', () => {
      const routes = [{ path: '/' }];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.title).toBe('Test App');
    });

    it('marks auth routes as noindex', () => {
      const routes = [{ path: '/admin', auth: { required: true } }];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.robots).toBe('noindex, nofollow');
    });

    it('marks public routes as index', () => {
      const routes = [{ path: '/about' }];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.robots).toBe('index, follow');
    });

    it('generates canonical URLs', () => {
      const routes = [{ path: '/about' }];
      const tags = generator.generateRouteMetaTags(routes);

      expect(tags[0].meta.canonical).toBe('https://example.com/about');
    });
  });

  // --- Blog discovery ---

  describe('discoverBlogPosts', () => {
    it('returns empty when no appRoot', () => {
      const gen = new SEOGenerator(BASE_OPTIONS);
      expect(gen.discoverBlogPosts()).toEqual([]);
    });

    // Missing date falls back to file mtime
    it('missing date in frontmatter falls back to file mtime', () => {
      mockPathExists.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['post_en.md'] as any);
      mockReadSync.mockReturnValue('---\ntitle: Old Post\n---\nContent');
      mockStatSync.mockReturnValue({ mtime: new Date('2025-06-15T00:00:00Z') });

      const gen = new SEOGenerator({ ...BASE_OPTIONS, appRoot: '/app' });
      const posts = gen.discoverBlogPosts();

      expect(posts[0].date).toBe('2025-06-15');

      // Reset
      mockPathExists.mockReturnValue(false);
      mockReaddirSync.mockReturnValue([]);
      mockReadSync.mockReturnValue('');
    });
  });

  // --- Full flow ---

  describe('generateSEOFiles', () => {
    it('returns generation results', async () => {
      const mockWriteFile = vi.fn();
      const routeData = {
        routes: [
          { path: '/', auth: false },
          { path: '/about', auth: false },
        ],
      };

      const results = await generator.generateSEOFiles(
        routeData,
        mockWriteFile
      );

      expect(results.totalRoutes).toBe(2);
      expect(results.publicRoutes).toBe(2);
      expect(results.protectedRoutes).toBe(0);
      expect(results.robotsTxt).toBeDefined();
      expect(results.sitemap).toBeDefined();
      expect(results.manifest).toBeDefined();
    });
  });

  // --- AI Crawler directives (tested via robots.txt) ---

  describe('AI crawler directives', () => {
    it('blocks training bots in recommended mode', () => {
      const content = generator.generateRobotsTxtContent({});
      expect(content).toContain('User-agent: GPTBot\nDisallow: /');
      expect(content).toContain('User-agent: Google-Extended\nDisallow: /');
      expect(content).toContain('User-agent: ClaudeBot\nDisallow: /');
    });

    it('allows search bots in recommended mode', () => {
      const content = generator.generateRobotsTxtContent({});
      expect(content).toContain('User-agent: OAI-SearchBot\nAllow: /');
      expect(content).toContain('User-agent: ChatGPT-User\nAllow: /');
      expect(content).toContain('User-agent: Claude-SearchBot\nAllow: /');
    });

    it('blocks all bots in block-all mode', () => {
      const gen = new SEOGenerator({
        ...BASE_OPTIONS,
        aiCrawlers: 'block-all',
      });
      const content = gen.generateRobotsTxtContent({});
      expect(content).toContain('User-agent: OAI-SearchBot\nDisallow: /');
    });

    it('allows all bots in allow-all mode', () => {
      const gen = new SEOGenerator({
        ...BASE_OPTIONS,
        aiCrawlers: 'allow-all',
      });
      const content = gen.generateRobotsTxtContent({});
      expect(content).toContain('User-agent: GPTBot\nAllow: /');
    });
  });
});
