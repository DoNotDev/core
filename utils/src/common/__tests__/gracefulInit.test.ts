import { describe, it, expect, vi } from 'vitest';

import { withGracefulDegradation } from '../gracefulInit';

describe('withGracefulDegradation', () => {
  it('returns result on success', async () => {
    const result = await withGracefulDegradation(
      async () => 'success',
      () => {},
      'TestFeature'
    );

    expect(result).toBe('success');
  });

  it('returns false and calls fallback on error', async () => {
    const fallback = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await withGracefulDegradation(
      async () => {
        throw new Error('init failed');
      },
      fallback,
      'TestFeature'
    );

    expect(result).toBe(false);
    expect(fallback).toHaveBeenCalled();
  });

  it('logs warning with feature name on error', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await withGracefulDegradation(
      async () => {
        throw new Error('boom');
      },
      () => {},
      'MyFeature'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('MyFeature')
    );
  });

  it('handles async init function', async () => {
    const result = await withGracefulDegradation(
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { initialized: true };
      },
      () => {},
      'AsyncFeature'
    );

    expect(result).toEqual({ initialized: true });
  });
});
