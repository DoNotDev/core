import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectExportedFunctions,
  detectSecretsFromEnv,
  generateFunctionsYaml,
  generateFunctionsYamlWithInfo,
  generateCrudExports,
  filterEnvSecrets,
} from '../generateYaml.js';

// Mock PathResolver — every method used in generateYaml.js must be tested
const { mockPathExists, mockReadSync, mockWriteSync } = vi.hoisted(() => ({
  mockPathExists: vi.fn(() => false),
  mockReadSync: vi.fn(() => ''),
  mockWriteSync: vi.fn(),
}));

vi.mock('../../utils/PathResolver.js', () => ({
  PathResolver: {
    getInstance: () => ({
      pathExists: mockPathExists,
      readSync: mockReadSync,
      writeSync: mockWriteSync,
    }),
  },
}));

describe('generateYaml — PathResolver integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathExists.mockReturnValue(false);
    mockReadSync.mockReturnValue('');
    mockWriteSync.mockReset();
  });

  // =========================================================================
  // PathResolver method call verification
  // =========================================================================

  describe('PathResolver method contracts', () => {
    it('detectExportedFunctions calls pathExists and readSync', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue('export const myFunc = () => {}');

      detectExportedFunctions('src/index.ts');

      expect(mockPathExists).toHaveBeenCalledWith('src/index.ts');
      expect(mockReadSync).toHaveBeenCalledWith('src/index.ts', {
        format: 'text',
      });
    });

    it('detectExportedFunctions returns early when file missing', () => {
      mockPathExists.mockReturnValue(false);

      const result = detectExportedFunctions('src/index.ts');

      expect(result).toEqual([]);
      expect(mockReadSync).not.toHaveBeenCalled();
    });

    it('detectSecretsFromEnv calls pathExists and readSync', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue('MY_SECRET=abc123');

      detectSecretsFromEnv('.env');

      expect(mockPathExists).toHaveBeenCalledWith('.env');
      expect(mockReadSync).toHaveBeenCalledWith('.env');
    });

    it('filterEnvSecrets calls pathExists, readSync, and writeSync', () => {
      mockPathExists.mockImplementation((path: string) => path === '.env');
      mockReadSync.mockReturnValue('MY_SECRET=value\nFIREBASE_REGION=eu');

      filterEnvSecrets({ functions: {} });

      // readSync called for .env (secret detection + filtering)
      expect(mockReadSync).toHaveBeenCalled();
      // writeSync called for .env (stripped) and .env.local (secrets)
      expect(mockWriteSync).toHaveBeenCalledWith('.env', expect.any(String));
      expect(mockWriteSync).toHaveBeenCalledWith(
        '.env.local',
        expect.stringContaining('MY_SECRET=value')
      );
    });

    it('filterEnvSecrets appends to existing .env.local', () => {
      mockPathExists.mockReturnValue(true);
      // First readSync for secret detection, second for .env content, third for .env.local
      mockReadSync
        .mockReturnValueOnce('MY_SECRET=value') // detectSecretsFromEnv
        .mockReturnValueOnce('MY_SECRET=value\nFIREBASE_REGION=eu') // filterEnvSecrets .env read
        .mockReturnValueOnce('EXISTING_KEY=old'); // .env.local existing content

      filterEnvSecrets({ functions: {} });

      // Should call writeSync on .env.local with appended content
      const envLocalCalls = mockWriteSync.mock.calls.filter(
        (c) => c[0] === '.env.local'
      );
      expect(envLocalCalls.length).toBe(1);
      expect(envLocalCalls[0][1]).toContain('EXISTING_KEY=old');
      expect(envLocalCalls[0][1]).toContain('MY_SECRET=value');
    });
  });

  // =========================================================================
  // detectExportedFunctions
  // =========================================================================

  describe('detectExportedFunctions', () => {
    it('detects re-exports', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        "export { myFunc, otherFunc } from './handlers';"
      );

      const result = detectExportedFunctions('src/index.ts');
      expect(result).toContain('myFunc');
      expect(result).toContain('otherFunc');
    });

    it('detects aliased re-exports', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        "export { internalName as publicName } from './handlers';"
      );

      const result = detectExportedFunctions('src/index.ts');
      expect(result).toContain('publicName');
      expect(result).not.toContain('internalName');
    });

    it('detects const exports', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        'export const createUser = onCall(() => {});\nexport const deleteUser = onCall(() => {});'
      );

      const result = detectExportedFunctions('src/index.ts');
      expect(result).toContain('createUser');
      expect(result).toContain('deleteUser');
    });

    it('deduplicates names', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        "export { myFunc } from './a';\nexport { myFunc } from './b';"
      );

      const result = detectExportedFunctions('src/index.ts');
      expect(result.filter((n) => n === 'myFunc')).toHaveLength(1);
    });
  });

  // =========================================================================
  // detectSecretsFromEnv
  // =========================================================================

  describe('detectSecretsFromEnv', () => {
    it('returns secrets excluding Firebase/config keys', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        'STRIPE_KEY=sk_test_123\nFIREBASE_REGION=europe-west1\nSENTRY_DSN=https://sentry.io'
      );

      const result = detectSecretsFromEnv();
      expect(result).toContain('STRIPE_KEY');
      expect(result).toContain('SENTRY_DSN');
      expect(result).not.toContain('FIREBASE_REGION');
    });

    it('skips comments and empty lines', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        '# Comment\n\nMY_KEY=value\n  \n# Another comment'
      );

      const result = detectSecretsFromEnv();
      expect(result).toEqual(['MY_KEY']);
    });

    it('skips X_GOOGLE_ prefixed keys', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        'X_GOOGLE_NEW_DEPLOY_TRIGGER=1\nMY_SECRET=value'
      );

      const result = detectSecretsFromEnv();
      expect(result).toEqual(['MY_SECRET']);
    });

    it('returns empty for missing file', () => {
      mockPathExists.mockReturnValue(false);
      expect(detectSecretsFromEnv()).toEqual([]);
    });
  });

  // =========================================================================
  // generateFunctionsYaml
  // =========================================================================

  describe('generateFunctionsYaml', () => {
    it('generates YAML with manual functions', () => {
      mockPathExists.mockReturnValue(false); // no .env, no entry file

      const yaml = generateFunctionsYaml({
        defaults: { region: ['europe-west1'] },
        functions: {
          sendEmail: { trigger: 'http', category: 'email' },
        },
      });

      expect(yaml).toContain('sendEmail:');
      expect(yaml).toContain('httpsTrigger:');
      expect(yaml).toContain('europe-west1');
      expect(yaml).toContain('category: email');
    });

    it('generates YAML with CRUD entities', () => {
      mockPathExists.mockReturnValue(false);

      const yaml = generateFunctionsYaml({
        defaults: {},
        functions: {},
        crud: { entities: ['user'] },
      });

      expect(yaml).toContain('create_user:');
      expect(yaml).toContain('get_user:');
      expect(yaml).toContain('list_user:');
      expect(yaml).toContain('update_user:');
      expect(yaml).toContain('delete_user:');
      expect(yaml).toContain('listCard_user:');
    });

    it('auto-detects functions from entry file', () => {
      mockPathExists.mockImplementation(
        (path: string) => path === 'src/index.ts'
      );
      mockReadSync.mockReturnValue(
        "export { processPayment } from './payment';"
      );

      const yaml = generateFunctionsYaml(
        { defaults: {}, functions: {} },
        { entryFile: 'src/index.ts' }
      );

      expect(yaml).toContain('processPayment:');
    });

    it('auto-detects secrets from .env', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockImplementation((path: string) => {
        if (path === '.env') return 'STRIPE_KEY=sk_test';
        if (path === 'src/index.ts')
          return "export { handler } from './handler';";
        return '';
      });

      const yaml = generateFunctionsYaml(
        { defaults: {}, functions: {} },
        { entryFile: 'src/index.ts', envPath: '.env' }
      );

      expect(yaml).toContain('key: STRIPE_KEY');
    });

    it('includes header with generation timestamp', () => {
      mockPathExists.mockReturnValue(false);

      const yaml = generateFunctionsYaml({ defaults: {}, functions: {} });

      expect(yaml).toContain('# Firebase Functions Configuration');
      expect(yaml).toContain('# Generated by @donotdev/core/functions');
    });
  });

  // =========================================================================
  // generateFunctionsYamlWithInfo
  // =========================================================================

  describe('generateFunctionsYamlWithInfo', () => {
    it('returns metadata alongside YAML', () => {
      mockPathExists.mockReturnValue(false);

      const result = generateFunctionsYamlWithInfo({
        defaults: {},
        functions: { myFunc: {} },
        crud: { entities: ['post'] },
      });

      expect(result.yaml).toBeDefined();
      expect(result.staticFunctions).toContain('myFunc');
      expect(result.crudFunctions).toContain('create_post');
      expect(result.crudFunctions).toHaveLength(7); // create, get, list, listCard, update, delete, bulk
    });

    it('reports auto-detected functions', () => {
      mockPathExists.mockImplementation(
        (path: string) => path === 'src/index.ts'
      );
      mockReadSync.mockReturnValue('export const autoFunc = onCall(() => {});');

      const result = generateFunctionsYamlWithInfo(
        { defaults: {}, functions: { manualFunc: {} } },
        { entryFile: 'src/index.ts' }
      );

      expect(result.autoDetected).toContain('autoFunc');
      expect(result.autoDetected).not.toContain('manualFunc');
      expect(result.staticFunctions).toContain('manualFunc');
      expect(result.staticFunctions).toContain('autoFunc');
    });
  });

  // =========================================================================
  // filterEnvSecrets
  // =========================================================================

  describe('filterEnvSecrets', () => {
    it('returns empty when no .env exists', () => {
      mockPathExists.mockReturnValue(false);

      const result = filterEnvSecrets({ functions: {} });
      expect(result.stripped).toEqual([]);
    });

    it('strips secrets and keeps config vars', () => {
      mockPathExists.mockImplementation((path: string) => path === '.env');
      mockReadSync.mockReturnValue(
        '# Config\nFIREBASE_REGION=eu\nSTRIPE_KEY=sk_test\nSENTRY_DSN=https://dsn'
      );

      const result = filterEnvSecrets({ functions: {} });

      expect(result.stripped).toContain('STRIPE_KEY');
      expect(result.stripped).toContain('SENTRY_DSN');
      expect(result.stripped).not.toContain('FIREBASE_REGION');

      // .env should be written without secrets
      const envWrite = mockWriteSync.mock.calls.find((c) => c[0] === '.env');
      expect(envWrite).toBeDefined();
      expect(envWrite![1]).toContain('FIREBASE_REGION=eu');
      expect(envWrite![1]).not.toContain('STRIPE_KEY');
    });

    it('does nothing when no secrets detected', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        'FIREBASE_REGION=eu\nFIREBASE_PROJECT_ID=my-project'
      );

      const result = filterEnvSecrets({ functions: {} });

      expect(result.stripped).toEqual([]);
      expect(mockWriteSync).not.toHaveBeenCalled();
    });

    it('includes manually specified secrets from config', () => {
      mockPathExists.mockImplementation((path: string) => path === '.env');
      mockReadSync.mockReturnValue('MY_MANUAL_SECRET=abc\nFIREBASE_REGION=eu');

      const result = filterEnvSecrets({
        functions: {
          myFunc: { secrets: ['MY_MANUAL_SECRET'] },
        },
      });

      expect(result.stripped).toContain('MY_MANUAL_SECRET');
    });
  });

  describe('generateCrudExports', () => {
    const CRUD_OPS = [
      'create',
      'get',
      'list',
      'listCard',
      'update',
      'delete',
      'bulk',
    ];

    it('emits every CRUD op × entity as a top-level named export', () => {
      const out = generateCrudExports({
        crud: { entities: ['cars', 'customers'] },
      });
      for (const entity of ['cars', 'customers']) {
        for (const op of CRUD_OPS) {
          expect(out).toContain(
            `export const ${op}_${entity} = crud['${op}_${entity}'];`
          );
        }
      }
    });

    it('includes bulk_<entity> for every entity (regression: missing bulk exports caused Cloud Run boot crash)', () => {
      const out = generateCrudExports({
        crud: { entities: ['inquiries'] },
      });
      expect(out).toContain(
        `export const bulk_inquiries = crud['bulk_inquiries'];`
      );
    });

    it('produces a valid stub when no entities are configured', () => {
      const out = generateCrudExports({});
      expect(out).toContain(
        "import { createCrudFunctions } from '@donotdev/functions/firebase';"
      );
      expect(out).toContain('const crud = createCrudFunctions(entities);');
      expect(out).not.toMatch(/^export const /m);
    });

    it('marks output as auto-generated so consumers know not to hand-edit', () => {
      const out = generateCrudExports({ crud: { entities: ['x'] } });
      expect(out).toMatch(/Auto-generated CRUD exports - DO NOT EDIT MANUALLY/);
    });
  });
});
