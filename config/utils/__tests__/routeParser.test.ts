import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseRouteManifest,
  getPublicStaticRoutes,
  expandBlogRoutes,
} from '../routeParser.js';

// Mock PathResolver
const mockReadSync = vi.fn();
const mockResolvePath = vi.fn((rel: string, base: string) => `${base}/${rel}`);
const mockGetAppRoot = vi.fn(() => '/app');
const mockPathExists = vi.fn(() => false);
const mockReaddirSync = vi.fn(() => [] as string[]);

vi.mock('../PathResolver.js', () => ({
  PathResolver: {
    getInstance: () => ({
      resolvePath: mockResolvePath,
      getAppRoot: mockGetAppRoot,
      readSync: mockReadSync,
      pathExists: mockPathExists,
      readdirSync: mockReaddirSync,
    }),
  },
}));

describe('parseRouteManifest', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid JSON route manifest', () => {
    mockReadSync.mockReturnValue({
      routes: [
        { path: '/', meta: { title: 'Home' } },
        { path: '/about', meta: { title: 'About' } },
      ],
      source: 'auto-discovery',
      totalRoutes: 2,
      generatedAt: '2026-03-14T00:00:00.000Z',
    });

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.source).toBe('auto-discovery');
    expect(result.routes).toHaveLength(2);
    expect(result.routes[0].path).toBe('/');
    expect(result.routes[1].path).toBe('/about');
    expect(result.errors).toHaveLength(0);
  });

  it('returns empty routes when manifest is missing', () => {
    mockReadSync.mockReturnValue(null);

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.source).toBe('fallback');
    expect(result.routes).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('handles routes with auth metadata', () => {
    mockReadSync.mockReturnValue({
      routes: [
        { path: '/', meta: {} },
        { path: '/admin', auth: { required: true }, meta: {} },
        { path: '/public', auth: false, meta: {} },
      ],
      source: 'auto-discovery',
    });

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.routes).toHaveLength(3);
    expect(result.routes[1].auth).toEqual({ required: true });
  });

  it('uses custom appRoot when provided', () => {
    mockReadSync.mockReturnValue({
      routes: [{ path: '/' }],
      source: 'auto-discovery',
    });

    parseRouteManifest({ appRoot: '/custom/root', logger: mockLogger });

    expect(mockResolvePath).toHaveBeenCalledWith(
      'public/route-manifest.json',
      '/custom/root'
    );
  });

  it('returns fallback on read error', () => {
    mockReadSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.source).toBe('fallback');
    expect(result.routes).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('works without logger', () => {
    mockReadSync.mockReturnValue(null);

    // Should not throw even without logger
    const result = parseRouteManifest({});
    expect(result.source).toBe('fallback');
  });

  it('handles manifest with empty routes array', () => {
    mockReadSync.mockReturnValue({
      routes: [],
      source: 'auto-discovery',
    });

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.routes).toEqual([]);
    expect(result.source).toBe('auto-discovery');
    expect(result.errors).toHaveLength(0);
  });

  it('handles manifest without routes key', () => {
    mockReadSync.mockReturnValue({
      source: 'auto-discovery',
      totalRoutes: 0,
    });

    const result = parseRouteManifest({ logger: mockLogger });

    expect(result.routes).toEqual([]);
    expect(result.errors).toHaveLength(0);
  });
});

describe('getPublicStaticRoutes', () => {
  it('filters out auth-protected routes', () => {
    const routes = [
      { path: '/', auth: false },
      { path: '/admin', auth: { required: true } },
      { path: '/about' },
    ];

    const result = getPublicStaticRoutes(routes);
    expect(result).toEqual(['/', '/about']);
  });

  it('filters out dynamic routes with :param', () => {
    const routes = [
      { path: '/' },
      { path: '/users/:id' },
      { path: '/about' },
      { path: '/blog/:slug/comments/:id' },
    ];

    const result = getPublicStaticRoutes(routes);
    expect(result).toEqual(['/', '/about']);
  });

  it('returns empty array for no public routes', () => {
    const routes = [
      { path: '/admin', auth: { required: true } },
      { path: '/users/:id' },
    ];

    const result = getPublicStaticRoutes(routes);
    expect(result).toEqual([]);
  });

  it('handles empty input', () => {
    expect(getPublicStaticRoutes([])).toEqual([]);
  });

  it('handles string-only routes', () => {
    const routes = ['/', '/about', '/users/:id'];
    const result = getPublicStaticRoutes(routes);
    expect(result).toEqual(['/', '/about']);
  });
});

