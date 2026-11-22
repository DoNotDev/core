// packages/core/config/functions/generateYaml.js

/**
 * @fileoverview Generate functions.yaml from FunctionsConfig
 * @description Build-time utility to auto-generate Firebase functions.yaml
 *              and filter .env secrets for clean deployment.
 *              Each endpoint binds the secrets its function declares
 *              (`secrets: [defineSecret('X')]`), read from the built bundle
 *              through the firebase-functions SDK manifest.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PathResolver } from '../utils/PathResolver.js';

const pathResolver = PathResolver.getInstance();

const CRUD_OPERATIONS = [
  'create',
  'get',
  'list',
  'listCard',
  'update',
  'delete',
  'bulk',
];

/**
 * Convert object to YAML string
 */
function toYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (Object.keys(value).length === 0) {
        yaml += `${spaces}${key}: {}\n`;
      } else {
        yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        yaml += `${spaces}${key}: []\n`;
      } else {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item);
            const [firstKey, firstVal] = entries[0];
            yaml += `${spaces}  - ${firstKey}: ${firstVal}\n`;
            for (let i = 1; i < entries.length; i++) {
              const [k, val] = entries[i];
              yaml += `${spaces}    ${k}: ${val}\n`;
            }
          } else {
            yaml += `${spaces}  - ${item}\n`;
          }
        }
      }
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }
  return yaml;
}

// --- Auto-Detection ---

/** Reserved .env key prefixes — config vars, not secrets */
const RESERVED_ENV_PREFIXES = ['X_GOOGLE_', 'FIREBASE_', 'EXT_', 'GCLOUD_'];
const CONFIG_ONLY_KEYS = [
  'FIREBASE_REGION',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_AUTH_DOMAIN',
  'ENABLE_RATE_LIMITING',
  'DISABLE_RATE_LIMITING',
  'ENABLE_METRICS',
  'DISABLE_METRICS',
  'ENFORCE_APP_CHECK',
];

/**
 * Auto-detect exported function names from entry file (src/index.ts)
 * Parses export statements and returns function names.
 * @param {string} entryFile - Path to the entry file (e.g., 'src/index.ts')
 * @returns {string[]} Exported function names
 */
export function detectExportedFunctions(entryFile) {
  if (!pathResolver.pathExists(entryFile)) return [];

  const content = pathResolver.readSync(entryFile, { format: 'text' });
  const names = [];

  // Match: export { name1, name2 } from '...'
  const reExports = content.matchAll(/export\s*\{([^}]+)\}/g);
  for (const m of reExports) {
    if (m[1]) {
      const exported = m[1]
        .split(',')
        .map((n) => {
          const parts = n.trim().split(/\s+as\s+/);
          return (parts[1] || parts[0] || '').trim();
        })
        .filter(Boolean);
      names.push(...exported);
    }
  }

  // Match: export const name = ...
  const constExports = content.matchAll(/export\s+const\s+(\w+)/g);
  for (const m of constExports) {
    if (m[1]) names.push(m[1]);
  }

  // Match: export default ...
  // (skip — Firebase doesn't use default exports for functions)

  return [...new Set(names)];
}

/**
 * List the keys of a .env file that are not framework config vars
 * (not FIREBASE_*, GCLOUD_*, etc.).
 *
 * Not used for secret binding: functions.yaml binds the secrets each function
 * declares (see {@link detectDeclaredSecrets}), whatever .env holds.
 *
 * @param {string} [envPath='.env'] - Path to .env file
 * @returns {string[]} Non-config key names
 */
export function detectSecretsFromEnv(envPath = '.env') {
  if (!pathResolver.pathExists(envPath)) return [];

  const content = pathResolver.readSync(envPath);
  const secrets = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    if (CONFIG_ONLY_KEYS.includes(key)) continue;
    if (RESERVED_ENV_PREFIXES.some((p) => key.startsWith(p))) continue;

    secrets.push(key);
  }

  return secrets;
}

/** Time allowed for the SDK to load the bundle and write its manifest. */
const MANIFEST_TIMEOUT_MS = 60_000;

/**
 * Find the firebase-functions SDK bin the way Node resolves the package:
 * `node_modules/firebase-functions` in `dir` or the nearest ancestor.
 * @param {string} dir - Absolute functions directory
 * @returns {string} Absolute path of the SDK bin script
 */
