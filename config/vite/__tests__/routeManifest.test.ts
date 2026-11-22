import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createRouteManifestStore } from '../../utils/routeParser.js';
import { createViteRoutePlugin } from '../plugins/RoutePlugin.js';
import { createViteSEOPlugin } from '../plugins/SEOPlugin.js';

describe('Vite route manifest', () => {
  let workspace: string;
  let appRoot: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'dndev-vite-routes-'));
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    appRoot = join(workspace, 'apps', 'shop');
    mkdirSync(join(appRoot, 'src', 'pages'), { recursive: true });
    writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ name: 'shop' }));
    writeFileSync(
      join(appRoot, 'src', 'pages', 'AboutPage.tsx'),
      "export const meta = { namespace: 'about' };\nexport default function AboutPage() { return null; }\n"
    );
    writeFileSync(
      join(appRoot, 'src', 'pages', 'BlogPostPage.tsx'),
      "export const meta = { namespace: 'blog', route: '/blog/:slug' };\nexport default function BlogPostPage() { return null; }\n"
    );
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
    PathResolver._reset();
  });

  // REGRESSION: the route plugin wrote public/route-manifest.json, which nothing reads on Vite
  it('is handed to the SEO and prerender plugins in memory, never written to public/', async () => {
    const routeManifest = createRouteManifestStore();
    const plugin = createViteRoutePlugin({ routeManifest });
    plugin.configResolved({ root: appRoot, command: 'build' });
    await plugin.buildStart();
    expect(routeManifest.get().routes.map((route: { path: string }) => route.path)).toContain('/about');
    expect(existsSync(join(appRoot, 'public', 'route-manifest.json'))).toBe(false);
  });

  // REGRESSION: the route plugin, the SEO plugin and the prerender listings each read
  // src/content/blog/ (three reads of every post per build)
  it('carries the blog posts, read once by the route plugin, to the SEO plugin', async () => {
    const blogDir = join(appRoot, 'src', 'content', 'blog');
    mkdirSync(blogDir, { recursive: true });
    writeFileSync(join(blogDir, 'hello_en.md'), '---\ntitle: "Hello, world"\ndate: 2026-01-10\n---\nBody\n');
    const routeManifest = createRouteManifestStore();
    const plugin = createViteRoutePlugin({ routeManifest });
    plugin.configResolved({ root: appRoot, command: 'build' });
    await plugin.buildStart();
    // Read once: a later read would find no post
    rmSync(blogDir, { recursive: true, force: true });

    const manifest = routeManifest.get();
    expect(manifest.blogPosts.map((post: { slug: string }) => post.slug)).toEqual(['hello']);
    expect(manifest.routes.find((route: { path: string }) => route.path === '/blog/hello')?.meta.seo.title).toBe(
      'Hello, world'
    );

    const seo = createViteSEOPlugin({ routeManifest, siteName: 'Shop', baseUrl: 'https://shop.example', isDev: true });
    seo.configResolved({ mode: 'production' });
    const emitted = new Map<string, string>();
    await seo.generateBundle.call({
      emitFile: ({ fileName, source }: { fileName: string; source: string }) => emitted.set(fileName, source),
    });
    expect(emitted.get('rss.xml')).toContain('<title><![CDATA[Hello, world]]></title>');
  });
});
