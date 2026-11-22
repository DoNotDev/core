import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RouteDiscovery } from '../RouteDiscovery.js';
import { ThemeDiscovery } from '../ThemeDiscovery.js';
import { isBuildError } from '../../utils/buildError.js';
import { extractMeta } from '../../utils/MetaExtractor.js';

/**
 * Misconfigured apps fail the build (createBuildError) instead of discovery logging the
 * error and returning an empty result: an app built with no routes, a page without its
 * auth guard, or themes without the framework font defaults.
 */

const roots: string[] = [];
const previousBuildId = process.env.DNDEV_BUILD_ID;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  process.env.DNDEV_BUILD_ID = previousBuildId;
});

/** RouteDiscovery.discover() over these pages (same per-file path as the build). */
async function discover(pages: Record<string, string>) {
  // A fresh build id: no cached result from another test
  process.env.DNDEV_BUILD_ID = `test-${Math.random()}`;
  const appRoot = mkdtempSync(join(tmpdir(), 'dndev-discovery-errors-'));
  roots.push(appRoot);
  const files = Object.entries(pages).map(([file, content]) => {
    const path = join(appRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
  });
  writeFileSync(join(appRoot, 'package.json'), JSON.stringify({ name: 'app' }));
  const discovery = new RouteDiscovery(
    {
      getAppRoot: () => appRoot,
      resolvePatterns: async () => ({}),
      resolveFiles: async () => ({ consumerFiles: files, frameworkFiles: [] }),
      getFileInfo: (absolutePath: string) => ({
        absolutePath,
        relativePath: relative(appRoot, absolutePath),
      }),
      read: async (path: string) => readFileSync(path, 'utf8'),
    },
    { additionalPatterns: [] }
  );
  return discovery.discover(true);
}

const page = (meta: string, imports = '') =>
  `${imports}\nexport const meta: PageMeta = {\n  ${meta}\n};\nexport default function Page() { return null; }\n`;

/** The error a call throws (fails the test when it throws none). */
async function thrown(run: () => unknown): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a build error');
}

describe('PageMeta that cannot be read (extractMeta)', () => {
  const ADMIN_ONLY_PAGE = page(
    "namespace: 'admin',\n  auth: ADMIN_ONLY,",
    "import { ADMIN_ONLY } from '../auth';"
  );

  it('fails the build naming the value, instead of dropping route, auth and seo', async () => {
    const error = await thrown(() => extractMeta(ADMIN_ONLY_PAGE, 'src/pages/AdminPage.tsx'));
    expect(isBuildError(error)).toBe(true);
    expect(error.message).toBe(
      '[dndev-routes] src/pages/AdminPage.tsx: PageMeta cannot be read at build: `ADMIN_ONLY` is not a literal value ' +
        '(an import, a variable or a call). Without it the page would lose its route, auth and seo. The build reads ' +
        'PageMeta statically: write every value as a literal in the object (strings, numbers, booleans, null, arrays ' +
        "and objects of those, icon: <Icon />, a string constant declared in the page file: const NAMESPACE = 'home'), " +
        "except entity, the defineEntity identifier imported from 'entities'. Example: auth: { required: true, " +
        "role: 'admin' } instead of auth: ADMIN_ONLY."
    );
  });

  it('names a call or a member of an import the same way', async () => {
    const call = await thrown(() => extractMeta(page("title: t('admin.title'),"), 'src/pages/X.tsx'));
    expect(call.message).toMatch(/: PageMeta cannot be read at build: `t` is not a literal value/);
    const member = await thrown(() => extractMeta(page('auth: ROLES.admin,'), 'src/pages/X.tsx'));
    expect(member.message).toMatch(/`ROLES` is not a literal value/);
  });

  it('reports a value that is not plain JavaScript with the engine message', async () => {
    const error = await thrown(() => extractMeta(page("route: '/x' as string,"), 'src/pages/X.tsx'));
    expect(error.message).toMatch(
      /^\[dndev-routes\] src\/pages\/X\.tsx: PageMeta cannot be read at build: it is not a plain object literal \(/
    );
  });

  it('still reads literals, JSX icons, same-file string constants and the entity reference', () => {
    expect(
      extractMeta(
        "export const NAMESPACE = 'home';\n" +
          page("namespace: NAMESPACE,\n  icon: <Home />,\n  auth: { required: true, role: 'admin' },\n  entity: productEntity,")
      )
    ).toEqual({
      namespace: 'home',
      icon: 'Home',
      auth: { required: true, role: 'admin' },
      entity: { identifier: 'productEntity' },
    });
    expect(extractMeta('export default function Page() { return null; }')).toBeNull();
  });

  it('fails the whole route discovery (not only the page)', async () => {
    await expect(discover({ 'src/pages/AdminPage.tsx': ADMIN_ONLY_PAGE })).rejects.toThrow(
      /^\[dndev-routes\] src\/pages\/AdminPage\.tsx: PageMeta cannot be read at build: `ADMIN_ONLY`/
    );
  });
});

describe('route discovery validation fails the build (no empty route list)', () => {
  it('two pages with the same route', async () => {
    const error = await thrown(() =>
      discover({
        'src/pages/AboutPage.tsx': page("namespace: 'about',"),
        'src/pages/company/AboutUsPage.tsx': page("route: '/about',"),
      })
    );
    expect(isBuildError(error)).toBe(true);
    expect(error.message).toBe(
      '[dndev-routes] src/pages/company/AboutUsPage.tsx: route /about is also the route of src/pages/AboutPage.tsx: ' +
        'two pages cannot share a URL. Give one of them another path with a PageMeta route override, ' +
        "e.g. export const meta: PageMeta = { route: '/custom-path' };"
    );
  });

  it('an invalid signedInRedirect', async () => {
    const external = await thrown(() =>
      discover({ 'src/pages/HomePage.tsx': page("signedInRedirect: 'https://evil.example',") })
    );
    expect(isBuildError(external)).toBe(true);
    expect(external.message).toBe(
      "[dndev-routes] src/pages/HomePage.tsx: PageMeta signedInRedirect must be an app path starting with '/' " +
        '(got "https://evil.example"). Example: export const meta: PageMeta = { signedInRedirect: \'/catalogue\' };'
    );
    await expect(
      discover({ 'src/pages/CatalogPage.tsx': page("route: '/catalogue',\n  signedInRedirect: '/catalogue',") })
    ).rejects.toThrow(
      '[dndev-routes] src/pages/CatalogPage.tsx: PageMeta signedInRedirect points at the page itself (/catalogue): ' +
        'signed-in visitors would loop. Use another page.'
    );
  });
});

describe('theme discovery: framework token CSS', () => {
  const themeDiscovery = (resolvePackage: () => string | null, readSync: () => unknown) =>
    new ThemeDiscovery({}, {
      resolvePackage,
      resolveFrameworkPackage: () => '/framework/ui',
      readSync,
      getDirname: () => '/framework',
      resolvePath: (path: string) => path,
    });

  it('fails the build when it cannot be resolved or read (fonts would be wrong)', async () => {
    const unresolved = await thrown(() =>
      themeDiscovery(() => null, () => '')._readFrameworkTokenCss()
    );
    expect(isBuildError(unresolved)).toBe(true);
    expect(unresolved.message).toMatch(/^\[dndev-theme\] cannot resolve @donotdev\/components\/styles/);

    const unreadable = await thrown(() =>
      themeDiscovery(() => '/framework/styles.css', () => null)._readFrameworkTokenCss()
    );
    expect(unreadable.message).toBe(
      '[dndev-theme] cannot read /framework/styles.css (framework font defaults)'
    );
  });
});
