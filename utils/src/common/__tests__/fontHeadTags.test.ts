// packages/core/utils/src/common/__tests__/fontHeadTags.test.ts

import { describe, expect, it } from 'vitest';

import { FONT_STYLE_ID, fontPreloadHeadTags } from '../headTags';

describe('fontPreloadHeadTags', () => {
  it('one CORS font preload per href, in order', () => {
    expect(fontPreloadHeadTags(['/fonts/a.1.woff2', '/fonts/b.2.woff2'])).toEqual([
      {
        tag: 'link',
        attributes: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/a.1.woff2', crossorigin: 'anonymous' },
      },
      {
        tag: 'link',
        attributes: { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/b.2.woff2', crossorigin: 'anonymous' },
      },
    ]);
    expect(fontPreloadHeadTags([])).toEqual([]);
  });

  it('the inline font style key', () => {
    expect(FONT_STYLE_ID).toBe('dndev-fonts');
  });
});
