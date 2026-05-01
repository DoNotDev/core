// packages/core/config/functions/generateYaml.js

/**
 * @fileoverview Generate functions.yaml from FunctionsConfig
 * @description Build-time utility to auto-generate Firebase functions.yaml
 *              and filter .env secrets for clean deployment
 */

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
 * Auto-detect secret keys from .env file
 * Returns keys that are NOT config vars (not FIREBASE_*, GCLOUD_*, etc.)
 * @param {string} [envPath='.env'] - Path to .env file
 * @returns {string[]} Secret key names
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

/**
 * Check if a function name matches a CRUD pattern (create_*, get_*, etc.)
 * @param {string} name
 * @returns {boolean}
 */
function isCrudFunctionName(name) {
  return CRUD_OPERATIONS.some((op) => name.startsWith(`${op}_`));
}

/**
 * Generate functions.yaml content from config
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @param {{ entryFile?: string, envPath?: string }} [options] - Auto-detection options
 * @returns {string} YAML content
 */
export function generateFunctionsYaml(config, options = {}) {
  const defaults = config.defaults || {};
  const appLabels = defaults.labels || {};
  const endpoints = {};

  // Auto-detect secrets from .env (unless manually specified per-function)
  const autoSecrets = options.envPath
    ? detectSecretsFromEnv(options.envPath)
    : detectSecretsFromEnv();
  const secretEnvVars =
    autoSecrets.length > 0 ? autoSecrets.map((s) => ({ key: s })) : undefined;

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

    endpoints[name] = {
      region: meta.region || defaults.region || ['europe-west1'],
      platform: meta.platform || defaults.platform || 'gcfv2',
      entryPoint: meta.entryPoint || name,
      labels,
    };

    if (meta.trigger === 'http') {
      endpoints[name].httpsTrigger = {};
    } else {
      endpoints[name].callableTrigger = {};
    }

    // Per-function secrets override auto-detected secrets
    if (meta.secrets?.length) {
      endpoints[name].secretEnvironmentVariables = meta.secrets.map((s) => ({
        key: s,
      }));
    } else if (secretEnvVars) {
      endpoints[name].secretEnvironmentVariables = secretEnvVars;
    }
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

        // CRUD functions also get auto-detected secrets
        if (secretEnvVars) {
          endpoints[name].secretEnvironmentVariables = secretEnvVars;
        }
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
 * Generate yaml and return metadata
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @param {{ entryFile?: string, envPath?: string }} [options] - Auto-detection options
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

  // Auto-detect secrets
  const autoSecrets = options.envPath
    ? detectSecretsFromEnv(options.envPath)
    : detectSecretsFromEnv();

  return {
    yaml: generateFunctionsYaml(config, options),
    functions: [...staticFunctions, ...crudFunctions],
    staticFunctions,
    crudFunctions,
    autoDetected,
    autoSecrets,
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
 * 1. Collects secret key names from FunctionsConfig
 * 2. Strips those keys from .env (which Firebase deploys)
 * 3. Moves them to .env.local (emulator-only, never deployed by Firebase)
 *
 * @param {import('@donotdev/types').FunctionsConfig} config
 * @returns {{ stripped: string[], kept: number }} Result summary
 */
export function filterEnvSecrets(config) {
  // Collect secret keys: manual from config + auto-detected from .env
  const secretKeys = new Set();

  // Manual: from config.functions[name].secrets
  for (const meta of Object.values(config.functions || {})) {
    if (meta.secrets) {
      for (const s of meta.secrets) secretKeys.add(s);
    }
  }

  // Auto-detect: all non-config keys from .env are secrets
  const autoSecrets = detectSecretsFromEnv();
  for (const s of autoSecrets) secretKeys.add(s);

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

  // Write filtered .env (deployed — no secrets)
  pathResolver.writeSync('.env', kept.join('\n'));

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
        existing.trimEnd() + '\n' + header + newEntries.join('\n') + '\n'
      );
    }
  } else {
    pathResolver.writeSync('.env.local', header + stripped.join('\n') + '\n');
  }

  const strippedKeys = stripped.map((l) => l.split('=')[0].trim());
  return { stripped: strippedKeys, kept: kept.length };
}
