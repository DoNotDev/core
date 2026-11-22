// packages/core/utils/src/common/blogFrontmatter.ts

/**
 * @fileoverview Blog post frontmatter
 * @description The one frontmatter reading of a blog post markdown file at runtime: the
 * templates blog loader (`@donotdev/templates`) and the generated Next blog post pages
 * (`@donotdev/core/server`), and the build: `bun run bpr` compiles this file into
 * `config/utils/blogFrontmatter.js`, the copy the plain-Node build imports (route manifest
 * blog routes, rss.xml, sitemap and llms.txt entries). Edit this file, never the `.js`.
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */

/** `---` fences around the frontmatter block, at the start of the file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** A line break right after the closing fence (not part of the content). */
const AFTER_FENCE = /^\r?\n/;

/**
 * Parse a blog post's frontmatter: `key: value` lines between `---` fences, a value's
 * surrounding quotes removed (`title: "Hello, world"` → `Hello, world`), and the markdown
 * after it.
 *
 * @param raw - Raw markdown file content
 * @returns `meta`: parsed key-value pairs (empty without frontmatter); `content`: the
 *   markdown after the closing fence (the whole file without frontmatter)
 *
 * @example
 * parseBlogFrontmatter('---\ntitle: "Hello"\n---\n# Body');
 * // { meta: { title: 'Hello' }, content: '# Body' }
 *
 * @version 0.1.0
 * @since 0.3.2
 * @author AMBROISE PARK Consulting
 */
export function parseBlogFrontmatter(raw: string): {
  meta: Record<string, string>;
  content: string;
} {
  const match = raw.match(FRONTMATTER);
  if (!match) return { meta: {}, content: raw };
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    if (!key) continue;
    let value = line.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, content: raw.slice(match[0].length).replace(AFTER_FENCE, '') };
}
