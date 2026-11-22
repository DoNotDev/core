import { describe, expect, it } from 'vitest';

import { parseBlogFrontmatter } from '../blogFrontmatter';

const POST =
  '---\ntitle: "Hello, world"\ndescription: \'A first post\'\ndate: 2026-01-10\n---\n\n# Hello\n';

describe('parseBlogFrontmatter (runtime: templates blog loader, Next blog pages)', () => {
  // REGRESSION: the Next blog post metadata and the runtime page kept the quotes
  it('removes a value\'s surrounding quotes and returns the markdown after the fence', () => {
    expect(parseBlogFrontmatter(POST)).toEqual({
      meta: { title: 'Hello, world', description: 'A first post', date: '2026-01-10' },
      content: '\n# Hello\n',
    });
    expect(parseBlogFrontmatter('# Only body')).toEqual({ meta: {}, content: '# Only body' });
  });
});
