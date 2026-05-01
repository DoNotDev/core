import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { dndevSchema } from '@donotdev/types';

import {
  validateUniqueFields,
  registerUniqueConstraintValidator,
} from '../validateUniqueFields';

function makeSchema(uniqueFields: any[] = []): dndevSchema<unknown> {
  return {
    metadata: {
      collection: 'test-collection',
      entity: 'TestEntity',
      uniqueFields,
    },
  } as any;
}

describe('validateUniqueFields', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips validation when no unique fields defined', async () => {
    const schema = makeSchema([]);

    await expect(
      validateUniqueFields(schema, { name: 'test' })
    ).resolves.toBeUndefined();
  });

  it('warns and skips when no validator registered (dev only)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schema = makeSchema([
      { field: 'email', errorMessage: 'Email taken' },
    ]);

    await expect(
      validateUniqueFields(schema, { email: 'test@test.com' })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No uniqueness validator registered')
    );
    process.env.NODE_ENV = originalEnv;
  });

  it('skips validation for null/undefined field values', async () => {
    const mockValidator = {
      checkDuplicate: vi.fn().mockResolvedValue(false),
    };
    registerUniqueConstraintValidator(mockValidator);

    const schema = makeSchema([
      { field: 'email', errorMessage: 'Email taken' },
    ]);

    await validateUniqueFields(schema, { email: null });

    expect(mockValidator.checkDuplicate).not.toHaveBeenCalled();
  });

  it('calls validator for non-null unique fields', async () => {
    const mockValidator = {
      checkDuplicate: vi.fn().mockResolvedValue(false),
    };
    registerUniqueConstraintValidator(mockValidator);

    const schema = makeSchema([
      { field: 'email', errorMessage: 'Email taken' },
    ]);

    await validateUniqueFields(schema, { email: 'test@test.com' }, 'doc123');

    expect(mockValidator.checkDuplicate).toHaveBeenCalledWith(
      'test-collection',
      'email',
      'test@test.com',
      'doc123'
    );
  });

  it('throws when duplicate found', async () => {
    const mockValidator = {
      checkDuplicate: vi.fn().mockResolvedValue(true),
    };
    registerUniqueConstraintValidator(mockValidator);

    const schema = makeSchema([
      { field: 'email', errorMessage: 'Email already exists' },
    ]);

    await expect(
      validateUniqueFields(schema, { email: 'dupe@test.com' })
    ).rejects.toThrow();
  });

  it('validates multiple unique fields', async () => {
    const mockValidator = {
      checkDuplicate: vi.fn().mockResolvedValue(false),
    };
    registerUniqueConstraintValidator(mockValidator);

    const schema = makeSchema([
      { field: 'email', errorMessage: 'Email taken' },
      { field: 'username', errorMessage: 'Username taken' },
    ]);

    await validateUniqueFields(schema, {
      email: 'a@b.com',
      username: 'user1',
    });

    expect(mockValidator.checkDuplicate).toHaveBeenCalledTimes(2);
  });
});
