// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GENERATED_CONFIG_JS,
  generateConfigJs,
  ROOT,
} from '../../../../../scripts/generateConfigJs.mjs';

describe('generated config JS (bun run bpr)', () => {
  // A hand edit of an output, or a source edited without rerunning bpr, fails here
  it.each(GENERATED_CONFIG_JS)('$output is what bpr generates from $source', async (file) => {
    const committed = readFileSync(join(ROOT, file.output), 'utf8');
    expect(committed, `${file.output} is stale: run bun run bpr`).toBe(
      await generateConfigJs(file)
    );
  });
});
