import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { createNextSEOHandler } from '../handlers/SEOHandler.js';

/** Next production builds and the app URL (publishedBaseUrl). */
describe('Next SEO handler: local vs deploy build URL', () => {
  let appRoot: string;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-next-url-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
    for (const name of ['CI', 'VERCEL', 'DNDEV_DEPLOY']) vi.stubEnv(name, '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  const handler = () =>
    createNextSEOHandler({ siteName: 'Boutique', baseUrl: 'http://localhost:3000', isDev: false });

  // REGRESSION: `next build` with a localhost NEXT_PUBLIC_APP_URL failed
  it('a local build keeps a localhost URL and generates the SEO files', () => {
    expect(handler().disabled).toBeUndefined();
  });

  it('a deploy build (CI, Vercel, dndev deploy) fails on it', () => {
    vi.stubEnv('VERCEL', '1');
    expect(handler).toThrow(/deploy build with base URL "http:\/\/localhost:3000"/);
  });
});
