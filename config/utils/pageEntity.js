/**
 * @fileoverview Page entity resolver
 * @description Build-time resolution of a page's declared entity (PageMeta
 * `entity: productEntity`) to its collection. The page names the `defineEntity`
 * definition it shows one record of, imported from the app's `entities` package; this
 * reads both sources statically (Babel AST, no evaluation: the entities package is
 * TypeScript importing the framework), follows the package's re-exports to the
 * `defineEntity({ collection: '...' })` call and returns that collection. Anything else
 * fails the build ({@link createBuildError}): no folder or string fallback.
 *
 * The same resolver (one per route discovery run, handed to the asset discovery) also
 * tells whether the app's entities use a field type (`usesFieldType('tel')`: a `tel`
 * field shows every country flag), from the same parsed files.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { createBuildError } from './buildError.js';

/** Plugin name of the resolver's build errors. */
const PLUGIN = 'dndev-routes';

/** Package a declared entity is imported from (the app's entity definitions). */
const ENTITIES_PACKAGE = 'entities';

/** Module `defineEntity` is imported from in an entity file. */
const DEFINE_ENTITY_MODULE = '@donotdev/core';

/** Extensions tried for a relative import without one (TS ESM `./x.js` → `./x.ts` too). */
const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Fix line shared by the page-side errors. */
const FIX_EXAMPLE =
  "import { productEntity } from 'entities';\n" +
  'export const meta: PageMeta = { entity: productEntity, route: { params: [\'slug\'] } };';

let babelPromise = null;

/** @babel/core, loaded on the first declared entity only (heavy, build tooling). */
async function loadBabel() {
  babelPromise ??= import('@babel/core').then((module) => module.default ?? module);
  return babelPromise;
}

/** Module AST of a TS/JS source (`jsx` only for .tsx/.jsx: it breaks `<T>x` casts). */
function parse(babel, code, filePath) {
  const jsx = /\.[jt]sx$/.test(filePath);
  try {
    return babel.parseSync(code, {
      configFile: false,
      babelrc: false,
      filename: filePath,
      sourceType: 'module',
      parserOpts: { plugins: jsx ? ['typescript', 'jsx'] : ['typescript'] },
    }).program;
  } catch (error) {
    throw createBuildError(
      PLUGIN,
      `${filePath} could not be parsed to resolve entities (PageMeta entity, entity field types): ${error.message}. Fix the syntax error.`,
      'invalid-configuration'
    );
  }
}

/** Name of an Identifier or StringLiteral node (import / export specifier names). */
function nameOf(node) {
  return node.type === 'StringLiteral' ? node.value : node.name;
}

/** Drops `as` / `satisfies` / non-null / parentheses around an expression. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(
      current.type
    )
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The value an entity reference of a page names: the `entities` export its identifier
 * is imported as (`import { productEntity as product } from 'entities'` → `productEntity`).
 *
 * @param {object} program - Page module AST
 * @param {string} identifier - Identifier the PageMeta `entity` holds
 * @returns {string | null} The `entities` export name, null when not a value import from 'entities'
 */
function importedEntityName(program, identifier) {
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type') continue;
    for (const specifier of node.specifiers) {
      if (specifier.local.name !== identifier) continue;
      if (
        node.source.value !== ENTITIES_PACKAGE ||
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type'
      ) {
        return null;
      }
      return nameOf(specifier.imported);
    }
  }
  return null;
}

/**
 * Resolver of `entities` exports to their collection, for one app (one discovery run).
 * Locates the app's `entities` package on first use (Node resolution from the app root:
 * `node_modules/entities`, the workspace link) and parses each of its files once, for
 * both questions it answers: a page entity's collection and the field types the
 * entities use.
 *
 * @param {string} appRoot - Absolute app directory (its package.json lists `entities`)
 * @returns {{ collectionOf: (exportName: string, pageFile: string) => Promise<string>, usesFieldType: (type: string) => Promise<boolean> }}
 * @since 0.3.2
 *
 * @example
 * const resolver = createEntityResolver('/repo/apps/shop');
 * await resolver.collectionOf('productEntity', 'src/pages/products/ProductPage.tsx'); // 'products'
 * await resolver.usesFieldType('tel'); // true when a defineEntity field is { type: 'tel' }
 */
