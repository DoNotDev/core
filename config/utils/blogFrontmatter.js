// GENERATED from ../../utils/src/common/blogFrontmatter.ts by bun run bpr. Do not edit; edit the .ts and rerun bpr.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const AFTER_FENCE = /^\r?\n/;
function parseBlogFrontmatter(raw) {
  const match = raw.match(FRONTMATTER);
  if (!match) return { meta: {}, content: raw };
  const meta = {};
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
export { parseBlogFrontmatter };
