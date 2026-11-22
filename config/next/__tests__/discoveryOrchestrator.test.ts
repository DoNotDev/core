import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBuildError } from '../../utils/buildError.js';
import { PathResolver } from '../../utils/PathResolver.js';
import { isBuildComplete, runDiscoveries } from '../discoveryOrchestrator.js';

const logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/** The route discovery's entities resolver: an app without a tel field. */
const entityResolver = { usesFieldType: async () => false };

/** Theme handler of an app whose theme renders text in system fonts only (empty font plan). */
const themeHandler = (fontCss: unknown) => ({
  generateFiles: async () => ({}),
  getDiscoveryData: async () => ({ fontCss }),
});
const SYSTEM_FONTS = {
  framework:
    ':root { --font-family: system-ui, sans-serif; --font-headline: var(--font-family); --font-weight-normal: 400; --font-weight-bold: 700; }',
  app: [],
};

/** Theme, i18n, SEO and asset handlers: runDiscoveries reads the app languages and builds the font plan before routes, then hands the routes to SEO and the flag codes to assets. */
const languageHandlers = {
  themeHandler: themeHandler(SYSTEM_FONTS),
  i18nHandler: {
    getDiscoveryData: async () => ({
      supportedLanguages: ['en'],
      fallbackLanguage: 'en',
      flagCodes: ['gb'],
    }),
    generateFiles: async () => ({}),
  },
  seoHandler: {
    useLanguages: () => {},
    useTranslations: () => {},
    useRoutes: () => {},
    generateFiles: async () => ({}),
  },
  assetHandler: {
    useFlagCodes: () => {},
    generateFiles: async () => ({}),
  },
};