export function createEntityResolver(appRoot) {
  let entry = null;
  const programs = new Map();

  /** Whether the app's package.json lists the `entities` package. */
  function declaresEntities() {
    const pkgPath = join(appRoot, 'package.json');
    const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
    return Boolean(
      pkg?.dependencies?.[ENTITIES_PACKAGE] || pkg?.devDependencies?.[ENTITIES_PACKAGE]
    );
  }

  /**
   * Entry module of the app's `entities` package.
   * @param {string} needer - What needs it, the error's subject (`<page> declares a PageMeta entity`)
   */
  function entryFile(needer) {
    if (entry) return entry;
    const declared = declaresEntities();
    let dir = appRoot;
    let packageDir = null;
    while (declared) {
      const candidate = join(dir, 'node_modules', ENTITIES_PACKAGE);
      if (existsSync(join(candidate, 'package.json'))) {
        packageDir = realpathSync(candidate);
        break;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!packageDir) {
      throw createBuildError(
        PLUGIN,
        `${needer}, but the app has no \`entities\` package ` +
          `(${declared ? 'not installed: run bun install' : 'not in the dependencies of its package.json'}). ` +
          'The entity is read from the app\'s defineEntity definitions. Fix: add `"entities": "workspace:*"` ' +
          'to the app\'s dependencies and export the entity from the entities package.',
        'missing-required-resource'
      );
    }
    const entitiesPkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    const main = moduleFile(resolve(packageDir, entitiesPkg.main ?? './index.ts'));
    if (!main) {
      throw createBuildError(
        PLUGIN,
        `The \`entities\` package (${packageDir}) has no entry module (package.json "main": ` +
          `${JSON.stringify(entitiesPkg.main ?? './index.ts')}). Fix: set "main" to its index file (./index.ts).`,
        'missing-required-resource'
      );
    }
    entry = main;
    return entry;
  }

  /** Parsed module, once per file. */
  async function programOf(filePath) {
    if (!programs.has(filePath)) {
      const babel = await loadBabel();
      programs.set(filePath, parse(babel, readFileSync(filePath, 'utf8'), filePath));
    }
    return programs.get(filePath);
  }

  /** Relative import of an entities file → its file, null for a package import. */
  function relativeModule(fromFile, specifier) {
    if (!specifier.startsWith('.')) return null;
    return moduleFile(resolve(dirname(fromFile), specifier));
  }

  /**
   * The declaration an `entities` module exports under `name`: follows `export { x } from`,
   * `export *` and local `export { x }` / imports to the `const x = …` initializer.
   *
   * @returns {Promise<{ init: object | null, program: object, file: string } | null>}
   */
  async function findExport(filePath, name, seen) {
    const key = `${filePath}#${name}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const program = await programOf(filePath);
    const stars = [];
    for (const node of program.body) {
      if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type') {
        const declared = localDeclaration(node.declaration, name);
        if (declared !== undefined) return { init: declared, program, file: filePath };
        for (const specifier of node.specifiers ?? []) {
          if (specifier.exportKind === 'type' || nameOf(specifier.exported) !== name) continue;
          if (specifier.type !== 'ExportSpecifier') return null;
          const local = nameOf(specifier.local);
          if (node.source) {
            const target = relativeModule(filePath, node.source.value);
            return target ? findExport(target, local, seen) : null;
          }
          return findLocal(filePath, program, local, seen);
        }
      } else if (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type') {
        const target = relativeModule(filePath, node.source.value);
        if (target) stars.push(target);
      }
    }
    for (const target of stars) {
      const found = await findExport(target, name, seen);
      if (found) return found;
    }
    return null;
  }

  /** A module-level binding: its `const` initializer, or the export an import names. */
  async function findLocal(filePath, program, name, seen) {
    for (const node of program.body) {
      const declared = localDeclaration(node, name);
      if (declared !== undefined) return { init: declared, program, file: filePath };
      if (node.type !== 'ImportDeclaration' || node.importKind === 'type') continue;
      for (const specifier of node.specifiers) {
        if (specifier.local.name !== name || specifier.type !== 'ImportSpecifier') continue;
        const target = relativeModule(filePath, node.source.value);
        return target ? findExport(target, nameOf(specifier.imported), seen) : null;
      }
    }
    return null;
  }

  /** Every module of the package: the entry and the files its relative imports / exports reach. */
  async function packageModules(entryModule) {
    const files = [entryModule];
    for (let index = 0; index < files.length; index += 1) {
      const program = await programOf(files[index]);
      for (const node of program.body) {
        const value =
          (node.type === 'ImportDeclaration' && node.importKind !== 'type') ||
          (node.type === 'ExportNamedDeclaration' && node.source && node.exportKind !== 'type') ||
          (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type');
        if (!value) continue;
        const target = relativeModule(files[index], node.source.value);
        if (target && !files.includes(target)) files.push(target);
      }
    }
    return files;
  }

  return {
    /**
     * Whether a `defineEntity` definition of the `entities` package has a field of this
     * type, written literally (`fields: { phone: { type: 'tel' } }`). False when the app
     * has no `entities` package.
     *
     * @param {string} type - Field type (`tel`)
     * @returns {Promise<boolean>}
     * @throws {Error} Build error when the package is declared but missing, or a file does not parse
     */
    async usesFieldType(type) {
      if (!declaresEntities()) return false;
      for (const file of await packageModules(entryFile(
        "The app's package.json lists `entities` (its entity field types are read)"
      ))) {
        if (definesFieldType(await programOf(file), type)) return true;
      }
      return false;
    },

    async collectionOf(exportName, pageFile) {
      const found = await findExport(
        entryFile(`${pageFile} declares a PageMeta entity`),
        exportName,
        new Set()
      );
      if (!found) {
        throw createBuildError(
          PLUGIN,
          `${pageFile}: PageMeta entity \`${exportName}\` is not exported by the \`entities\` package. ` +
            'The page names the entity definition it shows a record of. ' +
            `Fix: export it from the entities package index (export { ${exportName} } from './…').`,
          'invalid-configuration'
        );
      }
      return collectionOfDefinition(found, exportName, pageFile);
    },
  };
}