describe('expandBlogRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathExists.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    mockReadSync.mockReturnValue(null);
  });

  it('returns empty when no dynamic blog route exists', () => {
    const routes = [{ path: '/' }, { path: '/about' }];
    const result = expandBlogRoutes(routes, { appRoot: '/app' });
    expect(result).toEqual([]);
  });

  it('expands /blog/:slug into route objects with frontmatter', () => {
    mockPathExists.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      'hello-world_en.md',
      'my-post_en.md',
    ] as any);
    mockReadSync.mockImplementation((path: string) => {
      if (path.includes('hello-world')) {
        return '---\ntitle: Hello World\ndescription: A greeting\nimage: /blog/hw.webp\n---\nContent';
      }
      if (path.includes('my-post')) {
        return '---\ntitle: My Post\n---\nContent';
      }
      return null;
    });

    const routes = [{ path: '/' }, { path: '/blog' }, { path: '/blog/:slug' }];

    const result = expandBlogRoutes(routes, { appRoot: '/app' });
    const paths = result.map((r: any) => r.path);

    expect(paths).toContain('/blog');
    expect(paths).toContain('/blog/hello-world');
    expect(paths).toContain('/blog/my-post');
    expect(result).toHaveLength(3); // /blog index + 2 posts

    // Verify frontmatter SEO metadata
    const hw = result.find((r: any) => r.path === '/blog/hello-world');
    expect(hw.meta.seo.title).toBe('Hello World');
    expect(hw.meta.seo.description).toBe('A greeting');
    expect(hw.meta.seo.image).toBe('/blog/hw.webp');
    expect(hw.meta.seo.type).toBe('article');

    const mp = result.find((r: any) => r.path === '/blog/my-post');
    expect(mp.meta.seo.title).toBe('My Post');
    expect(mp.meta.seo.description).toBeNull();
  });

  it('ignores non-english markdown files', () => {
    mockPathExists.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      'my-post_en.md',
      'my-post_fr.md',
      'my-post_de.md',
    ] as any);
    mockReadSync.mockReturnValue('---\ntitle: My Post\n---\nContent');

    const routes = [{ path: '/blog/:slug' }];
    const result = expandBlogRoutes(routes, { appRoot: '/app' });
    const paths = result.map((r: any) => r.path);

    // Only 1 slug (my-post) + /blog index
    expect(paths).toEqual(['/blog', '/blog/my-post']);
  });

  it('returns empty when blog directory does not exist', () => {
    mockPathExists.mockReturnValue(false);

    const routes = [{ path: '/blog/:slug' }];
    const result = expandBlogRoutes(routes, { appRoot: '/app' });

    expect(result).toEqual([]);
  });

  it('supports custom blogPath', () => {
    mockPathExists.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['post_en.md'] as any);
    mockReadSync.mockReturnValue('---\ntitle: Post\n---\n');

    const routes = [{ path: '/articles/:slug' }];
    const result = expandBlogRoutes(routes, {
      appRoot: '/app',
      blogPath: '/articles',
    });
    const paths = result.map((r: any) => r.path);

    expect(paths).toContain('/articles');
    expect(paths).toContain('/articles/post');
  });

  it('handles empty blog directory', () => {
    mockPathExists.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);

    const routes = [{ path: '/blog/:slug' }];
    const result = expandBlogRoutes(routes, { appRoot: '/app' });

    expect(result).toEqual([]);
  });

  it('falls back to slug as title when frontmatter missing', () => {
    mockPathExists.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['no-frontmatter_en.md'] as any);
    mockReadSync.mockReturnValue('Just plain content, no frontmatter');

    const routes = [{ path: '/blog/:slug' }];
    const result = expandBlogRoutes(routes, { appRoot: '/app' });

    const post = result.find((r: any) => r.path === '/blog/no-frontmatter');
    expect(post.meta.seo.title).toBe('no-frontmatter');
  });
});
