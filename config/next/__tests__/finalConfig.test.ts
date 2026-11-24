// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { buildFinalConfig } from '../configBuilder.js';

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

describe('Next config: Turbopack only', () => {
  let appRoot: string;
  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-final-config-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });
  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
  });

  // REGRESSION: the framework's webpack function (Safari fix, flag filter, externals) never
  // ran: Next 16 builds with Turbopack
  it('sets no webpack config; an app\'s own passes through', () => {
    expect(finalConfig({})).not.toHaveProperty('webpack');
    const webpack = vi.fn();
    expect(finalConfig({ webpack }).webpack).toBe(webpack);
  });

  it('sets no compiler config; an app\'s own passes through', () => {
    expect(finalConfig({})).not.toHaveProperty('compiler');
    const compiler = { runAfterProductionCompile: vi.fn() };
    expect(finalConfig({ compiler }).compiler).toBe(compiler);
  });

  it('a static export (output: export) has no rewrites, redirects or headers', () => {
    const config = finalConfig({ output: 'export' });
    expect(config.output).toBe('export');
    expect(config).not.toHaveProperty('rewrites');
    expect(config).not.toHaveProperty('redirects');
    expect(config).not.toHaveProperty('headers');
  });
});
