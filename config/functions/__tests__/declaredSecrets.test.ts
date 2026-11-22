// packages/core/config/functions/__tests__/declaredSecrets.test.ts

/**
 * @fileoverview Secret bindings from a real built bundle
 * @description Runs the firebase-functions SDK manifest on a fixture bundle
 * (one function declaring a secret, one not): only the declaring function is
 * bound, .env never drives bindings, consecutive builds give the same yaml,
 * and `config.functions[name].secrets` wins.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectDeclaredSecrets,
  filterEnvSecrets,
  generateFunctionsYaml,
} from '../generateYaml.js';

/** Directory of the installed firebase-functions package (the repo's). */
function sdkPackageDir(): string {
  let dir = path.dirname(
    createRequire(import.meta.url).resolve('firebase-functions')
  );
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    dir = path.dirname(dir);
  }
  return fs.realpathSync(dir);
}

const BUNDLE = `import { onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const apiKey = defineSecret('API_KEY');

export const declaring = onCall({ secrets: [apiKey] }, () => 'ok');
export const plain = onRequest((req, res) => {
  res.send('ok');
});
`;

const CONFIG = { defaults: { region: ['europe-west1'] }, functions: {} };

/** functions.yaml without its generation-time header. */
function body(yaml: string): string {
  return yaml.slice(yaml.indexOf('endpoints:'));
}

describe('secret bindings from the built bundle', () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dndev-secrets-fixture-'));
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.symlinkSync(
      sdkPackageDir(),
      path.join(dir, 'node_modules', 'firebase-functions'),
      'dir'
    );
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'lib', 'index.js'), BUNDLE);
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', type: 'module', main: 'lib/index.js' })
    );
    // Legacy layout: the secret value and plain config both in .env
    fs.writeFileSync(
      path.join(dir, '.env'),
      'API_KEY=secret-value\nOTHER_KEY=plain-value\nFIREBASE_REGION=europe-west1\n'
    );
    previousCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads each function declaration through the SDK manifest', () => {
    expect(detectDeclaredSecrets(dir)).toEqual({ declaring: ['API_KEY'] });
  });

  it('binds only the declaring function', () => {
    const yaml = generateFunctionsYaml(
      { ...CONFIG, functions: { declaring: {}, plain: { trigger: 'http' } } },
      { functionsDir: dir }
    );
    const [declaringBlock, plainBlock] = body(yaml).split('  plain:');

    expect(declaringBlock).toContain('secretEnvironmentVariables:');
    expect(declaringBlock).toContain('- key: API_KEY');
    expect(plainBlock).not.toContain('secretEnvironmentVariables');
    expect(yaml).not.toContain('OTHER_KEY');
  });

  it('gives the same yaml on a second build after .env was filtered (regression)', () => {
    const config = {
      ...CONFIG,
      functions: { declaring: {}, plain: { trigger: 'http' as const } },
    };
    const first = generateFunctionsYaml(config, { functionsDir: dir });
    const { stripped } = filterEnvSecrets(config, { functionsDir: dir });
    const second = generateFunctionsYaml(config, { functionsDir: dir });

    expect(stripped).toEqual(['API_KEY']);
    expect(body(second)).toBe(body(first));
    expect(body(second)).toContain('- key: API_KEY');

    // Only the declared key left .env; plain config stays.
    const env = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    expect(env).not.toContain('API_KEY');
    expect(env).toContain('OTHER_KEY=plain-value');
    expect(env).toContain('FIREBASE_REGION=europe-west1');
    expect(fs.readFileSync(path.join(dir, '.env.local'), 'utf8')).toContain(
      'API_KEY=secret-value'
    );
  });

  it('lets config.functions[name].secrets override the declarations', () => {
    const yaml = generateFunctionsYaml(
      {
        ...CONFIG,
        functions: {
          declaring: { secrets: ['OVERRIDE_KEY'] },
          plain: { trigger: 'http', secrets: ['MANUAL_KEY'] },
        },
      },
      { functionsDir: dir }
    );
    const [declaringBlock, plainBlock] = body(yaml).split('  plain:');

    expect(declaringBlock).toContain('- key: OVERRIDE_KEY');
    expect(declaringBlock).not.toContain('API_KEY');
    expect(plainBlock).toContain('- key: MANUAL_KEY');
  });

  it('fails loud when the bundle cannot be loaded', () => {
    fs.rmSync(path.join(dir, 'lib', 'index.js'));

    expect(() => detectDeclaredSecrets(dir)).toThrow(
      /firebase-functions SDK failed to load the bundle/
    );
  });
});
