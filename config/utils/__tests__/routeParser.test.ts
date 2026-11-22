import { describe, it, expect } from 'vitest';

import { getPublicStaticRoutes, expandBlogRoutes } from '../routeParser.js';

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
  /** A post as readBlogPosts returns it. */
  const post = (slug: string, fields: Record<string, unknown> = {}) => ({
    slug,
    title: slug,
    description: '',
    date: '2026-01-01',
    tags: [],
    image: null,
    ...fields,
  });

  it('returns empty when no dynamic blog route exists', () => {
    const routes = [{ path: '/' }, { path: '/about' }];
    expect(expandBlogRoutes(routes, [post('hello')])).toEqual([]);
  });

  it('expands /blog/:slug into route objects with frontmatter', () => {
    const posts = [
      post('hello-world', { title: 'Hello World', description: 'A greeting', image: '/blog/hw.webp' }),
      post('my-post', { title: 'My Post' }),
    ];
    const routes = [{ path: '/' }, { path: '/blog' }, { path: '/blog/:slug' }];

    const result = expandBlogRoutes(routes, posts);
    expect(result.map((r: any) => r.path)).toEqual(['/blog', '/blog/hello-world', '/blog/my-post']);

    // Verify frontmatter SEO metadata
    const hw = result.find((r: any) => r.path === '/blog/hello-world');
    expect(hw.meta.seo).toEqual({
      title: 'Hello World',
      description: 'A greeting',
      image: '/blog/hw.webp',
      type: 'article',
    });

    const mp = result.find((r: any) => r.path === '/blog/my-post');
    expect(mp.meta.seo.title).toBe('My Post');
    expect(mp.meta.seo.description).toBeNull();
    expect(mp.meta.seo.image).toBeNull();
  });

  it('supports custom blogPath', () => {
    const routes = [{ path: '/articles/:slug' }];
    const result = expandBlogRoutes(routes, [post('post')], { blogPath: '/articles' });
    expect(result.map((r: any) => r.path)).toEqual(['/articles', '/articles/post']);
  });

  it('returns empty without blog posts', () => {
    expect(expandBlogRoutes([{ path: '/blog/:slug' }], [])).toEqual([]);
  });
});
