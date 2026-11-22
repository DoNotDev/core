import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { blogPostFiles, hasBlogFeed, readBlogPosts } from '../blogFeed.js';
import { expandBlogRoutes } from '../routeParser.js';
import { SEOGenerator } from '../SEOGenerator.js';

describe('hasBlogFeed', () => {
  const roots: string[] = [];
  const makeApp = (files?: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-blog-'));
    roots.push(root);
    if (files) {
      const dir = join(root, 'src', 'content', 'blog');
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(join(dir, f), '# post');
    }
    return root;
  };
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it('false without a blog directory', () => {
    expect(hasBlogFeed(makeApp())).toBe(false);
  });
  it('false when the blog directory has no English post', () => {
    expect(hasBlogFeed(makeApp(['hello_fr.md', 'notes.txt']))).toBe(false);
  });
  it('true with at least one <slug>_en.md post', () => {
    expect(hasBlogFeed(makeApp(['hello_en.md']))).toBe(true);
  });
});

describe('blog posts: one reading for every output', () => {
  const POST = '---\ntitle: "Hello, world"\ndescription: \'A first post\'\ndate: 2026-01-10\n---\n\nBody\n';

  it('blogPostFiles keeps the English posts, sorted', () => {
    expect(blogPostFiles(['b_en.md', 'a_fr.md', 'a_en.md', 'notes.txt'])).toEqual([
      'a_en.md',
      'b_en.md',
    ]);
  });

  // REGRESSION: rss.xml / llms.txt titles kept the quotes the prerendered page dropped
  it('the route manifest (prerender) and the SEO generator (rss, llms.txt) read the same title', () => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-blog-parse-'));
    try {
      const dir = join(root, 'src', 'content', 'blog');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'hello_en.md'), POST);
      const blogPosts = new SEOGenerator({ baseUrl: 'https://x.example', siteName: 'X', appRoot: root }).discoverBlogPosts();
      const [post] = blogPosts;
      const routes = expandBlogRoutes([{ path: '/blog/:slug' }], blogPosts);
      expect(post.title).toBe('Hello, world');
      expect(post.description).toBe('A first post');
      expect(routes.find((r) => r.path === '/blog/hello')?.meta.seo).toMatchObject({
        title: post.title,
        description: post.description,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('readBlogPosts', () => {
  const logger = { info: () => {}, warn: () => {}, debug: () => {} };
  const roots: string[] = [];
  const blogApp = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-blog-read-'));
    roots.push(root);
    const dir = join(root, 'src', 'content', 'blog');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
    return root;
  };
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it('reads the English posts\' frontmatter, newest first', () => {
    const root = blogApp({
      'old_en.md': '---\ntitle: Old\ndate: 2025-01-01\ntags: a, b\nimage: /blog/old.png\n---\nBody',
      'new_en.md': '---\ntitle: "New, again"\ndescription: Fresh\ndate: 2026-02-01\n---\nBody',
      'new_fr.md': '---\ntitle: Nouveau\ndate: 2026-02-01\n---\nCorps',
    });
    expect(readBlogPosts(root, logger)).toEqual([
      { slug: 'new', title: 'New, again', description: 'Fresh', date: '2026-02-01', tags: [], image: null },
      { slug: 'old', title: 'Old', description: '', date: '2025-01-01', tags: ['a', 'b'], image: '/blog/old.png' },
    ]);
  });

  it('titles a post without frontmatter with its slug', () => {
    const root = blogApp({ 'no-frontmatter_en.md': 'Just plain content' });
    expect(readBlogPosts(root, logger)[0]).toMatchObject({ slug: 'no-frontmatter', title: 'no-frontmatter' });
  });

  it('is empty without a blog directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-blog-read-'));
    roots.push(root);
    expect(readBlogPosts(root, logger)).toEqual([]);
  });
});
