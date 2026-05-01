import { describe, it, expect } from 'vitest';

import { createMetadata } from '../createMetadata';

describe('createMetadata', () => {
  it('creates metadata with all required fields', () => {
    const metadata = createMetadata('user-123');

    expect(metadata.createdById).toBe('user-123');
    expect(metadata.updatedById).toBe('user-123');
    expect(metadata.createdAt).toBeTruthy();
    expect(metadata.updatedAt).toBeTruthy();
  });

  it('createdAt and updatedAt are the same on creation', () => {
    const metadata = createMetadata('user-123');

    expect(metadata.createdAt).toBe(metadata.updatedAt);
  });

  it('timestamps are valid ISO strings', () => {
    const metadata = createMetadata('user-123');

    expect(new Date(metadata.createdAt).getTime()).toBeGreaterThan(0);
    expect(metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('works with any string userId', () => {
    const metadata = createMetadata('');
    expect(metadata.createdById).toBe('');

    const metadata2 = createMetadata('firebase-uid-abc123');
    expect(metadata2.createdById).toBe('firebase-uid-abc123');
  });
});
