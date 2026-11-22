import { describe, expect, it } from 'vitest';

/**
 * Regression: the workspace `entities` package (the `entities` dependency of apps/next,
 * apps/donotdev, apps/aigencie) re-exported seven files that never existed in this repo,
 * so importing it failed (the build-time prerender and Next entity pages import it).
 */
describe('workspace entities package', () => {
  it('loads: every re-export of its barrel exists', async () => {
    const entities = await import('../../../../../../entities/index');
    expect(Object.keys(entities).sort()).toEqual(['demoEntity', 'productEntity']);
    expect(entities.productEntity.collection).toBe('products');
    // Loads the @donotdev/core graph: slow under a full parallel run
  }, 30_000);
});
