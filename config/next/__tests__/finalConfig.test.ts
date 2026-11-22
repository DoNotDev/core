// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { buildFinalConfig } from '../configBuilder.js';
import { lowerClientDestructuring, targetsBuggySafari } from '../lowerDestructuring.js';

const logger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const finalConfig = (restNextConfig: Record<string, unknown>) =>
  buildFinalConfig({
    restNextConfig,
    discoveredPackages: [],
    routingMode: 'app',
    rewritesConfig: async () => [],
    redirectsConfig: async () => [],
    headersConfig: null,
    missingOptionalDeps: [],
    pathResolver: PathResolver.getInstance(),
    env: {},
    logger,
  });

/** A Turbopack client chunk (classic script): one module, pushed onto the global chunk list. */
const turbopackChunk = (id: string, body: string) =>
  `(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push([${JSON.stringify(id)},{f:${body}}]);`;
const CHUNK_A = turbopackChunk('a', '({a,b})=>{let[c]=b;return a+c}');

/** An app (package.json with `browserslist`) with built client chunks (`a.js` by default). */
function app(browserslist?: string[], chunks: Record<string, string> = { 'a.js': CHUNK_A }) {
  const dir = mkdtempSync(join(tmpdir(), 'dndev-lower-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', ...(browserslist && { browserslist }) }));
  mkdirSync(join(dir, '.next/static/chunks'), { recursive: true });
  for (const [name, code] of Object.entries(chunks)) writeFileSync(join(dir, '.next/static/chunks', name), code);
  return dir;
}
const chunk = (dir: string, name = 'a.js') => readFileSync(join(dir, '.next/static/chunks', name), 'utf8');
const SAFARI_12 = ['chrome >= 64', 'safari >= 12', 'ios_saf >= 12'];

describe('Next config: Turbopack only', () => {
  let appRoot: string;
  const dirs: string[] = [];
  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-final-config-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });
  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    PathResolver._reset();
  });

  // REGRESSION: the framework's webpack function (Safari fix, flag filter, externals) never
  // ran: Next 16 builds with Turbopack
  it('sets no webpack config; an app\'s own passes through', () => {
    expect(finalConfig({})).not.toHaveProperty('webpack');
    const webpack = vi.fn();
    expect(finalConfig({ webpack }).webpack).toBe(webpack);
  });

  it('a static export (output: export) has no rewrites, redirects or headers', () => {
    const config = finalConfig({ output: 'export' });
    expect(config.output).toBe('export');
    expect(config).not.toHaveProperty('rewrites');
    expect(config).not.toHaveProperty('redirects');
    expect(config).not.toHaveProperty('headers');
  });

  // REGRESSION: the Safari < 14.1 fix was a webpack plugin, so Turbopack builds shipped
  // destructuring to apps targeting Safari 12
  it('lowers destructuring after the production compile when the app targets Safari < 14.1', async () => {
    const own = vi.fn();
    const dir = app(SAFARI_12);
    dirs.push(dir);
    await finalConfig({ compiler: { runAfterProductionCompile: own } }).compiler.runAfterProductionCompile({
      distDir: '.next',
      projectDir: dir,
    });
    expect(chunk(dir)).not.toMatch(/\{a,b\}|\[c\]=/);
    expect(own).toHaveBeenCalledWith({ distDir: '.next', projectDir: dir });
  });

  it('leaves the chunks of an app on Next\'s default targets (Safari 16.4) or a modern browserslist', async () => {
    for (const browserslist of [undefined, ['safari >= 15', 'ios_saf >= 15']]) {
      const dir = app(browserslist);
      dirs.push(dir);
      expect(targetsBuggySafari(dir)).toBe(false);
      expect(await lowerClientDestructuring({ distDir: '.next', projectDir: dir })).toBe(0);
      expect(chunk(dir)).toBe(CHUNK_A);
    }
    const dir = app(['ios_saf >= 14']);
    dirs.push(dir);
    expect(targetsBuggySafari(dir)).toBe(true);
  });

  // REGRESSION: Babel put `const _excluded = [...]` at the top of every lowered chunk; chunks
  // share one global scope, so every chunk after the first threw "Identifier '_excluded' has
  // already been declared" and the page never hydrated
  it('lowered chunks run side by side in one global scope', async () => {
    const dir = app(SAFARI_12, {
      'a.js': turbopackChunk('a', '(o)=>{const{a,...rest}=o;return rest}'),
      'b.js': turbopackChunk('b', '(o)=>{const{b,...rest}=o;return rest}'),
    });
    dirs.push(dir);
    expect(await lowerClientDestructuring({ distDir: '.next', projectDir: dir })).toBe(2);
    expect(chunk(dir, 'a.js')).toContain('_excluded');

    const page = createContext({});
    runInContext(chunk(dir, 'a.js'), page);
    runInContext(chunk(dir, 'b.js'), page);
    const [[, a], [, b]] = runInContext('globalThis.TURBOPACK', page);
    expect(JSON.stringify(a.f({ a: 1, b: 2, c: 3 }))).toBe('{"b":2,"c":3}');
    expect(JSON.stringify(b.f({ a: 1, b: 2, c: 3 }))).toBe('{"a":1,"c":3}');
  });

  it('fails the build on a script chunk declaring a top-level binding (its scope would hide it)', async () => {
    const dir = app(SAFARI_12, { 'a.js': 'var shared=1;function f({a}){return a}' });
    dirs.push(dir);
    await expect(lowerClientDestructuring({ distDir: '.next', projectDir: dir })).rejects.toThrow(
      /declares top-level shared, f/
    );
  });
});
