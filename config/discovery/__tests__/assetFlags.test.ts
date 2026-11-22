// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssetDiscovery } from '../AssetDiscovery.js';
import { I18nDiscovery } from '../I18nDiscovery.js';
import { telFieldFlagCodes } from '../../utils/flagAsset.js';
import { createEntityResolver } from '../../utils/pageEntity.js';
import { PathResolver } from '../../utils/PathResolver.js';

/** The framework flag artwork (packages/core/i18n/flags). */
const ARTWORK_DIR = join(__dirname, '..', '..', '..', 'i18n', 'flags');

/** An entities package whose contact entity (re-exported, aliased defineEntity) has a tel field. */
const TEL_ENTITIES: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'entities',
    type: 'module',
    main: './index.ts',
  }),
  'index.ts':
    "export * from './product';\nexport { contactEntity } from './contact';\n",
  'product.ts': [
    "import { defineEntity } from '@donotdev/core';",
    "export const productEntity = defineEntity({ name: 'Product', collection: 'products', fields: { title: { type: 'text' } } });",
  ].join('\n'),
  'contact.ts': [
    "import { defineEntity as define } from '@donotdev/core';",
    'export const contactEntity = define({',
    "  name: 'Contact',",
    "  collection: 'contacts',",
    "  fields: { phone: { name: 'phone', type: 'tel', label: 'Phone' } },",
    '});',
  ].join('\n'),
};

/** The same package without a tel field (`type: 'tel'` outside a defineEntity field does not count). */
const NO_TEL_ENTITIES: Record<string, string> = {
  ...TEL_ENTITIES,
  'contact.ts': [
    "import { defineEntity } from '@donotdev/core';",
    "export const contactEntity = defineEntity({ name: 'Contact', collection: 'contacts', fields: { email: { type: 'email' } } });",
    "export const telTemplate = { type: 'tel' };",
  ].join('\n'),
};

