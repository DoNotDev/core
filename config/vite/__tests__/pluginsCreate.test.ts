import { describe, expect, it } from 'vitest';

import { createI18nStore, createViteI18nPlugin } from '../plugins/I18nPlugin.js';
import { createVitePrerenderPlugin } from '../plugins/PrerenderPlugin.js';
import { createViteSEOPlugin } from '../plugins/SEOPlugin.js';
import { createRouteManifestStore } from '../../utils/routeParser.js';

/** Regression: creating the plugins threw `mergedDiscoveryOptions is not defined`. */
describe('Vite plugin creation', () => {
  it('creates the i18n plugins', () => {
    const plugins = createViteI18nPlugin({ fallbackLanguage: 'fr', i18nStore: createI18nStore() });
    expect([plugins].flat().length).toBeGreaterThan(0);
  });

  it('creates the SEO plugin with the i18n options', () => {
    const plugin = createViteSEOPlugin({
      siteName: 'App',
      baseUrl: 'https://app.example',
      isDev: false,
      i18n: { fallbackLanguage: 'fr' },
      routeManifest: createRouteManifestStore(),
    });
    expect(plugin.name).toBe('vite-seo-plugin');
  });

  it('turns the SEO plugin off when disabled (appConfig.seo: false)', () => {
    expect(createViteSEOPlugin({ disabled: true }).name).toBe('seo-disabled');
  });

  it('creates the prerender plugin, failing on a non-boolean appConfig.prerenderRecords', () => {
    const stores = { routeManifest: createRouteManifestStore(), i18nStore: createI18nStore() };
    expect(createVitePrerenderPlugin({ prerenderRecords: false, ...stores }).name).toBe(
      'dndev-prerender'
    );
    expect(() => createVitePrerenderPlugin({ prerenderRecords: 'yes', ...stores })).toThrow(
      /appConfig.prerenderRecords must be true or false/
    );
  });

  it('the SEO and prerender plugins read the route plugin\'s manifest from memory, required', () => {
    expect(() => createVitePrerenderPlugin({})).toThrow(/routeManifest and options.i18nStore are required/);
    expect(() => createViteSEOPlugin({ siteName: 'App' })).toThrow(/routeManifest is required/);
    const store = createRouteManifestStore();
    expect(() => store.get()).toThrow(/route discovery did not run/);
    expect(() => store.set({ routes: [{ path: '/' }], source: 'auto-discovery' })).toThrow(/blogPosts/);
    store.set({ routes: [{ path: '/' }], source: 'auto-discovery', blogPosts: [] });
    expect(store.get()).toEqual({ routes: [{ path: '/' }], errors: [], source: 'auto-discovery', blogPosts: [] });
  });

  // One i18n discovery per build: the lazy-loader plugin waits for the main one
  it('the i18n lazy-loader plugin reads the main plugin\'s discovery, no scan of its own', async () => {
    const i18nStore = createI18nStore();
    const plugins = createViteI18nPlugin({ fallbackLanguage: 'fr', i18nStore });
    expect(plugins).toHaveLength(2);
    const [, lazy] = plugins;
    lazy.configResolved({ command: 'build' });
    const started = lazy.buildStart();
    i18nStore.set({ content: { shop: { fr: { title: 'Boutique' } } }, eagerNamespaces: [], flagCodes: ['fr'] });
    await started;
    expect(await lazy.load('\0virtual:i18n-lazy-shop-fr')).toBe('export default {"title":"Boutique"};');
    expect(() => createViteI18nPlugin({ fallbackLanguage: 'fr' })).toThrow(/i18nStore is required/);
  });
});
