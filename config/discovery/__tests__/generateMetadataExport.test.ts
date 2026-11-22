import { describe, expect, it } from 'vitest';

import { hasGenerateMetadataExport } from '../../utils/MetaExtractor.js';

describe("page module's own Next generateMetadata (hasGenerateMetadataExport)", () => {
  it('detects every export form', () => {
    for (const code of [
      'export async function generateMetadata({ params }) {\n  return {};\n}',
      'export function generateMetadata() {}',
      'export const generateMetadata = async () => ({});',
      "export { generateMetadata } from './metadata';",
      'const generateMetadata = () => ({});\nexport { default, generateMetadata };',
      '  export async function generateMetadata() {}',
    ]) {
      expect(hasGenerateMetadataExport(code)).toBe(true);
    }
  });

  it('ignores comments, other names and a module without it', () => {
    for (const code of [
      ' * export async function generateMetadata() {}',
      '// export function generateMetadata() {}',
      'export async function generateMetadataFor() {}',
      'async function generateMetadata() {}',
      "export const meta: PageMeta = { namespace: 'home' };",
    ]) {
      expect(hasGenerateMetadataExport(code)).toBe(false);
    }
  });
});