describe('runDiscoveries build marker', () => {
  let appRoot: string;
  const previousBuildId = process.env.DNDEV_BUILD_ID;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), 'dndev-discovery-'));
    PathResolver._reset();
    PathResolver.getInstance().setAppRoot(appRoot);
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
    PathResolver._reset();
    process.env.DNDEV_BUILD_ID = previousBuildId;
  });

  it('replaces a marker left by a previous build so later passes skip discovery', async () => {
    writeFileSync(join(appRoot, '.dndev-build'), 'old-build');
    process.env.DNDEV_BUILD_ID = 'new-build';
    const pathResolver = PathResolver.getInstance();
    let routeRuns = 0;
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => {
        routeRuns += 1;
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler, ...languageHandlers }, logger);
    await runDiscoveries({ routeHandler, ...languageHandlers }, logger);

    expect(readFileSync(join(appRoot, '.dndev-build'), 'utf8')).toBe(
      'new-build'
    );
    expect(isBuildComplete(appRoot)).toBe(true);
    expect(routeRuns).toBe(1);
  });

  it('keeps generated config files on disk during a run and sweeps only stale ones', async () => {
    process.env.DNDEV_BUILD_ID = 'sweep-build';
    const configDir = join(appRoot, 'src/config');
    mkdirSync(configDir, { recursive: true });
    const routeConfig = join(configDir, 'dndev-config-route.js');
    const staleConfig = join(configDir, 'dndev-config-removed.js');
    writeFileSync(routeConfig, 'old route config');
    writeFileSync(staleConfig, 'feature no longer generated');
    const past = new Date(Date.now() - 60_000);
    utimesSync(routeConfig, past, past);
    utimesSync(staleConfig, past, past);

    const pathResolver = PathResolver.getInstance();
    let routeConfigPresentDuringRun = false;
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => {
        routeConfigPresentDuringRun = existsSync(routeConfig);
        pathResolver.writeSync(routeConfig, 'new route config', {
          overwrite: true,
        });
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler, ...languageHandlers }, logger);

    expect(routeConfigPresentDuringRun).toBe(true);
    expect(readFileSync(routeConfig, 'utf8')).toBe('new route config');
    expect(existsSync(staleConfig)).toBe(false);
  });

  it('keeps a file written during the run even when its mtime predates the run start', async () => {
    // The kernel can stamp a fresh file slightly before a Date.now() taken
    // earlier; simulate the worst case with an mtime in the past.
    process.env.DNDEV_BUILD_ID = 'clock-skew-build';
    const routeConfig = join(appRoot, 'src/config/dndev-config-route.js');
    const past = new Date(Date.now() - 60_000);

    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => {
        pathResolver.writeSync(routeConfig, 'route config', {
          overwrite: true,
        });
        utimesSync(routeConfig, past, past);
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler, ...languageHandlers }, logger);

    expect(readFileSync(routeConfig, 'utf8')).toBe('route config');
  });

  it('stops recording writes when route generation fails', async () => {
    process.env.DNDEV_BUILD_ID = 'failing-build';
    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => {
        throw new Error('route discovery failed');
      },
    };

    await expect(runDiscoveries({ routeHandler, ...languageHandlers }, logger)).rejects.toThrow(
      'route discovery failed'
    );
    expect(() => pathResolver.stopWriteRecording()).toThrow(
      'stopWriteRecording() called without startWriteRecording()'
    );
  });

  it('builds the font plan before the routes: files in public/fonts/, the plan handed to the route handler', async () => {
    const pathResolver = PathResolver.getInstance();
    const calls: string[] = [];
    let plan: { css: string; preloads: Record<string, string[]> } | null = null;
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: (fonts: typeof plan) => {
        plan = fonts;
        calls.push('fonts');
      },
      getEntityResolver: () => entityResolver,
      generateFiles: async () => {
        calls.push('routes');
        return { routes: [{}] };
      },
    };
    writeFileSync(join(appRoot, 'package.json'), '{"name":"fixture-app"}');
    mkdirSync(join(appRoot, 'public', 'fonts'), { recursive: true });
    writeFileSync(join(appRoot, 'public', 'fonts', 'stale.woff2'), '');
    writeFileSync(join(appRoot, 'public', 'dndev-fonts.css'), '/* former font stylesheet */');
    const inter = {
      framework: `:root { --font-family: Inter, 'Inter Fallback', sans-serif; --font-headline: var(--font-family);
        --font-weight-normal: 400; --font-weight-bold: 700; }`,
      app: [],
    };

    process.env.DNDEV_BUILD_ID = 'fonts-plan';
    await runDiscoveries({ routeHandler, ...languageHandlers, themeHandler: themeHandler(inter) }, logger);

    expect(calls).toEqual(['fonts', 'routes']);
    expect(plan!.css).toContain("font-family:'Inter'");
    const files = readdirSync(join(appRoot, 'public', 'fonts'));
    expect(files).not.toContain('stale.woff2');
    for (const href of plan!.preloads.en) expect(files).toContain(href.split('/').pop());
    // The former stylesheet is swept as a stale artifact
    expect(existsSync(join(appRoot, 'public', 'dndev-fonts.css'))).toBe(false);
  });

  it('fails the run when theme discovery gives no font input', async () => {
    process.env.DNDEV_BUILD_ID = 'fonts-missing';
    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => ({ routes: [{}] }),
    };

    await expect(
      runDiscoveries(
        { routeHandler, ...languageHandlers, themeHandler: themeHandler(undefined) },
        logger
      )
    ).rejects.toThrow(/fontCss is required/);
  });

  it('fails the run on a build error from a non-critical handler; other errors are logged', async () => {
    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => ({ routes: [{}] }),
    };
    const failingAssets = (error: Error) => ({
      useFlagCodes: () => {},
      generateFiles: async () => {
        throw error;
      },
    });

    process.env.DNDEV_BUILD_ID = 'asset-build-error';
    await expect(
      runDiscoveries(
        {
          routeHandler,
          ...languageHandlers,
          assetHandler: failingAssets(createBuildError('dndev-assets', 'misconfigured')),
        },
        logger
      )
    ).rejects.toThrow('[dndev-assets] misconfigured');

    process.env.DNDEV_BUILD_ID = 'asset-plain-error';
    await expect(
      runDiscoveries(
        { routeHandler, ...languageHandlers, assetHandler: failingAssets(new Error('scan failed')) },
        logger
      )
    ).resolves.toBeUndefined();
  });

  it('hands the i18n flag codes and the route entities resolver to the asset handler before its generation', async () => {
    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      useLanguages: () => {},
      useI18n: () => {},
      useFonts: () => {},
      getEntityResolver: () => entityResolver,
      generateFiles: async () => ({ routes: [{}] }),
    };
    const calls: string[] = [];
    const assetHandler = {
      useFlagCodes: (codes: string[], resolver: unknown) =>
        calls.push(`flags:${codes.join(',')}:${resolver === entityResolver}`),
      generateFiles: async () => {
        calls.push('generate');
        return {};
      },
    };

    process.env.DNDEV_BUILD_ID = 'asset-flag-codes';
    await runDiscoveries({ routeHandler, ...languageHandlers, assetHandler }, logger);

    expect(calls).toEqual(['flags:gb:true', 'generate']);
  });
});
