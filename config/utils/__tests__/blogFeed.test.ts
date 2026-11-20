import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hasBlogFeed } from '../blogFeed.js';

describe('hasBlogFeed', () => {
  const roots: string[] = [];
  const makeApp = (files?: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-blog-'));
    roots.push(root);
    if (files) {
      const dir = join(root, 'src', 'content', 'blog');
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(join(dir, f), '# post');
    }
    return root;
  };
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it('false without a blog directory', () => {
    expect(hasBlogFeed(makeApp())).toBe(false);
  });
  it('false when the blog directory has no English post', () => {
    expect(hasBlogFeed(makeApp(['hello_fr.md', 'notes.txt']))).toBe(false);
  });
  it('true with at least one <slug>_en.md post', () => {
    expect(hasBlogFeed(makeApp(['hello_en.md']))).toBe(true);
  });
});
