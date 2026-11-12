import { describe, expect, it } from 'vitest';

import { createFunctionsConfig } from '../functions.js';
import { detectWorkspace } from '../workspace.js';

/**
 * Functions are server code: `react-server` makes `@donotdev/core` (".") resolve to the
 * client-free server entry, as in Next's server layer. Shared code (entities, provider
 * `common/`) imports the root and gets the right entry on every platform.
 */
describe('createFunctionsConfig resolve conditions', () => {
  it('includes react-server next to the ESM conditions', () => {
    const config = createFunctionsConfig({ workspace: detectWorkspace() });
    expect(config.conditions).toEqual(['react-server', 'import', 'module', 'node']);
  });
});
