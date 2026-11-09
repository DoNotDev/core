import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../PathResolver.js';

describe('PathResolver JSON writes', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dndev-pathresolver-'));
    PathResolver._reset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    PathResolver._reset();
  });

  it('writeSync ends JSON files with a newline', () => {
    const file = join(dir, 'package.json');
    PathResolver.getInstance().writeSync(file, { name: 'x' });
    expect(readFileSync(file, 'utf8')).toBe('{\n  "name": "x"\n}\n');
  });

  it('write ends JSON files with a newline', async () => {
    const file = join(dir, 'package.json');
    await PathResolver.getInstance().write(file, { name: 'x' });
    expect(readFileSync(file, 'utf8')).toBe('{\n  "name": "x"\n}\n');
  });
});
