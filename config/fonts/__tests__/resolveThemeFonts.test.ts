/**
 * Theme font stacks and weights per theme: the font plan's first step.
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

import { collectThemeTokens, resolveThemeFonts, splitTopLevel } from '../resolveThemeFonts.js';

const FRAMEWORK = `:root {
  --font-sans: Inter, 'Inter Fallback', sans-serif;
  --font-family: var(--font-sans);
  --font-headline: var(--font-sans);
  --font-mono: ui-monospace, monospace;
  --font-weight-normal: 400; --font-weight-bold: 700;
}
.dark { --background: #000; }`;

describe('collectThemeTokens', () => {
  it('keys declarations by root scope and theme class, with their file', () => {
    const scopes = collectThemeTokens(
      ':root, .luxury { --a: 1; } html.dark { --b: 2 !important; } .card .x { --c: 3; }',
      'src/themes.css'
    );
    expect([...scopes.keys()]).toEqual([':root', 'luxury', 'dark']);
    expect(scopes.get('dark')!.get('--b')).toEqual({ value: '2', source: 'src/themes.css', scope: 'dark' });
  });

  it('splitTopLevel ignores commas in quotes and parentheses', () => {
    expect(splitTopLevel("'A, B', var(--x, a, b), c")).toEqual(["'A, B'", 'var(--x, a, b)', 'c']);
  });
});

describe('resolveThemeFonts', () => {
  it('cascades framework → app → theme; stacks flattened, weights resolved', () => {
    const [root, dark, luxury] = resolveThemeFonts({
      frameworkCss: FRAMEWORK,
      appCss: [
        { file: 'src/themes.css', css: `.luxury { --font-headline: 'Playfair Display', 'Playfair Display Fallback', var(--font-sans); --font-weight-normal: var(--light); --light: 300; --font-weight-bold: bold; }` },
      ],
    });
    expect(root.scope).toBe(':root');
    expect(root.roles.body!.stack).toEqual(['Inter', 'Inter Fallback', 'sans-serif']);
    expect(root.roles.body!.origin!.token).toBe('--font-sans');
    expect(dark.scope).toBe('dark');
    expect(luxury.roles.headline!.stack).toEqual([
      'Playfair Display', 'Playfair Display Fallback', 'Inter', 'Inter Fallback', 'sans-serif',
    ]);
    expect(luxury.roles.headline!.origin!.declaration.source).toBe('src/themes.css');
    expect([...luxury.weights].map(([token, { weight }]) => [token, weight])).toEqual([
      ['--font-weight-normal', 300],
      ['--font-weight-bold', 700],
    ]);
  });

  it('fails on a weight token that is no weight', () => {
    expect(() =>
      resolveThemeFonts({ frameworkCss: FRAMEWORK, appCss: [{ file: 'a.css', css: ':root { --font-weight-bold: heavy; }' }] })
    ).toThrow('--font-weight-bold: heavy is not a font weight');
  });

  it('a var() with a fallback resolves through it', () => {
    const [root] = resolveThemeFonts({
      frameworkCss: FRAMEWORK,
      appCss: [{ file: 'a.css', css: ':root { --font-mono: var(--missing, Menlo), monospace; }' }],
    });
    expect(root.roles.mono!.stack).toEqual(['Menlo', 'monospace']);
  });
});
