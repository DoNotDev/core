import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRouteManifestStore } from '../../utils/routeParser.js';
import { seoStep } from '../../utils/SEOGenerator.js';
import { createViteSEOPlugin } from '../plugins/SEOPlugin.js';

const POST = { slug: 'hello', title: 'Hello', description: '', date: '2026-01-10', tags: [], image: null };

/** The SEO plugin of a built app, its emitFile failing for `failing`. */
async function runPlugin(failing: string) {
  const routeManifest = createRouteManifestStore();
  routeManifest.set({ routes: [{ path: '/' }], source: 'test', blogPosts: [POST] });
  const plugin = createViteSEOPlugin({
    routeManifest,
    siteName: 'Shop',
    baseUrl: 'https://shop.example',
    isDev: true,
    redirects: [{ from: '/old', to: '/new' }],
  });
  plugin.configResolved({ mode: 'production' });
  const emitted: string[] = [];
  const emitFile = ({ fileName }: { fileName: string }) => {
    if (fileName === failing) throw new Error('disk full');
    emitted.push(fileName);
  };
  await plugin.generateBundle.call({ emitFile });
  return emitted;
}

describe('Vite SEO plugin: a failing SEO file', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // REGRESSION: one failure dropped robots.txt, rss.xml, llms-full.txt and _redirects behind
  // one logged error, deploy builds included
  it('fails a deploy build with a build error naming the files', async () => {
    vi.stubEnv('DNDEV_DEPLOY', '1');
    await expect(runPlugin('robots.txt')).rejects.toThrow(
      /\[dndev-seo\] robots\.txt, rss\.xml, seo-manifest\.json not written: disk full/
    );
  });

  it('is one warning line on a local build, the other files still written', async () => {
    for (const name of ['CI', 'VERCEL', 'DNDEV_DEPLOY']) vi.stubEnv(name, '');
    const written: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
    const emitted = await runPlugin('robots.txt');
    vi.restoreAllMocks();
    expect(emitted).toEqual(expect.arrayContaining(['_redirects']));
    expect(emitted).not.toContain('robots.txt');
    const output = written.join('');
    expect(output.match(/not written/g)).toHaveLength(1);
    expect(output).toContain('[dndev] Local build: robots.txt, rss.xml, seo-manifest.json not written: disk full');
    // One message per failure: no error line on top of the warning
    expect(output).not.toMatch(/failed to generate|Stack:/);
  });
});

describe('seoStep', () => {
  it('rethrows a build error on every build', async () => {
    const buildError = Object.assign(new Error('[dndev-x] misconfigured'), { pluginName: 'dndev-x' });
    await expect(
      seoStep(['robots.txt'], () => { throw buildError; }, { warn: () => {} }, {})
    ).rejects.toBe(buildError);
  });
});
