import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PathResolver } from '../../utils/PathResolver.js';
import { isBuildComplete, runDiscoveries } from '../discoveryOrchestrator.js';

const logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
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
      generateFiles: async () => {
        routeRuns += 1;
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler }, logger);
    await runDiscoveries({ routeHandler }, logger);

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
      generateFiles: async () => {
        routeConfigPresentDuringRun = existsSync(routeConfig);
        pathResolver.writeSync(routeConfig, 'new route config', {
          overwrite: true,
        });
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler }, logger);

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
      generateFiles: async () => {
        pathResolver.writeSync(routeConfig, 'route config', {
          overwrite: true,
        });
        utimesSync(routeConfig, past, past);
        return { routes: [{}] };
      },
    };

    await runDiscoveries({ routeHandler }, logger);

    expect(readFileSync(routeConfig, 'utf8')).toBe('route config');
  });

  it('stops recording writes when route generation fails', async () => {
    process.env.DNDEV_BUILD_ID = 'failing-build';
    const pathResolver = PathResolver.getInstance();
    const routeHandler = {
      pathResolver,
      generateFiles: async () => {
        throw new Error('route discovery failed');
      },
    };

    await expect(runDiscoveries({ routeHandler }, logger)).rejects.toThrow(
      'route discovery failed'
    );
    expect(() => pathResolver.stopWriteRecording()).toThrow(
      'stopWriteRecording() called without startWriteRecording()'
    );
  });
});
