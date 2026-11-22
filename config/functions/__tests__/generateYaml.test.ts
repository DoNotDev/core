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

      filterEnvSecrets(
        { functions: {} },
        { declaredSecrets: { fn: ['MY_SECRET'] } }
      );

      expect(mockReadSync).toHaveBeenCalledWith('.env');
      // writeSync overwrites .env (stripped) and writes .env.local (secrets)
      expect(mockWriteSync).toHaveBeenCalledWith('.env', expect.any(String), {
        overwrite: true,
      });
      expect(mockWriteSync).toHaveBeenCalledWith(
        '.env.local',
        expect.stringContaining('MY_SECRET=value')
      );
    });

    it('filterEnvSecrets appends to existing .env.local', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync
        .mockReturnValueOnce('MY_SECRET=value\nFIREBASE_REGION=eu') // filterEnvSecrets .env read
        .mockReturnValueOnce('EXISTING_KEY=old'); // .env.local existing content

      filterEnvSecrets(
        { functions: {} },
        { declaredSecrets: { fn: ['MY_SECRET'] } }
      );

      // Should call writeSync on .env.local with appended content
      const envLocalCalls = mockWriteSync.mock.calls.filter(
        (c) => c[0] === '.env.local'
      );
      expect(envLocalCalls.length).toBe(1);
      expect(envLocalCalls[0][1]).toContain('EXISTING_KEY=old');
      expect(envLocalCalls[0][1]).toContain('MY_SECRET=value');
      expect(envLocalCalls[0][2]).toEqual({ overwrite: true });
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

      const yaml = generateFunctionsYaml(
        {
          defaults: { region: ['europe-west1'] },
          functions: {
            sendEmail: { trigger: 'http', category: 'email' },
          },
        },
        { declaredSecrets: {} }
      );

      expect(yaml).toContain('sendEmail:');
      expect(yaml).toContain('httpsTrigger:');
      expect(yaml).toContain('europe-west1');
      expect(yaml).toContain('category: email');
    });

    it('generates YAML with CRUD entities', () => {
      mockPathExists.mockReturnValue(false);

      const yaml = generateFunctionsYaml(
        {
          defaults: {},
          functions: {},
          crud: { entities: ['user'] },
        },
        { declaredSecrets: {} }
      );

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
        { entryFile: 'src/index.ts', declaredSecrets: {} }
      );

      expect(yaml).toContain('processPayment:');
    });

    it('binds only the secrets each function declares, never .env keys', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockImplementation((path: string) => {
        if (path === '.env') return 'STRIPE_KEY=sk_test\nOTHER_KEY=x';
        if (path === 'src/index.ts')
          return "export { handler, plain } from './handler';";
        return '';
      });

      const yaml = generateFunctionsYaml(
        { defaults: {}, functions: {}, crud: { entities: ['post'] } },
        {
          entryFile: 'src/index.ts',
          envPath: '.env',
          declaredSecrets: { handler: ['STRIPE_KEY'] },
        }
      );

      const handlerBlock = yaml.split('  plain:')[0]!;
      expect(handlerBlock).toContain('key: STRIPE_KEY');
      expect(yaml.match(/secretEnvironmentVariables/g)).toHaveLength(1);
      expect(yaml).not.toContain('OTHER_KEY');
      expect(mockReadSync).not.toHaveBeenCalledWith('.env');
    });

    it('manual config.functions[name].secrets override the declarations', () => {
      const yaml = generateFunctionsYaml(
        {
          defaults: {},
          functions: { handler: { secrets: ['MANUAL_KEY'] } },
        },
        { declaredSecrets: { handler: ['DECLARED_KEY'] } }
      );

      expect(yaml).toContain('key: MANUAL_KEY');
      expect(yaml).not.toContain('DECLARED_KEY');
    });

    it('looks declarations up by entryPoint', () => {
      const yaml = generateFunctionsYaml(
        {
          defaults: {},
          functions: { publicName: { entryPoint: 'internalName' } },
        },
        { declaredSecrets: { internalName: ['API_KEY'] } }
      );

      expect(yaml).toContain('key: API_KEY');
    });

    it('includes header with generation timestamp', () => {
      mockPathExists.mockReturnValue(false);

      const yaml = generateFunctionsYaml(
        { defaults: {}, functions: {} },
        { declaredSecrets: {} }
      );

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

      const result = generateFunctionsYamlWithInfo(
        {
          defaults: {},
          functions: { myFunc: {} },
          crud: { entities: ['post'] },
        },
        { declaredSecrets: { myFunc: ['B_KEY', 'A_KEY'], other: ['A_KEY'] } }
      );

      expect(result.yaml).toBeDefined();
      expect(result.staticFunctions).toContain('myFunc');
      expect(result.crudFunctions).toContain('create_post');
      expect(result.crudFunctions).toHaveLength(7); // create, get, list, listCard, update, delete, bulk
      expect(result.autoSecrets).toEqual(['A_KEY', 'B_KEY']);
      expect(result.declaredSecrets).toEqual({
        myFunc: ['B_KEY', 'A_KEY'],
        other: ['A_KEY'],
      });
    });

    it('reports auto-detected functions', () => {
      mockPathExists.mockImplementation(
        (path: string) => path === 'src/index.ts'
      );
      mockReadSync.mockReturnValue('export const autoFunc = onCall(() => {});');

      const result = generateFunctionsYamlWithInfo(
        { defaults: {}, functions: { manualFunc: {} } },
        { entryFile: 'src/index.ts', declaredSecrets: {} }
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

      const result = filterEnvSecrets(
        { functions: {} },
        { declaredSecrets: { fn: ['STRIPE_KEY'] } }
      );
      expect(result.stripped).toEqual([]);
    });

    it('strips only declared secrets; other keys stay as plain config', () => {
      mockPathExists.mockImplementation((path: string) => path === '.env');
      mockReadSync.mockReturnValue(
        '# Config\nFIREBASE_REGION=eu\nSTRIPE_KEY=sk_test\nSENTRY_DSN=https://dsn\nGITHUB_CLIENT_ID=id'
      );

      const result = filterEnvSecrets(
        { functions: {} },
        { declaredSecrets: { checkout: ['STRIPE_KEY'] } }
      );

      expect(result.stripped).toEqual(['STRIPE_KEY']);

      // .env keeps every undeclared key
      const envWrite = mockWriteSync.mock.calls.find((c) => c[0] === '.env');
      expect(envWrite).toBeDefined();
      expect(envWrite![1]).toContain('FIREBASE_REGION=eu');
      expect(envWrite![1]).toContain('SENTRY_DSN=https://dsn');
      expect(envWrite![1]).toContain('GITHUB_CLIENT_ID=id');
      expect(envWrite![1]).not.toContain('STRIPE_KEY');
    });

    it('does nothing when no function declares a secret', () => {
      mockPathExists.mockReturnValue(true);
      mockReadSync.mockReturnValue(
        'FIREBASE_REGION=eu\nSENTRY_DSN=https://dsn'
      );

      const result = filterEnvSecrets(
        { functions: {} },
        { declaredSecrets: {} }
      );

      expect(result.stripped).toEqual([]);
      expect(mockWriteSync).not.toHaveBeenCalled();
    });

    it('includes manually specified secrets from config', () => {
      mockPathExists.mockImplementation((path: string) => path === '.env');
      mockReadSync.mockReturnValue('MY_MANUAL_SECRET=abc\nFIREBASE_REGION=eu');

      const result = filterEnvSecrets(
        {
          functions: {
            myFunc: { secrets: ['MY_MANUAL_SECRET'] },
          },
        },
        { declaredSecrets: {} }
      );

      expect(result.stripped).toEqual(['MY_MANUAL_SECRET']);
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
