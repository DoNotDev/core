/**
 * @fileoverview Expo API Safety Net
 * @description Verifies that all framework APIs consumed by @donotdev/expo exist and are exported.
 * If any of these tests fail after a framework change, the expo package WILL break.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Expo API Safety Net — @donotdev/utils exports', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('@donotdev/utils');
  }, 30000);

  it('exports getStorageManager', () => {
    expect(mod.getStorageManager).toBeDefined();
    expect(typeof mod.getStorageManager).toBe('function');
  });

  it('exports initializePlatformDetection', () => {
    expect(mod.initializePlatformDetection).toBeDefined();
    expect(typeof mod.initializePlatformDetection).toBe('function');
  });

  it('exports isClient', () => {
    expect(mod.isClient).toBeDefined();
    expect(typeof mod.isClient).toBe('function');
  });

  it('exports handleError', () => {
    expect(mod.handleError).toBeDefined();
    expect(typeof mod.handleError).toBe('function');
  });

  it('exports getDndevConfig', () => {
    expect(mod.getDndevConfig).toBeDefined();
    expect(typeof mod.getDndevConfig).toBe('function');
  });

  it('exports StorageManager class', () => {
    expect(mod.StorageManager).toBeDefined();
  });

  it('exports BaseStorageStrategy class', () => {
    expect(mod.BaseStorageStrategy).toBeDefined();
  });
});

describe('Expo API Safety Net — @donotdev/stores exports', () => {
  let mod: any;

  beforeAll(async () => {
    mod = await import('@donotdev/stores');
  }, 30000);

  it('exports createDoNotDevStore', () => {
    expect(mod.createDoNotDevStore).toBeDefined();
    expect(typeof mod.createDoNotDevStore).toBe('function');
  });

  it('exports useThemeStore', () => {
    expect(mod.useThemeStore).toBeDefined();
  });

  it('exports useNetworkStore', () => {
    expect(mod.useNetworkStore).toBeDefined();
  });

  it('exports useOverlayStore', () => {
    expect(mod.useOverlayStore).toBeDefined();
  });
});
