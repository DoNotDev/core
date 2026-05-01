// packages/core/types/src/crud/conditions.ts

/**
 * @fileoverview Condition Types
 * @description Pure type definitions for the condition engine.
 * Runtime evaluation and builder logic live in @donotdev/utils.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported comparison operators */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'exists'
  | 'notExists'
  | 'contains';

/** A single condition: field + operator + value */
export interface ConditionNode {
  readonly type: 'condition';
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value?: unknown;
}

/** Logical group of conditions */
export interface ConditionGroup {
  readonly type: 'group';
  readonly logic: 'and' | 'or';
  readonly conditions: ReadonlyArray<ConditionExpression>;
}

/** A condition expression — the serializable data model for conditions */
export type ConditionExpression = ConditionNode | ConditionGroup;

/** Result of evaluating all conditions for a field */
export interface ConditionResult {
  /** Whether the field should be visible (default: true) */
  visible: boolean;
  /** Whether the field should be disabled (default: false) */
  disabled: boolean;
  /** Whether the field is required (default: false, overrides static validation.required) */
  required: boolean;
  /** Whether the field is readonly (default: false) */
  readonly: boolean;
}

/**
 * Structural interface satisfied by ConditionBuilder (defined in @donotdev/utils).
 * Allows types to reference builders without depending on the runtime class.
 */
export interface ConditionBuilderLike {
  readonly expression: ConditionExpression;
}

/** Accepted condition input — either a raw expression or a ConditionBuilder */
export type ConditionInput = ConditionExpression | ConditionBuilderLike;

/** Conditions that can be attached to a field */
export interface ConditionalBehavior {
  /** Condition for field visibility — if false, field is hidden and excluded from validation */
  visible?: ConditionInput;
  /** Condition for field disabled state */
  disabled?: ConditionInput;
  /** Condition for dynamic required — evaluated at runtime */
  required?: ConditionInput;
  /** Condition for readonly state */
  readonly?: ConditionInput;
}
