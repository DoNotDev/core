import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_OG_IMAGE } from '../../constants.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { clearMetadataCache, getMetadataForPath } from '../getMetadataForPath.js';
import { NextRouteHandler } from '../handlers/RouteHandler.js';

/**
 * getMetadataForPath (metadata manifest written by the Next route handler) applies the
 * AutoMetaTags defaults: `appConfig.seo.defaultImage` and the robots rule (auth-only
 * pages noindex by default).
 */
describe('getMetadataForPath: AutoMetaTags defaults', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-metadata-manifest-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
    vi.spyOn(process, 'cwd').mockReturnValue(appRoot);
    clearMetadataCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMetadataCache();
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  const routes = [
    { path: '/', meta: {}, metaExport: {}, auth: false },
    { path: '/compte', meta: {}, metaExport: {}, auth: { required: true } },
    {
      path: '/espace-pro',
      meta: { seo: { noindex: false } },
      metaExport: { seo: { noindex: false } },
      auth: true,
    },
    {
      path: '/brouillon',
      meta: { seo: { noindex: true } },
      metaExport: { seo: { noindex: true } },
      auth: false,
    },
  ];

  async function metadataOf(path: string, options: Record<string, unknown> = {}) {
    const handler = new NextRouteHandler(options);
    handler.useI18n({ supportedLanguages: ['en'], fallbackLanguage: 'en', content: {} });
    await handler.generateMetadataManifest({ routes });
    clearMetadataCache();
    return getMetadataForPath(path) as { robots?: unknown; openGraph?: { images?: string[] } };
  }

  it('auth-only pages are noindex by default, as AutoMetaTags (robots.txt never blocks them)', async () => {
    expect((await metadataOf('/compte')).robots).toEqual({ index: false });
    expect((await metadataOf('/espace-pro')).robots).toBeUndefined();
    expect((await metadataOf('/brouillon')).robots).toEqual({ index: false, follow: false });
    expect((await metadataOf('/')).robots).toBeUndefined();
  });

  it('pages without an image get appConfig.seo.defaultImage, else DEFAULT_OG_IMAGE', async () => {
    expect((await metadataOf('/')).openGraph?.images).toEqual([DEFAULT_OG_IMAGE]);
    expect(
      (await metadataOf('/', { defaultImage: '/og-image.jpg' })).openGraph?.images
    ).toEqual(['/og-image.jpg']);
  });
});

/**
 * REGRESSION: the manifest was computed before the i18n handler wrote its config and
 * before the SEO handler wrote seo-manifest.json, so a clean build had no translations
 * (title '', locale 'en') and a rebuild read the previous build's files.
 */
describe('metadata manifest: this build’s translations and site name', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-metadata-clean-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
    vi.spyOn(process, 'cwd').mockReturnValue(appRoot);
    clearMetadataCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearMetadataCache();
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  it('a clean build (no generated config on disk) titles pages in the app languages', async () => {
    const handler = new NextRouteHandler({ siteName: 'Boutique' });
    handler.useI18n({
      supportedLanguages: ['fr', 'en'],
      fallbackLanguage: 'fr',
      content: { about: { fr: { title: 'À propos' }, en: { title: 'About' } } },
    });
    await handler.generateMetadataManifest({
      routes: [{ path: '/about', meta: {}, metaExport: { namespace: 'about' }, auth: false }],
    });
    clearMetadataCache();
    expect(getMetadataForPath('/about')).toMatchObject({ title: 'À propos | Boutique' });
    clearMetadataCache();
    expect(getMetadataForPath('/about', 'en')).toMatchObject({ title: 'About | Boutique' });
  });

  // REGRESSION: a page without namespace got no translations; AutoMetaTags uses
  // appConfig.seo.defaultNamespace ('home')
  it('a page without namespace reads the default namespace, as AutoMetaTags', async () => {
    const handler = new NextRouteHandler({ siteName: 'Boutique' });
    handler.useI18n({
      supportedLanguages: ['fr'],
      fallbackLanguage: 'fr',
      content: { home: { fr: { title: 'Accueil', description: 'Bienvenue' } } },
    });
    await handler.generateMetadataManifest({
      routes: [{ path: '/faq', meta: {}, metaExport: { seo: { title: 'Questions' } }, auth: false }],
    });
    clearMetadataCache();
    expect(getMetadataForPath('/faq')).toMatchObject({
      title: 'Questions | Boutique',
      description: 'Bienvenue',
    });
  });

  it('fails loud when the translations were not handed over', async () => {
    await expect(
      new NextRouteHandler({}).generateMetadataManifest({ routes: [] })
    ).rejects.toThrow('useI18n');
  });
});
