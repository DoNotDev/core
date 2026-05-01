// packages/core/utils/src/common/generateFirestoreRuleCondition.ts

/**
 * @fileoverview Firestore rule condition generator for stakeholder ownership
 * @description Given EntityOwnershipConfig, returns a rule condition string suitable for
 * allow read and allow update. Use the same condition for both (owners can read and update).
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import type {
  EntityOwnershipConfig,
  EntityOwnershipPublicCondition,
} from '@donotdev/types';

/**
 * Escapes a value for use in Firestore rules (strings need quotes, booleans/numbers as-is).
 */
function ruleValue(value: string | boolean | number): string {
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Builds a single condition expression: resource.data.<field> <op> <value>
 */
function buildCondition(c: EntityOwnershipPublicCondition): string {
  const left = `resource.data.${c.field}`;
  const right = ruleValue(c.value);
  return `${left} ${c.op} ${right}`;
}

/**
 * Generates a Firestore rule condition for read and update based on ownership config.
 * Use the returned string in firestore.rules like:
 *
 *   allow read, update: if <generated>;
 *
 * The condition is: (publicCondition AND ...) OR request.auth.uid == resource.data.<ownerField1> OR ...
 *
 * @param ownership - Entity ownership config (ownerFields + optional publicCondition array)
 * @returns Rule condition expression string
 */
export function generateFirestoreRuleCondition(
  ownership: EntityOwnershipConfig
): string {
  const parts: string[] = [];

  if (ownership.publicCondition && ownership.publicCondition.length > 0) {
    const publicExpr = ownership.publicCondition
      .map(buildCondition)
      .join(' && ');
    parts.push(`(${publicExpr})`);
  }

  for (const field of ownership.ownerFields) {
    parts.push(`request.auth.uid == resource.data.${field}`);
  }

  if (parts.length === 0) {
    return 'false';
  }

  return parts.join(' || ');
}
