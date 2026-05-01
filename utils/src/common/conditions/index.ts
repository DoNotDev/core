// packages/core/utils/src/common/conditions/index.ts

/**
 * @fileoverview Condition Builder Engine
 * @description Fluent API for building field conditions and evaluating them at runtime.
 * Used for dynamic field visibility, disabled state, required state, and readonly state.
 *
 * @example
 * ```typescript
 * import { when, evaluateCondition } from '@donotdev/core';
 *
 * // Simple condition
 * const condition = when('productType').equals('car');
 * evaluateCondition(condition, { productType: 'car' }); // true
 *
 * // Combined conditions
 * const combined = when('type').equals('corporate')
 *   .or(when('groupSize').greaterThan(10));
 * evaluateCondition(combined, { type: 'individual', groupSize: 15 }); // true
 *
 * // On entity fields
 * { name: 'licensePlate', type: 'text', visibility: 'user',
 *   conditions: {
 *     visible: when('productType').equals('car'),
 *     required: when('productType').equals('car'),
 *   }
 * }
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  ConditionExpression,
  ConditionInput,
  ConditionNode,
  ConditionOperator,
  ConditionalBehavior,
  ConditionResult,
} from '@donotdev/types';

// ─── Evaluation Engine ───────────────────────────────────────────────────────

/**
 * Resolve a potentially dot-notated field path from form values.
 * Supports `step.field` for workflow cross-step references.
 */
