// packages/core/utils/src/common/errors/loadErrorReason.ts

/**
 * @fileoverview Reason of a failed read
 * @description The one mapping from a read's error code to the translated reason shown
 * in a load error (`dndev:messages.*`), shared by the web (`@donotdev/ui` CrudLoadError)
 * and native (`@donotdev/expo` CrudLoadError) load error boxes.
 *
 * @version 0.1.0
 * @since 0.3.8
 * @author AMBROISE PARK Consulting
 */

import { DoNotDevError } from './doNotDevError';

/** `dndev` key of the reason shown for an error code (`ERROR_CODES`). */
const REASON_KEYS: Readonly<Record<string, string>> = {
  unavailable: 'messages.networkError',
  'deadline-exceeded': 'messages.networkError',
  timeout: 'messages.networkError',
  'permission-denied': 'messages.forbidden',
  unauthenticated: 'messages.unauthorized',
  internal: 'messages.serverError',
};

/** Reason of any other error: a code not listed above, or an error without a code. */
const OTHER_REASON_KEY = 'messages.error';

/**
 * The `dndev` key of the reason a read failed, from its error code: network
 * (`unavailable`, `deadline-exceeded`, `timeout`) `messages.networkError`,
 * `permission-denied` `messages.forbidden`, `unauthenticated` `messages.unauthorized`,
 * `internal` `messages.serverError`; any other code, or an error that is not a
 * `DoNotDevError` (CRUD adapters wrap theirs), `messages.error`.
 *
 * @param error - The read's error
 * @returns A `dndev` namespace key
 *
 * @example
 * ```ts
 * loadErrorReasonKey(new DoNotDevError('Request failed.', 'permission-denied')); // 'messages.forbidden'
 * ```
 *
 * @version 0.1.0
 * @since 0.3.8
 */
export function loadErrorReasonKey(error: unknown): string {
  if (error instanceof DoNotDevError && Object.hasOwn(REASON_KEYS, error.code)) {
    return REASON_KEYS[error.code]!;
  }
  return OTHER_REASON_KEY;
}
