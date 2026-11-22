import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  assertPublicBaseUrl,
  isDeployBuild,
  publishedBaseUrl,
  SEOGenerator,
} from '../SEOGenerator.js';

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

  // --- Indexable routes (noindex / auth) ---

  describe('getSitemapRoutes', () => {
    it('excludes auth-only and seo.noindex routes, keeps dynamic routes with their collection', () => {
      const routes = generator.getSitemapRoutes([
        { path: '/', auth: false, meta: {} },
        { path: '/panier', auth: false, meta: { seo: { noindex: true } } },
        { path: '/dashboard', auth: { required: true }, meta: {} },
        { path: '/produits/:slug', auth: false, meta: { entity: 'products' } },
      ]);
      expect(routes).toEqual([
        { path: '/' },
        { path: '/produits/:slug', collection: 'products' },
      ]);
    });

    it('excludes 404 / not-found / error routes', () => {
      const routes = generator.getSitemapRoutes([
        { path: '/', auth: false, meta: {} },
        { path: '/404', auth: false, meta: { route: '/404' } },
        { path: '/not-found', auth: false, meta: {} },
        { path: '/500', auth: false, meta: {} },
        { path: '/error', auth: false, meta: {} },
        { path: '/oops', auth: false, meta: { route: '/404' } },
      ]);
      expect(routes).toEqual([{ path: '/' }]);
    });

    it('leaves catch-all routes out instead of listing the pattern', () => {
      const routes = generator.getSitemapRoutes([
        { path: '/', auth: false, meta: {} },
        { path: '/docs/*', auth: false, meta: {} },
        { path: '*', auth: false, meta: {} },
      ]);
      expect(routes).toEqual([{ path: '/' }]);
    });

    it('lists blog posts instead of the blog routes', () => {
      const routes = generator.getSitemapRoutes(
        [
          { path: '/blog', auth: false, meta: {} },
          { path: '/blog/:slug', auth: false, meta: { namespace: 'blog' } },
        ],
        [{ slug: 'hello', date: '2026-01-02' }]
      );
      expect(routes).toEqual([
        { path: '/blog', priority: 0.7, lastModified: '2026-01-02' },
        {
          path: '/blog/hello',
          priority: 0.6,
          changeFrequency: 'monthly',
          lastModified: '2026-01-02',
        },
      ]);
    });
  });

  // --- robots.txt generation (full flow) ---

  describe('generateRobotsTxt', () => {
    const mockWriteFile = vi.fn();

    beforeEach(() => {
      mockWriteFile.mockReset();
    });

    it('REGRESSION: never disallows a page, auth-only or sign-in (crawlers must read its noindex)', async () => {
      const seoData = {
        routes: [
          { path: '/', auth: false },
          { path: '/admin', auth: { required: true } },
          { path: '/settings', auth: { required: true } },
          { path: '/signin', auth: false },
        ],
      };

      await generator.generateRobotsTxt(seoData, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      const disallowed = content
        .split('\n\n')[0]
        .split('\n')
        .filter((line: string) => line.startsWith('Disallow:'));

      // Non-page paths only
      expect(disallowed).toEqual(['Disallow: /api']);
    });

    it('Vite: also disallows the SPA shell URL (shellPath), never a page rewritten to it', async () => {
      const vite = new SEOGenerator({
        baseUrl: 'https://example.com',
        siteName: 'Test',
        shellPath: '/_shell',
      });
      await vite.generateRobotsTxt({ routes: [{ path: '/compte', auth: true }] }, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];
      const disallowed = content
        .split('\n\n')[0]
        .split('\n')
        .filter((line: string) => line.startsWith('Disallow:'));
      expect(disallowed).toEqual(['Disallow: /api', 'Disallow: /_shell']);
    });

    it('REGRESSION: never disallows /_next (assets Google needs to render)', async () => {
      await generator.generateRobotsTxt({ routes: [] }, mockWriteFile);
      const content = mockWriteFile.mock.calls[0][1];

      expect(content).not.toContain('Disallow: /_next');
      expect(content).not.toContain('Disallow: /static');
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
        mockWriteFile,
        []
      );

      expect(results.manifest.manifest).toMatchObject({
        totalRoutes: 2,
        publicRoutes: 2,
        protectedRoutes: 0,
      });
      expect(results.robotsTxt).toBeDefined();
      expect(results.manifest).toBeDefined();
      // REGRESSION: no routeMetaTags (unread, its own title / robots rules); siteName is read
      expect(results.manifest.manifest).not.toHaveProperty('routeMetaTags');
      expect(results.manifest.manifest.siteName).toBe('Test App');
      // sitemap.xml: the shared builder (Vite buildPages, Next sitemap route), never here
      expect(results).not.toHaveProperty('sitemap');
      expect(mockWriteFile.mock.calls.map(([file]) => file)).not.toContain('sitemap.xml');
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

describe('assertPublicBaseUrl', () => {
  it('accepts a public URL', () => {
    expect(() =>
      assertPublicBaseUrl('https://shop.example', 'NEXT_PUBLIC_APP_URL')
    ).not.toThrow();
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://0.0.0.0',
    'http://[::1]:3000',
    'http://shop.localhost',
  ])('rejects the local URL %s', (url) => {
    expect(() => assertPublicBaseUrl(url, 'NEXT_PUBLIC_APP_URL')).toThrow(
      /NEXT_PUBLIC_APP_URL/
    );
  });

  it('rejects a relative URL', () => {
    expect(() => assertPublicBaseUrl('shop.example', 'VITE_APP_URL')).toThrow(
      /absolute/
    );
  });
});

describe('isDeployBuild', () => {
  it('is a deploy build on dndev deploy, Vercel and CI only', () => {
    expect(isDeployBuild({ DNDEV_DEPLOY: '1' })).toBe(true);
    expect(isDeployBuild({ VERCEL: '1' })).toBe(true);
    expect(isDeployBuild({ CI: 'true' })).toBe(true);
    expect(isDeployBuild({ CI: '1' })).toBe(true);
    expect(isDeployBuild({})).toBe(false);
    expect(isDeployBuild({ CI: 'false' })).toBe(false);
    expect(isDeployBuild({ CI: '0' })).toBe(false);
    expect(isDeployBuild({ NODE_ENV: 'production' })).toBe(false);
  });
});

describe('publishedBaseUrl', () => {
  // REGRESSION: every local production build failed on a localhost URL
  it('a local build publishes the URL it has, localhost included, with one warning line', () => {
    const logger = { warn: vi.fn() };
    expect(publishedBaseUrl('http://localhost:4321', 'VITE_APP_URL', logger, {})).toBe(
      'http://localhost:4321'
    );
    expect(publishedBaseUrl('http://localhost:4321', 'VITE_APP_URL', logger, {})).toBe(
      'http://localhost:4321'
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/Local build: .* carry http:\/\/localhost:4321 \(VITE_APP_URL\)/);
  });

  it('a local build without a usable URL publishes none, with one warning line', () => {
    const logger = { warn: vi.fn() };
    expect(publishedBaseUrl(null, 'NEXT_PUBLIC_APP_URL', logger, {})).toBeNull();
    expect(publishedBaseUrl('shop.example', 'NEXT_PUBLIC_APP_URL', logger, {})).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(publishedBaseUrl('https://shop.example', 'NEXT_PUBLIC_APP_URL', logger, {})).toBe(
      'https://shop.example'
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it.each([{ DNDEV_DEPLOY: '1' }, { VERCEL: '1' }, { CI: 'true' }])(
    'a deploy build (%o) fails on a missing or local URL',
    (env) => {
      const logger = { warn: vi.fn() };
      expect(() => publishedBaseUrl(null, 'VITE_APP_URL', logger, env)).toThrow(
        /deploy build without VITE_APP_URL/
      );
      expect(() => publishedBaseUrl('http://localhost:3000', 'VITE_APP_URL', logger, env)).toThrow(
        /local URLs/
      );
      expect(publishedBaseUrl('https://shop.example', 'VITE_APP_URL', logger, env)).toBe(
        'https://shop.example'
      );
    }
  );
});