/** Local name `defineEntity` is imported under from @donotdev/core in a module, if any. */
function defineEntityLocalName(program) {
  return program.body
    .filter((node) => node.type === 'ImportDeclaration' && node.source.value === DEFINE_ENTITY_MODULE)
    .flatMap((node) => node.specifiers)
    .find(
      (specifier) =>
        specifier.type === 'ImportSpecifier' && nameOf(specifier.imported) === 'defineEntity'
    )?.local.name;
}

/** Value of a non-computed property of an object literal, unwrapped (undefined when absent). */
function propertyValue(object, key) {
  if (object?.type !== 'ObjectExpression') return undefined;
  const property = object.properties.find(
    (prop) => prop.type === 'ObjectProperty' && !prop.computed && nameOf(prop.key) === key
  );
  return unwrap(property?.value);
}

/**
 * Whether a module calls `defineEntity` with a literal field of this type:
 * `defineEntity({ fields: { phone: { type: 'tel' } } })`, anywhere in the module.
 */
function definesFieldType(program, type) {
  const defineEntityLocal = defineEntityLocalName(program);
  if (!defineEntityLocal) return false;
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return false;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === defineEntityLocal
    ) {
      const fields = propertyValue(unwrap(node.arguments[0]), 'fields');
      if (
        fields?.type === 'ObjectExpression' &&
        fields.properties.some((field) => {
          const fieldType = propertyValue(unwrap(field.value), 'type');
          return fieldType?.type === 'StringLiteral' && fieldType.value === type;
        })
      ) {
        return true;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      const child = node[key];
      if (Array.isArray(child) ? child.some(visit) : child && typeof child === 'object' && visit(child)) {
        return true;
      }
    }
    return false;
  };
  return visit(program);
}

/** `const name = <init>` in a VariableDeclaration node: the initializer, undefined when absent. */
function localDeclaration(node, name) {
  if (node?.type !== 'VariableDeclaration') return undefined;
  for (const declarator of node.declarations) {
    if (declarator.id.type === 'Identifier' && declarator.id.name === name) {
      return declarator.init ?? null;
    }
  }
  return undefined;
}