describe('asset discovery: flags of the app languages', () => {
  const resolver = PathResolver.getInstance();
  const previousRoot = resolver.getAppRoot();
  const roots: string[] = [];
  afterEach(() => {
    resolver.setAppRoot(previousRoot);
    for (const root of roots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  const appWithPublic = () => {
    const appRoot = mkdtempSync(join(tmpdir(), 'dndev-flags-'));
    roots.push(appRoot);
    mkdirSync(join(appRoot, 'public'));
    resolver.setAppRoot(appRoot);
    return appRoot;
  };

  /** Workspace: an `entities` package linked in node_modules and an app depending on it. */
  const appWithEntities = (entities: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'dndev-flags-ws-'));
    roots.push(root);
    const write = (path: string, content: string) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    for (const [file, content] of Object.entries(entities))
      write(`entities/${file}`, content);
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(join(root, 'entities'), join(root, 'node_modules', 'entities'));
    write(
      'apps/shop/package.json',
      JSON.stringify({
        name: 'shop',
        dependencies: { entities: 'workspace:*' },
      })
    );
    const appRoot = join(root, 'apps', 'shop');
    mkdirSync(join(appRoot, 'public'));
    resolver.setAppRoot(appRoot);
    return appRoot;
  };

  /** Flag files the asset discovery copies for these app languages' flag codes. */
  const copiedFlags = async (appRoot: string, flagCodes: string[]) => {
    const discovery = new AssetDiscovery(resolver);
    discovery.useFlagCodes(flagCodes, createEntityResolver(appRoot));
    await discovery.discover(true);
    return readdirSync(join(appRoot, 'public', 'flags')).sort();
  };

  it('copies exactly the flags of the app languages to public/flags/ (no entities package), from the framework artwork', async () => {
    const appRoot = appWithPublic();
    mkdirSync(join(appRoot, 'src', 'locales'), { recursive: true });
    for (const language of ['en', 'fr', 'br']) {
      writeFileSync(
        join(appRoot, 'src', 'locales', `home_${language}.json`),
        '{"title":"x"}'
      );
    }
    // The app languages' flag codes, as the pickers render them (en → gb, br → br)
    const { supportedLanguages, flagCodes } = await new I18nDiscovery(
      resolver
    ).discover(true);
    expect(supportedLanguages).toEqual(['br', 'en', 'fr']);
    expect(flagCodes).toEqual(['br', 'gb', 'fr']);
    const discovery = new AssetDiscovery(resolver);
    discovery.useFlagCodes(flagCodes, createEntityResolver(appRoot));

    const result = await discovery.discover(true);

    const flagsDir = join(appRoot, 'public', 'flags');
    expect(readdirSync(flagsDir).sort()).toEqual([
      'br.svg',
      'fr.svg',
      'gb.svg',
    ]);
    for (const file of readdirSync(flagsDir)) {
      expect(readFileSync(join(flagsDir, file), 'utf8')).toBe(
        readFileSync(join(ARTWORK_DIR, file), 'utf8')
      );
    }
    // Flags are no asset of the manifest
    expect(
      result.assets.map((asset: { path: string }) => asset.path)
    ).not.toContain('/fr.svg');
    expect(result.copiedAssets).not.toContain('flags/fr.svg');
  });

  it('never overwrites or deletes a flag file the app has (flags beyond its languages)', async () => {
    const appRoot = appWithPublic();
    const flagsDir = join(appRoot, 'public', 'flags');
    mkdirSync(flagsDir);
    writeFileSync(join(flagsDir, 'fr.svg'), '<svg>own artwork</svg>');
    writeFileSync(join(flagsDir, 'nl.svg'), '<svg>added by hand</svg>');
    const discovery = new AssetDiscovery(resolver);
    discovery.useFlagCodes(['fr', 'de'], createEntityResolver(appRoot));

    await discovery.discover(true);

    expect(readdirSync(flagsDir).sort()).toEqual([
      'de.svg',
      'fr.svg',
      'nl.svg',
    ]);
    expect(readFileSync(join(flagsDir, 'fr.svg'), 'utf8')).toBe(
      '<svg>own artwork</svg>'
    );
    expect(readFileSync(join(flagsDir, 'nl.svg'), 'utf8')).toBe(
      '<svg>added by hand</svg>'
    );
  });

  it('adds every flag a tel field shows (all COUNTRIES, the default FR included) when an entity has a tel field', async () => {
    const appRoot = appWithEntities(TEL_ENTITIES);

    const files = await copiedFlags(appRoot, ['ko']);

    const expected = [...new Set(['ko', ...telFieldFlagCodes()])]
      .map((code) => `${code}.svg`)
      .sort();
    expect(files).toEqual(expected);
    expect(files).toContain('fr.svg');
    expect(telFieldFlagCodes()).toHaveLength(87);
  });

  it('copies only the language flags when no entity has a tel field', async () => {
    const appRoot = appWithEntities(NO_TEL_ENTITIES);

    expect(await copiedFlags(appRoot, ['ko', 'gb'])).toEqual([
      'gb.svg',
      'ko.svg',
    ]);
  });

  it('warns on a code without framework artwork and copies nothing for it', () => {
    const appRoot = appWithPublic();
    const discovery = new AssetDiscovery(resolver);
    const warn = vi
      .spyOn(discovery.logger, 'warn')
      .mockImplementation(() => {});

    expect(discovery._ensureFlags(['xx', 'fr'])).toEqual(['fr.svg']);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('public/flags/xx.svg')
    );
    expect(existsSync(join(appRoot, 'public', 'flags', 'xx.svg'))).toBe(false);
  });

  it('copies no flag without the flag codes of the app (no i18n discovery in the run)', async () => {
    const appRoot = appWithPublic();

    await new AssetDiscovery(resolver).discover(true);

    expect(existsSync(join(appRoot, 'public', 'flags'))).toBe(false);
  });
});
