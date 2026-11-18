// packages/core/schemas/src/common/crud/__tests__/rules.cases.ts

/**
 * @fileoverview CRUD rule cases
 * @description One case per CRUD rule, shared by every write path's tests (core rule
 * functions, client writers, server writers): a path that applies a rule differently fails
 * the same case. Plan: docs/plans/2026-11-17-crud-write-rules-ssot.html §5.
 */

import { noteEntity } from '@dndev/test-entities';

import { createSchemas } from '../../createSchema';

/** Entity of the cases (shared test entities): one required field, one optional field, a custom status. */
export const caseEntity = noteEntity;

export const caseSchemas = createSchemas(caseEntity);

/** One rule case: the write, and what it stores (`written`) or rejects (`issues` paths). */
export type RuleCase =
  | { rule: string; op: 'create'; values: Record<string, unknown>; expect: Expected }
  | {
      rule: string;
      op: 'update';
      id: string;
      patch: Record<string, unknown>;
      stored?: Record<string, unknown>;
      expect: Expected;
    }
  | { rule: string; op: 'remove'; id: string; expect: Expected };

export type Expected =
  | { ok: true; written: Record<string, unknown>; unknownKeys?: string[] }
  | { ok: false; issuePaths: string[] };

const storedDraft = { id: 'n1', status: 'draft', title: null, body: null };
const storedAvailable = { id: 'n1', status: 'available', title: 'T', body: null };

export const RULE_CASES: RuleCase[] = [
  { rule: '1 create validates everything', op: 'create', values: { body: 'b' }, expect: { ok: false, issuePaths: ['title'] } },
  { rule: '1 create valid', op: 'create', values: { title: 'T' }, expect: { ok: true, written: { title: 'T', status: 'available' } } },
  { rule: '7 default status available', op: 'create', values: { title: 'T' }, expect: { ok: true, written: { title: 'T', status: 'available' } } },
  { rule: '5/7 draft create saves incomplete', op: 'create', values: { status: 'draft' }, expect: { ok: true, written: { status: 'draft' } } },
  { rule: '6 create may start deleted, strict', op: 'create', values: { status: 'deleted' }, expect: { ok: false, issuePaths: ['title'] } },
  { rule: '6 custom status strict', op: 'create', values: { status: 'sold' }, expect: { ok: false, issuePaths: ['title'] } },
  { rule: '2 update validates what changes', op: 'update', id: 'n1', patch: { body: 'b' }, stored: { ...storedAvailable, title: null }, expect: { ok: true, written: { body: 'b' } } },
  { rule: '2 update cannot empty a required field', op: 'update', id: 'n1', patch: { title: null }, stored: storedAvailable, expect: { ok: false, issuePaths: ['title'] } },
  { rule: '5 draft update may empty a required field', op: 'update', id: 'n1', patch: { title: null }, stored: storedDraft, expect: { ok: true, written: { title: null } } },
  { rule: '5 leaving draft checks the whole record', op: 'update', id: 'n1', patch: { status: 'available' }, stored: storedDraft, expect: { ok: false, issuePaths: ['title'] } },
  { rule: '5 leaving draft, complete record', op: 'update', id: 'n1', patch: { status: 'available', title: 'T' }, stored: storedDraft, expect: { ok: true, written: { status: 'available', title: 'T' } } },
  { rule: '3 remove: logical delete of an incomplete draft', op: 'remove', id: 'n1', expect: { ok: true, written: { status: 'deleted' } } },
  { rule: '8 unknown keys reported, known keys written', op: 'update', id: 'n1', patch: { body: 'b', colour: 'red' }, stored: storedAvailable, expect: { ok: true, written: { body: 'b' }, unknownKeys: ['colour'] } },
  { rule: '8 stored row spread into a patch is not unknown', op: 'update', id: 'n1', patch: { ...storedAvailable, createdAt: 'x', body: 'b' }, stored: storedAvailable, expect: { ok: true, written: { status: 'available', title: 'T', body: 'b' }, unknownKeys: [] } },
];