/** Existing module file of an import path (as given, with an extension, or its index). */
function moduleFile(path) {
  const base = path.replace(/\.[cm]?js$/, '');
  const candidates = [
    path,
    ...MODULE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...MODULE_EXTENSIONS.map((extension) => join(path, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    if (/\.[cm]?[jt]sx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Collection of a `defineEntity(...)` initializer: the call's callee is `defineEntity`
 * imported from @donotdev/core, its argument an object literal with a string `collection`.
 */
function collectionOfDefinition({ init, program, file }, exportName, pageFile) {
  const call = unwrap(init);
  const defineEntityLocal = defineEntityLocalName(program);
  if (
    call?.type !== 'CallExpression' ||
    call.callee.type !== 'Identifier' ||
    !defineEntityLocal ||
    call.callee.name !== defineEntityLocal
  ) {
    throw createBuildError(
      PLUGIN,
      `${pageFile}: PageMeta entity \`${exportName}\` (${file}) is not a defineEntity definition. ` +
        'The build reads the collection from `defineEntity({ collection: ... })` in the entities package. ' +
        `Fix: export const ${exportName} = defineEntity({ name: '...', collection: '...', fields: { ... } }) ` +
        "with defineEntity imported from '@donotdev/core'.",
      'invalid-configuration'
    );
  }
  const options = unwrap(call.arguments[0]);
  const property =
    options?.type === 'ObjectExpression'
      ? options.properties.find(
          (prop) =>
            prop.type === 'ObjectProperty' &&
            !prop.computed &&
            nameOf(prop.key) === 'collection'
        )
      : undefined;
  const value = unwrap(property?.value);
  const collection =
    value?.type === 'StringLiteral'
      ? value.value
      : value?.type === 'TemplateLiteral' && value.expressions.length === 0
        ? value.quasis[0].value.cooked
        : null;
  if (!collection) {
    throw createBuildError(
      PLUGIN,
      `${pageFile}: PageMeta entity \`${exportName}\` (${file}) has no literal \`collection\` in its ` +
        'defineEntity options. The page\'s records (sitemap, prerender, server metadata) are read from it. ' +
        "Fix: set collection: 'products' (a string literal) in the defineEntity call.",
      'invalid-configuration'
    );
  }
  return collection;
}

/**
 * Collection of a page's declared entity, or null when the page declares none. The
 * PageMeta `entity` (as {@link extractMeta} reads it: `{ identifier }`) must be a bare
 * identifier named-imported from `'entities'` that resolves to a `defineEntity` with a
 * literal `collection`; a string, an expression (`{ expression }`: `entities.productEntity`
 * of a namespace import, a call) or any other value fails the build.
 *
 * @param {{ entity?: unknown } | null} metaExport - The page's extracted PageMeta
 * @param {string} source - Page module source
 * @param {string} pageFile - Page path for messages (`src/pages/products/ProductPage.tsx`)
 * @param {{ collectionOf: (exportName: string, pageFile: string) => Promise<string> }} resolver - {@link createEntityResolver}
 * @returns {Promise<string | null>} The entity's collection
 * @throws {Error} Build error (what, why, fix) on an invalid declaration
 * @since 0.3.2
 *
 * @example
 * await resolvePageEntity({ entity: { identifier: 'productEntity' } }, source, file, resolver); // 'products'
 */
export async function resolvePageEntity(metaExport, source, pageFile, resolver) {
  if (!metaExport || metaExport.entity === undefined) return null;
  const identifier = metaExport.entity?.identifier;
  const expression = metaExport.entity?.expression;
  if (typeof expression === 'string') {
    // `entities.productEntity` → productEntity in the fix; any other expression → the example name
    const name =
      expression.match(/^[A-Za-z_$][\w$]*\s*\??\.\s*([A-Za-z_$][\w$]*)$/)?.[1] ?? 'productEntity';
    throw createBuildError(
      PLUGIN,
      `${pageFile}: PageMeta entity \`${expression}\` is not a bare identifier. The build reads the ` +
        "entity statically: only a defineEntity definition named-imported from 'entities' resolves " +
        `to its collection (no namespace import, member access or call). Fix: import { ${name} } from 'entities'; ` +
        `then entity: ${name}`,
      'invalid-configuration'
    );
  }
  if (typeof identifier !== 'string') {
    throw createBuildError(
      PLUGIN,
      `${pageFile}: PageMeta entity must be the entity definition imported from 'entities' ` +
        `(got ${JSON.stringify(metaExport.entity)}). The build resolves it to the entity's collection. Fix:\n${FIX_EXAMPLE}`,
      'invalid-configuration'
    );
  }
  const program = parse(await loadBabel(), source, pageFile);
  const exportName = importedEntityName(program, identifier);
  if (!exportName) {
    throw createBuildError(
      PLUGIN,
      `${pageFile}: PageMeta entity \`${identifier}\` is not imported from 'entities'. ` +
        "The page's entity must be a defineEntity definition of the app's `entities` package " +
        `(one source for its collection). Fix: import { ${identifier} } from 'entities';`,
      'invalid-configuration'
    );
  }
  return resolver.collectionOf(exportName, pageFile);
}
