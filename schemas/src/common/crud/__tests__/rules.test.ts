// packages/core/schemas/src/common/crud/__tests__/rules.test.ts

/**
 * @fileoverview CRUD rule functions against the shared rule cases
 */

import { describe, expect, it } from 'vitest';

import { createStatus, prepareCreate } from '../create';
import { assertWrite } from '../prepared';
import type { PreparedWrite } from '../prepared';
import { prepareRemove, prepareUpdate } from '../update';

import { caseSchemas, RULE_CASES } from './rules.cases';
import type { RuleCase } from './rules.cases';

function run(c: RuleCase): PreparedWrite {
  if (c.op === 'create') return prepareCreate(caseSchemas, c.values);
  if (c.op === 'remove') return prepareRemove(caseSchemas, c.id);
  return prepareUpdate(caseSchemas, { id: c.id, patch: c.patch, stored: c.stored });
}

describe('CRUD rules (core functions)', () => {
  for (const c of RULE_CASES) {
    it(c.rule, () => {
      const result = run(c);
      if (c.expect.ok) {
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.written).toEqual(c.expect.written);
        if (c.expect.unknownKeys) expect(result.unknownKeys).toEqual(c.expect.unknownKeys);
      } else {
        expect(result.ok).toBe(false);
        if (result.ok) return;
        const paths = result.issues.map((issue) => issue.path?.map((p) => String(p.key)).join('.'));
        expect(paths).toEqual(c.expect.issuePaths);
      }
    });
  }

  it('createStatus: sent status, else available', () => {
    expect(createStatus({ status: 'draft' })).toBe('draft');
    expect(createStatus({})).toBe('available');
    expect(createStatus(undefined)).toBe('available');
  });

  it('an update without the stored row fails loud (except remove)', () => {
    expect(() => prepareUpdate(caseSchemas, { id: 'n1', patch: { body: 'b' } })).toThrow(/stored row/);
    expect(() => prepareUpdate(caseSchemas, { id: 'n1', patch: { status: 'available' } })).toThrow(/stored row/);
  });

  it('assertWrite: written, or validation-failed with the issues', () => {
    expect(assertWrite(prepareRemove(caseSchemas, 'n1'), 't')).toEqual({ status: 'deleted' });
    expect(() => assertWrite(prepareCreate(caseSchemas, {}), 'add(notes)')).toThrow(
      expect.objectContaining({ code: 'validation-failed' })
    );
  });
});
