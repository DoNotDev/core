// packages/core/utils/src/common/conditions/__tests__/conditions.test.ts

/**
 * @fileoverview Tests for the Condition Builder Engine
 * @description Unit tests for evaluateCondition, evaluateFieldConditions,
 * getConditionDependencies, ConditionBuilder, and the when() fluent API.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateCondition,
  evaluateFieldConditions,
  getConditionDependencies,
  ConditionBuilder,
  when,
} from '../index';

// ─── evaluateCondition: operators ──────────────────────────────────────────

describe('evaluateCondition', () => {
  describe('equals', () => {
    it('returns true when field matches value', () => {
      const cond = when('status').equals('active');
      expect(evaluateCondition(cond, { status: 'active' })).toBe(true);
    });

    it('returns false when field does not match', () => {
      const cond = when('status').equals('active');
      expect(evaluateCondition(cond, { status: 'inactive' })).toBe(false);
    });

    it('uses strict equality', () => {
      const cond = when('count').equals(0);
      expect(evaluateCondition(cond, { count: '' })).toBe(false);
      expect(evaluateCondition(cond, { count: false })).toBe(false);
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });

    it('returns false when field is missing', () => {
      const cond = when('status').equals('active');
      expect(evaluateCondition(cond, {})).toBe(false);
    });
  });

  describe('notEquals', () => {
    it('returns true when field differs from value', () => {
      const cond = when('status').notEquals('active');
      expect(evaluateCondition(cond, { status: 'inactive' })).toBe(true);
    });

    it('returns false when field matches value', () => {
      const cond = when('status').notEquals('active');
      expect(evaluateCondition(cond, { status: 'active' })).toBe(false);
    });

    it('returns true when field is missing (undefined !== value)', () => {
      const cond = when('status').notEquals('active');
      expect(evaluateCondition(cond, {})).toBe(true);
    });
  });

  describe('in', () => {
    it('returns true when field value is in the array', () => {
      const cond = when('role').in(['admin', 'editor']);
      expect(evaluateCondition(cond, { role: 'admin' })).toBe(true);
    });

    it('returns false when field value is not in the array', () => {
      const cond = when('role').in(['admin', 'editor']);
      expect(evaluateCondition(cond, { role: 'viewer' })).toBe(false);
    });

    it('returns false when field is missing', () => {
      const cond = when('role').in(['admin']);
      expect(evaluateCondition(cond, {})).toBe(false);
    });
  });

  describe('notIn', () => {
    it('returns true when field value is not in the array', () => {
      const cond = when('role').notIn(['banned', 'suspended']);
      expect(evaluateCondition(cond, { role: 'active' })).toBe(true);
    });

    it('returns false when field value is in the array', () => {
      const cond = when('role').notIn(['banned', 'suspended']);
      expect(evaluateCondition(cond, { role: 'banned' })).toBe(false);
    });
  });

  describe('greaterThan', () => {
    it('returns true when field is greater', () => {
      const cond = when('age').greaterThan(18);
      expect(evaluateCondition(cond, { age: 25 })).toBe(true);
    });

    it('returns false when field is equal', () => {
      const cond = when('age').greaterThan(18);
      expect(evaluateCondition(cond, { age: 18 })).toBe(false);
    });

    it('returns false when field is less', () => {
      const cond = when('age').greaterThan(18);
      expect(evaluateCondition(cond, { age: 10 })).toBe(false);
    });

    it('returns false when field is not a number', () => {
      const cond = when('age').greaterThan(18);
      expect(evaluateCondition(cond, { age: 'twenty' })).toBe(false);
    });
  });

  describe('lessThan', () => {
    it('returns true when field is less', () => {
      const cond = when('price').lessThan(100);
      expect(evaluateCondition(cond, { price: 50 })).toBe(true);
    });

    it('returns false when field is equal', () => {
      const cond = when('price').lessThan(100);
      expect(evaluateCondition(cond, { price: 100 })).toBe(false);
    });

    it('returns false when field is greater', () => {
      const cond = when('price').lessThan(100);
      expect(evaluateCondition(cond, { price: 150 })).toBe(false);
    });
  });

  describe('greaterThanOrEqual', () => {
    it('returns true when field is greater', () => {
      const cond = when('score').greaterThanOrEqual(50);
      expect(evaluateCondition(cond, { score: 75 })).toBe(true);
    });

    it('returns true when field is equal', () => {
      const cond = when('score').greaterThanOrEqual(50);
      expect(evaluateCondition(cond, { score: 50 })).toBe(true);
    });

    it('returns false when field is less', () => {
      const cond = when('score').greaterThanOrEqual(50);
      expect(evaluateCondition(cond, { score: 25 })).toBe(false);
    });
  });

  describe('lessThanOrEqual', () => {
    it('returns true when field is less', () => {
      const cond = when('temp').lessThanOrEqual(100);
      expect(evaluateCondition(cond, { temp: 80 })).toBe(true);
    });

    it('returns true when field is equal', () => {
      const cond = when('temp').lessThanOrEqual(100);
      expect(evaluateCondition(cond, { temp: 100 })).toBe(true);
    });

    it('returns false when field is greater', () => {
      const cond = when('temp').lessThanOrEqual(100);
      expect(evaluateCondition(cond, { temp: 120 })).toBe(false);
    });
  });

  describe('exists', () => {
    it('returns true for truthy string', () => {
      const cond = when('name').exists();
      expect(evaluateCondition(cond, { name: 'John' })).toBe(true);
    });

    it('returns false for null', () => {
      const cond = when('name').exists();
      expect(evaluateCondition(cond, { name: null })).toBe(false);
    });

    it('returns false for undefined (missing field)', () => {
      const cond = when('name').exists();
      expect(evaluateCondition(cond, {})).toBe(false);
    });

    it('returns false for empty string', () => {
      const cond = when('name').exists();
      expect(evaluateCondition(cond, { name: '' })).toBe(false);
    });

    it('returns false for false', () => {
      const cond = when('active').exists();
      expect(evaluateCondition(cond, { active: false })).toBe(false);
    });

    it('returns true for 0 (number)', () => {
      const cond = when('count').exists();
      expect(evaluateCondition(cond, { count: 0 })).toBe(true);
    });
  });

  describe('notExists', () => {
    it('returns true for null', () => {
      const cond = when('name').notExists();
      expect(evaluateCondition(cond, { name: null })).toBe(true);
    });

    it('returns true for empty string', () => {
      const cond = when('name').notExists();
      expect(evaluateCondition(cond, { name: '' })).toBe(true);
    });

    it('returns true for false', () => {
      const cond = when('active').notExists();
      expect(evaluateCondition(cond, { active: false })).toBe(true);
    });

    it('returns true for missing field', () => {
      const cond = when('field').notExists();
      expect(evaluateCondition(cond, {})).toBe(true);
    });

    it('returns false for truthy value', () => {
      const cond = when('name').notExists();
      expect(evaluateCondition(cond, { name: 'present' })).toBe(false);
    });
  });

  describe('contains', () => {
    it('returns true when string contains substring', () => {
      const cond = when('email').contains('@');
      expect(evaluateCondition(cond, { email: 'user@test.com' })).toBe(true);
    });

    it('returns false when string does not contain substring', () => {
      const cond = when('email').contains('@');
      expect(evaluateCondition(cond, { email: 'invalid' })).toBe(false);
    });

    it('returns true when array contains value', () => {
      const cond = when('tags').contains('urgent');
      expect(evaluateCondition(cond, { tags: ['urgent', 'important'] })).toBe(
        true
      );
    });

    it('returns false when array does not contain value', () => {
      const cond = when('tags').contains('urgent');
      expect(evaluateCondition(cond, { tags: ['normal'] })).toBe(false);
    });

    it('returns false for non-string non-array field', () => {
      const cond = when('count').contains(5);
      expect(evaluateCondition(cond, { count: 5 })).toBe(false);
    });
  });

  describe('unknown operator', () => {
    it('returns false for unrecognized operator', () => {
      const cond = new ConditionBuilder({
        type: 'condition',
        field: 'x',
        operator: 'bogus' as never,
        value: 1,
      });
      expect(evaluateCondition(cond, { x: 1 })).toBe(false);
    });
  });

  // ─── Dot-notated field paths ─────────────────────────────────────────────

  describe('dot-notated field resolution', () => {
    it('resolves nested field value', () => {
      const cond = when('step.productType').equals('car');
      expect(evaluateCondition(cond, { step: { productType: 'car' } })).toBe(
        true
      );
    });

    it('returns false for missing intermediate', () => {
      const cond = when('step.productType').equals('car');
      expect(evaluateCondition(cond, {})).toBe(false);
    });

    it('returns false when intermediate is null', () => {
      const cond = when('step.field').equals('x');
      expect(evaluateCondition(cond, { step: null })).toBe(false);
    });

    it('resolves deeply nested paths', () => {
      const cond = when('a.b.c').equals(42);
      expect(evaluateCondition(cond, { a: { b: { c: 42 } } })).toBe(true);
    });
  });

  // ─── Group logic: AND / OR ───────────────────────────────────────────────

  describe('AND logic', () => {
    it('returns true when all conditions pass', () => {
      const cond = when('type')
        .equals('car')
        .and(when('year').greaterThan(2000));
      expect(evaluateCondition(cond, { type: 'car', year: 2020 })).toBe(true);
    });

    it('returns false when one condition fails', () => {
      const cond = when('type')
        .equals('car')
        .and(when('year').greaterThan(2000));
      expect(evaluateCondition(cond, { type: 'car', year: 1990 })).toBe(false);
    });

    it('returns false when all conditions fail', () => {
      const cond = when('type')
        .equals('car')
        .and(when('year').greaterThan(2000));
      expect(evaluateCondition(cond, { type: 'bike', year: 1990 })).toBe(false);
    });
  });

  describe('OR logic', () => {
    it('returns true when first condition passes', () => {
      const cond = when('type')
        .equals('corporate')
        .or(when('size').greaterThan(10));
      expect(evaluateCondition(cond, { type: 'corporate', size: 2 })).toBe(
        true
      );
    });

    it('returns true when second condition passes', () => {
      const cond = when('type')
        .equals('corporate')
        .or(when('size').greaterThan(10));
      expect(evaluateCondition(cond, { type: 'individual', size: 15 })).toBe(
        true
      );
    });

    it('returns false when no conditions pass', () => {
      const cond = when('type')
        .equals('corporate')
        .or(when('size').greaterThan(10));
      expect(evaluateCondition(cond, { type: 'individual', size: 5 })).toBe(
        false
      );
    });
  });

  describe('nested compositions', () => {
    it('evaluates AND inside OR', () => {
      // (type=car AND year>2000) OR (type=bike)
      const cond = when('type')
        .equals('car')
        .and(when('year').greaterThan(2000))
        .or(when('type').equals('bike'));

      expect(evaluateCondition(cond, { type: 'car', year: 2020 })).toBe(true);
      expect(evaluateCondition(cond, { type: 'bike', year: 1990 })).toBe(true);
      expect(evaluateCondition(cond, { type: 'truck', year: 2020 })).toBe(
        false
      );
    });

    it('evaluates OR inside AND', () => {
      // (type=car OR type=truck) AND (year>2000)
      const left = when('type').equals('car').or(when('type').equals('truck'));
      const cond = left.and(when('year').greaterThan(2000));

      expect(evaluateCondition(cond, { type: 'car', year: 2020 })).toBe(true);
      expect(evaluateCondition(cond, { type: 'truck', year: 2020 })).toBe(true);
      expect(evaluateCondition(cond, { type: 'car', year: 1990 })).toBe(false);
      expect(evaluateCondition(cond, { type: 'bike', year: 2020 })).toBe(false);
    });
  });

  // ─── Raw ConditionExpression input ─────────────────────────────────────

  describe('raw expression input', () => {
    it('accepts a raw ConditionNode', () => {
      const result = evaluateCondition(
        { type: 'condition', field: 'x', operator: 'equals', value: 1 },
        { x: 1 }
      );
      expect(result).toBe(true);
    });

    it('accepts a raw ConditionGroup', () => {
      const result = evaluateCondition(
        {
          type: 'group',
          logic: 'and',
          conditions: [
            { type: 'condition', field: 'a', operator: 'equals', value: 1 },
            { type: 'condition', field: 'b', operator: 'equals', value: 2 },
          ],
        },
        { a: 1, b: 2 }
      );
      expect(result).toBe(true);
    });
  });
});

// ─── evaluateFieldConditions ──────────────────────────────────────────────

describe('evaluateFieldConditions', () => {
  it('returns all-default when behavior is undefined', () => {
    const result = evaluateFieldConditions(undefined, {});
    expect(result).toEqual({
      visible: true,
      disabled: false,
      required: false,
      readonly: false,
    });
  });

  it('returns all-default when behavior is empty object', () => {
    const result = evaluateFieldConditions({}, {});
    expect(result).toEqual({
      visible: true,
      disabled: false,
      required: false,
      readonly: false,
    });
  });

  it('evaluates visible condition', () => {
    const behavior = { visible: when('type').equals('car') };
    expect(evaluateFieldConditions(behavior, { type: 'car' })).toMatchObject({
      visible: true,
    });
    expect(evaluateFieldConditions(behavior, { type: 'bike' })).toMatchObject({
      visible: false,
    });
  });

  it('evaluates required condition', () => {
    const behavior = { required: when('mandatory').exists() };
    expect(
      evaluateFieldConditions(behavior, { mandatory: 'yes' })
    ).toMatchObject({ required: true });
    expect(evaluateFieldConditions(behavior, { mandatory: '' })).toMatchObject({
      required: false,
    });
  });

  it('evaluates disabled condition', () => {
    const behavior = { disabled: when('locked').equals(true) };
    expect(evaluateFieldConditions(behavior, { locked: true })).toMatchObject({
      disabled: true,
    });
    expect(evaluateFieldConditions(behavior, { locked: false })).toMatchObject({
      disabled: false,
    });
  });

  it('evaluates readonly condition', () => {
    const behavior = { readonly: when('status').equals('published') };
    expect(
      evaluateFieldConditions(behavior, { status: 'published' })
    ).toMatchObject({ readonly: true });
    expect(
      evaluateFieldConditions(behavior, { status: 'draft' })
    ).toMatchObject({ readonly: false });
  });

  it('evaluates multiple conditions together', () => {
    const behavior = {
      visible: when('type').equals('car'),
      required: when('type').equals('car'),
      disabled: when('status').equals('locked'),
      readonly: when('status').equals('archived'),
    };
    const result = evaluateFieldConditions(behavior, {
      type: 'car',
      status: 'locked',
    });
    expect(result).toEqual({
      visible: true,
      required: true,
      disabled: true,
      readonly: false,
    });
  });
});

// ─── ConditionBuilder ─────────────────────────────────────────────────────

describe('ConditionBuilder', () => {
  it('exposes the underlying expression', () => {
    const builder = when('field').equals('value');
    expect(builder.expression).toEqual({
      type: 'condition',
      field: 'field',
      operator: 'equals',
      value: 'value',
    });
  });

  it('delegates type getter to expression', () => {
    const builder = when('field').equals('value');
    expect(builder.type).toBe('condition');
  });

  it('flattens consecutive OR groups', () => {
    const cond = when('a')
      .equals(1)
      .or(when('b').equals(2))
      .or(when('c').equals(3));

    expect(cond.expression).toEqual({
      type: 'group',
      logic: 'or',
      conditions: [
        { type: 'condition', field: 'a', operator: 'equals', value: 1 },
        { type: 'condition', field: 'b', operator: 'equals', value: 2 },
        { type: 'condition', field: 'c', operator: 'equals', value: 3 },
      ],
    });
  });

  it('flattens consecutive AND groups', () => {
    const cond = when('a')
      .equals(1)
      .and(when('b').equals(2))
      .and(when('c').equals(3));

    expect(cond.expression).toEqual({
      type: 'group',
      logic: 'and',
      conditions: [
        { type: 'condition', field: 'a', operator: 'equals', value: 1 },
        { type: 'condition', field: 'b', operator: 'equals', value: 2 },
        { type: 'condition', field: 'c', operator: 'equals', value: 3 },
      ],
    });
  });

  it('does not flatten mixed logic (OR then AND)', () => {
    const cond = when('a')
      .equals(1)
      .or(when('b').equals(2))
      .and(when('c').equals(3));

    // OR group gets wrapped in AND group (not flattened)
    expect(cond.expression.type).toBe('group');
    expect((cond.expression as { logic: string }).logic).toBe('and');
  });
});

// ─── getConditionDependencies ─────────────────────────────────────────────

describe('getConditionDependencies', () => {
  it('extracts single field from simple condition', () => {
    const cond = when('status').equals('active');
    expect(getConditionDependencies(cond)).toEqual(new Set(['status']));
  });

  it('extracts multiple fields from AND group', () => {
    const cond = when('type').equals('car').and(when('year').greaterThan(2000));
    expect(getConditionDependencies(cond)).toEqual(new Set(['type', 'year']));
  });

  it('extracts multiple fields from OR group', () => {
    const cond = when('a').exists().or(when('b').exists());
    expect(getConditionDependencies(cond)).toEqual(new Set(['a', 'b']));
  });

  it('deduplicates repeated fields', () => {
    const cond = when('x').greaterThan(0).and(when('x').lessThan(100));
    expect(getConditionDependencies(cond)).toEqual(new Set(['x']));
  });

  it('extracts dot-notated paths', () => {
    const cond = when('step.productType').equals('physical');
    expect(getConditionDependencies(cond)).toEqual(
      new Set(['step.productType'])
    );
  });

  it('extracts fields from deeply nested compositions', () => {
    const cond = when('a')
      .equals(1)
      .and(when('b').equals(2).or(when('c').equals(3)));
    expect(getConditionDependencies(cond)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('works with raw ConditionExpression', () => {
    const deps = getConditionDependencies({
      type: 'group',
      logic: 'or',
      conditions: [
        { type: 'condition', field: 'x', operator: 'equals', value: 1 },
        { type: 'condition', field: 'y', operator: 'exists' },
      ],
    });
    expect(deps).toEqual(new Set(['x', 'y']));
  });
});
