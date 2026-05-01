import { describe, it, expect } from 'vitest';

import { updateMetadata } from '../updateMetadata';

describe('updateMetadata', () => {
  it('creates update metadata with userId', () => {
    const metadata = updateMetadata('user-456');

    expect(metadata.updatedById).toBe('user-456');
    expect(metadata.updatedAt).toBeTruthy();
  });

  it('does not include createdAt or createdById', () => {
    const metadata = updateMetadata('user-456');

    expect(metadata).not.toHaveProperty('createdAt');
    expect(metadata).not.toHaveProperty('createdById');
  });

  it('timestamp is valid ISO string', () => {
    const metadata = updateMetadata('user-456');

    expect(new Date(metadata.updatedAt).getTime()).toBeGreaterThan(0);
    expect(metadata.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
