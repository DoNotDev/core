// packages/core/schemas/src/common/crud/index.ts

/**
 * @fileoverview CRUD barrel
 * @description CRUD wire schemas (bulk) and the CRUD rules: one module per operation
 * (`create`, `update` with the logical delete `remove`), their result (`prepared`) and
 * the shared status rule (`status`). Every CRUD site applies the rules through these
 * functions only.
 *
 * @version 0.2.0
 * @since 0.2.0
 * @author AMBROISE PARK Consulting
 */

export * from './bulk';
export { createStatus, prepareCreate } from './create';
export { prepareRemove, prepareUpdate, updateCheck, updateNeedsStored } from './update';
export { hiddenStatusesFor, isReadableBy } from './read';
export type { UpdateInput } from './update';
export { assertWrite } from './prepared';
export type {
  CreateSchemas,
  PreparedWrite,
  UpdateSchemas,
  WriteIssue,
  WriteSchema,
  WriteSchemas,
} from './prepared';
// The status matrix questions (`STATUS_MATRIX`, @donotdev/types): what a status can do.
// The write-schema choice (`writeSchemaFor`, `entersVisibleStatus`) stays private: every
// site applies it through the rule functions above.
export { statusCan, statusesThat, statusOf, statusReadableBy } from './status';
export type { WriteSchemaKey } from './status';
