import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectMissingOptionalDeps } from '../detectOptionalDeps.js';
import { PathResolver } from '../PathResolver.js';

/** Writes `node_modules/<name>/package.json` (+ index.js) under the repo root. */
function installPackage(root: string, pkg: Record<string, unknown> & { name: string }) {
  const dir = join(root, 'node_modules', pkg.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ main: 'index.js', ...pkg }));
  writeFileSync(join(dir, 'index.js'), 'module.exports = {};');
}

describe('detectMissingOptionalDeps', () => {
  let root: string;
  let appRoot: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'dndev-optional-deps-'));
    appRoot = join(root, 'apps', 'site');
    mkdirSync(appRoot, { recursive: true });
    PathResolver._reset();
    installPackage(root, { name: '@donotdev/core' });
    // Another installed framework package declares both third-party deps optional peers
    installPackage(root, {
      name: '@donotdev/functions',
      peerDependencies: { '@supabase/supabase-js': '^2', shiki: '^3' },
      peerDependenciesMeta: { '@supabase/supabase-js': { optional: true }, shiki: { optional: true } },
    });
    installPackage(root, {
      name: '@donotdev/supabase',
      dependencies: { '@supabase/supabase-js': '^2' },
    });
    installPackage(root, { name: '@supabase/supabase-js' });
    installPackage(root, { name: 'shiki' });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    PathResolver._reset();
  });

  const writeApp = (dependencies: Record<string, string>) =>
    writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ name: 'site', dependencies }));

  it('keeps a hard dependency of a listed framework package (regression: supabase-js stubbed)', () => {
    writeApp({ '@donotdev/core': '*', '@donotdev/supabase': '*' });
    const { missing, installed } = detectMissingOptionalDeps(appRoot);
    expect(installed).toContain('@supabase/supabase-js');
    expect(missing).not.toContain('@supabase/supabase-js');
  });

  it('still aliases an installed optional dep the app neither lists nor needs', () => {
    writeApp({ '@donotdev/core': '*', '@donotdev/supabase': '*' });
    expect(detectMissingOptionalDeps(appRoot).missing).toContain('shiki');
  });

  it('aliases supabase-js when no listed framework package depends on it', () => {
    writeApp({ '@donotdev/core': '*' });
    expect(detectMissingOptionalDeps(appRoot).missing).toContain('@supabase/supabase-js');
  });

  it('keeps a third-party optional dep the app lists itself', () => {
    writeApp({ '@donotdev/core': '*', shiki: '*' });
    expect(detectMissingOptionalDeps(appRoot).installed).toContain('shiki');
  });
});
