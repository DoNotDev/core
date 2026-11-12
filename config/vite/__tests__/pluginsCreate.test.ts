import { describe, expect, it } from 'vitest';

import { createViteI18nPlugin } from '../plugins/I18nPlugin.js';
import { createViteSEOPlugin } from '../plugins/SEOPlugin.js';

/** Regression: creating the plugins threw `mergedDiscoveryOptions is not defined`. */
describe('Vite plugin creation', () => {
  it('creates the i18n plugins', () => {
    const plugins = createViteI18nPlugin({ fallbackLanguage: 'fr' });
    expect([plugins].flat().length).toBeGreaterThan(0);
  });

  it('creates the SEO plugin with the i18n options', () => {
    const plugin = createViteSEOPlugin({
      siteName: 'App',
      baseUrl: 'https://app.example',
      isDev: false,
      i18n: { fallbackLanguage: 'fr' },
    });
    expect(plugin.name).toBe('vite-seo-plugin');
  });

  it('turns the SEO plugin off when disabled (appConfig.seo: false)', () => {
    expect(createViteSEOPlugin({ disabled: true }).name).toBe('seo-disabled');
  });
});