function resolveValue(
  formValues: Record<string, unknown>,
  fieldPath: string
): unknown {
  if (fieldPath.includes('.')) {
    const parts = fieldPath.split('.');
    let current: unknown = formValues;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
  return formValues[fieldPath];
}

/**
 * Evaluate a single condition node against form values.
 */
function evaluateNode(
  node: ConditionNode,
  formValues: Record<string, unknown>
): boolean {
  const fieldValue = resolveValue(formValues, node.field);

  switch (node.operator) {
    case 'equals':
      return fieldValue === node.value;

    case 'notEquals':
      return fieldValue !== node.value;

    case 'in':
      return Array.isArray(node.value) && node.value.includes(fieldValue);

    case 'notIn':
      return Array.isArray(node.value) && !node.value.includes(fieldValue);

    case 'greaterThan':
      return (
        typeof fieldValue === 'number' &&
        typeof node.value === 'number' &&
        fieldValue > node.value
      );

    case 'lessThan':
      return (
        typeof fieldValue === 'number' &&
        typeof node.value === 'number' &&
        fieldValue < node.value
      );

    case 'greaterThanOrEqual':
      return (
        typeof fieldValue === 'number' &&
        typeof node.value === 'number' &&
        fieldValue >= node.value
      );

    case 'lessThanOrEqual':
      return (
        typeof fieldValue === 'number' &&
        typeof node.value === 'number' &&
        fieldValue <= node.value
      );

    case 'exists':
      return fieldValue != null && fieldValue !== '' && fieldValue !== false;

    case 'notExists':
      return fieldValue == null || fieldValue === '' || fieldValue === false;

    case 'contains':
      if (typeof fieldValue === 'string' && typeof node.value === 'string') {
        return fieldValue.includes(node.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(node.value);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Unwrap a ConditionInput to its raw ConditionExpression.
 */
function unwrap(input: ConditionInput): ConditionExpression {
  if (input instanceof ConditionBuilder) return input.expression;
  if ('expression' in input)
    return (input as { expression: ConditionExpression }).expression;
  return input as ConditionExpression;
}

/**
 * Evaluate a condition expression (node or group) against form values.
 *
 * @param condition - The condition expression or ConditionBuilder to evaluate
 * @param formValues - Current form values (flat object or nested for workflows)
 * @returns Whether the condition is satisfied
 *
 * @example
 * ```typescript
 * const cond = when('status').equals('active');
 * const result = evaluateCondition(cond, { status: 'active' }); // true
 * ```
 */
export function evaluateCondition(
  condition: ConditionInput,
  formValues: Record<string, unknown>
): boolean {
  const expr = unwrap(condition);

  if (expr.type === 'condition') {
    return evaluateNode(expr, formValues);
  }

  // Group evaluation
  const { logic, conditions } = expr;
  if (logic === 'and') {
    return conditions.every((c) => evaluateCondition(c, formValues));
  }
  // 'or'
  return conditions.some((c) => evaluateCondition(c, formValues));
}

/**
 * Evaluate all conditions for a field and return the computed state.
 *
 * @param behavior - The ConditionalBehavior from the field definition
 * @param formValues - Current form values
 * @returns ConditionResult with visible/disabled/required/readonly booleans
 */
export function evaluateFieldConditions(
  behavior: ConditionalBehavior | undefined,
  formValues: Record<string, unknown>
): ConditionResult {
  if (!behavior) {
    return { visible: true, disabled: false, required: false, readonly: false };
  }

  return {
    visible: behavior.visible
      ? evaluateCondition(behavior.visible, formValues)
      : true,
    disabled: behavior.disabled
      ? evaluateCondition(behavior.disabled, formValues)
      : false,
    required: behavior.required
      ? evaluateCondition(behavior.required, formValues)
      : false,
    readonly: behavior.readonly
      ? evaluateCondition(behavior.readonly, formValues)
      : false,
  };
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Chainable condition builder.
 * Wraps a ConditionExpression and provides .or()/.and() combinators.
 * Implements ConditionBuilderLike from @donotdev/types.
 */
export class ConditionBuilder {
  /** The underlying condition expression (serializable data) */
  readonly expression: ConditionExpression;

  constructor(expression: ConditionExpression) {
    this.expression = expression;
  }

  /** The discriminant for ConditionExpression — delegates to inner expression */
  get type(): ConditionExpression['type'] {
    return this.expression.type;
  }

  /** Combine with OR logic */
  or(other: ConditionExpression | ConditionBuilder): ConditionBuilder {
    const otherExpr =
      other instanceof ConditionBuilder ? other.expression : other;
    const thisExpr = this.expression;

    // Flatten: if this is already an OR group, append to it
    if (thisExpr.type === 'group' && thisExpr.logic === 'or') {
      return new ConditionBuilder({
        type: 'group',
        logic: 'or',
        conditions: [...thisExpr.conditions, otherExpr],
      });
    }
    return new ConditionBuilder({
      type: 'group',
      logic: 'or',
      conditions: [thisExpr, otherExpr],
    });
  }

  /** Combine with AND logic */
  and(other: ConditionExpression | ConditionBuilder): ConditionBuilder {
    const otherExpr =
      other instanceof ConditionBuilder ? other.expression : other;
    const thisExpr = this.expression;

    // Flatten: if this is already an AND group, append to it
    if (thisExpr.type === 'group' && thisExpr.logic === 'and') {
      return new ConditionBuilder({
        type: 'group',
        logic: 'and',
        conditions: [...thisExpr.conditions, otherExpr],
      });
    }
    return new ConditionBuilder({
      type: 'group',
      logic: 'and',
      conditions: [thisExpr, otherExpr],
    });
  }
}

/** Intermediate builder returned by when(field) — provides operator methods */
interface WhenFieldBuilder {
  /** Field equals value */
  equals(value: unknown): ConditionBuilder;
  /** Field does not equal value */
  notEquals(value: unknown): ConditionBuilder;
  /** Field value is in array */
  in(values: unknown[]): ConditionBuilder;
  /** Field value is not in array */
  notIn(values: unknown[]): ConditionBuilder;
  /** Field value is greater than */
  greaterThan(value: number): ConditionBuilder;
  /** Field value is less than */
  lessThan(value: number): ConditionBuilder;
  /** Field value is greater than or equal */
  greaterThanOrEqual(value: number): ConditionBuilder;
  /** Field value is less than or equal */
  lessThanOrEqual(value: number): ConditionBuilder;
  /** Field has a truthy value (not null, not empty, not false) */
  exists(): ConditionBuilder;
  /** Field has no value (null, empty, or false) */
  notExists(): ConditionBuilder;
  /** Field contains value (string includes or array includes) */
  contains(value: unknown): ConditionBuilder;
}

/**
 * Start building a condition for a field.
 *
 * @param field - Field name to evaluate (supports dot notation for nested/cross-step: 'step.field')
 * @returns Builder with operator methods
 *
 * @example
 * ```typescript
 * // Simple
 * when('type').equals('car')
 *
 * // Combined
 * when('type').equals('corporate').or(when('size').greaterThan(10))
 *
 * // Cross-step (workflows)
 * when('basics.productType').equals('physical')
 * ```
 */
export function when(field: string): WhenFieldBuilder {
  function node(
    operator: ConditionOperator,
    value?: unknown
  ): ConditionBuilder {
    return new ConditionBuilder({ type: 'condition', field, operator, value });
  }

  return {
    equals: (value: unknown) => node('equals', value),
    notEquals: (value: unknown) => node('notEquals', value),
    in: (values: unknown[]) => node('in', values),
    notIn: (values: unknown[]) => node('notIn', values),
    greaterThan: (value: number) => node('greaterThan', value),
    lessThan: (value: number) => node('lessThan', value),
    greaterThanOrEqual: (value: number) => node('greaterThanOrEqual', value),
    lessThanOrEqual: (value: number) => node('lessThanOrEqual', value),
    exists: () => node('exists'),
    notExists: () => node('notExists'),
    contains: (value: unknown) => node('contains', value),
  };
}

/**
 * Extract all field names referenced by a condition expression.
 * Useful for building dependency graphs and optimizing re-evaluation.
 *
 * @param condition - The condition expression or builder to analyze
 * @returns Set of field names (may include dot-notated paths)
 */
export function getConditionDependencies(
  condition: ConditionExpression | ConditionBuilder
): Set<string> {
  const expr =
    condition instanceof ConditionBuilder ? condition.expression : condition;
  const deps = new Set<string>();

  function collect(e: ConditionExpression): void {
    if (e.type === 'condition') {
      deps.add(e.field);
    } else {
      for (const child of e.conditions) {
        collect(child);
      }
    }
  }

  collect(expr);
  return deps;
}
