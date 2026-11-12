// packages/core/types/src/common/picklistOptions.ts

/**
 * @fileoverview Internal helper turning constant-map values into valibot picklist options
 * @description Not re-exported from the package. `Object.values()` returns `string[]`,
 * while `v.picklist()` requires a non-empty tuple; this helper proves non-emptiness
 * instead of casting.
 *
 * @version 0.1.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */

/**
 * Values of a constant map as a non-empty tuple for `v.picklist()`.
 *
 * @param constants - Constant map (e.g. `USER_ROLES`)
 * @returns Its values as `[string, ...string[]]`
 * @throws Error when the map is empty (a picklist with no options is a config bug)
 */
export function picklistOptions(
  constants: Readonly<Record<string, string>>
): [string, ...string[]] {
  const [first, ...rest] = Object.values(constants);
  if (first === undefined) {
    throw new Error('picklistOptions: constant map has no values');
  }
  return [first, ...rest];
}
