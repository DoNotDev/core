/**
 * @fileoverview llms.txt format
 * @description The one llms.txt (llmstxt.org) serializer: Vite writes it at build
 * (LlmsTxtGenerator), the Next llms.txt route at request time (next/seo). No imports,
 * so the runtime route stays light.
 *
 * @version 0.1.0
 * @since 0.2.3
 * @author AMBROISE PARK Consulting
 */

/** Collapse whitespace so a value stays on its markdown list line. */
function inline(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Format an llms.txt document: H1 name, blockquote summary, then H2 sections of
 * `- [title](url): description` links. Empty sections are left out.
 *
 * @param {{ name: string, summary?: string, sections: Array<{ heading: string, links: Array<{ title: string, url: string, description?: string }> }> }} doc
 * @returns {string} llms.txt text, ending with a newline
 *
 * @example
 * formatLlmsTxt({ name: 'Shop', sections: [{ heading: 'Pages', links: [{ title: 'Accueil', url: 'https://shop.example/' }] }] });
 * // '# Shop\n\n## Pages\n\n- [Accueil](https://shop.example/)\n'
 */
export function formatLlmsTxt(doc) {
  const lines = [`# ${inline(doc.name)}`, ''];
  if (doc.summary) lines.push(`> ${inline(doc.summary)}`, '');
  for (const section of doc.sections) {
    if (section.links.length === 0) continue;
    lines.push(`## ${inline(section.heading)}`, '');
    for (const link of section.links) {
      const entry = `- [${inline(link.title)}](${link.url})`;
      lines.push(
        link.description ? `${entry}: ${inline(link.description)}` : entry
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
