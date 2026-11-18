// packages/core/schemas/src/common/__tests__/status.grep.test.ts

/**
 * @fileoverview One status rule: no hand-written draft comparison
 * @description Design 2026-11-17 §6 "One status rule": every write site picks its
 * schema with `writeSchemaFor` (status module), so no source file outside that
 * module compares a status to `'draft'` itself. Grep-based: scans the `src` trees
 * of every framework package (tests, comments, build output and `expo` excluded).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

/** The status module: the one place the rule lives. */
const STATUS_MODULE = 'core/schemas/src/common/crud/status.ts';

/**
 * Read-only comparisons that are not write sites (path → reason).
 * A write site never belongs here: it calls `writeSchemaFor`.
 */
const ALLOWED: Record<string, string> = {
  'templates/src/crud/InquiryAdminTemplate.tsx': 'list display filter (drafts tab), no write',
};

/** `status === 'draft'`, `row.status !== "draft"`, `'draft' === status`, … */
const DRAFT_COMPARISON =
  /\b\w*status\s*[!=]==?\s*['"]draft['"]|['"]draft['"]\s*[!=]==?\s*[\w.?]*status\b/i;

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__tests__', 'coverage']);

/** Packages out of the rule's scope (`packages/<name>`): Expo is not covered by the design. */
const EXCLUDED_PACKAGES = new Set(['expo']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

/** `src` directories of every package (one or two levels deep: `core/schemas/src`). */
function srcDirs(): string[] {
  const dirs: string[] = [];
  const visit = (dir: string, depth: number) => {
    for (const name of readdirSync(dir)) {
      if (SKIPPED_DIRS.has(name) || name.startsWith('.')) continue;
      if (depth === 0 && EXCLUDED_PACKAGES.has(name)) continue;
      const path = join(dir, name);
      if (!statSync(path).isDirectory()) continue;
      if (name === 'src') dirs.push(path);
      else if (depth < 2) visit(path, depth + 1);
    }
  };
  visit(PACKAGES, 0);
  return dirs;
}

/** Code lines only: block / line comments dropped. */
function codeLines(source: string): string[] {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ''))
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'));
}

describe('one status rule (grep)', () => {
  it('scans the framework sources', () => {
    const files = srcDirs().flatMap((dir) => sourceFiles(dir));
    const paths = files.map((file) => relative(PACKAGES, file));
    expect(paths).toContain(STATUS_MODULE);
    for (const pkg of ['features/crud/src/', 'functions/src/', 'ui/src/', 'templates/src/']) {
      expect(paths.some((path) => path.startsWith(pkg)), pkg).toBe(true);
    }
    expect(paths.some((path) => path.startsWith('expo/'))).toBe(false);
  });

  it("no status compared to 'draft' outside the status module", () => {
    const offenders: string[] = [];
    for (const file of srcDirs().flatMap((dir) => sourceFiles(dir))) {
      const path = relative(PACKAGES, file);
      if (path === STATUS_MODULE || path in ALLOWED) continue;
      codeLines(readFileSync(file, 'utf8')).forEach((line, index) => {
        if (DRAFT_COMPARISON.test(line)) offenders.push(`${path}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
