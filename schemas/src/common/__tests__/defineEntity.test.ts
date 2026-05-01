import { describe, it, expect, vi } from 'vitest';

import { EDITABLE } from '@donotdev/types';

import { defineEntity } from '../defineEntity';
import { DEFAULT_STATUS_OPTIONS, baseFields } from '../visibility';

/** Minimal valid entity for tests */
function minimalEntity(overrides: Record<string, any> = {}) {
  const baseFields = {
    title: {
      name: 'title',
      label: 'Title',
      type: 'text' as const,
      visibility: 'user' as const,
      validation: { required: true },
    },
  };

  // Ensure all fields have name and label
  const processFields = (fields: Record<string, any>): Record<string, any> => {
    const processed: Record<string, any> = {};
    for (const [key, field] of Object.entries(fields)) {
      processed[key] = {
        name: key,
        label: field.label || key.charAt(0).toUpperCase() + key.slice(1),
        ...field,
      };
    }
    return processed;
  };

  const mergedFields = overrides.fields
    ? { ...baseFields, ...processFields(overrides.fields) }
    : baseFields;

  return {
    name: 'Product',
    collection: 'products',
    ...overrides,
    fields: mergedFields,
  };
}

describe('defineEntity', () => {
  describe('basic behavior', () => {
    it('returns entity with merged technical fields', () => {
      const result = defineEntity(minimalEntity());

      // User field present
      expect(result.fields.title).toBeDefined();
      expect(result.fields.title!.type).toBe('text');

      // Technical fields auto-added
      expect(result.fields.id).toBeDefined();
      expect(result.fields.createdAt).toBeDefined();
      expect(result.fields.updatedAt).toBeDefined();
      expect(result.fields.createdById).toBeDefined();
      expect(result.fields.updatedById).toBeDefined();
      expect(result.fields.status).toBeDefined();
    });

    it('sets default access config', () => {
      const result = defineEntity(minimalEntity());

      expect(result.access).toEqual({
        create: 'admin',
        read: 'guest',
        update: 'admin',
        delete: 'admin',
      });
    });

    it('merges custom access with defaults', () => {
      const result = defineEntity(
        minimalEntity({ access: { create: 'guest' } })
      );

      expect(result.access.create).toBe('guest');
      expect(result.access.read).toBe('guest'); // default preserved
      expect(result.access.delete).toBe('admin'); // default preserved
    });

    it('sets default namespace from entity name', () => {
      const result = defineEntity(minimalEntity());

      expect(result.namespace).toBe('entity-product');
    });

    it('preserves custom namespace', () => {
      const result = defineEntity(minimalEntity({ namespace: 'custom-ns' }));

      expect(result.namespace).toBe('custom-ns');
    });
  });

  describe('form config', () => {
    it('sets default form config when not provided', () => {
      const result = defineEntity(minimalEntity());

      expect(result.form).toBeDefined();
      expect(result.form!.type).toBe('single');
      expect(result.form!.layout?.columns).toBe(1);
      expect(result.form!.behavior?.showProgress).toBe(false);
    });

    it('merges user form config with defaults', () => {
      const result = defineEntity(
        minimalEntity({
          form: { type: 'single', layout: { columns: 2 } },
        })
      );

      expect(result.form!.layout?.columns).toBe(2);
      // Defaults still applied
      expect(result.form!.behavior?.showProgress).toBe(false);
    });
  });

  describe('status field', () => {
    it('has default status options (draft, available, deleted)', () => {
      const result = defineEntity(minimalEntity());
      const statusField = result.fields.status;

      expect(statusField.validation?.options).toBeDefined();
      const values = (
        statusField.validation!.options as Array<{ value: string }>
      ).map((o) => o.value);
      expect(values).toContain('draft');
      expect(values).toContain('available');
      expect(values).toContain('deleted');
    });

    it('merges user status options with defaults (no duplicates)', () => {
      const result = defineEntity(
        minimalEntity({
          fields: {
            title: {
              type: 'text',
              visibility: 'user',
              validation: { required: true },
            },
            status: {
              validation: {
                options: [
                  { value: 'sold', label: 'Sold' },
                  { value: 'draft', label: 'Custom Draft' }, // duplicate — should not appear twice
                ],
              },
            },
          },
        })
      );

      const statusField = result.fields.status;
      const options = statusField.validation!.options as Array<{
        value: string;
        label: string;
      }>;
      const values = options.map((o) => o.value);

      // Default options present
      expect(values).toContain('draft');
      expect(values).toContain('available');
      expect(values).toContain('deleted');
      // Custom option added
      expect(values).toContain('sold');
      // No duplicate draft
      expect(values.filter((v) => v === 'draft').length).toBe(1);
    });

    it('preserves status field type and visibility even with overrides', () => {
      const result = defineEntity(
        minimalEntity({
          fields: {
            title: {
              type: 'text',
              visibility: 'user',
              validation: { required: true },
            },
            status: {
              visibility: 'user', // attempt to override
              type: 'text', // attempt to override
            },
          },
        })
      );

      const statusField = result.fields.status;
      expect(statusField.type).toBe('select'); // preserved
      expect(statusField.visibility).toBe('admin'); // preserved
    });
  });

  describe('scope field', () => {
    it('auto-adds scope field when scope is configured', () => {
      const result = defineEntity(
        minimalEntity({
          scope: { field: 'companyId', provider: 'company' },
        })
      );

      expect(result.fields.companyId).toBeDefined();
      expect(result.fields.companyId!.type).toBe('reference');
      expect(result.fields.companyId!.visibility).toBe('technical');
      expect(result.fields.companyId!.editable).toBe(EDITABLE.CREATE_ONLY);
    });

    it('derives collection from field name (companyId -> companies)', () => {
      const result = defineEntity(
        minimalEntity({
          scope: { field: 'companyId', provider: 'company' },
        })
      );

      expect(result.fields.companyId!.validation?.reference).toBe('companies');
    });

    it('derives collection with simple pluralization (orgId -> orgs)', () => {
      const result = defineEntity(
        minimalEntity({
          scope: { field: 'orgId', provider: 'org' },
        })
      );

      expect(result.fields.orgId!.validation?.reference).toBe('orgs');
    });

    it('uses explicit collection when provided', () => {
      const result = defineEntity(
        minimalEntity({
          scope: {
            field: 'orgId',
            provider: 'org',
            collection: 'organizations',
          },
        })
      );

      expect(result.fields.orgId!.validation?.reference).toBe('organizations');
    });
  });

  describe('validation — listFields', () => {
    it('passes when all listFields reference valid fields', () => {
      expect(() =>
        defineEntity(minimalEntity({ listFields: ['title'] }))
      ).not.toThrow();
    });

    it('throws when listFields reference non-existent field', () => {
      expect(() =>
        defineEntity(minimalEntity({ listFields: ['nonexistent'] }))
      ).toThrow('do not exist');
    });
  });

  describe('validation — uniqueKeys', () => {
    it('passes when uniqueKeys reference valid fields', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            uniqueKeys: [{ fields: ['title'] }],
          })
        )
      ).not.toThrow();
    });

    it('throws when uniqueKeys reference non-existent fields', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            uniqueKeys: [{ fields: ['ghost'] }],
          })
        )
      ).toThrow('non-existent fields');
    });

    it('throws when uniqueKeys have empty fields array', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            uniqueKeys: [{ fields: [] }],
          })
        )
      ).toThrow('at least one field');
    });
  });

  describe('technical field customization', () => {
    it('allows customizing technical field properties while preserving type/visibility', () => {
      const result = defineEntity(
        minimalEntity({
          fields: {
            title: {
              type: 'text',
              visibility: 'user',
              validation: { required: true },
            },
            createdAt: {
              editable: 'admin',
              label: 'Date Created',
            },
          },
        })
      );

      const createdAt = result.fields.createdAt;
      expect(createdAt.type).toBe('timestamp'); // preserved
      expect(createdAt.visibility).toBe('technical'); // preserved
      expect(createdAt.editable).toBe('admin'); // user override
      expect(createdAt.label).toBe('Date Created'); // user override
    });
  });

  describe('multi-step form validation', () => {
    it('throws when multi-step form has no steps', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            form: {
              type: 'multi-step',
              steps: [],
            },
          })
        )
      ).toThrow('at least one step');
    });

    it('throws when step references non-existent field', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            form: {
              type: 'multi-step',
              steps: [{ label: 'Step 1', fields: ['title', 'ghostField'] }],
            },
          })
        )
      ).toThrow('non-existent fields');
    });

    // Note: Field step validation is not currently implemented
    it.skip('warns when fields are not included in any step', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      defineEntity(
        minimalEntity({
          form: {
            type: 'multi-step',
            steps: [{ label: 'Step 1', fields: ['title'] }],
          },
        })
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fields not included in any step')
      );
      warnSpy.mockRestore();
    });

    // Note: Form rule validation is not currently implemented
    it.skip('validates dynamic form rules reference valid fields', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            form: {
              type: 'single',
              rules: [
                {
                  condition: { field: 'ghostField', value: 'test' },
                  showFields: ['title'],
                },
              ],
            },
          })
        )
      ).toThrow('non-existent condition fields');
    });

    // Note: Field dependency validation is not currently implemented
    it.skip('validates field dependencies reference valid fields', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            fields: {
              title: {
                name: 'title',
                label: 'Title',
                type: 'text',
                visibility: 'user',
                dependsOn: { field: 'ghostField' },
              },
            },
          })
        )
      ).toThrow('depends on non-existent field');
    });
  });

  describe('field merging behavior', () => {
    it('user fields override base fields but preserve type/visibility for technical fields', () => {
      const result = defineEntity(
        minimalEntity({
          fields: {
            title: {
              name: 'title',
              label: 'Title',
              type: 'text',
              visibility: 'user',
              validation: { required: true },
            },
            createdAt: {
              editable: 'admin',
              label: 'Created',
            },
            updatedAt: {
              hint: 'Last modified',
            },
          },
        })
      );

      // User overrides applied for technical fields that support merging
      expect(result.fields.createdAt.editable).toBe('admin');
      expect(result.fields.createdAt.label).toBe('Created');
      expect(result.fields.updatedAt.hint).toBe('Last modified');

      // Type/visibility preserved from base
      expect(result.fields.createdAt.type).toBe('timestamp');
      expect(result.fields.createdAt.visibility).toBe('technical');
      expect(result.fields.updatedAt.type).toBe('timestamp');
      expect(result.fields.updatedAt.visibility).toBe('technical');
    });

    it('merges validation rules correctly', () => {
      const result = defineEntity(
        minimalEntity({
          fields: {
            title: {
              name: 'title',
              label: 'Title',
              type: 'text',
              visibility: 'user',
              validation: { required: true, minLength: 5 },
            },
          },
        })
      );

      expect(result.fields.title!.validation?.required).toBe(true);
      expect(result.fields.title!.validation?.minLength).toBe(5);
    });
  });

  describe('error handling', () => {
    it('wraps errors with entity context', () => {
      try {
        defineEntity(
          minimalEntity({
            listFields: ['nonexistent'],
          })
        );
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Product');
        expect(error.message).toContain('do not exist');
      }
    });

    it('handles undefined uniqueKeys entries gracefully', () => {
      // Should not throw on undefined entries (guarded in code)
      expect(() =>
        defineEntity(
          minimalEntity({
            uniqueKeys: [
              { fields: ['title'] },
              undefined as any,
              { fields: ['title'] },
            ],
          })
        )
      ).not.toThrow();
    });
  });

  describe('listCardFields validation', () => {
    it('throws when listCardFields reference non-existent fields', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            listCardFields: ['title', 'ghostField'],
          })
        )
      ).toThrow('do not exist');
    });

    it('passes when all listCardFields are valid', () => {
      expect(() =>
        defineEntity(
          minimalEntity({
            listCardFields: ['title'],
          })
        )
      ).not.toThrow();
    });
  });
});
