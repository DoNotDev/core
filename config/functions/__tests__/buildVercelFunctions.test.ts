// packages/core/config/functions/__tests__/buildVercelFunctions.test.ts

/**
 * @fileoverview Vercel functions build output
 * @description Builds a fixture `src/api` tree and checks the Build Output API v3
 * layout Vercel serves: one `api/<path>.func` per function file (bundled
 * `index.mjs` default-exporting the handler + `.vc-config.json`), shared `_`
 * files bundled in but not functions, stale functions removed, and fail-loud
 * cases (no `src/api`, a `[param]` segment).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VERCEL_FUNCTIONS_RUNTIME,
  buildVercelFunctions,
} from '../buildVercelFunctions.js';

function write(root: string, file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
}

/** Every file under dir, relative, sorted. */
function tree(dir: string): string[] {
  return (
    fs.readdirSync(dir, { recursive: true, withFileTypes: true }) as fs.Dirent[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();
}

describe('buildVercelFunctions', () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dndev-vercel-fixture-'));
    previousCwd = process.cwd();
    process.chdir(dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('emits one Build Output function per src/api file, served at /api/<path>', async () => {
    write(
      dir,
      'src/api/_shared.ts',
      'export const greet = (who: string) => `hi ${who}`;\n'
    );
    write(
      dir,
      'src/api/auth/getCustomClaims.ts',
      "import { greet } from '../_shared';\nexport default (req: { query: { who: string } }) => greet(req.query.who);\n"
    );
    write(dir, 'src/api/health.ts', 'export default () => "ok";\n');
    write(dir, 'src/api/health.test.ts', 'export {};\n');
    // A function deleted since the previous build must not ship
    write(dir, '.vercel/output/functions/api/removed.func/index.mjs', 'stale');

    const built = await buildVercelFunctions({ sourcemap: false });

    expect(built).toEqual(['api/auth/getCustomClaims', 'api/health']);
    const out = path.join(dir, '.vercel/output/functions');
    expect(tree(out)).toEqual([
      'api/auth/getCustomClaims.func/.vc-config.json',
      'api/auth/getCustomClaims.func/index.mjs',
      'api/health.func/.vc-config.json',
      'api/health.func/index.mjs',
    ]);
    const vcConfig = JSON.parse(
      fs.readFileSync(path.join(out, 'api/health.func/.vc-config.json'), 'utf8')
    );
    expect(vcConfig).toEqual({
      runtime: VERCEL_FUNCTIONS_RUNTIME,
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
      shouldAddSourcemapSupport: false,
    });

    // Self-contained ESM loaded by plain Node (as Vercel's launcher does): the shared
    // module is inlined, the handler is the default export
    const entry = pathToFileURL(
      path.join(out, 'api/auth/getCustomClaims.func/index.mjs')
    ).href;
    const result = execFileSync('node', [
      '--input-type=module',
      '-e',
      `const m = await import(${JSON.stringify(entry)}); process.stdout.write(m.default({ query: { who: 'ada' } }));`,
    ]).toString();
    expect(result).toBe('hi ada');
  });

  it('fails without src/api', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);
    await expect(buildVercelFunctions()).rejects.toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('fails on a dynamic [param] segment (never matched in Build Output)', async () => {
    write(
      dir,
      'src/api/crud/[collection]/bulk.ts',
      'export default () => "ok";\n'
    );
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as never);
    await expect(buildVercelFunctions()).rejects.toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(vi.mocked(console.error).mock.calls[0]?.[1])).toContain(
      'Dynamic route segments are not supported in src/api/: crud/[collection]/bulk.ts'
    );
  });
});
