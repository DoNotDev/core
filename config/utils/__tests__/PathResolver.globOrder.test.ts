import { describe, expect, it, vi } from 'vitest';

// fast-glob returns files in filesystem completion order: simulate an unsorted result
vi.mock('fast-glob', () => ({
  default: vi.fn(async () => ['/app/src/pages/products/ProductPage.tsx', '/app/src/pages/AboutPage.tsx', '/app/src/pages/articles/ArticlePage.tsx']),
}));

import { PathResolver } from '../PathResolver.js';

describe('PathResolver glob order', () => {
  // REGRESSION: route order (sitemap, llms.txt, manifests, proxy) changed between builds
  it('returns scanned files sorted, whatever order the filesystem gives', async () => {
    PathResolver._reset();
    const files = await PathResolver.getInstance()._globWithNormalization(['src/pages/**/*.tsx'], {});
    expect(files).toEqual([
      '/app/src/pages/AboutPage.tsx',
      '/app/src/pages/articles/ArticlePage.tsx',
      '/app/src/pages/products/ProductPage.tsx',
    ]);
    PathResolver._reset();
  });
});