function findFunctionsSdkBin(dir) {
  let current = dir;
  for (;;) {
    const pkgPath = path.join(
      current,
      'node_modules',
      'firebase-functions',
      'package.json'
    );
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const bin =
        typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['firebase-functions'];
      if (!bin) {
        throw new Error(
          `${pkgPath} declares no firebase-functions bin: upgrade firebase-functions.`
        );
      }
      return path.join(path.dirname(pkgPath), bin);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `firebase-functions not found from ${dir}: add it to the functions package dependencies.`
      );
    }
    current = parent;
  }
}

/**
 * Read the secrets each function of the built bundle declares
 * (`secrets: [defineSecret('X')]` in its options).
 *
 * Runs the firebase-functions SDK bin with `FUNCTIONS_MANIFEST_OUTPUT_PATH`,
 * the way firebase-tools discovers functions: the SDK loads the bundle (the
 * `main` of `functionsDir/package.json`) and writes its endpoint manifest.
 * Loading needs no secret value and no network; the child gets only `HOME`,
 * `PATH` and `NODE_ENV`.
 *
 * @param {string} [functionsDir='.'] - Functions package directory (built)
 * @returns {Record<string, string[]>} Entry point → declared secret names;
 *   functions that declare none are absent
 * @throws {Error} When the SDK is missing, or the bundle fails to load
 *
 * @example
 * ```js
 * detectDeclaredSecrets('.');
 * // → { stripeWebhook: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] }
 * ```
 */
