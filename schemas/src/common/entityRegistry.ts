// packages/core/schemas/src/common/entityRegistry.ts

/**
 * @fileoverview Entity registry (collection → entity)
 * @description `defineEntity()` records every entity here under its collection, so the
 * framework can resolve a reference field (`validation.reference: 'brands'`) to the full
 * referenced entity without any app wiring. Pure module (no React, no browser APIs):
 * safe on server and client. Backed by a global singleton so duplicated module
 * instances (HMR, bundler splits) share one map.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

import type { AnyEntity } from '@donotdev/types';
import { getGlobalSingleton } from '@donotdev/utils/server';

const getRegistry = () =>
  getGlobalSingleton('entity-registry', () => new Map<string, AnyEntity>());

/**
 * Record an entity under its collection. Called by `defineEntity()` only.
 * Re-defining the same collection (HMR) replaces the previous definition.
 *
 * @param entity - The defined entity
 */
export function registerEntity(entity: AnyEntity): void {
  getRegistry().set(entity.collection, entity);
}

/**
 * Entity defined for a collection, if the app defined one.
 *
 * @param collection - Collection name (e.g. a reference field's `validation.reference`)
 * @returns The entity, or `undefined` when no entity was defined for that collection
 *
 * @example
 * ```typescript
 * const brandEntity = getEntityByCollection('brands');
 * ```
 */
export function getEntityByCollection(
  collection: string
): AnyEntity | undefined {
  return getRegistry().get(collection);
}