export function detectDeclaredSecrets(functionsDir = '.') {
  const dir = path.resolve(functionsDir);
  const bin = findFunctionsSdkBin(dir);
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dndev-functions-manifest-')
  );
  const manifestPath = path.join(tmpDir, 'manifest.json');

  try {
    const result = spawnSync('node', [bin], {
      cwd: dir,
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        NODE_ENV: process.env.NODE_ENV,
        FUNCTIONS_MANIFEST_OUTPUT_PATH: manifestPath,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: MANIFEST_TIMEOUT_MS,
    });
    if (result.error) {
      throw new Error(
        `Could not read the secrets the functions declare (firebase-functions manifest in ${dir}): ${result.error.message}`
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `Could not read the secrets the functions declare: the firebase-functions SDK failed to load the bundle in ${dir} (exit ${result.status}). Build the functions first.\n${String(result.stderr).trim()}`
      );
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    /** @type {Record<string, string[]>} */
    const declared = {};
    for (const [id, endpoint] of Object.entries(manifest.endpoints ?? {})) {
      const keys = (endpoint?.secretEnvironmentVariables ?? []).map((entry) => {
        if (typeof entry?.key !== 'string' || !entry.key) {
          throw new Error(
            `firebase-functions manifest: endpoint "${id}" has a secret without a key.`
          );
        }
        return entry.key;
      });
      if (keys.length > 0) declared[endpoint.entryPoint ?? id] = keys;
    }
    return declared;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Secret bindings of one endpoint: the manual override, else its declarations.
 * @param {string[] | undefined} manual - `config.functions[name].secrets`
 * @param {string[] | undefined} declared - Secrets the function declares
 * @returns {{ key: string }[] | undefined} `secretEnvironmentVariables`, or undefined for none
 */
function secretBindings(manual, declared) {
  const keys = manual?.length ? manual : declared;
  return keys?.length ? keys.map((key) => ({ key })) : undefined;
}

/**
 * Check if a function name matches a CRUD pattern (create_*, get_*, etc.)
 * @param {string} name
 * @returns {boolean}
 */
function isCrudFunctionName(name) {
  return CRUD_OPERATIONS.some((op) => name.startsWith(`${op}_`));
}

/**
 * Generate functions.yaml content from config.
 *
 * Each endpoint's `secretEnvironmentVariables` lists the secrets its function
 * declares in the built bundle; `config.functions[name].secrets` overrides
 * them; an endpoint with neither gets no key. The bindings never depend on
 * .env, so consecutive builds give the same endpoints.
 *
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @param {{ entryFile?: string, envPath?: string, functionsDir?: string, declaredSecrets?: Record<string, string[]> }} [options] -
 *   Auto-detection options; `declaredSecrets` (from {@link detectDeclaredSecrets})
 *   skips reading the bundle again, else it is read from `functionsDir` (default '.')
 * @returns {string} YAML content
 */
export function generateFunctionsYaml(config, options = {}) {
  const defaults = config.defaults || {};
  const appLabels = defaults.labels || {};
  const endpoints = {};

  const declaredSecrets =
    options.declaredSecrets ?? detectDeclaredSecrets(options.functionsDir);

  // Auto-detect exported functions from entry file
  const autoExports = options.entryFile
    ? detectExportedFunctions(options.entryFile)
    : [];

  // Merge: manual config.functions + auto-detected exports (auto-detected fills gaps)
  const manualFunctions = config.functions || {};
  const allStaticNames = new Set(Object.keys(manualFunctions));

  // Add auto-detected exports that aren't CRUD and aren't already in manual config
  for (const name of autoExports) {
    if (!isCrudFunctionName(name) && !allStaticNames.has(name)) {
      allStaticNames.add(name);
    }
  }

  // Static functions
  for (const name of allStaticNames) {
    const meta = manualFunctions[name] || {};
    const labels = { ...appLabels, ...meta.labels };
    if (meta.category) labels.category = meta.category;

    const entryPoint = meta.entryPoint || name;
    endpoints[name] = {
      region: meta.region || defaults.region || ['europe-west1'],
      platform: meta.platform || defaults.platform || 'gcfv2',
      entryPoint,
      labels,
    };

    if (meta.trigger === 'http') {
      endpoints[name].httpsTrigger = {};
    } else {
      endpoints[name].callableTrigger = {};
    }

    // Manual per-function secrets override the function's declarations
    const secrets = secretBindings(meta.secrets, declaredSecrets[entryPoint]);
    if (secrets) endpoints[name].secretEnvironmentVariables = secrets;
  }

  // CRUD functions
  if (config.crud?.entities) {
    for (const entity of config.crud.entities) {
      for (const op of CRUD_OPERATIONS) {
        const name = `${op}_${entity}`;
        endpoints[name] = {
          region: defaults.region || ['europe-west1'],
          platform: defaults.platform || 'gcfv2',
          callableTrigger: {},
          entryPoint: name,
          labels: { ...appLabels, category: 'crud' },
        };

        // CRUD functions bind what they declare (the framework's declare none)
        const secrets = secretBindings(undefined, declaredSecrets[name]);
        if (secrets) endpoints[name].secretEnvironmentVariables = secrets;
      }
    }
  }

  const header = `# Firebase Functions Configuration
# Generated by @donotdev/core/functions - DO NOT EDIT MANUALLY
# Generated at: ${new Date().toISOString()}

`;
  return (
    header + toYaml({ endpoints, specVersion: 'v1alpha1', requiredAPIs: [] })
  );
}

/**
 * Generate the `.generated/crud-exports.ts` source file.
 *
 * Firebase CLI discovers functions by enumerating top-level named exports
 * of the built module — it cannot introspect object properties. The
 * canonical `export const crud = createCrudFunctions(entities)` one-liner
 * therefore needs a sibling file that destructures every CRUD op into a
 * top-level export. This is that file.
 *
 * Called by buildFunctions() before esbuild so the emitted file is always
 * in sync with CRUD_OPERATIONS × config.crud.entities. Writing this on
 * every build is what keeps newly-added ops (e.g. `bulk`) reaching deploy
 * without per-app edits.
 *
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @returns {string} Full TypeScript source
 */
export function generateCrudExports(config) {
  const entities = config.crud?.entities || [];
  const header = `// Auto-generated CRUD exports - DO NOT EDIT MANUALLY
// Generated by @donotdev/core/functions at ${new Date().toISOString()}

import * as entities from 'entities';
import { createCrudFunctions } from '@donotdev/functions/firebase';

const crud = createCrudFunctions(entities);
`;

  const blocks = [header];
  for (const entity of entities) {
    const block = [''];
    for (const op of CRUD_OPERATIONS) {
      const name = `${op}_${entity}`;
      block.push(`export const ${name} = crud['${name}'];`);
    }
    blocks.push(block.join('\n'));
  }

  return blocks.join('\n') + '\n';
}

/**
 * Generate yaml and return metadata. Reads the bundle's secret declarations
 * once and returns them (`declaredSecrets`) for {@link filterEnvSecrets}.
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @param {{ entryFile?: string, envPath?: string, functionsDir?: string, declaredSecrets?: Record<string, string[]> }} [options] - Auto-detection options
 */
export function generateFunctionsYamlWithInfo(config, options = {}) {
  const manualStatic = Object.keys(config.functions || {});
  const crudFunctions = [];

  if (config.crud?.entities) {
    for (const entity of config.crud.entities) {
      for (const op of CRUD_OPERATIONS) {
        crudFunctions.push(`${op}_${entity}`);
      }
    }
  }

  // Auto-detect exports if entryFile provided
  const autoExports = options.entryFile
    ? detectExportedFunctions(options.entryFile)
    : [];
  const autoDetected = autoExports.filter(
    (n) => !isCrudFunctionName(n) && !manualStatic.includes(n)
  );
  const staticFunctions = [...manualStatic, ...autoDetected];

  const declaredSecrets =
    options.declaredSecrets ?? detectDeclaredSecrets(options.functionsDir);

  return {
    yaml: generateFunctionsYaml(config, { ...options, declaredSecrets }),
    functions: [...staticFunctions, ...crudFunctions],
    staticFunctions,
    crudFunctions,
    autoDetected,
    // Secret names the bundle declares (union over functions)
    autoSecrets: [...new Set(Object.values(declaredSecrets).flat())].sort(),
    declaredSecrets,
  };
}

/**
 * Filter .env secrets for Firebase deployment
 *
 * Firebase loads .env as regular env vars. If the same key is also declared
 * as a secret (via defineSecret or secretEnvironmentVariables), Cloud Run
 * rejects the overlap.
 *
 * This function:
 * 1. Collects the declared secret names: what the bundle's functions declare
 *    plus `config.functions[name].secrets`
 * 2. Strips those keys from .env (which Firebase deploys); every other key
 *    stays as plain config
 * 3. Moves them to .env.local (emulator-only, never deployed by Firebase)
 *
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @param {{ functionsDir?: string, declaredSecrets?: Record<string, string[]> }} [options] -
 *   `declaredSecrets` from {@link detectDeclaredSecrets} (else read from `functionsDir`, default '.')
 * @returns {{ stripped: string[], kept: number }} Result summary
 */
export function filterEnvSecrets(config, options = {}) {
  const secretKeys = new Set();

  // Manual: from config.functions[name].secrets
  for (const meta of Object.values(config.functions || {})) {
    if (meta.secrets) {
      for (const s of meta.secrets) secretKeys.add(s);
    }
  }

  // Declared by the functions (defineSecret + secrets option)
  const declaredSecrets =
    options.declaredSecrets ?? detectDeclaredSecrets(options.functionsDir);
  for (const keys of Object.values(declaredSecrets)) {
    for (const s of keys) secretKeys.add(s);
  }

  if (secretKeys.size === 0 || !pathResolver.pathExists('.env')) {
    return { stripped: [], kept: 0 };
  }

  const original = pathResolver.readSync('.env');
  const lines = original.split(/\r?\n/);
  const kept = [];
  const stripped = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      kept.push(line);
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    const key = eqIndex > 0 ? trimmed.substring(0, eqIndex).trim() : '';
    if (secretKeys.has(key)) {
      stripped.push(line);
    } else {
      kept.push(line);
    }
  }

  if (stripped.length === 0) {
    return { stripped: [], kept: kept.length };
  }

  // Write filtered .env (deployed — no secrets). writeSync skips existing files without overwrite.
  pathResolver.writeSync('.env', kept.join('\n'), { overwrite: true });

  // Write/append to .env.local (emulator only — has secrets for local dev)
  const header = '# Secrets managed by sync-secrets (auto-filtered by build)\n';
  if (pathResolver.pathExists('.env.local')) {
    const existing = pathResolver.readSync('.env.local');
    const existingKeys = new Set(
      existing
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map((l) => l.split('=')[0].trim())
    );
    const newEntries = stripped.filter(
      (l) => !existingKeys.has(l.split('=')[0].trim())
    );
    if (newEntries.length > 0) {
      pathResolver.writeSync(
        '.env.local',
        existing.trimEnd() + '\n' + header + newEntries.join('\n') + '\n',
        { overwrite: true }
      );
    }
  } else {
    pathResolver.writeSync('.env.local', header + stripped.join('\n') + '\n');
  }

  const strippedKeys = stripped.map((l) => l.split('=')[0].trim());
  return { stripped: strippedKeys, kept: kept.length };
}
